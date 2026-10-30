# ALPHA VEND ALPHA — la configuration complète (29/10/2026)

Le compte MAÎTRE donne notre offre au pilote automatique (`/autopilote`) et le
laisse prospecter. Chaque étape ci-dessous a été vérifiée dans le code ; ce qui
n'a PAS été vérifié contre un vrai service est dit.

## ✅ État au 30/10/2026 (nuit) — ce qui est fait, ce qui reste

| | État | Comment c'est su |
|---|---|---|
| Compte maître reconnu (`OWNER_EMAILS`) | ✅ | `/api/compte/droits` → `"maitre": true`, lu par Zakaria |
| `SMTP_*` sur Vercel | ✅ posé | `/api/autopilote` → `smtpPret` ; le mot de passe ne sera prouvé qu'au 1er envoi |
| Configuration ALPHA vend ALPHA (cible, IMAP, closing) | ✅ servie par le serveur | vu au rendu, build de production |
| Closing écrit (prix + lien `/compte`) | ✅ | `tests/closing-inscrit.test.ts` |
| Connexion Google des inscrits | ✅ testée en vrai | `docs/CONNEXION-GOOGLE.md` |
| Ton nom (Réglages → Closer) | ⏳ à toi | |
| Clé Dropcontact · agenda iCal | ⏳ à toi | secrets du navigateur |
| « Lancer ALPHA » (jour ouvré, 9 h–12 h ou 14 h–18 h) | ⏳ à toi | |

Le serveur IMAP (`pop.securemail.pro`) reste NON vérifié avec la boîte : si le
journal dit « Réponses non lues », mettre `mail.securemail.pro`.

## ☁️ Depuis le 30/10 : il tourne aussi DANS LE CLOUD, onglet fermé, sans n8n

`/autopilote` → « Lancer dans le cloud » (maître seul). Le serveur joue les MÊMES
étapes que l'onglet (`lib/pilote-executeur.ts`) sur le pipe du serveur :

| | Où |
|---|---|
| Déclencheur | `pg_cron` → `/api/campaign/pilote-tick`, toutes les 5 min, lun–ven 8 h–19 h UTC (migration 020) |
| Interrupteur, réglages, ton nom, journal | table `pilote_serveur` (migration 019) — aucun secret dedans |
| Envoi, lecture de la boîte, agenda | gestionnaires de `/api/send`, `/api/reponses`, `/api/agenda` appelés en processus (mêmes gardes) |
| Clé Dropcontact, agenda | `DROPCONTACT_API_KEY`, `AGENDA_ICS_URL` dans Vercel |
| Fenêtre d'écriture | inchangée : hors 9 h–12 h / 14 h–18 h, il lit sans écrire |

Gardes : CRON_SECRET · interrupteur posé par toi · refus si l'ancien autopilote d'envoi
(`mail-tick`) est armé · un passage à la fois (verrou de 5 min) · sans boîte, il n'écrit pas.
Lancer le cloud arrête le pilote de l'onglet (deux pipes, une cible : pas deux fois).

**Pas encore prouvé en vrai** : aucun passage serveur n'a tourné (la table n'est pas posée,
le cron vise encore la copie Netlify). Ordre exact : `docs/A-FAIRE-ZAKARIA.md`, § 30/10 cloud.

## ⚡ Depuis le 29/10 (soir) : la configuration arrive toute faite

Connecté en `contact@eagleyecorp.fr`, ouvre `/autopilote` : si rien n'y est
réglé, l'écran applique de lui-même ce que le serveur sert au maître seul
(`/api/autopilote/configuration`, `lib/alpha-vend-alpha.ts`) — étapes 4, 5 et 6
ci-dessous, sauf les secrets. Un bouton « Configurer pour vendre ALPHA » la
réapplique. Elle ne LANCE rien.

Ce qui reste à toi, et ne peut pas venir du serveur :
- ton nom dans Réglages → Closer (on ne pose jamais l'identité d'un humain
  par configuration ; sans lui, les emails signent « EAGLEYE CORP ») ;
- la clé Dropcontact et l'adresse secrète de l'agenda (secrets, navigateur) ;
- « Lancer ALPHA ».

Vu au rendu (build de production, navigateur vierge, maître) : identité,
profil, cible 68.31Z/69, 5 envois/jour, IMAP posés ; ALPHA à l'arrêt ; 0 fiche
prête à recevoir un message.

## 0. Ce qui est mesuré avant de commencer

- **Aucun email n'est jamais parti par `/api/send` en production**
  (`tracking_messages` : 0 insertion). Le SMTP de Vercel n'est donc pas prouvé,
  et le palier démarre à **5 premiers messages par jour**.
- Le détail de `/api/health` est derrière `SITE_PASSWORD` : je ne peux pas le
  lire d'ici. C'est toi qui le lis (étape 2).
- **Le pilote écrit à TOUTE fiche réelle** (non démo) au stade « prospect » qui
  a un email et n'a jamais reçu de message. D'où l'étape 1 : un profil de
  navigateur NEUF, pour qu'aucune de tes fiches existantes ne parte sans toi.
- Fenêtre d'écriture : **jours ouvrés, 9 h–12 h et 14 h–18 h (Paris)**. Hors
  fenêtre, ALPHA lit les réponses mais n'écrit rien.

## 1. Le poste

Un **profil Chrome dédié** (« ALPHA vend ALPHA ») sur un ordinateur qui ne se
met pas en veille. En ligne, ALPHA travaille **onglet ouvert** (décision du
21/10) : onglet fermé = ALPHA arrêté.

## 2. Le serveur d'envoi — vérifier, puis poser si besoin

1. `https://alphasalesos.eagleyecorp.fr/gate` → mot de passe du site.
2. `https://alphasalesos.eagleyecorp.fr/api/health` → `capabilities.email`.
   - `configured: true` → passe à l'étape 3.
   - sinon, dans Vercel (Production) :
     `SMTP_HOST=smtp-fr.securemail.pro` · `SMTP_PORT=465` ·
     `SMTP_USER=contact@eagleyecorp.fr` · `SMTP_PASS=` (tapé dans Vercel,
     jamais collé dans une conversation) ·
     `SMTP_FROM=Zakaria Tazi <contact@eagleyecorp.fr>` — puis redéployer.
     ⚠ Les quatre variables de comptes doivent être posées AVANT (déjà le cas
     en production : l'app exige un compte pour `/api/send`).

## 3. Le compte

Se connecter avec `contact@eagleyecorp.fr` (ou `eagleyecorp.ad@gmail.com`) :
le verdict « maître » vient du serveur (`OWNER_EMAILS`).

## 4. Réglages → Agence

- **Nom** : `EAGLEYE CORP`
- **Closer** : ton nom, tapé par toi (c'est la signature des emails)

## 5. Réglages → « À qui vends-tu ? »

- Ce que tu vends : `un OS de vente qui trouve vos clients et pose vos rendez-vous`
- Secteur visé : `agences immobilières` · rôle : `dirigeants` · zone : `Rhône`
- Lien de réservation (facultatif) : ton lien Calendly/Google si tu en as un.
- Cliquer **« Refaire la démo sur ma cible »** — c'est CE bouton qui enregistre
  le profil. Il remplace les fiches de démo, garde les fiches réelles.

Sans ce profil, le pilote du maître retombe sur l'approche de notre escalier
(`expediteurDuPilote`).

## 6. `/autopilote`

| Champ | Valeur |
|---|---|
| Le métier de tes clients | `agences immobilières` → choisir **68.31Z** |
| Où | `69` |
| Taille | à ton choix (les TPE répondent davantage — non mesuré) |
| Clé Dropcontact | ta clé API (reste dans le navigateur) |
| Ton agenda | Google Agenda → paramètres de l'agenda → « Adresse secrète au format iCal » → coller → **Vérifier** |
| Premiers messages / jour | `5` (le serveur plafonne de toute façon) |
| Recherches de coordonnées / jour | `10` |
| Rendez-vous | En visio |
| Serveur de lecture (IMAP) | `pop.securemail.pro` |

**Le serveur IMAP** : le champ marche pour la boîte maison depuis le commit du
29/10 (il était ignoré). Deux serveurs IMAPS d'Amen répondent sur le port 993
(bannière lue le 29/10, sans authentification) : `pop.securemail.pro` et
`mail.securemail.pro`. Lequel porte `contact@` n'est pas vérifié : si le
journal dit « Réponses non lues », mets l'autre. Les deux sont du domaine du
SMTP (`securemail.pro`), seule condition pour que le mot de passe y parte.

## 7. Lancer

1. Vérifier « Prêtes à recevoir un message » : **0** avant le premier passage
   (sinon une fiche existante partirait — revenir à l'étape 1).
2. **Lancer ALPHA**, laisser l'onglet ouvert.
3. Ne PAS activer en même temps le Pilote serveur sur les mêmes fiches.

## 8. Après une heure

Le journal de `/autopilote` dit ce qui s'est passé. Les trois lignes qui
disent quoi corriger : « Coordonnées non lues » (Dropcontact), « Réponses non
lues » (IMAP), « agenda n'a pas pu être lu ». Un prix, une signature, un doute
remontent à toi : c'est toi qui closes.

## Ce qui n'est pas prouvé

Un vrai Dropcontact, une vraie lecture IMAP chez Amen, un vrai flux Google
Agenda, et le SMTP de Vercel. Le premier passage est le test.
