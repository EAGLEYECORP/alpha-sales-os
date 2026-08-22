# Notifications hors-app — mise en route

> Avant : les rappels ne partaient que pendant que l'onglet était ouvert.
> Autant dire jamais au moment où ils comptent — un commercial en tournée
> n'a pas le CRM ouvert. Maintenant le serveur décide et pousse, app fermée.

Quatre étapes. Comptez vingt minutes, une seule fois.

---

## 1. Générer les clés VAPID

Elles prouvent au service de push (Google, Mozilla, Apple) que l'envoi vient
bien de vous. **À faire une fois**, puis à conserver.

```bash
node -e "
const { webcrypto: c } = require('crypto');
c.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign','verify']).then(async k => {
  const pub = Buffer.from(await c.subtle.exportKey('raw', k.publicKey));
  const jwk = await c.subtle.exportKey('jwk', k.privateKey);
  console.log('VAPID_PUBLIC_KEY=' + pub.toString('base64url'));
  console.log('VAPID_PRIVATE_KEY=' + jwk.d);
});"
```

Puis dans `.env.local` (et dans Vercel) :

```
VAPID_PUBLIC_KEY=...
VAPID_PRIVATE_KEY=...
VAPID_SUBJECT=mailto:contact@eagleyecorp.fr
```

⚠ `VAPID_PRIVATE_KEY` est un secret. Elle ne va jamais dans le navigateur, et
jamais dans un commit. La **publique** est publique par construction : le
navigateur en a besoin pour s'abonner.

---

## 2. Créer la table des abonnements

Sans elle, les abonnements vivent en mémoire du serveur : **un redéploiement
les efface et les notifications s'arrêtent sans prévenir.** L'app le dit à
l'écran quand c'est le cas, mais autant ne pas en arriver là.

```sql
create table push_subscriptions (
  endpoint   text primary key,
  user_id    uuid,
  p256dh     text not null,
  auth       text not null,
  created_at timestamptz default now(),
  last_ok_at timestamptz,
  failures   int default 0
);
```

---

## 3. Activer sur l'appareil

Réglages → **Notifications — même app fermée** → *Activer sur cet appareil*.

À faire sur **chaque** appareil qui doit sonner (téléphone, portable). Un
abonnement vaut pour un navigateur, pas pour une personne.

**Sur iPhone**, ça ne marche que si l'app est ajoutée à l'écran d'accueil
(Partager → Sur l'écran d'accueil). C'est une contrainte d'Apple, pas un
défaut de l'app — et sans le savoir, on cherche une heure pourquoi rien
n'arrive.

Un refus est quasi définitif : le navigateur ne redemande pas. Il faut alors
réautoriser à la main (cadenas dans la barre d'adresse → Notifications).

---

## 4. Brancher le cron

**C'est l'étape qu'on oublie.** Sans elle, l'abonnement existe, la clé est
bonne, et rien ne part jamais.

```
POST https://<app>/api/push/tick
Authorization: Bearer $CRON_SECRET
```

Toutes les 15 à 30 minutes, en semaine, entre 8h et 19h. Inutile d'aller plus
vite : la route ne pousse qu'une notification par passage, et elle refuse
d'elle-même les heures creuses.

⚠ **Vercel Cron envoie des GET**, pas des POST. Le GET de cette route rend un
diagnostic, il n'envoie rien. Utilisez n8n (ou tout ordonnanceur qui sait
faire un POST avec un en-tête).

### Vérifier sans réveiller personne

```bash
curl -X POST https://<app>/api/push/tick \
  -H "Authorization: Bearer $CRON_SECRET" \
  -H "content-type: application/json" \
  -d '{"dryRun":true}'
```

Rend la notification qui **serait** envoyée, et à combien d'appareils.

---

## Ce qui déclenche une notification

Une seule à la fois, par ordre de gravité :

| Cas | Quand | Pourquoi celui-là |
|---|---|---|
| **RDV imminent** | 20 à 45 min avant | Le seul qu'on ne rattrape pas. Sous 20 min il est déjà en route ; au-delà de 45 il aura oublié. |
| **Échéance dépassée** | Next step daté passé, fiche encore chaude | La fuite la plus banale et la plus chère : la fiche était travaillée, elle refroidit toute seule. |
| **Fenêtre de rappel ouverte** | Prospect mûr, moment calculé sur SA réactivité | Le seul cas où l'OS sait quelque chose que vous ne pouvez pas deviner. |

Et trois règles dures :

1. **Jamais hors fenêtre utile** — ni la nuit, ni le week-end, ni entre 12h et
   14h. Les mêmes fenêtres que les appels.
2. **Une seule par passage.** Deux notifications simultanées, c'est zéro
   décision prise.
3. **Rien de purement informatif.** Un chiffre qui monte n'est pas une raison
   de sortir un téléphone de sa poche. Une notification qu'on apprend à
   ignorer rend inutile celle qui comptera vraiment.

---

## Ce qui n'est pas garanti

- **Le délai.** Un service de push livre « au mieux ». Sur un téléphone en
  veille profonde ou en économiseur de batterie, la notification peut arriver
  avec du retard. Ce n'est pas un canal temps réel.
- **Rien n'a été testé en conditions réelles depuis l'environnement de
  développement** : il ne peut joindre aucun service de push. Ce qui EST
  prouvé, c'est le chiffrement — testé contre le vecteur d'exemple de la
  RFC 8291, octet pour octet. Le transport se vérifie au premier envoi réel.
