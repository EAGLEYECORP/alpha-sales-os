# FinOps & Token Budgeting
**Alpha Sales OS**

## Principe

Tout ce qui dépense chez l’opérateur (SMTP, minutes LiveKit, jetons frontier) est payant.  
Tout ce qui tourne sur les données du client sans coût marginal est gratuit.

## Cascade de coût

1. Ollama local → coût marginal 0
2. NVIDIA NIM → bas
3. Anthropic → variable
4. Templates purs → 0

## Budgeting (`lib/token-budget.ts`)

- Estimation prudente calibrée sur le français (~3,6 car/jeton).
- Priorité 1 (doctrine, règles de sécurité) **jamais coupée**.
- Budgets par route (ex. `/api/agent` 12 k, `/api/ai` 6 k, etc.).
- Rapport de consommation avec conseil automatique quand le contexte dilue.

## Coût usine voix (ordre de grandeur)

Voir `lib/voice-costs.ts`. À 1 000 appels/mois le coût usine reste largement sous le prix public (marge brute élevée une fois le fixe amorti).

## Entitlements

La frontière gratuit / payant est technique, pas marketing :  
tant qu’il n’existe pas de credentials par locataire pour SMTP et LiveKit, ouvrir ces briques en gratuit revient à offrir sa carte et son domaine.
