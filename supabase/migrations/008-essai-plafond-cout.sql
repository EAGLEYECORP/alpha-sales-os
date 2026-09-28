-- ─────────────────────────────────────────────────────────────────────
-- L'ESSAI 30 JOURS A DEUX LIMITES, ET LA BASE N'EN CONNAISSAIT QU'UNE.
--
-- `entitlements` portait déjà `statut = 'essai'` et `essai_jusqu_a` : la
-- dimension TEMPS était complète. Il manquait la dimension COÛT, qui est le
-- seul vrai risque.
--
-- ⚠⚠ POURQUOI LA DURÉE SEULE NE SUFFIT PAS. Les briques ouvertes pendant
-- l'essai DÉPENSENT chez nous — SMTP, minutes LiveKit/Telnyx, jetons IA — et
-- il n'existe aucun chemin d'identifiants par locataire. Un essai borné par le
-- seul calendrier, c'est notre carte bancaire confiée à un inconnu pendant
-- trente jours, et ça ne se voit que sur la facture, un mois plus tard. Un
-- compte motivé consomme en deux jours ce qu'on comptait donner en trente.
--
-- Le plafond et sa dérivation vivent dans `lib/essai.ts` (ancré sur le coût
-- MESURÉ du palier d'entrée). Le SQL ne le recopie PAS : deux définitions du
-- même seuil finiraient par diverger, et c'est celle qu'on ne relit pas — le
-- SQL — qui ferait foi parce qu'elle s'exécute en premier. Même règle que la
-- fenêtre d'appel, qu'un test interdit déjà au SQL de redéfinir.
--
-- ⚠ DÉFAUT `null` ET NON `0`, et ce n'est pas un détail. `0` affirmerait « ce
-- compte n'a rien consommé » ; `null` dit « on ne sait pas ». `etatEssai()`
-- FERME l'essai sur `null` — l'inconnu vaut refus quand l'erreur coûte plus
-- cher que l'abstention. Mettre `0` par défaut ouvrirait l'essai en grand sur
-- une colonne jamais alimentée.
-- ─────────────────────────────────────────────────────────────────────

alter table public.entitlements
  add column if not exists cout_consomme_eur numeric(10, 2) default null;

comment on column public.entitlements.cout_consomme_eur is
  'Coût REEL consomme pendant l''essai, en euros (nos couts, pas le prix client). '
  'NULL = inconnu, et l''inconnu ferme l''essai (voir lib/essai.ts). '
  'Le plafond n''est PAS ici : une seule definition, cote TypeScript.';
