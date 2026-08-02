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

## 1 bis. Le cas transitoire : une adresse sur un domaine qui n'est pas le tien

Situation réelle d'août 2026 : `eagleye.fr` arrive lundi soir, et en attendant
il y a `z.tazi@scintia.ai` — une vraie boîte sur un vrai domaine
d'entreprise, mais **sans accès administrateur**.

### Ce que dit le DNS de `scintia.ai`

```
MX     scintia-ai.mail.protection.outlook.com   → Microsoft 365
SPF    v=spf1 include:spf.protection.outlook.com -all    ✓ strict
DKIM   selector1 / selector2 → ...dkim.mail.microsoft     ✓ signé
DMARC  SEPT enregistrements concurrents                   ✗ politique annulée
```

Techniquement, l'authentification est meilleure que celle d'`eagleye.fr`
aujourd'hui : SPF en `-all` (rejet strict) et DKIM actif. **Sauf le DMARC**,
et c'est un vrai problème — voir plus bas.

### Trois raisons de ne PAS y faire passer la prospection

**1. Le risque de réputation ne t'appartient pas.** Les plaintes pour spam et
les rebonds d'une liste froide frappent la réputation de `scintia.ai` — le
domaine dont dépendent les emails commerciaux et le support de Scintia. Tu
n'as pas le droit de dépenser un actif qui n'est pas le tien. Cela demande un
accord explicite et écrit de leur côté, pas une supposition parce que tu
revends leur produit.

**2. Sans accès admin, tu ne peux rien réparer.** Le DMARC de `scintia.ai` est
cassé (voir ci-dessous) et tu ne peux pas le corriger. Si Microsoft restreint
l'envoi sortant du tenant à cause du volume, tu ne peux pas le débloquer non
plus.

**3. Confusion sur le responsable de traitement.** Tes emails portent la marque
EAGLEYE CORP, le pied RGPD et un lien de désinscription. Envoyés depuis
`@scintia.ai`, ils désignent Scintia comme l'expéditeur responsable au sens du
RGPD. C'est un mélange qu'on ne veut ni juridiquement, ni commercialement.

### Le défaut trouvé sur scintia.ai — à leur remonter

`_dmarc.scintia.ai` porte **sept enregistrements DMARC** :

```
v=DMARC1; p=none; rua=mailto:a.fekiri@scintia.ai
v=DMARC1; p=none; rua=mailto:p.lebailly@scintia.ai
v=DMARC1; p=none; rua=mailto:m.demir@scintia.ai
v=DMARC1; p=none; rua=mailto:support@scintia.ai
v=DMARC1; p=none
v=DMARC1; p=none; rua=mailto:contact@scintia.ai
v=DMARC1; p=none; rua=mailto:j.point@scintia.ai
```

Chacun est valide pris isolément. Ensemble, ils ne valent **rien** : la
RFC 7489 §6.6.3 impose au serveur destinataire d'arrêter la découverte de
politique dès qu'il trouve plus d'un enregistrement — il refuse de deviner
lequel appliquer. Le domaine paraît protégé et ne l'est pas, exactement comme
s'il n'avait aucun DMARC.

Chacun a manifestement ajouté le sien pour recevoir les rapports. La
correction tient en une ligne : **un seul enregistrement, plusieurs
destinataires dedans**.

```
v=DMARC1; p=none; rua=mailto:contact@scintia.ai,mailto:support@scintia.ai
```

C'est une information gratuite et précise à apporter à Scintia. Elle vaut
mieux qu'un argumentaire.

### Ce qu'on fait, concrètement, jusqu'à lundi soir

**Aucun email froid.** Ce n'est pas une privation : la montée en charge
démarrerait à **5 envois/jour** de toute façon. Trois jours × 5 = 15 emails.
Zéro gain, et un risque qui retombe sur un tiers.

Les deux canaux qui ne dépendent d'aucun domaine restent ouverts :

| Canal | Volume/jour | Dépend d'un domaine ? |
|---|---|---|
| Appels & visites | 30 | non |
| LinkedIn | 25 | non |
| **Total** | **55 touches/jour** | |

Et le vrai travail du week-end : **charger les fiches**. C'est le goulot, et il
ne dépend d'aucun DNS.

`z.tazi@scintia.ai` reste parfaitement légitime pour ce à quoi il sert : la
correspondance individuelle, les réponses, les rendez-vous. Un mail écrit à
une personne qui t'a répondu n'est pas de la prospection en volume et ne pose
aucun de ces trois problèmes.

### Note technique, si tu tentes quand même la connexion SMTP

`scintia.ai` est sur Microsoft 365. L'authentification SMTP classique y est
encore possible aujourd'hui — Microsoft la désactive par défaut **fin décembre
2026** et la supprime au second semestre 2027 — mais elle est souvent déjà
coupée au niveau du tenant, ou par les « paramètres de sécurité par défaut ».
Sans accès admin, tu ne peux pas la rouvrir.

Les erreurs à reconnaître :

| Erreur | Signification |
|---|---|
| `535 5.7.139 Authentication unsuccessful… basic authentication is disabled` | l'admin doit l'activer pour ta boîte |
| `550 5.7.30 Basic authentication is not supported for Client Submission` | coupée au niveau du tenant |

Dans les deux cas, la réponse n'est pas de contourner : c'est d'attendre
`eagleye.fr`.

---

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

**Ce week-end, sans domaine :** appels (30/j) + LinkedIn (25/j) + charger les
fiches. Aucun email froid. Et remonter à Scintia le défaut des sept DMARC.

**Lundi soir, quand `eagleye.fr` arrive :**

1. Créer/récupérer une boîte `@eagleye.fr` chez OVH.
2. Activer DKIM dans l'espace client OVH.
3. Publier `_dmarc.eagleye.fr` → `v=DMARC1; p=none; rua=mailto:postmaster@eagleye.fr`
4. Mettre les `SMTP_*` d'OVH dans `.env.local`, avec `SMTP_FROM` en `@eagleye.fr`.
5. Sur Vercel : `TRACKING_BASE_URL`, `APP_BASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`.
6. Passer `/recette` de bout en bout.
7. Démarrer à **5 envois/jour** et monter de 5 par semaine.
8. Charger 300 à 600 fiches — le seul vrai goulot.
