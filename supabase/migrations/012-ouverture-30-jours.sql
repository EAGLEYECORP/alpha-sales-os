-- ─────────────────────────────────────────────────────────────────────
-- L'OUVERTURE 30 JOURS — le démarreur et le compteur qui n'existaient pas.
--
-- ⚠⚠ CE QUE LA MIGRATION 008 A LAISSÉ OUVERT, ET QUI ANNULAIT TOUT.
--
-- 008 a créé `cout_consomme_eur` avec un défaut `null`, et `etatEssai()`
-- FERME l'essai sur `null` — l'inconnu vaut refus. Le raisonnement était bon.
-- Ce qui manquait, ce sont les deux bouts :
--
--  · **personne n'écrivait jamais cette colonne.** Zéro appelant dans tout le
--    dépôt, vérifié. Donc aucune ligne ne passait jamais de `null` à un
--    nombre ;
--  · **personne n'ouvrait jamais d'essai.** `droitsPourOffre` rend
--    `statut: "actif", essai_jusqu_a: null` sur toutes les offres, et
--    `finDEssai()` n'était importée par aucun fichier de production.
--
-- Résultat mesuré : un essai posé à la main retombait au socle gratuit **le
-- jour même**, parce que son compteur valait `null`. L'essai trente jours ne
-- s'était jamais ouvert une seule fois. Une garde fail-closed posée sur un
-- compteur inexistant ne protège rien — elle interdit tout, en silence.
--
-- ⚠ AUCUNE LISTE DE BRIQUES N'EST ÉCRITE ICI, et c'est volontaire.
-- Le démarreur pose `bricks = '{}'` : ce que l'essai OUVRE se dérive côté
-- TypeScript (`BRIQUES_ESSAI`, soit tout le catalogue moins `HORS_ESSAI`).
-- Recopier la liste en SQL créerait une seconde définition du périmètre de
-- l'essai, et c'est celle qu'on ne relit pas — le SQL — qui gagnerait, parce
-- qu'elle s'exécute en premier. Même règle que le plafond, que 008 refuse
-- déjà de recopier, et que la fenêtre d'appel, qu'un test interdit au SQL de
-- redéfinir.
-- Conséquence concrète et voulue : une ligne d'essai écrite à la main avec
-- `bricks = '{alpha-voice}'` n'ouvre PAS la téléphonie. Le périmètre est tenu
-- par le code, pas par ce qui se trouve dans la colonne.
--
-- ⚠ NON TESTÉ CONTRE UN VRAI PROJET SUPABASE — le proxy sortant ne l'atteint
-- pas depuis l'environnement de développement. Relis la sortie du SQL Editor
-- plutôt que de supposer que ça a marché.
-- ─────────────────────────────────────────────────────────────────────

-- ── 1. LE COMPTEUR : un incrément ATOMIQUE ────────────────────────────
--
-- ⚠⚠ POURQUOI UNE FONCTION ET PAS UN `update` DEPUIS LE CODE.
-- Lire la valeur, ajouter, réécrire : deux appels simultanés du même compte
-- lisent tous deux 12,00 et écrivent tous deux 12,50. Une des deux dépenses
-- disparaît. Sur une boucle d'appels — exactement le cas que le plafond
-- existe pour borner — la fuite est proportionnelle au débit. L'addition doit
-- se faire DANS la base, en une instruction.
--
-- ⚠ `coalesce(…, 0)` sur la valeur courante : une ligne d'essai posée sans
-- compteur vaut `null`, et `null + 0,50` vaut `null` en SQL. Sans ce
-- coalesce, débiter un compte au compteur inconnu le laisserait inconnu —
-- donc fermé pour toujours, sans que rien ne le dise.
create or replace function public.debiter_essai(p_tenant uuid, p_montant numeric)
returns numeric
language sql
security definer
set search_path = public
as $$
  update public.entitlements
     set cout_consomme_eur = coalesce(cout_consomme_eur, 0) + p_montant,
         updated_at = now()
   where tenant_id = p_tenant
  returning cout_consomme_eur;
$$;

-- Le service role seul. Un client qui pourrait appeler cette fonction
-- pourrait aussi débiter le compteur d'un autre — ou le sien à zéro.
revoke all on function public.debiter_essai(uuid, numeric) from public, anon, authenticated;

-- ── 2. LE DÉMARREUR : tout nouveau compte entre en essai ──────────────
--
-- ⚠ `cout_consomme_eur = 0` EXPLICITEMENT, jamais le défaut de la colonne.
-- C'est LE piège de cette migration : le défaut est `null`, `null` ferme
-- l'essai, donc un démarreur qui se contente d'écrire `statut = 'essai'`
-- crée un essai mort-né. Le `0` dit « ce compte n'a rien consommé » là où
-- `null` dit « on ne sait pas », et ces deux phrases mènent à des décisions
-- opposées.
--
-- ⚠ `on conflict do nothing` : un compte qui a DÉJÀ une ligne — un client qui
-- paie, un essai déjà consommé, un compte suspendu — n'est jamais remis en
-- essai. Sans cette clause, une réexécution de la migration rouvrirait
-- trente jours pleins à tout le monde, y compris à ceux qui ont épuisé leur
-- plafond. Un essai se donne une fois.
create or replace function public.ouvrir_essai_nouveau_compte()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.entitlements (tenant_id, bricks, statut, essai_jusqu_a, cout_consomme_eur)
  values (new.id, '{}', 'essai', now() + interval '30 days', 0)
  on conflict (tenant_id) do nothing;
  return new;
end;
$$;

-- ⚠ La DURÉE est écrite ici en clair (30 jours) alors que `DUREE_ESSAI_JOURS`
-- l'est aussi côté TypeScript. C'est la seule recopie que cette migration
-- s'autorise, et elle n'est pas gratuite : `tests/essai.test.ts` croise les
-- deux et tombe si elles divergent. La raison de ne pas l'éviter : un trigger
-- ne peut pas importer une constante, et la seule alternative — laisser le
-- code poser la date à l'inscription — ferait dépendre l'ouverture d'un
-- appel applicatif qui peut ne pas avoir lieu. Le trigger, lui, ne se saute
-- pas.

drop trigger if exists ouvrir_essai_a_l_inscription on auth.users;
create trigger ouvrir_essai_a_l_inscription
  after insert on auth.users
  for each row execute function public.ouvrir_essai_nouveau_compte();

-- ── 3. LES COMPTES DÉJÀ INSCRITS ──────────────────────────────────────
--
-- Le trigger ne vaut que pour l'avenir. Ceux qui se sont inscrits avant
-- l'ouverture n'auraient jamais d'essai — et ce sont précisément les premiers
-- arrivés. Ils reçoivent trente jours à compter de MAINTENANT, pas de leur
-- inscription : un essai rétroactif déjà expiré est une insulte polie.
--
-- ⚠ Seuls les comptes SANS ligne du tout. On ne touche à aucun statut
-- existant : un client qui paie ne doit pas être rétrogradé en essai par une
-- migration, et un compte suspendu ne se rouvre pas par un script.
insert into public.entitlements (tenant_id, bricks, statut, essai_jusqu_a, cout_consomme_eur)
select u.id, '{}', 'essai', now() + interval '30 days', 0
  from auth.users u
 where not exists (select 1 from public.entitlements e where e.tenant_id = u.id)
on conflict (tenant_id) do nothing;

-- Sommer l'enveloppe sans balayer toute la table : la somme se lit à chaque
-- résolution de droits d'un compte en essai, donc très souvent.
create index if not exists entitlements_essai_statut_idx
  on public.entitlements (statut)
  where statut = 'essai';

comment on function public.debiter_essai(uuid, numeric) is
  'Incremente atomiquement le cout consomme d''un essai. Service role seul. '
  'Voir lib/compteur-essai.ts : un debit qui echoue doit REFUSER la depense.';
