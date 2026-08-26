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

## 4. RELEVÉ DE MARCHÉ — et il contredit le diagnostic d'hier

> Relevé le 26 août 2026. **Sources secondaires** (articles de comparaison),
> pas les pages de tarifs des éditeurs. Ordre de grandeur, pas tarif opposable :
> rouvre la page du concurrent le jour où tu le cites en rendez-vous.
> Rejouable : `lib/marche.ts`.

### Ce qui est BIEN placé — ne touche pas

| Notre offre | Marché | Verdict |
|---|---|---|
| **Pack setup 10 000 €** | Implémentation sur mesure 4 600–23 000 € | **dans le marché** |
| **Essai 290 €** | Frais de mise en service télésecrétariat 100–300 € | **dans le marché** |
| **Alpha Voice 364 €/mois** | Télésecrétariat humain 80–400 €/mois | **dans le marché** |
| **Solo 79 €/mois** | Axonaut (forfait FR) 50–100 €/mois | **dans le marché** |

**Ta question d'hier était « faut-il monter le full OS au-dessus de 10 k ? ».
La réponse est non.** Le pack est correctement placé. Le problème est ailleurs.

### Ce qui est MAL placé

**Les briques à l'unité sont ~×2 le marché.**

| Brique | Notre prix | Comparable | Écart |
|---|---|---|---|
| CRM & Pipeline | 190 €/mois | Axonaut 50–100 € (forfait, facturation incluse) | ×1,9 |
| Campagnes & outreach | 290 €/mois | Lemlist 54–146 €/siège | ×2,0 |
| Le Cerveau | 240 €/mois | — | pas de comparable direct |

C'est **ça** qui produisait la remise de 51 % sur le pack. Alignées sur le
marché, la somme des briques passe de 2 034 € à **1 291 €/mois** — et la remise
du pack tombe de **51 % à 23 %**, sans toucher au pack.

**Pro à 149 €/mois est SOUS le marché** (secrétaire IA France : 200–300 €/mois).
Avec 200 appels inclus, tu te sous-vends. Il y a de la place jusqu'à ~200 €.

### Le point sur lequel tu te feras attaquer

Ramené à la minute, Alpha Voice est à **0,43 €/min** (364 € pour 855 min à
30 % de décroché × 2,85 min).

| Comparable | Prix | Notre position |
|---|---|---|
| Bland (tout inclus) | 0,10–0,13 €/min | **×3,3** |
| Vapi/Retell tout compris | 0,13–0,30 €/min | ×1,4 |
| Marché global | 0,11–0,41 €/min | ×1,03 |

Un acheteur technique sortira Bland ou Vapi et dira « c'est 3× moins cher ».
**Il aura raison sur le chiffre et tort sur le produit** : Vapi est une API où
il construit tout — script, intégration CRM, conformité article 50, numéros,
sourcing. Nous vendons le service fini.

La bonne réponse en rendez-vous n'est pas de défendre le prix à la minute,
c'est de **refuser la comparaison** : « Vapi vous vend une brique de Lego. Ce
que vous comparez, c'est votre télésecrétariat à 300 €/mois qui ne fait que
l'entrant. »

> ⚠ Ce 0,43 €/min repose sur l'hypothèse de 30 % de décroché — **jamais
> mesurée**. Si le décroché réel est de 50 %, on tombe à 0,26 €/min et l'écart
> disparaît. C'est la première chose que l'essai ScintIA va te dire.

### Ce que je ferais, dans l'ordre

1. **Monter Pro** de 149 à ~199 €/mois (on est sous le marché, 200 appels inclus).
2. **Baisser les briques à l'unité** vers le marché → la remise du pack redevient
   crédible toute seule.
3. **Ne pas toucher** au pack, à l'essai, à Solo, ni au palier 1 000 appels.

Je n'ai appliqué **aucun** de ces changements : ce sont des décisions
commerciales, pas des corrections de bug. Le calcul est rejouable
(`lib/marche.ts`), les prix se changent dans `lib/offres-publiques.ts`.

---

## 5. Ce qui manque encore

| Manque | Pourquoi ça bloque |
|---|---|
| **Ton taux horaire chargé** | 6 briques sur 10 se chiffrent au temps. Sans lui, aucun prix de setup client. Hypothèse de travail : 70 €/h. |
| **Une facture Telnyx réelle** | Seule ligne de coût invérifiable, et la plus lourde (17 %). |
| **Le temps réel d'une installation** | Les 46 h du catalogue sont des estimations. Aucune installation n'a eu lieu. |
| **Le taux de décroché réel** | Toute la comparaison à la minute en dépend. L'essai ScintIA le donnera. |
| **Les pages de tarifs officielles** | Le relevé est secondaire. Avant de citer un concurrent en rendez-vous, rouvre sa page. |

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
