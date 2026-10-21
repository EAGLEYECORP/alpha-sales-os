#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────
# REJOUER LE LOT À COLLER SUR UN VRAI POSTGRES — l'artefact tel qu'on le colle.
#
#   bash scripts/rejouer-lot.sh
#
# `supabase/migrations/LOT-A-COLLER.sql` est ce que Zakaria colle dans l'éditeur
# SQL de production. `tests/migrations-lot.test.ts` vérifie qu'il correspond au
# générateur — il ne l'EXÉCUTE pas. Ce script le fait : sur une base neuve, DEUX
# fois (un lot « colle et oublie » doit être rejouable), puis un parcours de bout
# en bout : inscription → essai ouvert → débit → compteur de l'enveloppe.
#
# ⚠ Ce que ça NE prouve PAS : le comportement d'un projet Supabase hébergé (ses
# rôles réels, ses extensions, son PostgREST). Le décor `auth` / `storage` est
# IMITÉ ; il reproduit ce que le lot référence, rien de plus.
# ─────────────────────────────────────────────────────────────────────
set -euo pipefail

B=/usr/lib/postgresql/16/bin
R="$(cd "$(dirname "$0")/.." && pwd)"
D="/tmp/pg-lot-$$"
PORT=54330
ECHECS=0

[ -x "$B/initdb" ] || { echo "⚠ Postgres 16 introuvable : $B/initdb"; exit 2; }
[ "$(id -u)" = 0 ] || { echo "⚠ à lancer en root (runuser donne la main à l'utilisateur postgres)."; exit 2; }

nettoyer() {
  runuser -u postgres -- "$B/pg_ctl" -D "$D/data" -m immediate stop >/dev/null 2>&1 || true
  rm -rf "$D"
}
trap nettoyer EXIT

mkdir "$D" && chown postgres "$D"
runuser -u postgres -- "$B/initdb" -D "$D/data" -A trust -U postgres >/dev/null
runuser -u postgres -- "$B/pg_ctl" -D "$D/data" -o "-p $PORT -k $D -c listen_addresses='' -c fsync=off" -l "$D/log" -w start >/dev/null
P=("$B/psql" -h "$D" -p "$PORT" -U postgres -v ON_ERROR_STOP=1 -q)
"${P[@]}" -d postgres -c "create database alpha" >/dev/null
P+=(-d alpha)

verdict() { if [ "$2" = 1 ]; then echo "  ✓ $1"; else echo "  ✗ $1"; ECHECS=$((ECHECS + 1)); fi; }
val() { "${P[@]}" -At -c "$1"; }

echo "── décor imité : rôles, auth.users, auth.uid(), storage"
"${P[@]}" >/dev/null <<'SQL'
create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
create schema auth;
create table auth.users (
  id uuid primary key default gen_random_uuid(), email text,
  created_at timestamptz default now(), last_sign_in_at timestamptz, email_confirmed_at timestamptz);
create function auth.uid() returns uuid language sql stable
  as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
grant usage on schema auth to anon, authenticated, service_role;
create schema storage;
create table storage.buckets (id text primary key, name text, public boolean);
create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text, name text, owner uuid);
alter table storage.objects enable row level security;
create function storage.foldername(name text) returns text[] language sql immutable
  as $$ select string_to_array(name, '/') $$;
SQL

echo "── le lot, première fois"
"${P[@]}" -f "$R/supabase/migrations/LOT-A-COLLER.sql" >"$D/lot1.out" 2>"$D/lot1.err" \
  && verdict "le lot passe sur une base neuve" 1 \
  || { verdict "le lot passe sur une base neuve" 0; head -5 "$D/lot1.err"; }

echo "── le lot, DEUXIÈME fois (rejouable : un lot « colle et oublie »)"
"${P[@]}" -f "$R/supabase/migrations/LOT-A-COLLER.sql" >"$D/lot2.out" 2>"$D/lot2.err" \
  && verdict "le lot se rejoue sans erreur" 1 \
  || { verdict "le lot se rejoue sans erreur" 0; head -5 "$D/lot2.err"; }

echo "── parcours de bout en bout, avec les triggers de la production en place"
TRIG=$(val "select string_agg(tgname, ', ' order by tgname) from pg_trigger where tgrelid = 'public.entitlements'::regclass and not tgisinternal")
echo "  triggers sur entitlements : $TRIG"
verdict "le trigger d'attribution (007) ET celui du compteur (018) coexistent" "$(echo "$TRIG" | grep -q entitlements_attribution_immuable && echo "$TRIG" | grep -q entitlements_enveloppe && echo 1 || echo 0)"

U=$(val "insert into auth.users(email) values ('nouveau@example.test') returning id")
LIGNE=$(val "select statut||'|'||coalesce(cout_consomme_eur::text,'NULL') from public.entitlements where tenant_id = '$U'")
verdict "une inscription ouvre un essai à coût 0 (vu : $LIGNE)" "$([ "$LIGNE" = "essai|0.00" ] && echo 1 || echo 0)"
verdict "…sans toucher le compteur (delta nul)" "$([ "$(val 'select cout_global_essais()')" = "0.00" ] && echo 1 || echo 0)"

"${P[@]}" -c "select public.debiter_essai('$U', 0.5)" >/dev/null
verdict "un débit de 0,50 € passe malgré le trigger d'attribution" "$([ "$(val "select cout_consomme_eur from public.entitlements where tenant_id = '$U'")" = "0.50" ] && echo 1 || echo 0)"
verdict "…et le compteur le voit" "$([ "$(val 'select cout_global_essais()')" = "0.50" ] && echo 1 || echo 0)"
verdict "compteur = somme (écart $(val 'select ecart from public.ecart_enveloppe_essais()'))" "$([ "$(val 'select ecart from public.ecart_enveloppe_essais()')" = "0.00" ] && echo 1 || echo 0)"

"${P[@]}" -c "update public.entitlements set statut = 'actif' where tenant_id = '$U'" >/dev/null
verdict "un compte qui PAIE sort de l'enveloppe" "$([ "$(val 'select cout_global_essais()')" = "0.00" ] && echo 1 || echo 0)"

"${P[@]}" -c "delete from auth.users where id = '$U'" >/dev/null
verdict "supprimer le compte (cascade) laisse un compteur cohérent" "$([ "$(val 'select ecart from public.ecart_enveloppe_essais()')" = "0.00" ] && echo 1 || echo 0)"

ANON=$("${P[@]}" -At -c "set role anon; select count(*) from public.enveloppe_essais" 2>&1 || true)
echo "  anon → enveloppe_essais : $ANON"
verdict "anon ne lit PAS le budget d'acquisition" "$(echo "$ANON" | grep -q 'permission denied' && echo 1 || echo 0)"
LOC=$("${P[@]}" -At -c "set role authenticated; select public.cout_global_essais()" 2>&1 || true)
echo "  authenticated → cout_global_essais() : $LOC"
verdict "un locataire connecté non plus" "$(echo "$LOC" | grep -q 'permission denied' && echo 1 || echo 0)"
PRIV=$("${P[@]}" -At -c "select string_agg(grantee||':'||privilege_type, ', ') from information_schema.role_table_grants where table_name='enveloppe_essais'" 2>&1 || true)
echo "  privilèges sur enveloppe_essais : ${PRIV:-aucun}"

echo
[ "$ECHECS" = 0 ] && echo "LE LOT TIENT." || { echo "$ECHECS PREUVE(S) EN ÉCHEC."; exit 1; }
