# FinOps — ce que coûte une décision d'IA, et qui le paie
**Alpha Sales OS · chaque chiffre cite sa source (`fichier#symbole`)**

## 1. La frontière gratuit / payant est un coût, pas un choix marketing

Tout ce qui **dépense chez nous** (notre SMTP, nos minutes de téléphonie, nos
jetons de modèle) est payant ; tout ce qui tourne sur les données de
l'utilisateur sans coût marginal est gratuit, sans limite de durée.

- Socle gratuit : `lib/entitlements.ts#BRIQUES_GRATUITES`.
- Carte des API qui dépensent, et chemin qu'elles servent : `lib/api-access.ts#CHEMIN_PAR_API`.
- Preuve exécutable : `tests/entitlements-routes.test.ts`.

## 2. Cascade de modèles — le moins cher qui répond

`lib/ai-engine.ts#runAI` essaie dans l'ordre :

| Rang | Moteur | Coût marginal |
|---|---|---|
| 1 | Ollama (local) | nul |
| 2 | NVIDIA | bas |
| 3 | Anthropic | variable |
| 4 | Gabarits sans IA | nul |

L'utilisateur peut apporter sa propre clé (BYOK) : la dépense est alors la
sienne — `lib/credentials-secret.ts#moteurIADeLaRequete`.

## 3. Budget de contexte par route

- Estimation prudente pour le français : `lib/token-budget.ts#CHARS_PAR_JETON`.
- Plafonds par route : `lib/token-budget.ts#BUDGETS` (agent 12 000, IA 6 000…).
- Coupe du moins prioritaire d'abord ; la priorité 1 n'est jamais coupée :
  `lib/token-budget.ts#assemble`.
- Consommation chiffrée : `lib/token-budget.ts#consommation`.

## 4. Plafonds qui protègent la marge et la réputation

- Essai : borné par la durée **et** par un montant de consommation réelle ;
  l'enveloppe totale des essais est tenue en base (migration 018).
- Envoi : 5 emails par jour la première semaine, 40 au plafond par boîte :
  `lib/email-ramp.ts#rampDepuisPremierEnvoi`.

## 5. Ce qui n'est pas mesuré

- Le coût réel d'un mois de production : aucun client payant, aucune facture.
- Le coût vocal de bout en bout : estimé à partir des grilles fournisseurs
  (`lib/voice-costs.ts`), jamais relevé sur une facture réelle.
