# Compte ScintIA — loger le pipe de juillet

> Décision : le pipeline réel de juillet 2026 (16 fiches Lyon —
> `lib/pipeline-juillet.ts`) appartient à **ScintIA / Callflow**, pas à
> EAGLEYE. On crée donc un **compte ScintIA** et on y met ce pipe. C'est le
> premier vrai test du multi-locataire : un compte revendeur, ses données à
> lui, isolées.

## Ce qu'est « le compte ScintIA »

- **Marque (`agencyName`)** : `ScintIA`.
- **Offre (`offer.whatYouSell`)** : « Callflow — accueil & relance IA au
  téléphone pour les commerces ». `offer.city` : `Lyon`.
- **Tarifs (`settings.pricing`)** : setup **990 €** (`CALLFLOW_SETUP`) + paliers
  Callflow (`CALLFLOW_PALIERS`, `lib/pipeline-juillet.ts`).
- **Données** : les 16 fiches de juillet (***NOM-RETIRE***, Vauban, ***NOM-RETIRE***, Brotteaux,
  ***NOM-RETIRE***, ***NOM-RETIRE***, ***NOM-RETIRE***, ***NOM-RETIRE***, ***NOM-RETIRE***…).

## Marche à suivre

### Option A — en solo/local (rapide, pour toi tout de suite)
L'app est local-first : « compte » = l'identité white-label du navigateur.
1. **Réglages → Agence** : `Nom d'agence` = **ScintIA**.
2. **Réglages → Mon offre** : ce que tu vends = **Callflow…**, ville = **Lyon**,
   proposition de valeur = « chaque appel manqué est un client perdu — on répond
   à votre place, 24/7 ».
3. **Réglages → Tarifs — mon offre** : setup **990 €** + tes paliers Callflow.
4. **Réglages → Données → « Charger mon pipeline juillet »** : les 16 fiches
   entrent, avec leurs RDV datés.
5. **Réglages → « Client parfait (ICP) » → Générer** : l'ICP se déduit
   automatiquement de l'offre Callflow (métiers au téléphone).

> Documents, ICP, prompts IA et voix parlent désormais au nom de **ScintIA** —
> c'est le white-label qui fait le travail.

### Option B — vrai compte isolé (multi-locataire Supabase)
Quand tu veux ScintIA comme **compte séparé** (isolation RLS, revente) :
1. Suis `docs/OUVRIR-UN-COMPTE-CLIENT.md` : crée le compte (Supabase →
   Invite user) avec l'email ScintIA.
2. Connecte-toi **avec ce compte**, refais les réglages white-label ci-dessus
   (marque/offre/tarifs ScintIA).
3. Charge le pipe juillet **sous ce compte** → ses 16 fiches vivent sous son
   `user_id`, invisibles des autres comptes (RLS).
4. **Avant de facturer** : le test d'isolation à deux comptes
   (`docs/PREUVE-RLS.md`).

## Pourquoi ça compte

- Ça **prouve le white-label sur un cas réel** : EAGLEYE et ScintIA cohabitent,
  chacun son offre, ses tarifs, ses données.
- Le pipe de juillet devient **le pipe de ScintIA** — propre, attribué, prêt à
  travailler (les RDV ***NOM-RETIRE*** 3/08, Vauban 3/08, ***NOM-RETIRE*** 5/08 sont déjà datés).
- C'est la répétition générale avant d'ouvrir des comptes à d'autres revendeurs.
