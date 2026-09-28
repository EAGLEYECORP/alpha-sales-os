# Dictionnaire CRM — toutes les variables suivies par Google Sheets

[`crm-schema.json`](./crm-schema.json) est **la source de vérité** des colonnes
du CRM : chaque variable que la feuille Google Sheets doit suivre, avec sa clé
stable, son libellé de colonne, son type, **qui l'écrit** et **ce qui l'utilise**
dans l'app.

## La même clé partout

La `key` d'un champ est identique dans les 4 endroits — c'est ce qui fait
circuler la donnée sans friction :

| Où | Fichier | Rôle |
|---|---|---|
| App → CRM | `lib/n8n.ts` → `prospectToRow()` | l'app pousse la ligne |
| CRM → App | `lib/n8n.ts` → `n8nRowsToProspects()` | l'app lit la ligne |
| Import CSV | `lib/csv.ts` → `HEADER_MAP` | reconnaît les en-têtes FR/EN |
| Feuille | `integrations/google-apps-script/Code.gs` → `COLUMNS` | crée les colonnes |

> En cas de doute, **`crm-schema.json` fait foi**. Quand tu ajoutes une variable,
> ajoute-la ici d'abord, puis répercute dans les 4 fichiers ci-dessus.

## Qui écrit quoi (`source`)

- **human** — saisi par le closer (dans l'app ou directement dans le Sheet).
  Les champs `critical:true` sont ceux sans lesquels le process bloque
  (`lib/missing-info.ts`) : contact, email/tél, chiffres de la Taxe, offre, contrat.
- **app** — collecté/calculé par l'UI (étape, next step, tracking).
- **n8n** — rempli par les automations (History, meeting, enrichissement, STOP).
- **provider** — fournisseur d'email (réponses entrantes).
- **computed** — dérivé (probabilité, taxe, LTV, paiements).

## La boucle de la donnée

```
Humain saisit une info critique dans l'app
      │  (bouton « Synchroniser CRM » sur la fiche)
      ▼
POST /api/crm/patch ──▶ Supabase crm_records (synced_to_sheet=false)
      │                        │
      │                        ▼  workflow alpha-crm-sync (cron)
      │                 Google Sheets  (puis synced_to_sheet=true)
      ▼
callN8n('upsert') ──▶ n8n ──▶ Google Sheets (écriture immédiate)

Sheet édité à la main ──▶ n8n (list) ──▶ l'app relit (syncFromN8n)
```

## Groupes

`identity · contact · audit · pipeline · interactions · commercial · retention ·
tracking · meta` — voir le JSON pour le détail champ par champ.

## Copier les en-têtes dans une feuille vierge

L'app propose **Réglages → Dictionnaire CRM → Copier les en-têtes** (ordre
canonique). Ou récupère-les via l'Apps Script (menu → Initialiser le CRM), qui
crée exactement ces colonnes.
