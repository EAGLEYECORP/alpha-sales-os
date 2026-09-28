-- ─────────────────────────────────────────────────────────────────────
-- 009 — LE DESTINATAIRE NORMALISÉ, pour les DEUX canaux
--
-- Pourquoi : `verifieMentions` (lib/conformite.ts) n'exige la mention de
-- provenance qu'au PREMIER message à une personne. Répondre à « lui a-t-on
-- déjà écrit ? » suppose de reconnaître la même personne d'un envoi à
-- l'autre — or `tracking_messages` ne portait qu'une colonne `email`, et la
-- branche SMS n'écrivait rien du tout. Sur le SMS, la question n'avait donc
-- aucune réponse, et l'inconnu valant « premier », CHAQUE SMS exigeait la
-- mention. Un SMS se paie au segment.
--
-- ⚠⚠ POURQUOI UNE COLONNE ET PAS LA RÉUTILISATION DE `email`
-- Stocker un numéro de téléphone dans une colonne nommée `email` marche —
-- `channel` lève l'ambiguïté — et ment à tous ceux qui liront la table
-- ensuite. On a déjà payé une constante à deux sens dans ce dépôt ; une
-- colonne à deux sens coûterait pareil.
--
-- ⚠ `destinataire` porte une valeur NORMALISÉE, jamais la saisie brute :
-- email en minuscules, téléphone en E.164 (`toE164`, lib/voice-script.ts).
-- Sans ça « 04 51 22 21 82 » et « +33451222182 » seraient deux personnes, la
-- reconnaissance échouerait toujours, et la fonctionnalité aurait l'air
-- branchée sans jamais reconnaître personne.
--
-- ⚠ Rejouable : `add column if not exists`, et le backfill est idempotent.
-- ─────────────────────────────────────────────────────────────────────

alter table public.tracking_messages
  add column if not exists destinataire text;

-- Le backfill reprend l'historique email existant. Sans lui, toute adresse
-- déjà contactée avant cette migration repasserait pour un premier contact
-- et recevrait la mention une fois de trop — inoffensif, mais évitable.
--
-- ⚠ Il ne peut PAS reconstituer l'historique SMS : il n'y en a jamais eu.
-- Les numéros déjà démarchés resteront donc « premiers » une dernière fois.
-- C'est le bon sens du repli — on informe une fois de trop, jamais une fois
-- de moins.
update public.tracking_messages
   set destinataire = lower(trim(email))
 where destinataire is null
   and email is not null
   and trim(email) <> '';

-- La question posée est « existe-t-il UNE ligne pour ce destinataire ? »,
-- scopée au locataire. C'est exactement cet index.
create index if not exists tracking_destinataire_idx
  on public.tracking_messages (user_id, channel, destinataire);
