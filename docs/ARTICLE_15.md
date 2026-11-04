# Article 15 — exactitude, robustesse, cybersécurité
**Règlement (UE) 2024/1689 · appliqué volontairement (système non classé haut risque, voir `docs/EU_AI_ACT.md`)**

> Chaque mesure cite `fichier#symbole` ; `tests/dossier-conformite.test.ts` les ouvre.
> Une menace sans mesure citée est listée comme **ouverte**, pas comme couverte.

## § 1 et § 3 — Exactitude : ne rien affirmer qu'on n'a pas mesuré

- **Zéro donnée → `null`, jamais `0`**, et jamais un taux sans dénominateur ni
  intervalle. Mesure de référence : `lib/pipeline-juillet.ts#JUILLET_REEL`
  (78 prospects, 6 rendez-vous, 0 vente).
- **ALPHA n'invente pas un prix** : il ne répond « c'est combien ? » qu'avec la
  phrase que l'opérateur a déclarée ; sinon la question remonte —
  `lib/reponses-inscrit.ts#closingPret`.
- **Ce qui part par écrit est un gabarit, pas une génération libre** : les
  messages du pilote sont construits par des fonctions déterministes
  (`lib/autopilote-inscrit.ts#premierMessage`, `lib/reponses-inscrit.ts#propositionCreneaux`) ;
  aucun modèle ne rédige un email qui part sans relecture.
- **Aucun modèle n'est entraîné** sur les données des utilisateurs : il n'y a donc
  pas de boucle de rétroaction qui grave une erreur dans des poids. Ce qui
  s'accumule est une note relisible (`lib/apprentissage.ts`).

## § 4 — Robustesse : dégrader, jamais déraper

| Défaillance | Comportement | Où |
|---|---|---|
| Un fournisseur de modèle tombe | Le suivant prend le relais ; en dernier recours, des gabarits sans IA | `lib/ai-engine.ts#runAI` |
| Contexte trop long | On coupe le moins prioritaire ; la doctrine et les règles (priorité 1) ne sont jamais coupées | `lib/token-budget.ts#assemble` |
| Base injoignable, droits illisibles | Retour au socle **gratuit** (rien de payant ne s'ouvre sur une panne) | `lib/entitlements.ts#resoudreDroits` |
| Historique d'envoi illisible | Palier d'envoi le plus **bas** (5/jour) | `lib/email-ramp.ts#rampDepuisPremierEnvoi` |
| Agent vocal absent | Le tick refuse de composer (un appel dans le vide brûle la fiche et le numéro) | `lib/presence-agent.ts#presenceAgent` |
| Réponse ambiguë, prix, signature, doute | Rien n'est envoyé ; la fiche remonte, datée | `lib/reponses-inscrit.ts#deciderReponse` |
| Refus de palier (429) pendant une réponse | La réponse reçue n'est pas marquée « vue » : elle repassera | `lib/autopilote-inscrit.ts#issueEnvoi` |
| Deux passages simultanés du pilote serveur | Verrou en base, expirant seul | `lib/pilote-serveur.ts#VERROU_MS` |

## § 5 — Cybersécurité : la surface, menace par menace

| Menace | Surface réelle | Mesure | Où |
|---|---|---|---|
| Injection de consignes | Sites lus, emails reçus, documents importés | Tout texte entrant est encadré comme DONNÉE, son cadre ne peut pas être refermé de l'intérieur, et les règles qui priment sont posées **après** les données | `lib/untrusted.ts#wrapUntrusted` · `lib/untrusted.ts#UNTRUSTED_RULES` |
| Détournement d'outil | Le modèle qui lirait une injection | **L'IA de l'app n'a aucun outil d'écriture.** Les décisions d'envoi sont du code déterministe ; le connecteur MCP n'accorde que lecture + proposition, jamais un envoi | `lib/mcp-oauth.ts#PORTEES_OAUTH` |
| Abus d'envoi / de dépense | `/api/send`, `/api/voice/call`, jetons | Le gratuit n'atteint aucune route qui dépense chez nous | `lib/api-access.ts#CHEMIN_PAR_API` · `lib/entitlements.ts#autorise` |
| Déploiement ouvert par erreur | Production sans compte ni mot de passe | Retombe au gratuit, personne n'est maître | `lib/entitlements.ts#deploiementSansSerrure` |
| SSRF | Lecture de site, agenda iCal | Adresses privées et non HTTPS refusées, revérifiées à chaque redirection | `lib/site-fetch.ts#safePublicUrl` |
| Fuite de secrets d'un locataire | Clés IA et SMTP « apportées » (BYOK) | Chiffrées au repos ; seule une empreinte revient au navigateur | `lib/credentials-secret.ts#chiffrer` · `lib/credentials-secret.ts#empreinteVisible` |
| Rafale de requêtes | Toute l'app | Limiteur par IP, borné en mémoire | `lib/limiteur.ts#creerLimiteur` |
| Appels du planificateur usurpés | Ticks serveur | Secret comparé en temps constant ; sans secret, la route n'existe pas | `lib/pilote-serveur-appel.ts#estAppelPiloteServeur` |

## Ouvert — ce qui n'est pas encore couvert

1. **Isolation entre comptes rejouée en production** (deux vrais comptes) :
   `npm run verify:rls`, `docs/PREUVE-RLS.md`.
2. **Jeu de tests adversarial sur la sortie d'un vrai modèle** : on prouve
   l'encadrement, pas l'obéissance du modèle. La parade structurelle reste
   l'absence d'outil d'écriture.
3. **Journal d'audit des décisions d'IA**, en append-only, côté serveur.
4. **Rotation des clés** collées par le passé dans des conversations.
