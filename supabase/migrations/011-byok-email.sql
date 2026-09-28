-- ─────────────────────────────────────────────────────────────────────
-- 011 — BYOK : la capacité `email`
--
-- Le lot L2. Un locataire peut apporter son SMTP : ses emails partent de SON
-- domaine, sous SA réputation, et il ne touche jamais la nôtre.
--
-- ⚠ La contrainte grandit EN MÊME TEMPS que le type `Capacite`
-- (lib/credentials.ts), dans le même diff — un test croise les deux listes.
-- Une valeur ajoutée d'un seul côté donne soit une capacité que la base
-- refuse d'écrire, soit une valeur en base que le code ne sait pas servir.
--
-- ⚠ Rejouable : on retire la contrainte avant de la reposer, et les deux
-- ordres sont gardés.
-- ─────────────────────────────────────────────────────────────────────

alter table public.tenant_credentials
  drop constraint if exists tenant_credentials_capacite_check;

alter table public.tenant_credentials
  add constraint tenant_credentials_capacite_check
  check (capacite in ('ia', 'email'));
