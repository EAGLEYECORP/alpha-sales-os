# DÉMARRAGE — la prise en main, pas à pas

**EAGLEYE CORP · ALPHA SALES OS®**

Ce document accompagne l'écran **`/demarrage`**. L'écran sait où tu en es et
te donne la prochaine action ; ce document explique le pourquoi de chaque
étape et ce qu'il faut avoir sous la main.

Si tu ne lis qu'une chose : **ouvre `/demarrage`, fais ce qui est écrit dans
l'encadré du haut, reviens.** Tout le reste est du contexte.

---

## Comment le chemin fonctionne

Seize étapes, quatre phases, dans un ordre qui n'est pas négociable :

| Phase | Ce qu'elle produit | Durée honnête |
|---|---|---|
| **1 · Brancher** | La machine peut envoyer, écrire, recevoir. Rien ne part encore. | ~1 h, une seule fois |
| **2 · Charger** | Du carburant dans le réservoir. | 2 à 4 h — la partie la plus rentable |
| **3 · Lancer** | Les premières touches partent, sur les trois canaux. | la première semaine |
| **4 · Tenir** | Le rythme s'installe. | tous les jours |

**Treize étapes sur seize se cochent toutes seules.** Pas parce que tu as
déclaré les avoir faites — parce que l'app constate la donnée : le serveur voit
le SMTP, le DNS répond, le CRM contient un événement email, le pipe contient
300 fiches. Une case qu'on coche soi-même ment ; un compteur ne ment pas.

Les trois étapes restantes (offre, recette, qualité de la base) sont marquées « case manuelle » à l'écran. Elles valent ce que vaut ta rigueur.

> **Si une étape reste rouge alors que tu es sûr de l'avoir faite, c'est la
> donnée qui a raison.** Un SMTP renseigné mais l'app pas redémarrée, un DNS
> publié mais pas encore propagé, un import lancé mais échoué en silence.
> Clique « Réévaluer » et lis le détail : il dit exactement ce que l'app voit.

---

## Phase 1 — Brancher (~1 h, une seule fois)

À avoir sous la main avant de commencer : tes identifiants SMTP, l'accès à ton
registrar de domaine (OVH), et 1 heure sans interruption.

### 1.1 Brancher l'envoi email — 15 min
Le seul organe sans lequel rien d'autre ne sert.
`.env.local` : `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`.
Redémarre l'app. L'organe « Envoi email » passe au vert dans `/pilote`.

### 1.2 Publier SPF, DKIM et DMARC — 20 min
**L'étape que tout le monde saute, et celle qui coûte le plus cher.**

> **Préalable non négociable : envoie depuis TON domaine.** SPF, DKIM et DMARC
> se publient sur un domaine que tu contrôles. Depuis `@gmail.com`,
> `@outlook.com` ou `@orange.fr`, ces enregistrements appartiennent au
> fournisseur : tu ne peux rien y publier, et l'ancienneté de ton compte
> personnel ne transfère aucune réputation à de la prospection. ALPHA rend un
> verdict **bloquant** dans ce cas. Détail complet : `docs/ENVOI.md`.

Sans ces enregistrements, les mails partent mais n'arrivent pas — et aucune
alerte ne remonte. Tu conclurais que ton message est mauvais alors que
personne ne l'a reçu.

`/settings` → *Délivrabilité du domaine* → lis le verdict → copie
l'enregistrement → publie-le chez OVH → reviens → « Vérifier ».

*État connu de `eagleye.fr` : SPF publié, **DMARC absent**. À corriger.*
Enregistrement à publier sur `_dmarc.eagleye.fr` :
`v=DMARC1; p=none; rua=mailto:postmaster@eagleye.fr`
Commence en `p=none` (observation), passe à `p=quarantine` après quelques
semaines de rapports.

### 1.3 Brancher l'IA locale — 20 min
`ollama pull qwen2.5:3b`, puis `OLLAMA_URL` et `OLLAMA_MODEL` dans
`.env.local`. Sans IA l'app bascule sur des templates hors-ligne : ça marche,
mais tu perds la personnalisation par fiche — donc l'essentiel de l'avantage.

### 1.4 Connecter le cerveau n8n — 30 min
n8n fait tourner ce qui doit tourner sans toi : synchro CRM, réponses
entrantes, remontée du tracking. Importe les workflows de `integrations/`,
puis `/settings` → *Connexion n8n* → « Tester la connexion » → « Récupérer mes
prospects ».

### 1.5 Armer les réponses entrantes — 15 min
`WEBHOOK_SECRET` dans `.env.local`, puis pointe n8n sur
`POST /api/webhooks/inbound` avec l'en-tête `x-webhook-secret`.
C'est ce qui détecte les STOP automatiquement — **c'est un sujet légal, pas
seulement une politesse.**

### 1.6 Créer le lien de réservation — 15 min
La pièce qui donne des **rendez-vous en autonomie** : le prospect pose le
créneau lui-même pendant que tu es sur le terrain. Cal.com ou Calendly, 15 min,
« Audit express ». Colle-le dans `/settings` → *Agence*. Il apparaît alors dans
les emails, les messages LinkedIn et l'audit cadeau.

### 1.7 Fixer ton offre et tes règles — 20 min *(manuel)*
Les Règles business sont injectées **mot pour mot** dans chaque génération. Si
elles sont floues, tout ce que l'IA écrit sera flou. Relis-les ligne par ligne.

### 1.8 Passer la recette — 30 min *(manuel)*
`/recette` prouve que la boucle tourne vraiment : envoi → ouverture → clic →
réponse → STOP. Tant qu'elle n'est pas passée, tu supposes, tu ne sais pas.

---

## Phase 2 — Charger (2 à 4 h)

### 2.1 Charger 300 fiches minimum — 3 h
**C'est le vrai goulot, et de très loin.** Avec 25 fiches, aucun taux n'est
fiable et le meilleur outil du monde tourne à vide. Avec 300, la machine a de
quoi travailler pendant un mois.

Cible un périmètre étroit : Lyon + **une** verticale. Minimum vital par fiche :
nom, secteur, ville, téléphone. L'email peut venir après.
`/settings` → *Données réelles* → CSV ou lien Google Sheets.

### 2.2 Nettoyer ce qui bloquerait l'envoi — 45 min *(manuel)*
Une base sale brûle la réputation du domaine : chaque adresse morte est un
rebond, et les rebonds comptent contre toi longtemps. Supprime les doublons et
les fiches sans aucun moyen de contact.

---

## Phase 3 — Lancer (première semaine)

### 3.1 Première salve email
**Commence à 5 envois par jour.** La boîte n'est pas chauffée, et ALPHA n'a pas
de warmup automatique (contrairement à Instantly ou Smartlead — voir
`docs/MARCHE.md`). Monte de 5 par semaine jusqu'à 40. Plus vite, tu grilles le
domaine et tu perds tout d'un coup.

| Semaine | Envois/jour |
|---|---|
| 1 | 5 |
| 2 | 10 |
| 3 | 15 |
| … | … |
| 8 | 40 — plafond, on n'y touche plus |

Tu n'as rien à calculer : `/pilote` → *Volume du jour* applique le palier tout
seul, à partir de la date de ton premier envoi consigné. Et pour aller au-delà
de 40/jour il faudrait plusieurs boîtes en rotation — voir `docs/ENVOI.md` §2.

### 3.2 Première session d'appels
L'appel est le canal qui signe. Bloque 45 minutes sans interruption : **15
appels valent mieux que 40 bâclés.** Après chaque appel, clique le statut — il
écrit dans le CRM. Aucun appel ne se termine sans prochaine étape datée.

### 3.3 Machine LinkedIn
Quota **25 actions/jour**, ce n'est pas de la prudence excessive : au-delà, les
comptes se font restreindre. Invitation → J+2 message → J+4 relance. **Jamais
de lien dans l'invitation.**

### 3.4 Premier rendez-vous
Prépare-le dans `/closer` : score de chaleur, angle, itinéraire. Mode closing
pendant l'entretien. Sors avec une prochaine étape datée. Toujours.

---

## Phase 4 — Tenir (tous les jours)

### La journée type — environ 90 minutes

| Moment | Écran | Geste |
|---|---|---|
| Matin, 15 min | `/pilote` | Volume du jour + file de décision, de haut en bas |
| Matin, 30 min | `/newsletter` ou `/campaigns` | La salve email du jour |
| Après-midi, 45 min | `/appels` | La session d'appels |
| En déplacement | `/closer` | Tournée, brief, closing |
| Fin de journée, 5 min | fiches touchées | Consigner. Ce qui n'est pas consigné n'existe pas. |

### 4.1 Tenir le volume 5 jours de suite
Un client demande 50 à 200 touches utiles. Cinq jours tenus, c'est ce qui
sépare une machine d'une bonne intention — et c'est le seul moyen d'obtenir des
chiffres qui veulent dire quelque chose.

L'app compte une journée « tenue » à partir de **20 touches consignées**, et
regarde les **14 derniers jours**. Cinq journées tenues valident l'étape.

### 4.2 Premier client signé
`/pipeline` → passe la fiche en « signé » **quand l'argent est encaissé**, pas
quand la parole est donnée. `/preuves` ne compte que l'encaissé. Demande le
témoignage dans les 7 jours, pendant que le résultat est frais.

---

## Les capacités — et pourquoi on ne les dépasse pas

| Canal | Plafond/jour | Ce qui casse au-delà |
|---|---|---|
| Email | 40 | La réputation d'envoi décroche. Invisible, puis brutal. |
| LinkedIn | 25 | Le compte se fait restreindre. |
| Appels & visites | 30 | La qualité de conversation chute — et c'est elle qui signe. |
| **Total** | **~95** | |

Ce ne sont pas des limites de l'outil, ce sont des limites du monde réel avec
**une** boîte d'envoi et **un** profil. Au-delà, on ne gagne pas plus : on perd
tout d'un coup.

---

## Reprendre après une pause

Tu as arrêté deux semaines ? Ne recommence pas de zéro.

1. `/demarrage` → « Réévaluer ». Le chemin se recalcule sur tes données
   réelles : ce qui est fait reste fait.
2. `/pilote` → la file de décision montre ce qui s'est accumulé. Traite les
   urgentes d'abord.
3. `/nurture` → les fiches refroidies. Une relance vaut mieux qu'un nouveau
   contact : le coût d'acquisition est déjà payé.

---

## Où trouver le reste

| Question | Document |
|---|---|
| La doctrine, les dix commandements, les sept péchés | `docs/BIBLE.md` |
| Ce qui tourne sans moi, et comment le lancer en service | `docs/AUTOPILOTE.md` |
| Les chiffres, capacités, taux de conversion | `docs/CHIFFRES.md` |
| Face à la concurrence, et Alpha Voice | `docs/MARCHE.md` |
| Le playbook terrain par verticale | `docs/TERRAIN.md` |
| L'installation technique détaillée | `docs/INSTALLATION.md` |
| Adresse d'envoi, rythme, tracking | `docs/ENVOI.md` |
| Le débrief vocal et l'assistant d'appel | `docs/VOIX.md` |

---

## La seule phrase à retenir

**Brancher avant de charger, charger avant d'envoyer, envoyer avant de tenir.**
Sauter une phase, c'est faire du volume dans le vide.
