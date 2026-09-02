# Montrer Alpha Sales OS en visio — la check-list

> Pour une démonstration en direct depuis la production Vercel, écran partagé.
> À lire une fois **avant** l'appel, pas pendant.

---

## 1. Le mot de passe — ce qui se passe vraiment

`SITE_PASSWORD` n'est plus un mur sur toute l'app *en théorie* — mais le mur ne
se lève **que si** `comptesActifs()` ET `serverAuthEnforced()` sont vrais, et
les deux sont **opt-in** (comptes Supabase + `REQUIRE_AUTH`). Tant qu'ils ne
sont pas configurés sur Vercel, **le mot de passe garde tout**, exactement
comme avant. C'est voulu : sans autre serrure, `/api/send` enverrait de vrais
emails à n'importe qui.

**Ce que ça veut dire concrètement :**

- **Le cookie d'accès dure 30 jours** (`alpha_access`). Si tu t'es connecté sur
  cette machine et ce navigateur dans le mois, **tu ne verras pas la porte**.
- **Connecte-toi AVANT de lancer le partage d'écran.** Une fois le cookie posé,
  plus personne ne voit le mot de passe.
- **Le piège :** ouvrir une fenêtre de navigation privée, un autre navigateur
  ou un autre appareil **en pleine démo** → l'écran `/gate` s'affiche devant
  tout le monde. Reste dans la fenêtre déjà connectée.
- Pour savoir ce que la prod expose réellement, ouvre `/api/health` **une fois
  connecté** : il rend le détail seulement si tu as le cookie (sinon `{ ok }`,
  et c'est délibéré — annoncer publiquement « ce déploiement tourne sans mot de
  passe » serait une invitation).

---

> ⚠ **Si tu as basculé sur le LOGIN** (`REQUIRE_AUTH=1` + Supabase), ce
> paragraphe change : l'entrée n'est plus un mot de passe partagé mais un
> **compte** (email + mot de passe, que tu changes toi-même sans redéployer).
> `SITE_PASSWORD` ne garde alors plus que `/payouts`, `/offre` et `/api/sync`.
> Détail de la bascule et de son ordre : CLAUDE.md § « Du mot de passe au
> compte ». **Ne bascule pas la veille d'une démonstration.**

## 2. Les trois écrans à NE PAS ouvrir en partage d'écran

Ils sont protégés par le mot de passe — que **tu as**. La protection ne te
protège donc pas de toi-même.

| Écran | Ce qu'il montre | Pourquoi c'est un problème en visio |
|---|---|---|
| `/payouts` | Notre économie : commissions, ce qui nous revient | Un partenaire ou un client y lit notre marge sur lui |
| `/offre` | Le calculateur interne, colonne « ce qui nous revient » | Idem — c'est le seul écran qui affiche les deux colonnes côte à côte |
| Réglages → **Opérateur** | Le portefeuille de comptes, les taux | Ça n'intéresse pas le client et ça répond à des questions qu'il ne pose pas |

**Ce qui se montre sans risque :** `/aujourdhui`, une fiche prospect
(`/prospects/…`), `/pipeline`, `/templates`, `/voice`, `/controle`.

---

## 3. Les données affichées — le vrai piège

Le pipe réel (fiches de juillet, prospects ICP) contient des **entreprises
lyonnaises réelles, avec noms, adresses et numéros de téléphone**. Les afficher
sur un écran partagé, c'est diffuser des données personnelles de tiers à des
gens qui n'ont rien à voir — un sujet RGPD, pas seulement une maladresse.

**Fais la démo sur le jeu de démonstration** (bouton « Explorer la démo » du
guide d'installation). Filet de sécurité déjà en place : `/api/send` **refuse**
d'écrire à une fiche de démonstration (409) — les adresses sont inventées et un
envoi produirait un rebond dur.

---

## 4. Les actions qui partent pour de vrai

Sur la production, ces boutons ne simulent rien :

- **Envoyer un email** → part vraiment (SMTP), et compte dans la réputation du
  domaine.
- **Lancer un appel** → compose un vrai numéro, et facture de vraies minutes.
- **Lancer une campagne** → envoie en lot.

Un clic de trop pendant une démonstration est un vrai message à un vrai
prospect. **Sur le jeu de démonstration, l'envoi est bloqué** — c'est la raison
principale de faire la démo dessus plutôt que sur le pipe réel.

---

## 5. Pourquoi le local rame en visio, et ce qu'il faut savoir

Ce n'est pas l'app : `next dev` recompile chaque page **à la première visite**,
et le partage d'écran mange le CPU en même temps. En production Vercel tout est
déjà compilé — c'est le bon choix pour une démo.

**La contrepartie :** en local, une erreur s'affiche à l'écran avec sa pile
d'appels. En production, elle donne une page d'erreur sans détail. Si quelque
chose casse en direct, tu ne sauras pas quoi sur le moment — passe à l'écran
suivant et regarde les logs Vercel après.

---

## 6. L'ordre qui marche, en 6 minutes

Le même que celui d'un rendez-vous Alpha Voice (`docs/OFFRE-ALPHA-VOICE.md`) :
on fait constater avant de montrer.

1. **`/aujourdhui`** — « voilà ce que la machine me dit de faire ce matin, et
   pourquoi ». C'est le seul écran qui montre le produit *en train de servir*.
2. **Une fiche prospect** — l'audit, puis l'argumentaire : les questions, le
   chiffrage de la perte **sur ses données**, l'offre, la garantie.
3. **`/voice`** — faire entendre l'agent. C'est le moment qui convainc.
4. **`/controle`** — les paliers 10 / 100 / 1 000 : « on ne lance pas 1 000
   appels avant d'avoir mesuré sur 10 ».

> ⚠ Ne finis pas sur un écran de réglages. On finit sur ce que ça produit.
