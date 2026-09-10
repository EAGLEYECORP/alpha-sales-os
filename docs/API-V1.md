# API Alpha Sales — v1

> La porte d'entrée des intégrations : n8n, un CRM client, un formulaire de
> site, un scraper. On envoie du JSON, on récupère un **verdict**.

## Authentification

```
Authorization: Bearer <clé>
```

Les clés valides sont listées dans `ALPHA_API_KEYS` côté serveur (séparées par
des virgules) :

```
ALPHA_API_KEYS=cle-n8n-xxxxx,cle-site-yyyyy
```

**Sans cette variable, la route est fermée.** Une API d'écriture ouverte par
défaut est une faute — pas un confort de développement.

> `/api/v1` est hors du mot de passe du site (`SITE_PASSWORD`) : un tiers qui
> appelle l'API n'a pas ce cookie. Ce n'est pas un trou — la route porte sa
> propre authentification et refuse tout si aucune clé n'est configurée.

## `POST /api/v1/prospects`

Corps : un **tableau**, ou `{ "prospects": [...] }`. Maximum **500** par requête.

```bash
curl -X POST "$APP/api/v1/prospects?accountId=eagleye" \
  -H "Authorization: Bearer $ALPHA_API_KEY" \
  -H "Content-Type: application/json" \
  -d '[
    {
      "societe": "Carrosserie Aldrene",
      "gérant": "Marc Dubois",
      "téléphone": "04 65 71 00 00",
      "ville": "Lyon 6e",
      "secteur": "artisan",
      "missedCallsPerWeek": 9,
      "avgTicket": 400
    }
  ]'
```

### Les alias sont compris

Le monde réel n'utilise pas nos noms de champs. `societe`, `entreprise`,
`commerce`, `raison_sociale` → tous lus comme `company`. Idem pour
`téléphone`/`tel`/`mobile`, `courriel`/`mail`, `ville`/`commune`…

`GET /api/v1/prospects` (avec la clé) renvoie la liste complète des champs
reconnus.

### Ce que la route ne prendra JAMAIS de l'extérieur

`stage` · `probability` · `payments` · `contract`

Un système tiers n'a pas à décider qu'un prospect est **signé**. Toute fiche
entre au début du pipeline, quoi qu'envoie l'appelant.

### La réponse

```jsonc
{
  "accepted": 1,
  "rejected": [],                     // { index, error } — la ligne fautive est nommée
  "warnings": [                       // par ligne : ce qui a été ignoré ou corrigé
    { "index": 0, "company": "…", "warnings": ["Champs ignorés : nawak."] }
  ],
  "stored": 1,
  "triage": {
    "verdict": "1 fiche sur 1 est appelable (1 chaude). Commence par…",
    "chaudes": 1, "tiedes": 0, "froides": 0, "injoignables": 0,
    "comptes": [{ "accountId": "eagleye", "count": 1, "estimatedHT": 990 }],
    "trous": [{ "gap": "le NOM du décideur", "count": 1, "pct": 100 }]
  }
}
```

**Le triage est le vrai retour.** Importer 1 000 lignes ne veut rien dire ;
savoir que 40 sont réellement appelables, et que 60 % n'ont pas de décideur
nommé, si. Un trou à plus de 50 % vient presque toujours d'une **colonne
absente à la source** — va la corriger là-bas plutôt qu'à la main.

## Comportement à la fusion

Une fiche déjà travaillée **ne perd rien** quand un scraper la renvoie :

| Rafraîchi | Conservé |
|---|---|
| société, nom, email, téléphone, ville | **stade du pipeline** |
| secteur (si précisé) | événements, notes terrain |
| champs d'audit non vides | valeurs et paiements |

Le score d'audit ne descend jamais : `max(existant, entrant)`.

## Codes de réponse

| Code | Sens |
|---|---|
| `200` | Traité (regarde `rejected` et `warnings`) |
| `400` | JSON invalide, ou corps qui n'est pas un tableau |
| `401` | Clé absente ou inconnue |
| `413` | Plus de 500 fiches — découpe l'envoi |
| `422` | Toutes les lignes refusées |

## Ce qui n'est pas encore fait

- **Calendrier** (Teams / Google Meet) et **CRM externe** (Notion) : pas
  d'intégration OAuth. En attendant, n8n fait le pont dans les deux sens.
- **Ingestion de documents** vers le Cerveau par l'API : l'import de fichiers
  se fait dans le navigateur (`/cerveau`), où le fichier ne transite par aucun
  serveur. C'est délibéré pour les audits clients.
