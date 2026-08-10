# Les chiffres d'ALPHA — capacités réelles et modèle de conversion

> Deux catégories, jamais mélangées : **ce qui est certain** (les
> capacités, écrites dans le code) et **ce qui est modélisé** (les taux
> de conversion, issus de fourchettes de marché). Personne ne peut
> prédire tes taux. Seul le Test 1 les donnera.

---

## 1. Capacités — certaines (constantes du code)

| Canal | Plafond/jour | Où c'est écrit | Pourquoi ce plafond |
|---|---|---|---|
| LinkedIn | **25** | `lib/linkedin.ts` · `LINKEDIN_DAILY_SAFE` | Au-delà, les comptes se font restreindre. |
| Email | **40** | `lib/daily-plan.ts` · `EMAIL_DAILY_SAFE` | Réputation d'envoi sur une seule boîte. |
| Appels & visites | **30** | `lib/daily-plan.ts` · `CALL_DAILY_SAFE` | Au-delà, la qualité de conversation chute. |
| **Total** | **95 touches/jour** | | ≈ **2 000/mois** (21 jours ouvrés) |

Autres limites dures :

| Paramètre | Valeur | Fichier |
|---|---|---|
| Envois email par heure | 40 | `MAX_SENDS_PER_HOUR` (.env) |
| Anti-doublon « déjà contacté » | 14 jours | `CONTACT_COOLDOWN_DAYS` (.env) |
| Invitation LinkedIn | 300 caractères max | `LINKEDIN_INVITE_LIMIT` |
| Cadence LinkedIn | invitation → J+2 → J+4 | `lib/linkedin-sequence.ts` |
| Pièces jointes | 3 max, 400 Ko chacune | `app/api/send/route.ts` |
| Objectif quotidien par défaut | 60 touches | `DEFAULT_DAILY_TARGET` |

### SMS — le cas à part

Aucun plafond n'est codé : le SMS passe par **Textbelt**, facturé au
message (crédit acheté). Techniquement, tu peux en envoyer autant que ton
crédit le permet.

**Mais** : en France, la prospection par SMS est bien plus encadrée que
l'email. Vers un particulier, l'**opt-in préalable est obligatoire**.
Vers un professionnel sur ses coordonnées pro, la tolérance existe mais
la CNIL est nettement plus stricte que sur l'email, et le taux de
plainte est élevé. **Recommandation : réserve le SMS aux prospects qui
t'ont déjà répondu** (confirmation de RDV, rappel) — jamais en premier
contact. Ce n'est pas un canal de volume.

### Le carburant nécessaire

Pour tenir 95 touches/jour sans épuiser les fiches (cadence + cooldown
de 14 jours) : **400 à 600 fiches actives** en rotation. En dessous, le
Pilote affiche « pas assez de carburant » — et il a raison.

---

## 2. Conversion — modélisée, pas prédite

⚠ **Ces fourchettes sont des repères de marché pour de la prospection
B2B à froid, pas une prévision de tes résultats.** Elles servent à
dimensionner, et à savoir si le Test 1 est au-dessus ou en dessous.

| Étape | Fourchette de marché | Ce qui te pousse vers le haut |
|---|---|---|
| Invitation LinkedIn acceptée | 20–40 % | Local, note personnalisée, profil de fondateur |
| Réponse au message post-connexion | 10–25 % | Question de diagnostic, zéro pitch |
| Ouverture email | 20–40 % | Métrique peu fiable (protection Apple) — à ne pas piloter |
| Réponse email à froid | 2–5 % | Personnalisation réelle, audit offert |
| Appel → décideur joint | 15–25 % | Horaires métier connus (le playbook les a) |
| Conversation → RDV posé | 10–20 % | Permission, critère, silence après la question |
| RDV → client signé | 15–30 % | Audit chiffré, démo avant prix, doctrine |

### Le modèle à pleine capacité (600 fiches, 2 000 touches/mois)

```
525 invitations LinkedIn  → 25-35 % acceptées   → 130-185 connexions
                          → 10-20 % répondent   →  13-37 conversations
840 emails                →  2-5 % répondent    →  17-42 réponses
630 appels                → 15-25 % décideur    →  95-160 conversations
                          → 10-20 % posent RDV  →  10-32 RDV
────────────────────────────────────────────────────────────────────
RDV posés / mois          ≈ 15 à 40
Clients signés / mois     ≈ 3 à 8   (à 15-30 % de closing)
```

**Chiffre d'affaires correspondant** (setup seul, grille du contrat,
panier moyen 2 500 €) : **7 500 à 20 000 € / mois**, auxquels s'ajoute
la commission de 30 % sur le CA généré — qui, elle, se cumule mois
après mois.

---

## 3. L'avertissement qui compte le plus

**Le Test 1 (25 fiches) ne donnera aucun taux fiable.** Sur 25 touches,
1 à 3 réponses relèvent du hasard, pas de la statistique. Il faut
**200 à 300 touches par canal** avant qu'un taux veuille dire quelque
chose.

Ce que le Test 1 valide vraiment :
- que la mécanique tourne bout en bout (message → réponse → audit → RDV) ;
- que les messages ne choquent personne ;
- que le temps de réponse tient ;
- l'ordre de grandeur, pas le taux.

Ne change **qu'une variable à la fois** entre deux tests, et attends
d'avoir 200 touches sur un canal avant d'en tirer une conclusion.

---

## 4. Le seul chiffre qui compte aujourd'hui

Capacité : **95 touches/jour**. Carburant actuel : **le nombre de fiches
actives dans ton pipe**. Tant que le second est inférieur à 400, le
premier ne sert à rien.

C'est le seul goulot d'étranglement réel — ni la machine, ni les
messages, ni les quotas.

---

## 5. Vendre Alpha Sales OS — unit economics (le mot de Papa)

> « Know your ROI, cash flow, CAC, LTV, break-even, and the true value of
> your time. » Voici ces chiffres pour **EAGLEYE qui vend le logiciel**.
> Calculés par `calcSaas()` (`lib/pricing.ts`) ; pilotables en direct sur
> **/offre → onglet « Vendre Alpha Sales OS »**.

**La preuve de concept, énoncée par Zakaria : `2 500 € d'installation × 10
clients = 25 000 €`.** C'est du **cash encaissé**, avant même le récurrent.

**Cas de base** : installation **2 500 €**, abonnement **290 €/mois**,
rétention **12 mois**, cible **10 clients**. Coûts : ton temps **5 h/client
à 50 €/h**, acquisition hors-temps **25 €/client**, infra fixe **120 €/mois**.

| Métrique | Formule | Cas de base |
|---|---|---|
| **Cash setup (la POC)** | installation × clients | **25 000 €** |
| **MRR** | clients × prix | **2 900 €/mois** |
| **ARR** | MRR × 12 | **34 800 €** |
| **Cash mois 1** | setups + 1er MRR | **27 900 €** |
| **CAC / client** | acq. + (heures × valeur heure) | **~275 €** (≈ 91 % ton temps) |
| **LTV / client** | setup + prix × rétention | **~5 980 €** |
| **LTV : CAC** | LTV ÷ CAC | **~21 : 1** (cible > 3:1) |
| **Break-even infra** | infra fixe ÷ prix | **1 client** |
| **Remboursement de ton temps** | temps total ÷ MRR | **< 1 mois** |

### Sensibilité au prix mensuel (installation 2 500 €, 10 clients)

| Prix/mois | Cash setup | MRR | ARR | LTV/client | LTV:CAC |
|---|---|---|---|---|---|
| 149 € | 25 000 € | 1 490 € | 17 880 € | ~4 290 € | ~16 : 1 |
| **290 €** | **25 000 €** | **2 900 €** | **34 800 €** | **~5 980 €** | **~21 : 1** |
| 490 € | 25 000 € | 4 900 € | 58 800 € | ~8 380 € | ~30 : 1 |
| 990 € | 25 000 € | 9 900 € | 118 800 € | ~14 380 € | ~52 : 1 |

**Les deux seuls leviers qui comptent :** le **prix** (il déplace le récurrent)
et la **valeur de ton temps** (≈ 91 % du CAC) — c'est exactement ce qu'Alpha
Sales OS réduit en automatisant l'outreach. Pilotable en direct sur
**/offre → « Vendre Alpha Sales OS »**.

### « 5M » — la suite, pas la POC

Les 10 clients = **25 k€ de cash + ~35 k€ d'ARR** : la preuve que la machine
signe. Les paliers supérieurs viennent des **revendeurs white-label** (chacun
apporte ses propres clients) — on enchaîne les deux, on ne les confond pas.
