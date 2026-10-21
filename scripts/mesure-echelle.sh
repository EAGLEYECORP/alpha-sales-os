#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────
# MESURER L'ÉCHELLE SUR UN VRAI POSTGRES — rejouable, hors du produit.
#
#   bash scripts/mesure-echelle.sh [TAILLE]          (défaut : 1 000 000 de comptes)
#
# Ce que ça fait, dans l'ordre :
#   1. monte un Postgres 16 JETABLE (/tmp, supprimé en sortant), avec un décor
#      `auth` imité, et y rejoue les VRAIES migrations 002 · 008 · 012 · 017 ;
#   2. y crée TAILLE comptes (le trigger d'inscription tourne à chaque ligne) ;
#   3. mesure l'ANCIEN état : tout rapatrier, la somme, `adoption_stats` ;
#   4. applique 018-echelle.sql, puis PROUVE :
#        · `adoption_stats` rend EXACTEMENT la même chose qu'avant ;
#        · le compteur de l'enveloppe égale la somme, après des milliers
#          d'opérations aléatoires (débits, passages en « actif », suppressions,
#          nouvelles inscriptions, compteurs à null) ;
#        · des débits CONCURRENTS (pgbench, une transaction chacun) ne perdent
#          rien et ne se bloquent pas ;
#        · l'inscription reste plate.
#
# ⚠ Ce que ça NE mesure PAS, et il faut le dire : ni Supabase hébergé (son
# PostgREST, son pool de connexions, ses limites de plan), ni Vercel, ni le SMTP.
# C'est la couche SQL que nous écrivons, pas l'infrastructure qui l'entoure.
#
# Il faut root (postgres refuse de tourner en root : on lui passe la main par
# `runuser`) et les binaires de /usr/lib/postgresql/16/bin.
# ─────────────────────────────────────────────────────────────────────
set -euo pipefail

N="${1:-1000000}"
B=/usr/lib/postgresql/16/bin
R="$(cd "$(dirname "$0")/.." && pwd)"
D="/tmp/pg-echelle-$$"
PORT=54329
ECHECS=0

[ -x "$B/initdb" ] || { echo "⚠ $B/initdb introuvable : Postgres 16 n'est pas installé ici."; exit 2; }
[ "$(id -u)" = 0 ] || { echo "⚠ à lancer en root (runuser donne la main à l'utilisateur postgres)."; exit 2; }

nettoyer() {
  runuser -u postgres -- "$B/pg_ctl" -D "$D/data" -m immediate stop >/dev/null 2>&1 || true
  rm -rf "$D"
}
trap nettoyer EXIT

mkdir "$D" && chown postgres "$D"
runuser -u postgres -- "$B/initdb" -D "$D/data" -A trust -U postgres >/dev/null
runuser -u postgres -- "$B/pg_ctl" -D "$D/data" \
  -o "-p $PORT -k $D -c listen_addresses='' -c fsync=off -c synchronous_commit=off -c shared_buffers=256MB -c max_connections=60" \
  -l "$D/log" -w start >/dev/null

PSQL=("$B/psql" -h "$D" -p "$PORT" -U postgres -v ON_ERROR_STOP=1 -q)
"${PSQL[@]}" -d postgres -c "create database alpha" >/dev/null
P=("${PSQL[@]}" -d alpha)

verdict() { # $1 = libellé, $2 = 0|1 (1 = vrai)
  if [ "$2" = 1 ]; then echo "  ✓ $1"; else echo "  ✗ $1"; ECHECS=$((ECHECS + 1)); fi
}
ms() { "${P[@]}" -At -c '\timing on' -c "$1" 2>&1 | grep -E '^Time:' | sed 's/Time: //; s/ ms.*//' | tail -1; }
val() { "${P[@]}" -At -c "$1"; }

echo "── 1. banc : Postgres $("$B/postgres" --version | awk '{print $3}'), décor auth imité, migrations 002 · 008 · 012 · 017"
"${P[@]}" >/dev/null <<'SQL'
create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
create schema auth;
create table auth.users (
  id uuid primary key default gen_random_uuid(), email text,
  created_at timestamptz default now(), last_sign_in_at timestamptz, email_confirmed_at timestamptz);
create function auth.uid() returns uuid language sql stable
  as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
grant usage on schema auth to anon, authenticated, service_role;
SQL
for m in 002-entitlements 008-essai-plafond-cout 012-ouverture-30-jours 017-adoption; do
  "${P[@]}" -f "$R/supabase/migrations/$m.sql" >/dev/null
done

echo "── 2. $N comptes, le trigger d'inscription tourne à chaque ligne"
t0=$(date +%s%N)
"${P[@]}" -c "insert into auth.users(email) select 'u'||g||'@example.test' from generate_series(1,$N) g"
t1=$(date +%s%N)
US_AVANT=$(( (t1 - t0) / 1000 / N ))
echo "  inscription : ${US_AVANT} µs par compte (moyenne sur $N)"

# Des données qui ressemblent à une vraie base : dates étalées, confirmations, connexions, adresses nulles.
"${P[@]}" -c "update auth.users set
    created_at = now() - (random() * interval '60 days'),
    email_confirmed_at = case when random() < 0.7 then now() - (random() * interval '60 days') end,
    last_sign_in_at = case when random() < 0.4 then now() - (random() * interval '40 days') end,
    email = case when random() < 0.001 then null else email end"
"${P[@]}" -c "update public.entitlements set cout_consomme_eur = round((random() * 5)::numeric, 2)
               where cout_consomme_eur = 0 and random() < 0.3"
"${P[@]}" -c "vacuum analyze auth.users"
"${P[@]}" -c "vacuum analyze public.entitlements"

echo "── 3. L'ANCIEN ÉTAT"
OLD_ALL=$(ms "\\copy (select cout_consomme_eur from public.entitlements where statut='essai') to '/dev/null'")
OLD_SUM=$(ms "select coalesce(sum(cout_consomme_eur),0) from public.entitlements where statut='essai'")
EX="array['U5@EXAMPLE.TEST','u77@example.test','absent@nulle.part']"
OLD_ADO=$(ms "select public.adoption_stats($EX)")
# ⚠ On garde la fonction ANCIENNE vivante sous un autre nom, au lieu d'en figer un résultat :
# ces compteurs dépendent de now() (« inscrits dans la dernière heure »). Comparer un JSON figé
# à l'étape 3 avec un JSON calculé plusieurs minutes plus tard échoue pour de mauvaises raisons —
# quelques lignes ont franchi la frontière entre les deux appels. Deux fonctions, UNE instruction :
# même now(), même données.
DEF=$("${P[@]}" -At -c "select pg_get_functiondef('public.adoption_stats(text[])'::regprocedure)")
printf '%s\n' "${DEF//adoption_stats/adoption_stats_ancienne}" | "${P[@]}" >/dev/null
printf "  tout rapatrier (ce que faisait l'application) : %s ms\n  somme en base                                 : %s ms\n  adoption_stats                                : %s ms\n" "$OLD_ALL" "$OLD_SUM" "$OLD_ADO"

echo "── 4. migration 018"
"${P[@]}" -f "$R/supabase/migrations/018-echelle.sql" >/dev/null
echo "  (rejouable : on la rejoue pour le vérifier)"
"${P[@]}" -f "$R/supabase/migrations/018-echelle.sql" >/dev/null
verdict "018 rejouée sans erreur" 1

echo "── 5. PREUVES"
NEW_ADO=$(ms "select public.adoption_stats($EX)")
EGAL=$(val "select (public.adoption_stats_ancienne($EX) = public.adoption_stats($EX))::int")
verdict "adoption_stats rend EXACTEMENT le même JSON que l'ancienne version, mêmes données, même instant ($OLD_ADO ms → $NEW_ADO ms)" "$EGAL"
EGAL1=$(val "select (public.adoption_stats_ancienne('{}') = public.adoption_stats('{}'))::int")
verdict "…et sans aucune exclusion" "$EGAL1"
EGAL2=$(val "select (public.adoption_stats_ancienne(array['u1@example.test','U2@EXAMPLE.TEST','u3@example.test']) = public.adoption_stats(array['u1@example.test','U2@EXAMPLE.TEST','u3@example.test']))::int")
verdict "…et avec des exclusions en casse mélangée" "$EGAL2"
EGAL0=$(val "select (public.adoption_stats('{}') ->> 'total')::bigint = (select count(*) from auth.users)")
[ "$EGAL0" = "t" ] && EGAL0=1 || EGAL0=0
verdict "sans exclusion, 'total' = tous les comptes" "$EGAL0"
NUL=$(val "select (public.adoption_stats(array[null,'u5@example.test']) ->> 'total')::bigint > 0")
[ "$NUL" = "t" ] && NUL=1 || NUL=0
verdict "une exclusion null ne vide plus tout" "$NUL"

CNT=$(ms "select public.cout_global_essais()")
printf "  cout_global_essais() : %s ms (ancienne somme : %s ms)\n" "$CNT" "$OLD_SUM"
ECART0=$(val "select ecart from public.ecart_enveloppe_essais()")
verdict "compteur = somme au sortir de la migration (écart $ECART0)" "$([ "$ECART0" = "0.00" ] || [ "$ECART0" = "0" ] && echo 1 || echo 0)"

echo "  … 20 000 débits, 5 000 passages en « actif », 2 000 retours en essai, 1 000 compteurs à null,"
echo "    3 000 suppressions de comptes (cascade), 5 000 nouvelles inscriptions"
"${P[@]}" >/dev/null <<'SQL'
select public.debiter_essai(tenant_id, round((random() * 2)::numeric, 2))
  from (select tenant_id from public.entitlements order by random() limit 20000) t;
update public.entitlements set statut = 'actif'
 where tenant_id in (select tenant_id from public.entitlements where statut = 'essai' order by random() limit 5000);
update public.entitlements set statut = 'essai'
 where tenant_id in (select tenant_id from public.entitlements where statut = 'actif' order by random() limit 2000);
update public.entitlements set cout_consomme_eur = null
 where tenant_id in (select tenant_id from public.entitlements order by random() limit 1000);
delete from auth.users where id in (select id from auth.users order by random() limit 3000);
insert into auth.users(email) select 'neuf'||g||'@example.test' from generate_series(1, 5000) g;
SQL
ECART=$(val "select ecart from public.ecart_enveloppe_essais()")
verdict "après ces opérations, compteur = somme (écart $ECART)" "$([ "$ECART" = "0.00" ] || [ "$ECART" = "0" ] && echo 1 || echo 0)"

echo "  … débits CONCURRENTS : 16 clients, une transaction par débit, 4 000 débits chacun"
"${P[@]}" -c "create table public.mesure_tenants as select tenant_id, row_number() over () as k
                from (select tenant_id from public.entitlements where statut = 'essai' limit 2000) t"
cat > "$D/debit.sql" <<'SQL'
\set k random(1, 2000)
select public.debiter_essai((select tenant_id from public.mesure_tenants where k = :k), 0.01);
SQL
SOMME_AVANT=$(val "select coalesce(sum(cout_consomme_eur),0) from public.entitlements where statut='essai'")
"$B/pgbench" -h "$D" -p "$PORT" -U postgres -n -f "$D/debit.sql" -c 16 -j 4 -t 4000 alpha 2>&1 \
  | grep -E "number of failed|tps =|latency average" | sed 's/^/    /'
SOMME_APRES=$(val "select coalesce(sum(cout_consomme_eur),0) from public.entitlements where statut='essai'")
ATTENDU=$(val "select ($SOMME_AVANT + 16 * 4000 * 0.01)::numeric(14,2)")
verdict "64 000 débits concurrents : aucun perdu (attendu $ATTENDU, obtenu $SOMME_APRES)" "$([ "$ATTENDU" = "$SOMME_APRES" ] && echo 1 || echo 0)"
ECART2=$(val "select ecart from public.ecart_enveloppe_essais()")
verdict "…et le compteur suit toujours (écart $ECART2)" "$([ "$ECART2" = "0.00" ] || [ "$ECART2" = "0" ] && echo 1 || echo 0)"

echo "  … l'inscription reste PLATE avec le trigger du compteur"
t0=$(date +%s%N)
"${P[@]}" -c "insert into auth.users(email) select 'apres'||g||'@example.test' from generate_series(1, 50000) g"
t1=$(date +%s%N)
US_APRES=$(( (t1 - t0) / 1000 / 50000 ))
printf "  inscription : %s µs par compte (avant 018 : %s µs)\n" "$US_APRES" "$US_AVANT"
verdict "le trigger du compteur ne ralentit pas l'inscription de plus de 2× ($US_APRES µs vs $US_AVANT µs)" "$([ "$US_APRES" -le $(( US_AVANT * 2 + 20 )) ] && echo 1 || echo 0)"

echo
printf "RÉSUMÉ @ %s comptes : somme %s ms → compteur %s ms · adoption_stats %s ms → %s ms · inscription %s → %s µs\n" \
  "$N" "$OLD_SUM" "$CNT" "$OLD_ADO" "$NEW_ADO" "$US_AVANT" "$US_APRES"
[ "$ECHECS" = 0 ] && echo "TOUT TIENT." || { echo "$ECHECS PREUVE(S) EN ÉCHEC."; exit 1; }
