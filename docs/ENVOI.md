# ENVOI — depuis quelle adresse, à quel rythme, et ce que le tracking dit vraiment

**EAGLEYE CORP · ALPHA SALES OS®**

Trois questions, trois réponses fermes. Elles décident si tes mails arrivent
ou pas, et aucune n'est une question de goût.

---

## 1. Depuis quelle adresse ? Pas depuis une boîte Gmail personnelle.

C'est contre-intuitif, donc voilà le raisonnement complet.

### L'ancienneté d'un compte ne se transfère pas à la prospection

Un compte Gmail vieux de dix ans a une excellente réputation **pour ce qu'il a
fait** : de la correspondance personnelle, quelques dizaines de messages par
mois, vers des gens qui répondent. La réputation d'envoi ne se mesure pas en
années, elle se mesure en **schéma d'envoi**. Le jour où cette boîte passe à
120 messages sortants vers des inconnus, avec un lien et un pied de
désinscription, elle produit exactement l'anomalie que les filtres cherchent —
et l'ancienneté ne protège de rien. Elle aggrave même le contraste.

### Tu ne peux rien authentifier sur `gmail.com`

C'est le point technique décisif. SPF, DKIM et DMARC se publient sur **un
domaine que tu contrôles**. `gmail.com` appartient à Google :

```
gmail.com        v=spf1 redirect=_spf.google.com
_dmarc.gmail.com v=DMARC1; p=none; sp=quarantine; rua=mailto:mailauth-reports@google.com
```

Ces enregistrements sont ceux de Google, pas les tiens. Tu ne peux ni les
modifier, ni t'y identifier, ni construire de réputation dessus. Tout le
travail de délivrabilité — celui que le panneau *Réglages → Délivrabilité*
mesure — devient impossible.

**ALPHA le détecte maintenant** : si `SMTP_FROM` pointe sur une boîte grand
public (Gmail, Outlook, Yahoo, Free, Orange, La Poste…), le verdict est
**bloquant**, avec l'explication à l'écran. Il ne te dira jamais « tout est
bon » sur un domaine qui ne t'appartient pas.

### Les autres raisons, plus courtes

- **Plafond dur.** Un compte Gmail gratuit est limité à ~100 emails/jour en
  SMTP. Tes 120–150 sont hors d'atteinte par construction.
- **Conditions d'usage.** La prospection non sollicitée depuis une adresse
  grand public gratuite est contraire aux règles de ces services. Le risque
  n'est pas un avertissement : c'est la suspension du compte — celui qui porte
  aussi tes affaires personnelles.
- **Cohérence de marque.** Tes emails portent l'identité EAGLEYE CORP, le pied
  RGPD et la mention `eagleye.fr`. Un `From:` en `@gmail.com` derrière tout ça
  affaiblit le message avant même qu'il soit lu.

### Ce qu'il faut faire — et tu as déjà l'infrastructure

`eagleye.fr` a **déjà** des serveurs de messagerie chez OVH :

```
MX      mx0.mail.ovh.net, mx1.mail.ovh.net, mx2.mail.ovh.net, mx3.mail.ovh.net
SPF     v=spf1 include:mx.ovh.com ~all       ← déjà publié ✓
DMARC   absent                                ← à publier
```

Tu n'as donc rien à acheter. La marche à suivre :

1. **Crée (ou récupère) une boîte `@eagleye.fr`** dans l'espace client OVH.
   `contact@`, `zakaria@`, peu importe — une vraie boîte, pas un alias.
2. **Active DKIM** pour `eagleye.fr` dans OVH (Emails → Domaine → DKIM).
   C'est une case à cocher ; OVH publie l'enregistrement lui-même.
3. **Publie DMARC** : TXT sur `_dmarc.eagleye.fr` →
   `v=DMARC1; p=none; rua=mailto:postmaster@eagleye.fr`
4. **Pointe ALPHA dessus** dans `.env.local` :
   ```
   SMTP_HOST=ssl0.ovh.net
   SMTP_PORT=587
   SMTP_USER=contact@eagleye.fr
   SMTP_PASS=<le mot de passe de la boîte>
   SMTP_FROM=EAGLEYE CORP <contact@eagleye.fr>
   ```
5. **Vérifie** : *Réglages → Délivrabilité du domaine → Vérifier*. Les trois
   voyants doivent passer.

> Ton Gmail reste utile : garde-le pour recevoir les notifications de
> réservation, les rapports DMARC si tu veux, et ta correspondance. Ce n'est
> pas lui l'adresse d'envoi de la prospection.

**Si tu veux quand même utiliser l'interface Gmail**, la solution propre est
Google Workspace avec `eagleye.fr` comme domaine (~7 €/mois) : tu retrouves
Gmail, mais le `From:` est `@eagleye.fr` et les enregistrements sont à toi. Ce
qui n'est jamais acceptable, c'est d'envoyer *depuis* `@gmail.com`.

---

## 1 ter. Le mode qui marche AUJOURD'HUI : ALPHA rédige, tu envoies

C'est le compromis juste, et ce n'est pas un pis-aller. `/outbox` prépare les
messages du jour, personnalisés par le playbook, et ouvre **ta** fenêtre de
rédaction Gmail pré-remplie. Tu relis, tu cliques « Envoyer » **dans Gmail**.
Puis « J'ai envoyé » dans ALPHA, et la touche entre dans le CRM.

C'est exactement le geste de la machine LinkedIn : l'app prépare, l'humain
envoie.

### Pourquoi ça change tout par rapport à l'envoi SMTP depuis Gmail

Les objections du §1 portaient sur **l'envoi automatisé en volume** depuis une
adresse grand public : plafond SMTP, conditions d'usage, réputation. Rien de
tout ça ne s'applique ici, parce qu'il ne s'agit plus d'envoi automatisé :

| | SMTP automatisé | `/outbox` manuel |
|---|---|---|
| Qui appuie sur Envoyer | l'app | toi, dans Gmail |
| Volume | 40+/jour, en salve | 5/jour, un par un |
| Conditions d'usage Gmail | prospection en masse → risque de suspension | correspondance ordinaire |
| Format | HTML | texte brut |
| Dans tes « Messages envoyés » | non | oui, avec le fil |

Cinq messages écrits un par un, relus, envoyés à la main depuis ta boîte, ce
n'est pas de la prospection en masse. C'est de la correspondance — et Gmail
la traite comme telle.

### Ce que tu gagnes

- **Rien à configurer.** Pas de `SMTP_*`, pas de mot de passe d'application.
  Ça marche maintenant, sur `eagleyecorp.ad@gmail.com` comme sur n'importe
  quelle adresse.
- **Le message est bon.** Personnalisé par la verticale du playbook, posture
  pull, sortie STOP incluse. En texte brut — ce qui, pour un premier contact,
  bat le HTML : ça ressemble à un humain qui écrit.
- **L'anti-doublon fonctionne.** ALPHA enregistre le message avant d'ouvrir
  Gmail. Si tu as déjà écrit à cette adresse dans les 14 jours, il te le dit.
- **Les clics sont tracés.** Les liens nus sont réécrits en liens tracés.
- **La réponse arrive dans ta boîte**, dans le bon fil, comme n'importe quel
  échange.

### Ce que tu perds, et il faut le savoir

- **Les ouvertures.** Un message en texte brut n'a pas d'images, donc pas de
  pixel. Elles ne sont pas mesurées — et l'app affiche « non mesuré » plutôt
  qu'un zéro qui ressemblerait à un échec. Rappel de l'ordre de fiabilité :
  **réponse > clic > ouverture**.
- **La charte graphique.** Pas de mise en page CALM, pas de logo aigle. Pour
  un premier contact froid, c'est un gain déguisé en perte.
- **Le geste manuel.** Cinq ouvertures d'onglet par jour, cinq clics
  « Envoyer », cinq « J'ai envoyé ». Compte trois minutes.

### Le seul piège : « J'ai envoyé »

C'est la seule chose que l'app ne peut pas constater seule. Si tu ne cliques
pas, la touche n'existe pas : la fiche te sera reproposée demain, et le CRM
mentira sur ce que tu as fait. **Clique-le au retour de Gmail, pas plus tard.**

Et n'invente pas l'inverse : ne clique pas « J'ai envoyé » avant d'avoir
réellement envoyé. La carte reste visible après le clic — précisément pour que
tu voies ce que tu viens de consigner.

### Le compte expéditeur

Renseigne `eagleyecorp.ad@gmail.com` en haut de `/outbox`. Sans lui, Gmail
rédige depuis le dernier compte Google utilisé dans le navigateur — l'erreur
qu'on ne remarque qu'après avoir cliqué Envoyer.

### Quand `eagleye.fr` arrive lundi

Rien à jeter. Deux options qui coexistent :

- **garder `/outbox`** pour les 5 à 15 messages à forte valeur, écrits un par
  un — c'est là que les réponses se gagnent ;
- **brancher le SMTP OVH** pour le volume et la newsletter, avec la charte, le
  pixel d'ouverture et la montée en charge automatique.

Le plus probable : les deux. Le manuel pour les meilleures fiches, le SMTP
pour la lettre hebdomadaire.

---

## 1 bis. ~~Le cas transitoire : une adresse sur un domaine qui n'est pas le tien~~

> **SECTION RETIRÉE — 02/09/2026.** Elle décrivait comment envoyer depuis une
> boîte hébergée sur le domaine d'un partenaire, en attendant `eagleye.fr`.
> Ce partenariat est terminé : cette adresse n'est plus la nôtre à utiliser, et
> l'audit DNS de leur domaine n'a plus à figurer dans notre dépôt.
>
> **Ce qu'il faut en retenir, et qui vaut pour n'importe quel domaine :**
>
> · **Un domaine dont tu n'es pas admin ne peut pas porter ta prospection.**
>   Tu ne peux y publier ni SPF, ni DKIM, ni DMARC ; tu ne peux rien réparer ;
>   et les rebonds d'une liste froide frappent la réputation de quelqu'un
>   d'autre. Envoie depuis TON domaine.
> · **Plusieurs enregistrements DMARC valent ZÉRO.** La norme impose au
>   destinataire de tous les ignorer dès qu'il en trouve plus d'un : un domaine
>   avec sept DMARC est traité exactement comme un domaine sans DMARC. Ce piège
>   est vérifié en code par `lib/deliverability-dns.ts`, pas seulement écrit
>   ici — c'est la seule forme qui survit.
> · **Une adresse sur un domaine tiers reste légitime pour la correspondance
>   individuelle** (réponses, rendez-vous). Ce n'est pas de la prospection en
>   volume et ça ne pose aucun de ces problèmes.

## 2. À quel rythme ? Pas 120–150 sur une boîte.

### L'arithmétique, sans confort

| Objectif | Boîtes nécessaires | État chez nous |
|---|---|---|
| 40/jour | 1 | atteignable en 8 semaines |
| 120/jour | 3 | pas d'infrastructure de rotation |
| 150/jour | 4 | idem |

Le plafond de **40/jour par boîte** n'est pas une prudence excessive : c'est le
seuil au-delà duquel une boîte unique, sans réseau de warmup, décroche. Et le
décrochage est invisible puis brutal — tu continues d'envoyer, plus rien
n'arrive, et tu conclus que ton message est mauvais.

Pour tenir 120–150/jour proprement il faut ce qu'ont Instantly et Smartlead :
plusieurs boîtes sur plusieurs domaines secondaires, rotation, warmup
automatique. **ALPHA n'a rien de tout ça** — c'est écrit dans
`docs/MARCHE.md` §3, et ce n'était pas un oubli : c'est un chantier
d'infrastructure qui ne lève pas le goulot actuel.

### La montée en charge est maintenant calculée, pas déclarée

ALPHA lit la **date du premier email consigné dans le CRM** et en déduit le
plafond du jour :

| Semaines depuis le 1ᵉʳ envoi | Plafond/jour |
|---|---|
| aucun envoi | 5 |
| 1 | 5 |
| 2 | 10 |
| 3 | 15 |
| 4 | 20 |
| … | +5/semaine |
| 8 et au-delà | 40 — plafond, définitif |

C'est le chiffre qu'affiche `/pilote` → *Volume du jour*, avec la raison. On ne
peut pas se mentir dessus : il ne vient pas d'un réglage, il vient de
l'historique réel.

### La bonne façon de lire ça

Ton goulot n'est pas le nombre d'emails que tu peux envoyer. **Ton goulot,
c'est le nombre de fiches en base.** 120 emails/jour × 5 jours = 600 touches
par semaine. Charge d'abord 300 à 600 fiches ; à ce moment-là, la question du
volume deviendra réelle — et on saura si elle vaut un chantier de rotation.

Et l'email n'est qu'un tiers du volume. Le plan quotidien complet monte à ~95
touches/jour : **40 emails + 25 LinkedIn + 30 appels/visites.** C'est là que
les 120 se trouvent, pas dans une seule boîte poussée au rouge.

---

## 3. Le tracking : ce qui est branché, et ce que les chiffres valent

### C'est déjà construit

| Brique | Où |
|---|---|
| Pixel d'ouverture | `/api/track/open/[id]` |
| Redirection de clic (par lien, comptée) | `/api/track/click` |
| Anti-doublon « déjà contacté » | `/api/track/contacted` |
| Statistiques | `/api/track/stats` |
| Vue par prospect | fiche → onglet *Tracking* |
| Vue par secteur + totaux | `/campaigns` |
| Test bout-en-bout | `/recette` |

Chaque email parti de l'app est tracké automatiquement. Il n'y a rien à coder.

### Les trois variables qui décident si ça marche

```
TRACKING_BASE_URL=https://alphasalesos.vercel.app   # ← la plus importante
APP_BASE_URL=https://alphasalesos.vercel.app
SUPABASE_SERVICE_ROLE_KEY=<clé service Supabase>
```

**`TRACKING_BASE_URL` est la pièce maîtresse.** Le pixel et les liens de clic
sont chargés par le destinataire, sur SA machine. S'ils pointent sur
`localhost:3000`, ils ne se chargent nulle part et tu ne mesures rien. Ils
doivent pointer sur une URL publique — ton déploiement Vercel.

**`SUPABASE_SERVICE_ROLE_KEY`** rend le tracking durable. Sans elle, les
compteurs vivent en mémoire et repartent à zéro à chaque redémarrage — et sur
Vercel, chaque instance a sa propre mémoire.

### Comment vérifier que c'est vraiment branché

`/recette` fait le test complet, en conditions réelles : envoi → ouverture →
clic → réponse → STOP. Envoie-toi le message de test, ouvre-le, clique le
lien, et regarde les voyants bouger. Tant que la recette n'est pas passée, tu
supposes que ça trace ; tu ne le sais pas.

### Ce que les taux valent — et la limite du taux d'ouverture

**Le taux d'ouverture est indicatif, pas mesuré.** Apple Mail Privacy
Protection précharge les images de tous les messages reçus, ouverts ou non ;
Gmail les fait transiter par son proxy. Résultat : des ouvertures comptées pour
des messages que personne n'a lus, et des ouvertures manquées chez ceux qui
bloquent les images. L'avertissement est maintenant affiché sous les tuiles,
dans l'app.

**Le taux de clic demande un geste humain délibéré.** C'est le seul des deux
sur lequel on prend une décision.

**Et la réponse vaut plus que les deux réunis.** C'est le seul indicateur qui
compte vraiment : `/preuves` ne mesure rien d'autre que ce qui a produit de
l'argent encaissé.

Ordre de lecture, du plus fiable au moins fiable :
**réponse > clic > ouverture.**

---

## Récapitulatif — ce qu'il te reste à faire

**Sans domaine :** appels (30/j) + LinkedIn (25/j) + charger les fiches.
Aucun email froid.

**Lundi soir, quand `eagleye.fr` arrive :**

1. Créer/récupérer une boîte `@eagleye.fr` chez OVH.
2. Activer DKIM dans l'espace client OVH.
3. Publier `_dmarc.eagleye.fr` → `v=DMARC1; p=none; rua=mailto:postmaster@eagleye.fr`
4. Mettre les `SMTP_*` d'OVH dans `.env.local`, avec `SMTP_FROM` en `@eagleye.fr`.
5. Sur Vercel : `TRACKING_BASE_URL`, `APP_BASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`.
6. Passer `/recette` de bout en bout.
7. Démarrer à **5 envois/jour** et monter de 5 par semaine.
8. Charger 300 à 600 fiches — le seul vrai goulot.
