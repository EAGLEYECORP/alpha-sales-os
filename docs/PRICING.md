# PRICING — ce qui est calculé, ce qui est décidé, ce qui manque

> Chiffres produits par `lib/pricing-briques.ts` et `lib/voice-costs.ts`.
> Rejouables : `npx tsx` sur les fonctions, pas des nombres recopiés à la main.
> **Tout ce qui est marqué ⚠ n'a pas été vérifié et ne doit pas partir dans un
> devis en l'état.**

---

## 1. LE POINT LE PLUS IMPORTANT : « 360 € » n'est pas un coût

Tu m'as dit : *« on est à 360 € par mois pour 1 000 appels… ce prix-là c'est
pour payer la téléphonie et aussi la voix »*.

Le modèle de coût du dépôt ne trouve ce chiffre **dans aucune hypothèse** :

| Hypothèse | Coût fournisseurs |
|---|---|
| 1 000 composés, 30 % décrochés, 2,85 min | **99 €** |
| 1 000 **tous décrochés** × 2,85 min (pire cas réaliste) | **184 €** |
| 1 000 tous décrochés × 5 min (cas absurde) | **281 €** |

**360 € correspond au PRIX PUBLIC, pas au coût.** Il est déjà dans le code
depuis longtemps : `OUTBOUND_UNIT_HT = 364 €`. Tu as très probablement mémorisé
ton tarif de vente et l'as repris comme un coût.

**Pourquoi ça compte demain :** si tu présentes 360 € comme ton coût à ScintIA,
tu justifies un prix de vente à ~1 440 € (ta règle ×4). S'ils vérifient, ou si
tu te trompes dans l'autre sens, tu vends à marge nulle. **Tranche ça avant le
rendez-vous.**

> ⚠ Une réserve honnête dans l'autre sens : le tarif **Telnyx France** n'est pas
> public et n'a jamais été relevé sur une de tes factures. C'est la seule ligne
> de coût invérifiable, et c'est la plus lourde (17 % du total). Si ton vrai
> tarif minute est 3× l'hypothèse, le coût passe de 99 € à ~160 €. Toujours pas
> 360 €, mais l'écart mérite une facture réelle.

---

## 2. Alpha Voice — ce que ça coûte, ce que ça rapporte

### Palier 1 000 appels/mois — la grille actuelle tient

```
1 000 composés · 300 décrochés · 855 min de conversation
Coût fournisseurs .............. 96 €   (dont 57 € de fixe mutualisé)
Prix affiché ................... 364 €
Marge .......................... 268 € (74 %) → ×3,79 le coût
Plancher règle ×4 .............. 213 €
```

**Verdict : la règle ×4 est tenue.** Rien à changer sur ce palier.

### Les jetons LLM ne sont pas le problème

C'est la question que tu posais, et la réponse est rassurante :

| Modèle | Par appel | 300 appels décrochés |
|---|---|---|
| gpt-4o-mini | 0,22 centime | **0,65 €** |
| gpt-4o | 3,6 centimes | **10,90 €** |

Un appel consomme ~13 400 jetons en entrée (l'historique repart à chaque tour)
et 600 en sortie. Même sur le modèle cher, **les jetons pèsent moins que la
téléphonie**. Ce qui coûte, c'est la minute : Telnyx, Fish, LiveKit, Deepgram.

**Conséquence commerciale :** inutile de faire porter la clé API au client. Tu
peux tout inclure et rester à ×4 — c'est plus simple à vendre et ça t'évite un
support « sa clé a expiré ».

> ⚠ Tarifs modèles issus de ma connaissance d'entraînement, **non vérifiés
> depuis cet environnement** (le proxy sortant bloque). À confirmer sur la page
> de tarifs avant tout devis. Le rapport entre modèles, lui, est stable.

---

## 3. Le palier d'ESSAI — ce qui manquait pour demain

**Le blocage :** la grille facturait 100 appels **364 €** (millier entamé).
Personne ne dit oui à un mois complet pour un test.

**Ajouté :** `prixEssai()` dans `lib/bricks.ts`.

```
Mise en route Alpha Voice + 100 appels réels inclus ....... 290 € HT, une fois
  Coût réel ......... 61 €   →  marge 229 € (79 %), ×4,8
  Déduit intégralement du 1er mois si passage au palier 1 000 sous 30 jours
  Un seul essai par client
```

### Ce qu'il faut dire au client — et ce qu'il ne faut pas dire

**Dis :** « frais de mise en route, 100 appels réels inclus ».
**Ne dis pas :** « forfait 100 appels ». Sinon il compare aux 364 € du millier,
trouve que c'est 8× plus cher au ratio, et il a raison.

L'écart est **volontaire** : à la proportionnelle (36 €), dix lots de 100
coûteraient moins qu'un palier 1 000 et tu aurais fabriqué l'arbitrage inverse
de celui que tu veux. Un test protégé par le prix vend le palier suivant.

Ce que tu vends réellement dans ces 290 €, ce n'est pas de la consommation
(quelques euros) : c'est le **script, le trunk SIP, le premier lot de numéros,
et l'écoute des premiers appels**. Plusieurs heures, facturées une fois.

> ⚠ Les 290 € couvrent ~4 h de mise en route à 70 €/h. **Les deux nombres sont
> à toi de valider** — je n'ai ni ton taux horaire ni le temps réel d'une
> installation, puisqu'aucune n'a eu lieu.

---

## 4. Le catalogue de briques — le problème du pack

```
À la carte (10 briques) ....... 20 500 € setup  +  2 034 €/mois
Pack complet .................. 10 000 € setup  +  1 000 €/mois
                                → remise de 51 % sur les deux
```

**Une remise de moitié dit le contraire de « élite ».** Ce n'est pas un pack,
c'est un aveu : le client en déduit que les briques à l'unité sont gonflées, et
il le calcule en dix secondes.

Tu demandais s'il faut monter le full OS au-dessus de 10 k. Voilà l'arbitrage
réel — mais il porte sur **l'écart**, pas sur le chiffre isolé :

| Setup pack | Remise vs à la carte |
|---|---|
| 10 000 € | 51 % |
| 12 500 € | 39 % |
| **15 000 €** | **27 %** |
| 18 000 € | 12 % |

**Deux sorties cohérentes, pas les deux à la fois :**
1. **Monter le pack** vers 15 000 € — la remise tombe à 27 %, crédible, et
   l'ancre haute sert le positionnement élite.
2. **Baisser les prix à la carte** — mais tu perds la mécanique d'upsell
   (aujourd'hui l'addition de 3 briques dépasse le pack, c'est volontaire).

Je ne tranche pas : ça dépend de ce que font tes concurrents, et **je n'ai
aucun relevé** (le proxy bloque, et rien dans le dépôt). C'est la donnée qui
manque, et ta règle « un peu moins que le marché » est incalculable sans elle.

### Ta règle ×4 est fausse sur 4 briques sur 10

| Brique | Prix | Coût | Multiple | Verdict |
|---|---|---|---|---|
| Alpha Voice | 364 € | 142 € | ×2,6 | au-dessus du plancher |
| Campagnes | 290 € | 113 € | ×2,6 | au-dessus |
| Le Cerveau | 240 € | 70 € | ×3,4 | **hors règle** |
| CRM & Pipeline | 190 € | 70 € | ×2,7 | **hors règle** |
| Audits | 150 € | 76 € | ×2,0 | au-dessus |
| Tracking | 140 € | 35 € | ×4,0 | **hors règle** |
| Alpha Live | 180 € | 75 € | ×2,4 | au-dessus |
| Closer OS | 140 € | 37 € | ×3,8 | au-dessus |
| Agent ALPHA | 220 € | 82 € | ×2,7 | au-dessus |
| Pilotage & KPIs | 120 € | 35 € | ×3,4 | **hors règle** |

**Pourquoi « hors règle » :** le Cerveau, le CRM, le Tracking et le Pilotage ont
un **coût marginal quasi nul**. L'hébergement (57 €/mois) est mutualisé sur
*tous* les clients. Quatre fois zéro fait zéro : appliquée telle quelle, ta
règle dirait de **donner** ces quatre briques.

Ce qu'elles coûtent vraiment, c'est du **temps** : installation et support.
C'est ça qui se facture. Le reste du prix vient de la **valeur** et du marché —
et ça ne se calcule pas, ça se décide.

> Le module refuse d'inventer un plancher pour ces briques-là : il rend `null`
> et explique pourquoi, plutôt que de sortir un chiffre qui aurait l'air calculé.

---

## 5. Ce qu'il manque, et que je ne peux pas produire

| Manque | Pourquoi ça bloque |
|---|---|
| **Ton taux horaire chargé** | 6 briques sur 10 se chiffrent au temps. Sans lui, aucun prix. Hypothèse de travail ci-dessus : 70 €/h. |
| **Les prix concurrents** | « Un peu moins que le marché » est incalculable sans le marché. Proxy bloqué : à relever toi-même. |
| **Une facture Telnyx réelle** | Seule ligne de coût invérifiable, et la plus lourde. |
| **Le temps réel d'une installation** | Les 46 h du catalogue sont des estimations de conception. Aucune installation n'a eu lieu. À corriger après ScintIA. |

---

## 6. Demain, avec ScintIA — les trois chiffres à avoir en tête

```
1.  ESSAI ............ 290 € HT — mise en route + 100 appels réels
                       déduits du 1er mois s'il passe au palier sous 30 j

2.  PALIER 1 000 ..... 364 € HT/mois — sans engagement
                       (coût 96 €, marge 74 %)

3.  TON COÛT ......... ~96 € pour 1 000 appels, PAS 360 €
```

**L'ordre de la conversation :** démo gratuite → essai payant → mensualité. Ne
saute pas l'essai : c'est lui qui transforme un « intéressant » en client, et
c'est lui qui te donne ton premier taux de décroché mesuré — celui qui remplace
l'hypothèse à 20 % dans toute l'app (`tauxPourPlan`).

> ⚠ Rappel doctrine : ScintIA prend **30 % + 10 % du mensuel** sur Callflow.
> Ces chiffres-là sont NOS prix Alpha Voice, un produit différent. Ne mélange
> pas les deux grilles dans la même conversation.
