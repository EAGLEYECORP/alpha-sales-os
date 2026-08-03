# Brouillons Gmail HTML — prêts à envoyer

**EAGLEYE CORP · ALPHA SALES OS®**

Déposer le message dans tes **brouillons Gmail**, en HTML « calme » (la marque
Eagleye), un prospect ou tout le lot — puis tu ouvres Gmail, tu relis, tu
cliques **Envoyer**. Rien ne part de l'app : un brouillon n'est pas un envoi.

C'est le pendant riche de la *Boîte d'envoi* : là, l'app ouvre une fenêtre de
rédaction Gmail pré-remplie en **texte brut** ; ici, elle dépose un vrai
brouillon **HTML**, mis en page, dans ta boîte.

---

## Le geste

Boîte d'envoi (`/outbox`) :

- **« Créer N brouillons HTML »** en haut → dépose tout le lot du jour (hors
  fiches de démo et fiches sans email).
- **« Brouillon HTML »** sur une fiche → dépose seulement celle-là.
- **« Prévisualiser »** sur une fiche → ouvre le rendu HTML exact dans un
  onglet, sans rien déposer. Marche même sans configuration.

Le HTML est rendu depuis le texte **que tu vois** (sujet + corps édités
compris) : ce que tu relis est ce qui sera déposé.

---

## Le branchement — 2 minutes, un seul identifiant

Le dépôt passe par **IMAP APPEND** : la même mécanique, et le **même mot de
passe d'application Gmail**, que l'envoi SMTP. Aucun OAuth, aucune clé de plus.

Dans `.env.local` :

```
SMTP_USER=eagleyecorp.ad@gmail.com
SMTP_PASS=xxxx xxxx xxxx xxxx     # mot de passe d'application Gmail (16 car.)
SMTP_FROM=EAGLEYE CORP <eagleyecorp.ad@gmail.com>
```

C'est tout : IMAP réutilise `SMTP_USER` / `SMTP_PASS` par défaut. Le dossier
des brouillons est découvert automatiquement (y compris son nom localisé,
« [Gmail]/Brouillons » en français) via l'extension IMAP `SPECIAL-USE`.

### Obtenir le mot de passe d'application

1. Le compte Gmail doit avoir la **validation en deux étapes** activée.
2. [myaccount.google.com/apppasswords](https://myaccount.google.com/apppasswords)
   → crée un mot de passe pour « Courrier ».
3. Colle les 16 caractères dans `SMTP_PASS`. Le même sert à envoyer **et** à
   brouillonner.
4. Vérifie qu'**IMAP est activé** : Gmail → Paramètres → Transfert et
   POP/IMAP → « Activer IMAP ».

### Une autre boîte, ou un autre fournisseur

Renseigne alors explicitement :

```
IMAP_HOST=imap.gmail.com      # ou imap.ovh.net, outlook.office365.com…
IMAP_PORT=993
IMAP_USER=...
IMAP_PASS=...
```

---

## Ce que ça fait, et ce que ça ne fait pas

| | |
|---|---|
| **Fait** | Dépose un brouillon HTML soigné, prêt à envoyer, dans ta boîte. |
| **Fait** | Un prospect, ou tout le lot du jour, du même geste. |
| **Ne fait pas** | **Envoyer.** Tu relis et tu cliques « Envoyer » toi-même. |
| **Ne fait pas** | Déposer vers une fiche de **démo** (adresse inventée) ou sans email — écartées, comme dans la Boîte d'envoi. |
| **Ne fait pas** | Consigner une touche au CRM. La touche naît quand tu cliques « J'ai envoyé » après l'envoi réel. |

Le premier dépôt se fait **vers ta propre boîte**, comme pour l'email et pour
Alpha Voice : tu vois le rendu réel, le dossier d'arrivée, avant qu'un prospect
ne reçoive quoi que ce soit.

---

## Où c'est dans le code

| Rôle | Fichier |
|---|---|
| Fabrique le lot (filtre démo/sans-email, tri) + rendu HTML | `lib/gmail-draft.ts` |
| MIME RFC 822 (MailComposer, livré avec Nodemailer) | `lib/gmail-mime.ts` |
| Client IMAP APPEND sur `node:tls` (zéro dépendance) | `lib/imap-append.ts` |
| Route de dépôt + sonde de capacité | `app/api/gmail/draft/route.ts` |
| Boutons (lot, unité, prévisualisation) | `app/outbox/page.tsx` |
| Tests (filtres, cadrage IMAP, SPECIAL-USE) | `tests/gmail-draft.test.ts` |

---

## Ce qui n'a PAS été vérifié en conditions réelles

Honnêteté nécessaire, dans la ligne d'`Alpha Voice` : le client IMAP n'a **pas
pu être testé contre un vrai serveur Gmail** dans l'environnement de
construction (pas d'identifiants). Ce qui est vérifié :

- la fabrication du lot, les filtres démo/sans-email, le rendu HTML/texte ;
- le cadrage du littéral synchronisant `APPEND {n}` (longueur en octets) et le
  drapeau `\Draft` ; l'analyse `SPECIAL-USE` (tests unitaires) ;
- **la machine à états de bout en bout sur une vraie socket TLS**, contre un
  serveur IMAP factice : accueil → `LOGIN` → `LIST SPECIAL-USE` (découverte du
  dossier localisé « [Gmail]/Brouillons ») → `APPEND` (littéral à la bonne
  longueur en octets, UTF-8 accents + € intacts) → `LOGOUT`.

Ce qui ne l'est pas : la poignée de main et les réponses **du vrai Gmail**.
**Premier dépôt réel : fais-le vers ta propre boîte.** Si le dépôt échoue, la
route renvoie l'erreur IMAP telle quelle, et « Prévisualiser » reste disponible
sans rien brancher.
