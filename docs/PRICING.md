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

## 1 bis. PREMIÈRES MESURES RÉELLES — 27 août 2026

Premier appel live facturé. Ce sont les seuls chiffres de ce document qui
viennent d'une facture et non d'une page de tarifs.

### Fish Audio — le tarif est bon, le VOLUME ne l'est pas

```
Facturé ............ 4 922 octets → 0,07 $   (S2.1 Pro)
Attendu au tarif ... 4 922 × 15 $/Mo = 0,0738 $
→ le tarif de 15 $/Mo est CONFIRMÉ (écart 5 %)
```

Mais rapporté à la minute de conversation :

| | octets/min | $/min |
|---|---|---|
| Hypothèse du modèle | 695 | 0,0104 |
| **Mesuré** | **1 641** | **0,023** |

**×2,24.** J'ai remplacé la constante par la mesure (`lib/voice-costs.ts`),
dans le sens prudent : sur un modèle de coût, l'erreur qui se paie est celle
qui sous-estime.

> ⚠ **Ce ×2,24 n'est pas expliqué — mais une piste est écartée.** Du français
> à ~150 mots/min fait ~1 000 octets/min de parole. 4 922 octets, c'est donc
> près de **5 minutes de parole dans un appel de 3 minutes**.
>
> J'avais avancé qu'on payait de la **synthèse jamais entendue** : LiveKit
> générant du TTS en spéculatif, jeté quand le prospect coupe. **Vérifié dans
> la source de `livekit-agents` 1.7.1** (`voice/turn.py`) :
> `_PREEMPTIVE_GENERATION_DEFAULTS` vaut `enabled: True` mais
> **`preemptive_tts: False`** — seul le LLM tourne en spéculatif, le TTS ne
> démarre qu'une fois le tour confirmé. `voice/agent.py` ne passe aucun
> `turn_handling`, donc ces défauts s'appliquent. **L'hypothèse tombe.**
>
> Reste l'explication la plus simple : le compteur du tableau de bord est
> **cumulé sur la période** et couvrait plusieurs essais, pas ce seul appel.
> Si c'est ça, le coût réel par minute est **inférieur** à 0,023 $ et le
> modèle est simplement prudent — le bon sens de l'erreur.
>
> **Ça se tranche en trente secondes** : relève le compteur Fish avant et
> après UN appel isolé.

### Telnyx — un plafond, toujours pas un tarif

```
Dépense du mois ......... 2,05 $
dont numéro ............. ~1,00 $
→ usage voix ............ AU PLUS 1,05 $
```

**Ça ne donne pas un prix à la minute** : on ignore combien de minutes
d'essai ont été passées ce mois-là, et rien ne dit que le solde soit
intégralement de la voix.

| Si ces 1,05 $ couvrent… | ça fait | vs l'hypothèse (0,012 $/min) |
|---|---|---|
| 3 min | 0,35 $/min | **×29** |
| 10 min | 0,105 $/min | ×8,7 |
| 20 min | 0,053 $/min | ×4,4 |
| 30 min | 0,035 $/min | ×2,9 |
| 60 min | 0,018 $/min | ×1,5 |

**La bonne nouvelle est la valeur absolue** : un mois d'essais a coûté
2,05 $ en tout. La mauvaise, c'est que l'incertitude qui reste porte sur la
ligne la plus lourde du modèle.

**À tirer, et ça clôt le sujet** : Telnyx → *Reporting → Usage Reports*,
export CDR du mois. Minutes et coût par appel.

### Ce que ça fait au palier 1 000 appels

| Modèle | Coût | Marge | Multiple | Plancher ×4 |
|---|---|---|---|---|
| Avant (tout hypothèse) | 88 € | 276 € (76 %) | ×4,14 | 351 € |
| **Fish mesuré** | **95 €** | **269 € (74 %)** | **×3,83** | **380 €** |
| Fish mesuré + Telnyx ×3 | 114 € | 250 € (69 %) | ×3,18 | 458 € |
| Fish mesuré + Telnyx ×10 | 182 € | 182 € (50 %) | ×2,00 | 730 € |

**Lecture pour le rendez-vous :** à 364 €, tu tiens la règle ×4 tant que
Telnyx ne dépasse pas ~3× l'hypothèse. **Au-delà, la règle ×4 casse** — pas
la rentabilité (50 % de marge reste bon), mais ta propre règle. C'est le
seul scénario où le prix de 364 € devrait bouger, et il se tranche avec un
export CDR, pas avec une opinion.

---

## 2. Alpha Voice — ce que ça coûte, ce que ça rapporte

### Palier 1 000 appels/mois — recalculé après la mesure Fish

⚠ **Ce bloc annonçait « 96 € · ×3,79 · la règle ×4 est tenue ». Les trois
étaient faux** : le chiffre datait d'avant la mesure Fish du 27/08, et il
mélangeait deux hypothèses de durée. Recalculé, les deux scénarios :

| Durée moyenne d'un appel décroché | Minutes | Coût | Marge | Multiple |
|---|---|---|---|---|
| 2,00 min (défaut du modèle) | 600 | **95 €** | 269 € (74 %) | ×3,84 |
| **2,85 min (ta durée réelle)** | 855 | **109 €** | 255 € (70 %) | **×3,34** |

`1 000 composés · 30 % décrochés · 57 € de fixe mutualisé · prix 364 €`

**Verdict corrigé : la règle ×4 N'EST PAS tenue** — et elle ne l'était déjà
plus à ta propre durée d'appel, avant même de vérifier Telnyx. Le plancher
×4 sur ce palier serait de **436 €**, pas 364 €.

Ce que ça veut dire, sans dramatiser : **70 % de marge reste très bon.**
C'est ta règle qui n'est pas tenue, pas ta rentabilité. Trois sorties, à toi
de choisir :
1. **monter le palier à ~436 €** — le marché le supporte (télésecrétariat
   80–400 €/mois, § 4), mais tu perds l'argument « moins cher qu'une
   secrétaire » ;
2. **assumer ×3,3** et écrire la règle comme un objectif, pas une loi ;
3. **attendre l'export CDR Telnyx** avant de bouger — si le tarif réel est
   sous l'hypothèse, le multiple remonte tout seul.

Je recommande la 3 : bouger un prix public sur un modèle dont la ligne la
plus lourde est encore supposée, c'est bouger deux fois.

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

## 4 bis. LE TAUX HORAIRE — relevé sur le marché, faute de l'avoir de toi

Je te l'ai demandé trois fois. Il bloquait six briques sur dix et tout prix de
setup client. Je l'ai donc **relevé sur le marché** plutôt que de laisser la
grille muette. `lib/taux-horaire.ts` — remplaçable par ta compta le jour où
elle existe : une mesure maison bat toujours un baromètre.

### Le relevé (27 août 2026, sources secondaires)

| Profil | TJM France |
|---|---|
| Développeur junior (< 3 ans) | 250–350 € |
| Développeur confirmé | 350–600 € (médiane ~520) |
| Développeur senior (React, Python) | 500–700 € |
| **Automatisation (n8n, Make, Zapier)** | **350–700 €** |
| Consultant IA | 400–1 500 € |
| Intégrateur d'automatisations IA | 700–1 500 € |

Île-de-France ~620 €/j · régions 450–540 €/j · Lyon = 2ᵉ bassin tech, haut de
la province (décote retenue : 8 %, la plus faible de la fourchette).

### Ce qui est retenu

```
TJM ................ 500 € HT/jour   (fourchette 450–550)
Heures par jour .... 7      (pas 8 : le TJM est un prix de JOURNÉE)
→ TAUX ............. 71 €/h  (fourchette 64–79)
```

**Le contre-calcul donne plus.** Intersection « automatisation » × « dev
senior » = 500–700 national, centre 600, soit **552 €/j à Lyon**. Je retiens
500. Ce n'est pas une erreur : le haut de fourchette se défend avec des
références, et il y a **zéro vente**. Un TJM qu'on ne sait pas justifier se
négocie à la baisse en direct — ça coûte plus cher que de l'avoir posé juste.
Il remonte au premier client livré.

> ⚠ **Ce taux dit ce qu'une heure se VEND, pas ce qu'elle coûte.** Ne lui
> applique jamais la règle ×4 : tu facturerais l'installation quatre fois le
> prix du marché en croyant être prudent. Pour un indépendant seul, le coût
> d'une heure est son coût d'opportunité — donc le taux lui-même. La marge
> sur du temps humain est structurellement nulle, et c'est précisément
> pourquoi la règle ×4 ne vaut que pour la consommation fournisseurs.

### Ce que ça débloque — et le chiffre qui fait mal

Tout le catalogue se chiffre enfin. Le résultat n'est pas confortable :

| Brique | Setup affiché | Heures | Main-d'œuvre | Multiple |
|---|---|---|---|---|
| Agent ALPHA | 2 200 € | 3 h | 213 € | **×10,3** |
| Salle de contrôle & KPIs | 1 200 € | 2 h | 142 € | ×8,5 |
| Le Cerveau · CRM · Tracking · Closer | 1 500–2 500 € | 3–5 h | 213–355 € | ×7,0 |
| Campagnes & outreach | 2 500 € | 6 h | 426 € | ×5,9 |
| Alpha Voice | 3 500 € | 12 h | 852 € | ×4,1 |
| **Pack complet** | **10 000 €** | **46 h (6,6 j)** | **3 266 €** | **×3,1** |

**Agent ALPHA, c'est 2 200 € pour 3 heures estimées — 733 €/h.** Ça ne
survit pas à la question « ça vous prend combien de jours ? ».

**Ce que je ne recommande PAS :** baisser ces prix. Un frais d'installation
n'est pas un devis en régie — on installe un produit qui existe déjà, et le
client n'achète pas des journées. Le pack à 10 000 € reste dans le marché de
l'implémentation sur mesure (4 600–23 000 €, § 4).

**Ce que je recommande :** ne jamais laisser la conversation devenir des
heures. C'est le même refus de comparaison que face à Vapi : « vous ne payez
pas mes journées, vous payez un système qui tourne le lendemain ».

> ⚠ **Et l'écart est peut-être un artefact.** Les 46 h du catalogue sont des
> ESTIMATIONS — aucune installation n'a eu lieu. Si une vraie pose prend 3×
> plus longtemps, Agent ALPHA tombe à 9 h et 244 €/h, ce qui est parfaitement
> défendable. **La première installation réelle tranche**, et elle tranche
> dans le sens qui t'arrange. Chronomètre-la.

### La limite du temps vendu — l'argument du produit, chiffré

```
130 jours facturés/an → 65 000 €     (occupation moyenne)
180 jours facturés/an → 90 000 €     (bien occupé)
```

Voilà le plafond de la vente de temps, et c'est exactement pourquoi l'OS
récurrent existe. À 10 ventes/mois sur l'offre Pro, tu dépasses ce plafond
sans vendre une heure de plus.

---

## 5. Ce qui manque encore

| Manque | Pourquoi ça bloque |
|---|---|
| ~~Ton taux horaire~~ → **relevé sur le marché** (§ 4 bis) | Débloqué : 71 €/h (500 €/j ÷ 7 h). À remplacer par ta compta réelle dès qu'elle existe. |
| **Le temps RÉEL d'une installation, chronométré** | Les 46 h du catalogue sont estimées. C'est ce qui décide si les frais de setup sont ×10 la main-d'œuvre ou ×3 — donc s'ils sont attaquables ou non. |
| **L'export CDR Telnyx** (Reporting → Usage Reports) | Le solde du mois (2,05 $) est connu depuis le 27/08 — mais il ne donne pas un tarif à la minute. Il faut les minutes par appel. Dernière ligne du modèle encore supposée, et la plus lourde. |
| **Le compteur Fish avant/après UN appel isolé** | Tranche le ×2,24. La piste « synthèse payée puis jetée » est écartée (`preemptive_tts: False` dans livekit-agents 1.7.1) ; reste le compteur cumulé, auquel cas le coût réel est plus BAS que ce que le modèle retient. |
| **Le taux de décroché réel** | Toute la comparaison à la minute en dépend. L'essai ScintIA le donnera. |
| **Les pages de tarifs officielles** | Le relevé est secondaire. Avant de citer un concurrent en rendez-vous, rouvre sa page. |

---

## 6. Demain, avec ScintIA — les trois chiffres à avoir en tête

```
1.  ESSAI ............ 290 € HT — mise en route + 100 appels réels
                       déduits du 1er mois s'il passe au palier sous 30 j

2.  PALIER 1 000 ..... 364 € HT/mois — sans engagement
                       coût 109 € à ta durée réelle (2,85 min)
                       → marge 255 € (70 %), soit ×3,34

3.  TON COÛT ......... ~109 € pour 1 000 appels, PAS 360 €
                       (95 € si les appels tombent à 2 min)
```

⚠ **Ce qu'il ne faut PAS dire en rendez-vous** : « on est à ×4 ». C'est
×3,34 à ta durée d'appel réelle, et la ligne Telnyx est encore une
hypothèse. Le chiffre solide, celui que tu peux défendre, c'est **70 % de
marge** — pas un multiple.

**L'ordre de la conversation :** démo gratuite → essai payant → mensualité. Ne
saute pas l'essai : c'est lui qui transforme un « intéressant » en client, et
c'est lui qui te donne ton premier taux de décroché mesuré — celui qui remplace
l'hypothèse à 20 % dans toute l'app (`tauxPourPlan`).

> ⚠ Rappel doctrine : ScintIA prend **30 % + 10 % du mensuel** sur Callflow.
> Ces chiffres-là sont NOS prix Alpha Voice, un produit différent. Ne mélange
> pas les deux grilles dans la même conversation.
