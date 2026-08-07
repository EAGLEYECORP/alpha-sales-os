# Récap urgent — être full terrain, alerté seulement quand ça compte

**EAGLEYE CORP · ALPHA SALES OS®**

Tu es sur le terrain toute la journée. Tu ne veux pas ouvrir l'app dix fois.
Tu veux **une seule alerte** : ce qui est vraiment critique aujourd'hui, et
rien d'autre.

C'est le cadran **« faire »** de l'écran Aujourd'hui — urgent ET important —
poussé sur ton téléphone. Pas les relances tièdes, pas les fiches froides :
seulement ce qui **perd de la valeur si ce n'est pas fait aujourd'hui** (un RDV,
une étape en retard, un deal avancé qui refroidit).

> Règle : **rien de critique = aucune alerte.** Un « rien d'urgent » quotidien
> apprend à ignorer la notification. On ne l'envoie que quand il y a une raison.

---

## Deux façons de le recevoir

### 1. À la demande — marche tout de suite

Onglet **Aujourd'hui → « M'envoyer le récap »**. Avant de partir en tournée,
un clic : tu reçois les priorités du jour par SMS (ou email). Le bouton
n'apparaît que si l'envoi est configuré (SMS ou email).

### 2. Automatique chaque matin — pour ne rien avoir à faire

Un cron n8n lit ton CRM (Google Sheet) à 7h30 et déclenche l'alerte **sans que
tu ouvres quoi que ce soit**. C'est ça, « être full terrain et tout est géré ».

- Workflow : `integrations/n8n/alpha-digest-urgent.workflow.json` (à importer
  dans n8n, comme les autres).
- Il lit le Sheet, reconstruit les fiches, et POST à `/api/digest` de l'app —
  qui applique **la même logique** que l'écran Aujourd'hui et envoie le SMS.

---

## Ce qu'il faut brancher

| Pour… | Variable (Vercel / .env) |
|---|---|
| Recevoir par **SMS** | `TEXTBELT_KEY` + `ALERT_PHONE` (ton mobile) |
| Recevoir par **email** (repli) | `SMTP_*` + `DIGEST_EMAIL` (ou `SMTP_FROM`) |
| Le cron du matin | n8n + `APP_BASE_URL` pointant sur l'app en ligne |

Le destinataire est **toujours** pris dans l'environnement, jamais dans la
requête : personne ne peut se servir de `/api/digest` pour spammer un tiers.

Canal : SMS si `TEXTBELT_KEY` est là, sinon email. `GET /api/digest` dit ce
qui est prêt.

---

## Ce que le SMS contient

```
ALPHA — 2 priorités aujourd'hui, 1 980 € en jeu :
• Démo Vauban — aujourd'hui 09:00 (7 août)
• Rappeler pour la décision — Garage du Parc (5 août)
```

Court, daté, actionnable. Le détail (le *pourquoi* de chaque ligne) part en
email si tu es sur ce canal, et reste dans l'onglet Aujourd'hui.

---

## Ce que ça ne fait pas

- **Ça ne t'envoie pas tout.** Seulement le cadran critique. Le reste attend.
- **Ça ne décide pas à ta place.** Un SMS dit « prépare la démo Vauban » ; il
  ne la prépare pas. Les 20 % qui signent restent à toi (voir `AUTOPILOTE.md`).
- **Ça n'invente aucune urgence.** Une fiche sans échéance datée n'est jamais
  critique — d'où l'importance de toujours poser une **prochaine étape datée**
  (le Débrief terrain le fait pour toi après chaque RDV).
