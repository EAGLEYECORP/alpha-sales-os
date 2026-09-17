# RELIER eagleyecorp.fr À GITHUB — marche à suivre

> Écrit le 17/09/2026. Le site est aujourd'hui déployé **à la main** (« drop ») :
> le déploiement en ligne date du **5 septembre** et rien ne relie le domaine au
> dépôt. Tant que c'est le cas, personne ne peut dire ce qui est réellement en
> ligne sans regarder la page.
>
> ⚠ **Les libellés de l'interface Netlify peuvent avoir bougé.** Je ne peux pas
> la charger d'ici (le proxy sortant la bloque), donc chaque étape décrit CE QUE
> L'ÉCRAN FAIT, pas seulement comment il s'appelle. Si le mot diffère, suis la
> description.

> ⚠⚠ **NE PAS REESSAYER DE DÉPLOYER DEPUIS UNE SESSION — testé le 17/09, ça ne
> passe pas.** Le MCP Netlify ne déploie rien lui-même : `deploy-site` rend une
> commande `npx @netlify/mcp … --proxy-path …` qui téléverse le dépôt et lance
> un build chez Netlify. La commande s'installe correctement (npm est autorisé),
> puis **le téléversement échoue en `403 Forbidden`** — le proxy sortant de
> l'environnement ne laisse pas passer l'hôte de dépôt. Même famille de blocage
> que `curl eagleyecorp.fr`, qui rend 403 lui aussi.
> Conséquence : **toute mise en ligne passe par un humain**, à la main ou par la
> liaison git. Une session peut préparer, tester et vérifier la source ; elle ne
> peut pas publier.
> ⚠ Une session qui tenterait quand même doit d'abord sortir `donnees-privees/`
> de l'arborescence — la commande téléverse le RÉPERTOIRE DE TRAVAIL, pas
> `site/`, et c'est `netlify.toml` (`base = "site"`) qui décide ensuite de ce
> qui est publié. Le dossier a été déplacé puis **restauré** lors de l'essai.

## Les repères

| | |
|---|---|
| Site Netlify | `eagleyecorpfr` |
| Console | `https://app.netlify.com/projects/eagleyecorpfr` |
| Dépôt | `EAGLEYECORP/alpha-sales-os` |
| Branche à choisir | `claude/crm-n8n-email-tracking-4qxtwr` ⚠ **il n'y a pas de `main`** |
| Dossier à publier | `site/` — jamais la racine |
| Déploiement de repli | `6a9b667fec9f71a8e86609df` (5 septembre) |

---

## ⚠ AVANT DE COMMENCER — deux choses qui peuvent te bloquer

1. **Le dépôt appartient à une organisation GitHub (`EAGLEYECORP`).** L'appli
   Netlify doit y être autorisée. Si tu n'es pas propriétaire de
   l'organisation, GitHub affichera une demande d'approbation **en attente** et
   la liaison ne se terminera pas. À vérifier avant, pas au milieu.
2. **Ça se fait mal au téléphone.** L'écran de configuration de build est dense
   et les champs sont faciles à rater. Si tu es au salon : fais la **voie A**
   maintenant (deux minutes, le contenu est en ligne), et la **voie B** ce soir
   sur un ordinateur.

---

## VOIE A — publier le contenu aujourd'hui, sans rien relier

À faire si tu veux juste que la nouvelle page soit en ligne tout de suite.

1. Récupère le dossier `site/` du dépôt sur ta machine (branche
   `claude/crm-n8n-email-tracking-4qxtwr`, à jour).
2. Va sur `https://app.netlify.com/projects/eagleyecorpfr` → onglet **Deploys**.
3. Glisse le dossier **`site`** sur la zone de dépôt en bas de la page
   (« Drag and drop your site output folder here »).
4. ⚠⚠ **Glisse le dossier `site`, PAS le dossier du dépôt.** Si tu déposes
   `alpha-sales-os/`, tu publies `donnees-privees/` — 78 fiches réelles, dont
   une personne physique avec son numéro. Sur un domaine public. Regarde le nom
   du dossier avant de lâcher.

Le déploiement prend ~1 minute. Passe ensuite à la **vérification** plus bas.

---

## VOIE B — relier le dépôt (ce qui supprime le problème pour de bon)

### Écran 1 — ouvrir la configuration

`https://app.netlify.com/projects/eagleyecorpfr` → **Project configuration**
(ou **Site configuration** selon la version) → dans le menu de gauche,
**Build & deploy**.

### Écran 2 — lier le dépôt

Dans la section **Continuous deployment**, le site affiche aujourd'hui quelque
chose comme « *This project is not linked to a repository* ». Clique sur
**Link repository** (ou **Set up continuous deployment**).

1. Choisis **GitHub** comme fournisseur.
2. Une fenêtre GitHub s'ouvre pour autoriser Netlify. Si elle ne s'ouvre pas :
   ton navigateur bloque la pop-up.
3. Sur l'écran GitHub, choisis l'organisation **EAGLEYECORP**, puis **n'autorise
   que le dépôt nécessaire** (*Only select repositories* → `alpha-sales-os`).
   ⚠ Ne donne pas l'accès à tous les dépôts : c'est un accès permanent en
   lecture, et il n'y a aucune raison de l'élargir.
4. De retour sur Netlify, sélectionne `EAGLEYECORP/alpha-sales-os`.

### Écran 3 — la branche, et c'est le piège

**Branch to deploy** : `claude/crm-n8n-email-tracking-4qxtwr`.

⚠ Netlify propose `main` par défaut. **Ce dépôt n'a pas de `main`** — sa
branche par défaut est celle-ci. Si tu laisses `main`, le build échouera ou ne
se déclenchera jamais, et le site restera figé sans que rien ne l'annonce.

### Écran 4 — les réglages de build

- **Base directory** : `site`
- **Build command** : *laisse vide*
- **Publish directory** : *laisse vide*

⚠ **Pourquoi laisser deux champs vides.** Le dépôt porte maintenant un
`netlify.toml` à la racine dont le seul rôle est d'écrire `base = "site"`, et
`site/netlify.toml` fournit le reste (publication du dossier, en-têtes de
sécurité). Remplir les champs dans l'interface crée une **seconde définition**
de ce qu'on publie — et le jour où les deux divergent, c'est celle qu'on ne
relit pas qui s'exécute. On saisit `base` dans l'interface uniquement parce que
c'est lui qui dit à Netlify *où trouver* le reste.

### Écran 5 — déclencher

**Deploys** → **Trigger deploy** → **Deploy site**.

Ouvre le journal du build et cherche la ligne qui nomme le dossier publié. Tu
dois y voir `site` — pas la racine du dépôt.

---

## ⚠⚠ LA VÉRIFICATION — c'est l'étape que personne n'écrit, et la seule qui compte

Quelle que soit la voie choisie, fais les trois, dans cet ordre.

**1. Le dépôt n'est pas publié.** Ouvre ces adresses. Les trois doivent rendre
une **404** (ta page 404, pas celle de Netlify) :

- `https://eagleyecorp.fr/package.json`
- `https://eagleyecorp.fr/CLAUDE.md`
- `https://eagleyecorp.fr/donnees-privees/prospects-icp.csv`

> 🚨 **Si l'une des trois affiche du contenu, arrête tout et reviens en arrière
> immédiatement** (procédure en bas). Ça veut dire que la racine du dépôt est
> servie, et la troisième adresse est une fuite de données personnelles de
> tiers. Ce n'est pas un défaut d'affichage — c'est le seul incident grave que
> ce projet ait déjà connu une fois.

**2. Le nouveau contenu est là.** Sur `https://eagleyecorp.fr` :

- la phrase **« Alpha est celui qui refuse »** apparaît sous le titre ;
- le menu du haut contient **Conformité** ;
- le lien mène à une section qui parle du **2 août 2026**.

**3. Le site n'est pas cassé.** Clique **Demander un cadrage** (ça doit ouvrir
un mail vers `contact@eagleyecorp.fr`), et ouvre `/mentions-legales` — la
redirection sans extension doit marcher.

---

## REVENIR EN ARRIÈRE

`https://app.netlify.com/projects/eagleyecorpfr` → **Deploys** → repère le
déploiement du **5 septembre** (`6a9b667fec9f71a8e86609df`) → ouvre-le →
**Publish deploy**.

C'est immédiat et sans perte : Netlify garde tous les déploiements. Revenir en
arrière n'annule pas la liaison git — ça remet simplement l'ancienne version en
ligne pendant que tu corriges la configuration.

---

## CE QUE LA LIAISON CHANGE, ET QU'IL FAUT ACCEPTER

**Chaque push sur `claude/crm-n8n-email-tracking-4qxtwr` redéploie
eagleyecorp.fr.** C'est le but — plus d'envoi manuel, plus de doute sur ce qui
est en ligne. Mais c'est aussi la branche de développement du produit : une
modification de `site/` part en public à la seconde où elle est poussée, sans
relecture intermédiaire.

C'est acceptable tant que `site/` est gardé par `tests/site-vitrine.test.ts` —
la catégorie doit correspondre au code, aucune promesse de conformité, aucun
label, aucun montant d'amende, et la configuration ne peut pas publier la
racine. Le jour où quelqu'un pousse sans faire tourner les tests, cette garde
ne s'exécute pas : **rien dans Netlify ne lance `npm test`.**

> ⚠ La suite logique, quand il y aura le temps : une action GitHub qui refuse le
> push si les tests tombent. Aujourd'hui, la garde protège celui qui la lance —
> c'est mieux que rien, et ce n'est pas une barrière.
