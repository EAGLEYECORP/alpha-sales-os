# Offres, prix & projections — ALPHA SALES OS

> Chiffres **illustratifs** (hypothèses claires), pas des promesses. Sert à
> décider la stratégie de prix et à se fixer des jalons réalistes.

## 1. Le « on double → 5M€ » — remis d'aplomb

Le post LinkedIn (le centime qui double : 5,3 M€ en 30 jours) est une **métaphore
de la constance**, pas une courbe de SaaS. Doubler chaque **jour** est
impossible ; doubler chaque **mois** au début, depuis une petite base, **l'est**.
C'est là qu'est la vraie magie du compounding — mesurée en mois, pas en jours.

- **5 M€ « à la fin du mois » (MRR)** = ~50 000 clients payants. Non.
- **5 M€ en ARR (revenu annuel récurrent)** = ~4 200 clients à 100 €/mois. **Ça,
  c'est un objectif à 24-36 mois** — un vrai cap, atteignable.
- **Le vrai objectif du mois 1** : **5 clients payants qui restent.** Point.

## 2. Prix — recommandation

Garde l'entrée basse (marché TPE/PME FR sensible au prix), monétise la valeur et
la rétention :

| Formule | Prix | Note |
|---|---|---|
| Gratuit | 0 € | Local-first, 50 fiches, 20 e-mails/mois → **entonnoir** |
| **Solo** | **79 €/mois** | Un commercial. Bon prix d'entrée. |
| **Pro** | **149 €/mois** | Volume + IA + voix. |
| **Solo annuel** | **790 €/an** (2 mois offerts) | **À AJOUTER** — cash d'avance + churn ↓ |
| **Agence** | **59 €/siège** (≥ 3 sièges) | Prix par siège plutôt que devis flou |
| Done-for-you | Setup 2 500 € + 30 % | Le modèle service (lib/pricing.ts) — **finance le cash au début** |

**Pourquoi 79 € est même un peu bas** : tu fais gagner ~2 h/jour à un commercial.
2 h × 20 j × 30 €/h = **1 200 €/mois de temps rendu**. À 79 €, le ROI est
évident — argument de vente, et marge pour monter plus tard.

## 3. Unit economics (hypothèses)

- **ARPU** (revenu moyen/compte) : mix 70 % Solo / 30 % Pro ≈ **100 €/mois**.
- **Churn** early-stage : **5 %/mois** (bon produit → viser 3 %).
- **LTV** = ARPU / churn = 100 / 0,05 = **2 000 €** par client.
- **Conversion gratuit → payant** : **2-5 %** (dépend de l'entonnoir).
  → Pour 100 clients payants, il faut ~2 000-5 000 inscrits gratuits.
  **La distribution (contenu viral, Studio social) est le vrai moteur.**

## 4. Trois scénarios sur 12 mois (ARPU 100 €)

| Scénario | Hypothèse d'acquisition | Clients M12 | MRR M12 | ARR M12 |
|---|---|---|---|---|
| **Prudent** | +3 clients nets/mois | ~30 | 3 000 € | 36 000 € |
| **Base** | +30 %/mois après les 5 premiers | ~120 | 12 000 € | 144 000 € |
| **Ambitieux** | doublement mensuel 5 mois puis +30 % | ~500 | 50 000 € | 600 000 € |

> Le scénario **Ambitieux** = « le jeu du doublement » qui marche : 5 → 10 → 20 →
> 40 → 80, puis on décélère. C'est ça, l'esprit du post — mais en mois.

## 5. Le chemin vers 5 M€ (ARR)

En partant du scénario **Base** (120 clients à M12), à **+20 %/mois** ensuite :
- ~4 200 clients ≈ **20 mois de plus** → **5 M€ ARR autour de l'an 3.**
- Leviers pour accélérer : baisser le churn (annuel, onboarding), monter l'ARPU
  (Pro, add-ons voix), et surtout **l'acquisition** (contenu + bouche-à-oreille).

## 6. Le plan des 30 prochains jours (ce qui compte vraiment)

1. **Prouver** : Supabase/Stripe réels (`verify:rls` + paiement test).
2. **Publier le légal** (avocat) → tu peux encaisser proprement.
3. **10 démos → 5 clients payants.** Le done-for-you (setup 2 500 €) peut
   financer le début pendant que le SaaS monte.
4. **Contenu quotidien** (Studio social) → remplir l'entonnoir gratuit.
5. Mesurer : inscrits → free actifs → payants → rétention à 30 j. **Ces 4
   chiffres, chaque semaine.** Le reste est du bruit.

> Objectif honnête du mois 1 : **premiers 5 payants + rétention prouvée.** C'est
> ça qui multiplie la valeur par 10-100 — pas une feature de plus.
