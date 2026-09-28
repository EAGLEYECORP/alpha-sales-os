-- ─────────────────────────────────────────────────────────────────────
-- 010 — BYOK : les identifiants apportés par le locataire
--
-- Pourquoi : un compte gratuit ne pouvait appeler que 4 familles d'API sur
-- 20, et la raison n'était pas commerciale — `/api/ai` brûlait NOTRE clé.
-- Ouvrir l'IA au gratuit revenait à donner notre carte bancaire à des
-- inconnus. Cette table est ce qui permet à un locataire de la payer
-- lui-même, chez son fournisseur.
--
-- ⚠⚠ AUCUNE POLICY RLS, ET C'EST LE POINT. RLS est activé, et il n'existe
-- délibérément AUCUNE policy : personne ne lit cette table depuis un JWT
-- client, pas même le propriétaire de la ligne. Il n'a aucun besoin de
-- relire sa clé — il l'a déjà — et une faille XSS dans SON navigateur
-- l'exfiltrerait. On écrit par une route serveur, on ne relit jamais.
-- L'écran des Réglages affiche `empreinte`, qui n'est pas un secret.
--
-- ⚠ Une ligne par CAPACITÉ, pas par variable : un SMTP a besoin de cinq
-- valeurs cohérentes entre elles, et une ligne par variable autoriserait un
-- SMTP à moitié configuré — l'état où l'on croit avoir branché et où rien
-- ne part. (La capacité `email` viendra avec son lot ; voir la contrainte.)
--
-- ⚠ Rejouable : `create table if not exists`, aucun DDL non protégé.
-- ─────────────────────────────────────────────────────────────────────

create table if not exists public.tenant_credentials (
  tenant_id       uuid        not null references auth.users (id) on delete cascade,
  -- ⚠ UNE SEULE VALEUR AUJOURD'HUI. Les quatre autres capacités du chiffrage
  -- (email, sms, transcription, telephonie) viendront avec leur lot, et
  -- ajouteront leur valeur ICI et dans `Capacite` (lib/credentials.ts) dans
  -- le MÊME diff. Un test croise les deux listes : les déclarer d'avance
  -- créerait des valeurs que le code ne sait pas servir, et qu'un lecteur
  -- croirait branchées.
  capacite        text        not null check (capacite in ('ia')),
  secret_chiffre  text        not null,
  nonce           text        not null,
  cle_version     integer     not null default 1,
  -- Les quatre derniers caractères, en clair. Ce n'est pas un secret : c'est
  -- ce qui permet d'afficher « clé … a4f2 » sans jamais redescendre la clé
  -- elle-même dans un navigateur.
  empreinte       text        not null,
  cree_le         timestamptz not null default now(),
  -- ⚠ NULL ⇒ la capacité reste FERMÉE. Une clé jamais testée n'ouvre rien :
  -- sinon on colle une clé fausse, la brique s'ouvre, et le premier vrai
  -- usage échoue devant un prospect — le pire moment pour découvrir une
  -- faute de frappe.
  verifie_le      timestamptz,
  dernier_echec   text,
  primary key (tenant_id, capacite)
);

alter table public.tenant_credentials enable row level security;

-- Pas de `create policy` : voir l'encadré en tête. RLS actif + zéro policy
-- = refus par défaut pour tout JWT client. Seul le service role passe.
