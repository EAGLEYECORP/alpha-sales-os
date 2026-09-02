# VOIX — débrief terrain & assistant d'appel

**EAGLEYE CORP · ALPHA SALES OS®**

Deux briques vocales, construites d'après l'analyse de `docs/MARCHE.md` §4.
Ni l'une ni l'autre n'adresse la parole à un prospect : **l'IA parle à son
opérateur, jamais à un tiers.** C'est ce qui les met hors du champ de
l'obligation de divulgation de l'article 50 du règlement européen sur l'IA,
applicable depuis le 2 août 2026.

---

## (a) Débrief terrain — `/debrief`

### Le geste

Tu sors du rendez-vous. Tu ouvres `/debrief` sur ton téléphone, tu choisis la
fiche, tu appuies sur le micro et tu parles quarante secondes :

> « Garage Bouchon, j'ai vu Marc le gérant, ils ratent des appels le samedi,
> il veut en parler à son associé, je rappelle jeudi. »

ALPHA en tire :

| Champ | Extrait |
|---|---|
| Interlocuteur | Marc |
| Frein | « Je dois en parler à mon associé » |
| Prochaine étape | Rappeler — **jeudi**, daté |
| Canal | Appel (ou visite si tu dis « sur place », « je sors de chez eux ») |
| Notes | Le transcript complet, intact |

Tu relis, tu corriges ce qui doit l'être, tu écris dans le CRM. Trente
secondes au lieu des dix minutes du soir — dix minutes qu'on ne prend jamais.

### Ce que ça règle

La saisie d'après-coup est ce qui tue les CRM. Pas l'envoi, pas le script :
le fait qu'après une journée de terrain, personne n'a l'énergie de ressaisir
six rendez-vous. Résultat : la fiche ment, la relance n'arrive pas, le deal
meurt d'une mort administrative.

### Les règles, et pourquoi

**Rien n'est écrit sans relecture.** L'écran produit un brouillon éditable
champ par champ. Aucune écriture automatique dans le CRM.

**Aucune date n'est devinée.** Si tu ne dis pas de date, la prochaine étape
n'est pas créée — l'écran affiche « aucune date entendue ». Une prochaine
étape inventée est pire que pas de prochaine étape, parce qu'elle a l'air
vraie. **Dis toujours ta date à voix haute.**

**Le jour cité en passant n'est pas le rendez-vous.** Dans « ils ratent des
appels *le samedi*, je rappelle *jeudi* », la date retenue est jeudi.
L'extraction s'ancre sur le verbe d'action (rappeler, repasser, envoyer,
relancer, on se voit) et lit ce qui suit.

**Rien ne peut faire passer une fiche en « signé ».** L'étape suggérée peut
être audit, démo, offre, red zone ou perdu. Jamais signé : signer est un
engagement, il se décide, il ne se dicte pas.

### Ce que la date comprend

| Tu dis | Compris comme |
|---|---|
| demain, après-demain, ce soir | +1, +2, aujourd'hui |
| jeudi, lundi matin | la prochaine occurrence de ce jour (jamais aujourd'hui) |
| dans 3 jours, dans deux semaines, dans un mois | décalage exact |
| la semaine prochaine, le mois prochain | +7 jours, +1 mois |
| le 12 septembre | la date exacte (l'an prochain si elle est déjà passée) |
| le 12 | le prochain 12 du mois |

> Réserve honnête : « mardi prochain » est compris comme **le prochain
> mardi**, pas comme « le mardi de la semaine suivante ». L'usage français
> hésite entre les deux. Le champ date est modifiable juste à côté —
> jette-lui un œil quand tu dis « prochain ».

### Les deux moteurs

1. **Déterministe, hors-ligne, instantané.** Il tourne toujours, sans modèle,
   sans réseau. Ce n'est pas un repli au rabais : quand Ollama n'est pas
   branché — le cas par défaut — c'est LUI la fonctionnalité.
2. **Ollama, s'il est configuré.** Il affine deux champs mous : le résumé et
   le nom de l'interlocuteur. **Il ne touche jamais à la date** — une date
   hallucinée devient un rendez-vous manqué.

Si le serveur est injoignable, l'extraction retombe côté navigateur. Le
débrief ne se perd pas.

---

## (b) Assistant d'appel — bouton dans `/appels` et `/closer`

### Le geste

Avant de composer, tu cliques « Écouter ». Pendant l'appel, dès qu'une
objection est prononcée, la réponse du playbook s'affiche — mot pour mot,
prête à être dite.

L'assistant **n'émet aucun son.** Il ne parle qu'à toi, à l'écran.

### Pourquoi aucune IA générative ici

Une réponse qui met deux secondes à arriver arrive trop tard. L'appariement
est local et déterministe : quelques millisecondes, hors-ligne. Et la bonne
réponse est celle qu'on a écrite à froid, dans le playbook — pas celle qu'un
modèle improvise à chaud pendant que tu as le prospect en ligne.

### Ce qu'il reconnaît

**Douze objections génériques** — « on a déjà quelqu'un », « c'est trop
cher », « ça coûte combien ? », « envoyez-moi un mail », « pas le temps »,
« je dois en parler à mon associé », « un robot ça fait fuir », « on gère »,
« rappelez-moi », « ça ne m'intéresse pas », « on est complets », « pas le
moment ».

**Plus les objections de la verticale**, tirées de `lib/playbook.ts`. Quand le
métier a sa propre réponse, elle passe devant la générique : elle a été
écrite pour lui.

Si rien ne correspond, **l'assistant se tait.** Souffler à côté en plein appel
est pire que de ne rien souffler.

### Les alertes doctrine

C'est la partie qu'aucun outil du marché n'a, parce qu'elle vient de ta
méthode. L'assistant écoute aussi **ce que TU dis** et alerte quand tu casses
la doctrine :

| Alerte | Déclenchée par |
|---|---|
| Tu parles prix avant la démo | « ça coûte », « euros », « tarif », « abonnement par mois » |
| Tu chiffres les € perdus à froid | « vous perdez », « manque à gagner » |
| Tu cites sa note Google | « note Google », « avis », « étoiles » |
| Ton ciblage est en volume, pas en critère | « toutes les agences », « tous les garages » |
| Ton observation est une affirmation | « j'ai vu que », « j'ai remarqué » |
| Tu déroules les fonctionnalités | « ça permet aussi », « il y a aussi » |

Chaque alerte donne la correction, pas seulement le reproche.

---

## Ce qu'il faut savoir avant de compter dessus

**Navigateur.** La transcription du navigateur utilise la Web Speech API :
**Chrome, Edge et Safari la savent ; Chromium, Brave et Firefox non** (ils
n'embarquent pas la clé du service vocal de Google — l'erreur y est « network »,
pas un vrai problème réseau). Deux replis, partout : le bouton **« Écrire au
clavier »**, et — dès que la transcription serveur est branchée — le bouton
**« Dicter (serveur) »**.

**Transcription serveur — marche sur TOUS les navigateurs.** Le Débrief peut
enregistrer l'audio (MediaRecorder, universel) et le transcrire côté serveur,
ce qui contourne entièrement la Web Speech API. On branche un fournisseur ASR :
`DEEPGRAM_API_KEY` (palier gratuit) ou un endpoint Whisper compatible OpenAI
(`WHISPER_API_URL` + `WHISPER_API_KEY`). Route : `app/api/transcribe`, capture :
`components/voice/use-recorder.ts`. Sans clé, le bouton n'apparaît pas et le
repli clavier reste.

**Ce n'est pas 100 % local.** Sur Chrome de bureau, la reconnaissance transite
par les serveurs de Google. C'est acceptable ici — tu dictes TES propres
notes, pas la parole d'un tiers — mais ça se dit, ça ne se cache pas. Si un
jour ça devient bloquant, la brique à remplacer est
`components/voice/use-speech.ts` par un Whisper local ; le reste du code ne
bouge pas.

**Chromium annonce parfois savoir transcrire sans le pouvoir.** Si le micro ne
rend rien, l'erreur s'affiche — bascule au clavier, le résultat est identique.

**Parle normalement.** Pas besoin d'articuler comme un robot. En revanche :
dis le nom de la personne, dis le frein, **dis la date**.

---

## (c) Alpha Voice — l'agent qui parle · `/voice`

Construit. Le détail d'installation est dans `voice/README.md`.

Il sert la **démonstration** : le prospect entend, sur son propre métier, ce
que vivraient ses clients. C'est la doctrine appliquée — l'émotion avant le
prix — et c'est ce qui a converti la Carrosserie des Brotteaux.

**La divulgation est prononcée par le code, pas par le modèle.** Un modèle
peut reformuler ou sauter une consigne ; une ligne de code, non. Elle passe
sans interruption possible, et si le script ne porte pas les trois mentions de
l'article 50, l'agent refuse de démarrer — vérifié des deux côtés, app et
service.

Trois modes exposés : démo entrante, démo sortante sur rendez-vous, rappel
d'un contact entrant — **et le démarchage à froid**, voir juste en dessous.

---

## L'APPEL À FROID — la décision a été renversée le 28/08/2026

> ⚠ **Cette section disait « pas de démarcheur téléphonique IA sortant » et
> elle a continué de le dire pendant que le code faisait l'inverse.** C'est le
> défaut le plus coûteux qu'un document puisse porter : il ne périme pas en
> silence, il **argumente contre l'état réel** auprès de quiconque le lit de
> bonne foi.

Alpha Voice **démarche à froid** et mène l'appel entier : il qualifie et
conclut lui-même. La règle est dans le code — `COLD_CALLING_DISCIPLINE`
(`lib/voice-script.ts`).

**Les trois raisons de ne pas le faire, et ce qu'elles sont devenues**
(développé dans `docs/MARCHE.md` §4.2) :

1. **L'article 50** impose qu'un agent qui appelle se déclare artificiel et
   dise pour le compte de qui il agit. → **Toujours vrai, et maintenant
   appliqué par le code** : la phrase est prononcée par `first_sentence`, pas
   par le modèle, et `audit_script` refuse un script non conforme. Le taux de
   raccrochage derrière cette phrase **reste non mesuré** — c'est ce que le
   palier 10 achète.
2. **Le conflit de posture** — « notre premier contact ne peut pas être une IA
   qui démarche » parce qu'on revendait le produit d'un tiers. → **Tombé** :
   l'accord revendeur est mort le 02/09/2026 et Alpha Voice est à nous.
   L'entrant et le sortant sont le même produit, avec la même divulgation.
3. **Ce n'est pas le goulot** — le goulot est le nombre de fiches en base.
   → **Toujours vrai, mais ce n'est pas un veto** : c'est la raison d'être des
   paliers 10 · 100 · 1 000, qui n'autorisent le volume qu'après la mesure.

**Ce qui reste de l'ancien refus, et qui compte :** une IA qui démarche n'a
droit à **aucune improvisation**. Objectif unique (le RDV), aucun prix, le NON
qui raccroche, le OUI qui passe la main. `auditScript` refuse un script qui
s'en écarte.

La pile n'est plus en veille : l'entrant tourne en production
(`voice/INBOUND.md`), le sortant est cadencé par `lib/call-cadence.ts`.

---

## Où c'est dans le code

| Rôle | Fichier |
|---|---|
| Normalisation du texte parlé | `lib/speech-text.ts` |
| Extraction du débrief + dates françaises | `lib/debrief.ts` |
| Catalogue d'objections + alertes doctrine | `lib/live-assist.ts` |
| Capture micro (Web Speech API) | `components/voice/use-speech.ts` |
| Panneau d'assistant d'appel | `components/voice/live-assist.tsx` |
| Écran de débrief | `app/(app)/debrief/page.tsx` |
| Affinage IA (Ollama, optionnel) | `app/api/debrief/route.ts` |
| Tests (dates, extraction, appariement) | `tests/voice.test.ts` |
