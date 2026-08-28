# Changer un prompt — le guide

> Ce qui suit vaut pour **Alpha Sales OS**. La règle tient en une phrase :
> un prompt s'édite à **un seul endroit**, il est **validé** avant de
> s'appliquer, et il n'atteint **n8n** que si tu le **pousses**.

---

## Pourquoi ça existait pas avant, et ce que ça coûtait

La doctrine était écrite à **sept** endroits :

| Où | Quoi |
|---|---|
| `app/api/ai/route.ts` | `SYSTEM` — le copilote de vente |
| `app/api/agent/route.ts` | `SYSTEM_BASE` — l'agent conversationnel |
| `app/api/debrief/route.ts` | `SYSTEM` — l'extraction de débrief |
| `lib/business-rules.ts` | `DEFAULT_BUSINESS_RULES` — les 14 règles |
| `integrations/n8n/PROMPTS.md` | la bibliothèque à coller dans n8n |
| `settings.businessRules` | la copie que l'opérateur édite |
| **les nœuds IA de n8n** | **la copie collée à la main** |

Un seul des sept était modifiable, et il n'atteignait que les routes de l'app.
Changer une règle voulait dire la retrouver dans six fichiers **plus** rouvrir
n8n et recoller dans chaque nœud. En pratique : on ne la changeait pas, et les
copies divergeaient sans que rien ne le dise.

---

## Le geste, dans l'app

**Réglages → Prompts** (`/prompts`).

1. **Choisis le prompt.** La liste dit où il tourne : `app` (une route) ou
   `n8n` (un nœud). Ce n'est pas cosmétique — ça décide de l'étape 4.
2. **Lis sa fiche.** Ce qu'il reçoit (les variables), ce qu'il doit rendre
   (texte libre ou **JSON strict**, parsé par du code).
3. **Modifie, puis regarde deux choses :**
   - le **verdict** — ce que ton texte a *perdu*, avec la conséquence ;
   - l'**écart avec le livré** — la colonne qui compte est celle des lignes
     **retirées**. Ajouter une consigne se remarque ; en supprimer une ne se
     remarque jamais.
4. **Enregistre.** À cet instant :
   - prompt `app` → **c'est fini**, il s'applique au prochain appel ;
   - prompt `n8n` → il faut **Pousser vers n8n** (bouton dans la colonne).

**Revenir en arrière** : « Revenir au livré » supprime ta version. On ne stocke
jamais le texte livré comme s'il était une modification — sinon une
amélioration livrée plus tard ne t'atteindrait plus.

---

## Ce qu'on ne peut PAS retirer d'un prompt

La validation refuse d'appliquer un texte qui a perdu l'une de ces règles.
Ce ne sont pas des préférences de style.

| Invariant | Ce qui arrive sans lui |
|---|---|
| **anti-injection** | Un email de prospect peut dicter sa conduite à l'agent : lui faire ignorer ses règles, révéler des infos internes, écrire à quelqu'un d'autre. **Ça ne se voit pas dans la sortie.** |
| **JSON strict** | Un nœud Code parse la réponse. Une phrase d'introduction polie fait tomber le workflow, et l'erreur remonte des heures plus tard sur une fiche au hasard. |
| **prix après démo** | Un chiffre lâché trop tôt transforme la conversation en négociation. |
| **next step daté** | Un échange sans date de suite est un échange perdu. |
| **chiffrer l'inaction** | Un montant générique se vérifie en dix secondes et détruit tout le reste. |
| **ne rien inventer** | Un chiffre fabriqué entre dans le CRM comme s'il avait été constaté. |

> ⚠ Si tu **ajoutes** un invariant plus tard, toutes les versions modifiées
> d'avant deviennent non conformes d'un coup. Elles ne sont **plus servies** —
> on retombe sur le texte livré, et l'écran te le dit en rouge. C'est
> volontaire : servir une version périmée en silence serait pire.

---

## Côté n8n — ce qu'il reste à faire UNE fois

> ⚠ **Tant que cette étape n'est pas faite, « Pousser » ne change rien.**
> Je ne peux pas la faire ni la vérifier d'ici : elle est dans ton n8n.
> L'app est honnête à ce sujet — elle refuse d'afficher « poussé » si n8n ne
> confirme pas une écriture.

### Le contrat

L'app envoie au webhook `alpha-dashboard-api` :

```json
{
  "action": "prompts.set",
  "prompts": [
    { "id": "socle-n8n", "texte": "…", "modifieLe": "2026-08-28T09:00:00.000Z" }
  ]
}
```

Et attend en retour :

```json
{ "ok": true, "written": 1 }
```

> Le champ **`written`** n'est pas décoratif. Le routeur du workflow a un
> `fallbackOutput` qui répond `ping` à **toute action inconnue** : sans lui,
> un n8n qui n'a jamais entendu parler de `prompts.set` renverrait un 200
> réjouissant et l'app afficherait « 3 prompts poussés » alors que rien n'a
> bougé.

### Les trois modifications dans n8n

**1. Un onglet `PROMPTS` dans la feuille CRM** — trois colonnes :
`id` · `texte` · `modifieLe`.

**2. Deux branches sur le nœud `Router (action)`** de
`alpha-dashboard-api` :

- `prompts.set` → nœud Google Sheets en **appendOrUpdate** sur l'onglet
  `PROMPTS`, clé `id` → puis un nœud « Respond to Webhook » qui renvoie
  `{ "ok": true, "written": {{ $items().length }} }`.
- `prompts.get` → lecture de l'onglet → `{ "prompts": [...] }`.

**3. Chaque nœud IA prend son système dans l'onglet**, au lieu de son propre
champ. En pratique, un nœud Sheets « lire PROMPTS » en amont, puis dans le
nœud IA :

```
={{ $('PROMPTS').all().find(r => r.json.id === 'socle-n8n')?.json.texte
    || 'REPLI : socle absent de la feuille' }}
```

> Le **repli** compte : si la feuille est vide ou illisible, il vaut mieux un
> nœud qui dit « socle absent » qu'un nœud qui tourne sans consigne.

---

## Ce que « poussé » veut dire, et ce que ça ne veut pas dire

- **poussé** = n8n a **écrit** les lignes dans la feuille.
- **≠ utilisé** = tes nœuds IA lisent-ils la feuille ? C'est l'étape 3
  ci-dessus, et l'app ne peut pas la vérifier.

Le message affiché après une poussée le dit mot pour mot. Ne le prends pas
pour de la prudence excessive : c'est exactement le genre d'écart qui fait
croire pendant trois semaines qu'une règle est appliquée.

---

## Les fichiers

| Fichier | Rôle |
|---|---|
| `lib/prompts.ts` | Le **registre** : où chaque prompt tourne, ce qu'il reçoit, ce qu'il rend, ses invariants. **Descend dans le navigateur** — aucun texte ici. |
| `lib/prompts-textes.ts` | Les **textes livrés**. **Module serveur**, jamais importé par un composant client. |
| `app/api/prompts/route.ts` | Sert les textes à l'écran d'édition. **Réservée au compte maître** : la doctrine récite les taux du portefeuille. |
| `lib/n8n.ts` → `pousserPrompts` | L'envoi, et le refus de mentir sur le résultat. |
| `tests/prompts.test.ts` | Les gardes, dont : **nos propres textes passent notre validation**. |

> ⚠ Pourquoi cette séparation registre / textes : au premier jet, le texte
> livré était dans le registre. `tests/vitrine-fuite.test.ts` a immédiatement
> signalé que `lib/business-rules` repartait dans un chunk `_next/static/**`
> — téléchargeable **sans cookie**, mot de passe actif ou non. La doctrine y
> récite l'offre, la grille par brique et le taux de **chaque compte**. Une
> route se garde ; un chunk ne se garde pas.
