# EU AI Act — positionnement réglementaire et dossier technique
**Règlement (UE) 2024/1689 · Alpha Sales OS · état au 04/11/2026**

> **Comment lire ce dossier.** Chaque garantie cite le fichier et le symbole qui
> l'appliquent, sous la forme `fichier#symbole`. `tests/dossier-conformite.test.ts`
> ouvre chacune de ces citations à chaque `npm test` : si le symbole disparaît
> ou change de fichier, la suite tombe. Une phrase de ce dossier qui ne pointe
> vers rien n'est pas une garantie, c'est une intention — elle est alors écrite
> comme telle, dans la section « Ce qui n'est pas prouvé ».

## 1. Classification

Alpha Sales OS automatise la prospection et la qualification commerciale **B2B** :
trouver des entreprises, écrire un premier message, lire les réponses, proposer
des créneaux, appeler (Alpha Voice).

| Question | Réponse | Pourquoi |
|---|---|---|
| Pratique interdite (art. 5) ? | **Non** | Aucune manipulation subliminale, aucune notation sociale, aucune biométrie. |
| Haut risque (annexe III) ? | **Non** | Ni recrutement, ni évaluation de travailleurs, ni crédit, ni infrastructure critique, ni service public essentiel. Le système décide *quand écrire à une entreprise*, pas du sort d'une personne. |
| Obligations de transparence (art. 50) ? | **Oui** | Un agent vocal et des emails rédigés et envoyés sans relecture humaine interagissent avec des personnes. |
| Modèle d'IA à usage général (art. 51+) ? | **Non, déployeur** | Nous louons des modèles (Ollama local, NVIDIA, Anthropic) ; nous n'en entraînons aucun. |

**Conséquence** : pas de déclaration UE de conformité (art. 47), pas de marquage
CE (art. 48), pas d'enregistrement dans la base de l'UE (art. 71) — ces obligations
visent le haut risque. Le dossier ci-dessous suit **volontairement** la structure
de l'annexe IV, parce que c'est la grille la plus exigeante pour décrire un
système, pas parce qu'elle s'impose à nous.

> ⚠ Ce qui ferait basculer la classification : vendre Alpha pour **trier des
> candidats** (recrutement) ou **noter des salariés**. Aucune offre ne le fait,
> et l'ouvrir se décide — ce serait l'annexe III, point 4.

## 2. Article 50 — la divulgation est exécutée, pas promise

| Canal | Ce que le code impose | Où |
|---|---|---|
| Appel vocal | La première phrase dit : IA, pas une personne, pour le compte de qui. Un script qui l'omet est refusé avant l'appel. | `lib/voice-script.ts#auditScript` · `lib/voice-script.ts#DISCLOSURE_REQUIREMENTS` |
| Email ou message autonome | Sans relecture humaine, le corps doit nommer l'IA ; sinon `/api/send` refuse. | `lib/signature-ia.ts#verifieDivulgation` · `lib/signature-ia.ts#DIVULGATION_ECRITE` |
| Email relu par un humain | Écrire « IA » serait **faux** : c'est refusé aussi. | `lib/signature-ia.ts#divulgation` |

Prouvé par `tests/art50-disclosure.test.ts`.

## 3. Dossier technique — structure de l'annexe IV, appliquée volontairement

1. **Description générale.** OS de vente B2B. En ligne : le CRM vit dans le
   navigateur de l'utilisateur (local-first) ; le serveur ne voit pas ses fiches.
   Installé « chez vous » : sur le serveur du client. Destination, publics et
   limites : `README.md`.
2. **Architecture et composants.** `docs/ARCHITECTURE.md`. Cascade de modèles
   ordonnée : Ollama (local) → NVIDIA → Anthropic → gabarits sans IA —
   `lib/ai-engine.ts#runAI`.
3. **Données.** Aucun jeu d'entraînement : aucun modèle n'est entraîné ni
   ajusté. La mémoire du produit est une recherche **lexicale** écrite à la main
   (`lib/knowledge.ts#search`), les documents sont lus en mémoire
   (`lib/file-extract.ts#extractFile`). Ce que le système « apprend » est une
   note relisible, jamais un poids : `lib/apprentissage.ts`.
4. **Modèle.** Modèles tiers, sans réglage de notre part. Le contexte envoyé est
   borné par route et par priorité : `lib/token-budget.ts#BUDGETS`,
   `lib/token-budget.ts#assemble`.
5. **Prétraitement.** Tout texte entrant (site, email, document) est encadré
   comme DONNÉE avant d'atteindre un modèle : `lib/untrusted.ts#wrapUntrusted`.
6. **Performance — mesurée, et sans arrondir.** Une seule mesure maison :
   juillet 2026, 78 prospects → 6 rendez-vous (7,7 %, intervalle de Wilson à 95 %
   3,6 %–15,8 %) → **0 vente** (`lib/pipeline-juillet.ts#JUILLET_REEL`).
   Zéro donnée rend `null`, jamais `0`. Aucun email n'est encore parti de l'app
   en production (relevé du 30/10/2026).
7. **Contrôle humain (art. 14).** Voir `docs/SAFETY.md`. Le prix, la signature,
   le doute et toute réponse ambiguë remontent à l'humain :
   `lib/reponses-inscrit.ts#deciderReponse`.
8. **Exactitude, robustesse, cybersécurité (art. 15).** `docs/ARTICLE_15.md`.
9. **Gestion des risques.** Plafond légal de sollicitations (décret
   n° 2022-1313) : `lib/call-cadence.ts#plafondRappels`. Fenêtre d'envoi :
   `lib/conformite.ts#fenetreOuverte`. Mentions obligatoires :
   `lib/conformite.ts#verifieMentions`. Palier d'envoi par boîte :
   `lib/email-ramp.ts#rampDepuisPremierEnvoi`.
10. **Journal des modifications.** L'historique Git de ce dépôt, chaque commit
    passé par `npm test` et `tsc` avant la production.
11. **Normes harmonisées.** Aucune n'est publiée pour l'AI Act à ce jour ; aucune
    n'est revendiquée.
12. **Déclaration UE de conformité.** Non applicable (pas de haut risque).
13. **Surveillance après mise en service.** Écrans `/moniteur` et `/ceo`
    (maître), sonde `/api/health`. Ils lisent le **serveur**, jamais le
    navigateur : `lib/moniteur.ts`.
14. **Performance en conditions réelles.** À écrire : le premier envoi réel n'a
    pas eu lieu.

## 4. Ce qui n'est pas prouvé

- **L'isolation entre comptes en production** : conçue (RLS), testée en mémoire,
  pas encore rejouée sur deux vrais comptes (`npm run verify:rls`, `docs/PREUVE-RLS.md`).
- **La latence vocale** : aucun chiffre de bout en bout n'a été mesuré en production.
  Aucun n'est donc écrit ici.
- **Un vrai Dropcontact, une vraie lecture IMAP, un vrai agenda Google** lus par le
  pilote : branchés et testés sur services simulés, jamais sur les vrais.

Ce document n'est pas un avis juridique. Il décrit ce que le logiciel fait.
