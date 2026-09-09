-- ─────────────────────────────────────────────────────────────────────
-- MIGRATION 003 — L'ORGANISATION : responsables, membres, et ce qu'on voit.
--
-- ── CE QUE ÇA AJOUTE, ET POURQUOI C'EST DÉLICAT ──
--
-- Jusqu'ici, chaque compte était une île : la RLS le limite à ses propres
-- lignes, et c'était TOUT le cloisonnement du produit. Cette migration ouvre
-- une porte dedans, parce qu'un responsable commercial doit voir le pipe de
-- ses vendeurs — sans ça il n'a pas un CRM, il a un carnet privé par personne.
--
-- ⚠ LA RÈGLE VIT DANS `lib/organisation.ts`, PAS ICI. Ce fichier pose la
-- structure et les politiques ; la décision « qui voit quoi » est écrite,
-- commentée et TESTÉE là-bas (`tests/organisation.test.ts`). Deux endroits qui
-- répondent à la même question finissent par diverger, et ici diverger veut
-- dire : un client lit le fichier de prospection d'un autre.
--
-- ── LA DÉCISION CENTRALE, ET ELLE SE VOIT DANS LES POLITIQUES ──
--
-- Un RESPONSABLE voit le CONTENU de ses membres (leurs fiches).
-- NOUS (le maître) ne voyons PAS le contenu — seulement l'exploitation :
-- combien de fiches, quel statut, quelle dernière activité.
--
-- Ce n'est pas de la prudence décorative. Lire le CRM d'un client, c'est lire
-- les nom, téléphone et email de gens qui ne nous connaissent pas : ça fait de
-- nous un SOUS-TRAITANT au sens de l'art. 28 RGPD, ce qui exige un contrat
-- écrit, une finalité déclarée et une durée. Rien de tout ça n'existe. Et
-- l'exploitation suffit : le support et le succès client ont besoin de savoir
-- si le compte tourne, pas du numéro d'un prospect.
--
-- ── COMMENT L'APPLIQUER ──
--
-- Supabase Dashboard → SQL Editor → coller ce fichier entier → Run.
-- Idempotent : le relancer ne casse rien.
--
-- ⚠ NON TESTÉ CONTRE UN VRAI PROJET SUPABASE — l'environnement de
-- développement ne l'atteint pas (le proxy bloque les clés live). Relis la
-- sortie du SQL Editor, et vérifie l'isolation À DEUX COMPTES avant de
-- facturer quoi que ce soit : `supabase/verify-isolation.mjs`.
-- ─────────────────────────────────────────────────────────────────────

create table if not exists public.organisation (
  -- Le compte lui-même.
  tenant_id uuid primary key references auth.users (id) on delete cascade,

  -- « maitre » | « responsable » | « membre ». Même espace de noms que
  -- `RoleCompte` (lib/organisation.ts).
  --
  -- ⚠ Le rôle « maitre » n'est PAS ce qui nous rend maîtres. `estMaitre()`
  -- lit l'email du JETON contre `OWNER_EMAILS`, côté serveur, et
  -- court-circuite la base. Si quelqu'un écrivait 'maitre' dans cette
  -- colonne, il n'obtiendrait rien : la ligne est descriptive, pas
  -- décisionnelle. C'est délibéré — une élévation de privilège ne doit
  -- jamais passer par une table que le produit écrit.
  role text not null default 'responsable' check (role in ('maitre', 'responsable', 'membre')),

  -- Le responsable auquel ce compte est rattaché. NULL pour un maître et pour
  -- un responsable.
  parent_id uuid references auth.users (id) on delete set null,

  -- Nom d'affichage du membre, pour que son responsable le reconnaisse dans
  -- une liste. Pas d'email ici : il vit dans `auth.users`, et le recopier
  -- créerait une seconde vérité à tenir à jour.
  libelle text,

  cree_le timestamptz not null default now(),

  -- ⚠ UN SEUL NIVEAU DE RATTACHEMENT. Un membre ne peut pas avoir de membres.
  -- Autoriser une chaîne (A pilote B qui pilote C) rendrait « qui voit quoi »
  -- récursif, donc invérifiable d'un coup d'œil. Une hiérarchie profonde
  -- s'ajoutera si un client la demande — jamais « au cas où », sur le mur qui
  -- protège tout.
  constraint parent_seulement_pour_membre check (
    (role = 'membre' and parent_id is not null)
    or (role <> 'membre' and parent_id is null)
  ),

  -- Et personne ne se rattache à soi-même : ce serait une boucle qui rendrait
  -- toute traversée infinie.
  constraint pas_son_propre_parent check (parent_id is null or parent_id <> tenant_id)
);

create index if not exists organisation_parent_idx on public.organisation (parent_id);

alter table public.organisation enable row level security;

-- ── Lecture : sa propre ligne, et celles de ses membres ──
--
-- ⚠ ON NE MET PAS DE POLITIQUE « le maître lit tout » ICI, et c'est
-- volontaire. Le maître passe par le SERVICE ROLE côté serveur (qui contourne
-- la RLS de toute façon) et son accès est filtré EN SORTIE par
-- `filtrerExploitation` — une liste blanche de champs. Écrire une politique
-- « maître » en SQL ferait dépendre notre accès d'une valeur en base plutôt
-- que de `OWNER_EMAILS`, c'est-à-dire déplacerait la décision d'élévation de
-- privilège dans une table.
drop policy if exists "organisation_lecture" on public.organisation;
create policy "organisation_lecture" on public.organisation
  for select using (
    tenant_id = auth.uid()
    or parent_id = auth.uid()
  );

-- ── Écriture : un responsable gère SES membres, et personne d'autre ──
--
-- ⚠ `with check` ET `using` — les deux, et pas seulement le premier. `using`
-- décide quelles lignes on peut TOUCHER ; `with check` décide de ce que la
-- ligne a le droit de DEVENIR. Sans `with check`, un responsable pourrait
-- prendre un de ses membres et le rattacher à quelqu'un d'autre — ou se
-- promouvoir. C'est l'oubli classique sur une politique d'update.
drop policy if exists "organisation_creation_membre" on public.organisation;
create policy "organisation_creation_membre" on public.organisation
  for insert with check (
    role = 'membre' and parent_id = auth.uid()
  );

drop policy if exists "organisation_maj_membre" on public.organisation;
create policy "organisation_maj_membre" on public.organisation
  for update
  using (parent_id = auth.uid())
  with check (role = 'membre' and parent_id = auth.uid());

drop policy if exists "organisation_suppression_membre" on public.organisation;
create policy "organisation_suppression_membre" on public.organisation
  for delete using (parent_id = auth.uid());

-- ─────────────────────────────────────────────────────────────────────
-- L'ACCÈS SUPPORT AU CONTENU — la porte qu'on conçoit AVANT d'en avoir besoin.
--
-- Elle n'est pas ouverte. Elle est écrite maintenant parce que le besoin
-- arrivera un mardi soir, avec un client au téléphone et une envie de faire
-- vite : le pire moment pour concevoir une exception.
--
-- Les quatre conditions sont cumulatives, et la quatrième NE SE CODE PAS :
--   1. le client a consenti, DEPUIS SON COMPTE ;
--   2. le consentement porte une date de fin ;
--   3. l'accès est journalisé ;
--   4. un contrat de sous-traitance (art. 28 RGPD) est signé avec ce client.
--
-- `lib/organisation.ts` → `accesContenuAutorise` les vérifie toutes, et rend
-- `false` tant qu'une seule manque.
-- ─────────────────────────────────────────────────────────────────────
create table if not exists public.acces_support (
  tenant_id uuid primary key references auth.users (id) on delete cascade,
  -- Le client a ouvert l'accès lui-même. Jamais posé par nous.
  consenti boolean not null default false,
  -- Un accès sans terme n'est pas un dépannage, c'est un abonnement à ses
  -- données. NULL = pas d'accès, quelle que soit la valeur de `consenti`.
  expire_le timestamptz,
  -- Le contrat existe-t-il ? Coché à la main, par nous, après signature.
  -- ⚠ Cette colonne ne PROUVE rien : elle sert à ce qu'on ne puisse pas
  -- l'oublier en croyant que le code s'en occupe.
  contrat_sous_traitance boolean not null default false,
  maj_le timestamptz not null default now()
);

alter table public.acces_support enable row level security;

-- Le client lit et écrit SON consentement. Lui seul.
drop policy if exists "acces_support_par_le_client" on public.acces_support;
create policy "acces_support_par_le_client" on public.acces_support
  for all using (tenant_id = auth.uid()) with check (tenant_id = auth.uid());

-- ── Le journal des accès support — sans lui, le consentement ne vaut rien ──
--
-- ⚠ Un consentement dont l'usage n'est pas tracé est une signature sur un
-- chèque en blanc : le client a dit oui, et personne — lui compris — ne peut
-- savoir ce qui a été regardé, quand, ni par qui. Le journal est ce qui rend
-- le consentement vérifiable.
create table if not exists public.journal_acces_support (
  id uuid primary key default gen_random_uuid(),
  -- Le compte REGARDÉ.
  tenant_id uuid not null references auth.users (id) on delete cascade,
  -- Qui a regardé (notre compte).
  operateur_id uuid references auth.users (id) on delete set null,
  -- Ce qui a été consulté, en clair et court : « fiches », « campagnes »…
  objet text not null,
  -- Pourquoi. Un accès sans motif écrit se justifie après coup.
  motif text,
  le timestamptz not null default now()
);

create index if not exists journal_acces_tenant_idx on public.journal_acces_support (tenant_id, le desc);

alter table public.journal_acces_support enable row level security;

-- ⚠ LE CLIENT LIT LE JOURNAL DE SON PROPRE COMPTE, ET NE PEUT PAS L'ÉCRIRE.
-- C'est l'inverse de l'intuition : c'est le regardé qui doit pouvoir lire, et
-- personne (nous compris, via cette politique) qui doit pouvoir modifier. Les
-- écritures passent par le service role côté serveur. Un journal que le
-- surveillé ne peut pas lire ne le protège pas ; un journal que le surveillant
-- peut réécrire ne prouve rien.
drop policy if exists "journal_lecture_par_le_client" on public.journal_acces_support;
create policy "journal_lecture_par_le_client" on public.journal_acces_support
  for select using (tenant_id = auth.uid());
