# CRM « mémoire » — Google Sheets + Apps Script

Le CRM d'ALPHA SALES OS **est** un Google Sheets. La logique vit dans un
Apps Script attaché à la feuille : il maintient le schéma, **génère les
scripts de vente selon le statut (étape)** du prospect, et expose un **Web
App** que le backend n8n appelle pour lire et **remplir la mémoire à chaque
étape**.

```
        ┌──────────────┐   scripts par étape   ┌──────────────────┐
        │  Google      │◀──────────────────────│  Apps Script     │
        │  Sheets      │──────────────────────▶│  (Code.gs)       │
        │  (« CRM »)   │   lecture / écriture   │  Web App doGet/  │
        └──────────────┘                        │  doPost + menu   │
               ▲                                 └────────┬─────────┘
               │ HTTPS (token)                            │
        ┌──────┴───────┐                                  │
        │  n8n (local) │──────────────────────────────────┘
        │  agent conv. │   upsert / history / stage / script
        └──────────────┘
```

## Installation (5 min)

1. Crée un Google Sheets vide.
2. **Extensions → Apps Script**.
3. Colle le contenu de [`Code.gs`](./Code.gs) dans `Code.gs`.
   (Optionnel : active « Afficher le fichier manifeste `appsscript.json` »
   dans ⚙ Paramètres du projet, et colle [`appsscript.json`](./appsscript.json).)
4. **Enregistre**, puis recharge la feuille : le menu **🦅 ALPHA SALES OS**
   apparaît.
5. Menu → **① Initialiser / réparer le CRM** (crée les colonnes).
6. Menu → **② Charger les régies Lyon** (importe les ~32 agences de la liste
   de prospection — matching par nom, jamais de doublon).

## Le secret partagé (API_TOKEN)

Pour que seul ton n8n puisse écrire :

1. Apps Script → ⚙ **Paramètres du projet** → **Propriétés du script**.
2. Ajoute :
   - `API_TOKEN` = un secret long et aléatoire (ex. `openssl rand -hex 24`).
   - `CLOSER_NAME` = ton nom (injecté dans les scripts). *(optionnel)*

Chaque appel au Web App doit fournir `?token=…` (GET) ou `{"token":"…"}`
(POST). Sans `API_TOKEN` défini, le Web App est ouvert — à éviter en prod.

## Déployer le Web App

**Déployer → Nouveau déploiement → Type : Application Web**
- Exécuter en tant que : **moi**
- Accès : **Tout le monde** (l'anonymat est couvert par le token)

Copie l'URL `…/exec`. Menu → **🔑 Afficher l'URL du Web App** la rappelle.

## API (ce que n8n appelle)

### Lecture — `GET …/exec?token=SECRET&action=…`

| action | paramètres | retour |
|---|---|---|
| `schema` | — | colonnes + étapes |
| `list` | — | toutes les lignes |
| `get` | `id=<nom ou email>` | une ligne |
| `script` | `id=<nom>` | scripts email/DM/appel pour l'étape courante |
| `due` | — | lignes dont la Deadline est dépassée (relances à faire) |

### Écriture — `POST …/exec` (body JSON)

```jsonc
// Créer / enrichir (ne remplace que les champs fournis → max d'infos)
{ "token": "SECRET", "action": "upsert",
  "data": { "prospect": "Régie Pariset", "email": "contact@regie-pariset.com",
            "rating": "4,4", "reviews": "85", "tax": "3200", "audit": "Site 2016, 0 prise de RDV en ligne" } }

// Journal horodaté (History) — n8n loggue chaque interaction
{ "token": "SECRET", "action": "history", "id": "Régie Pariset", "text": "Email d'audit envoyé, ouvert 2×" }

// Changer d'étape (pose un next step daté automatiquement)
{ "token": "SECRET", "action": "stage", "id": "Régie Pariset", "stage": "audit", "action": "RDV mardi 15h" }

// Écrire un champ précis
{ "token": "SECRET", "action": "set", "id": "Régie Pariset", "field": "meeting", "value": "2026-07-10 15:00 — audit sur place" }

// Obtenir les scripts (idem GET action=script)
{ "token": "SECRET", "action": "script", "id": "Régie Pariset" }
```

Les clés de `data` sont **les bonnes variables** — identiques aux colonnes
(`prospect, type, rating, reviews, experience, city, phone, email, hours,
website, onSite, onlineBooking, stage, audit, contact, history, message,
meeting, obstacles, objections, tax, closeDate, deadline, delivery,
satisfaction, upsell, notes`). Récupère la liste vivante via `action=schema`.

## Génération de scripts selon le statut

`generateScripts_()` retourne, pour l'étape courante, un **email (objet +
corps), un DM et un script d'appel** remplis avec les variables de la ligne
(note Google, nombre d'avis, taxe d'ignorance, ville, contact, closer). Les
8 étapes du pipeline sont couvertes : `prospect → contact → audit → demo →
offre → redzone → signe → perdu`. L'angle est calibré **régies immobilières**
(note Google + réactivité sur les mandats).

Depuis la feuille : sélectionne une ligne → menu **✍️ Générer le script** (il
s'écrit aussi dans la colonne `Message`, prêt à partir).

## Import vers l'app Next.js

L'app ALPHA SALES OS sait déjà importer cette feuille : **Réglages → Import
Google Sheets** (lien de partage « tous ceux qui ont le lien » ou publication
CSV). Les colonnes FR sont reconnues automatiquement.
