# Brancher un agent sur Alpha Sales OS

> Comment un agent (moi via Cowork/Claude Code, ou n'importe quel autre)
> surveille le pipe et prépare la suite — **sans pouvoir envoyer, appeler ni
> modifier quoi que ce soit**.

---

## Le principe, et pourquoi il n'est pas négociable

L'agent lit largement. Il n'écrit **qu'une seule chose** : une **proposition**,
qu'un humain approuve dans l'app.

Ce n'est pas de la prudence décorative. Trois raisons concrètes :

1. **Un agent n'a pas de continuité.** Il ne se souvient pas de ce qu'il a
   envoyé hier. Un système qui envoie sans mémoire fiable relance deux fois la
   même personne.
2. **Un agent n'a pas de responsabilité.** Quand un mauvais email part chez un
   client réel, c'est toi qui réponds.
3. **Une erreur d'agent est silencieuse et rapide.** Un humain qui se trompe
   s'arrête. Un agent recommence quinze fois avant qu'on s'en aperçoive.

La proposition règle les trois : un acte **écrit, daté, attribué**, tranché par
un humain. L'agent garde son utilité — voir, comprendre, préparer — et perd
exactement le pouvoir qu'il ne peut pas assumer.

**Ce qui change pour toi** : tu ne lis plus ton pipe pour trouver quoi faire.
Tu lis une file et tu dis oui ou non. C'est plus rapide que de décider.

---

## Ce que l'agent voit, et ce qu'il ne voit pas

| Il voit | Il ne voit PAS |
|---|---|
| Qui est prêt à signer, qui dort, qui est saturé | les emails |
| L'étape, la valeur annuelle, les signaux vitaux | les téléphones |
| Ce qui n'a pas de prochaine étape | les noms de personnes, les adresses |
| Les propositions déjà déposées et leur sort | |

Un moniteur n'a pas besoin de savoir **comment** joindre quelqu'un pour dire
qu'il **faut** le joindre. Sortir des coordonnées de tiers vers un agent
externe serait une transmission de données personnelles sans nécessité.
Vérifié par test.

---

## Les clés et leurs portées

`ALPHA_API_KEYS` était une liste plate : toute clé pouvait tout faire.
Acceptable à un seul utilisateur, plus du tout avec un client qui paie.

**Format** : `nom:propriétaire:portée1|portée2:secret`, entrées séparées par
des virgules.

```bash
ALPHA_API_KEYS="orchestrateur:operateur:etat.read|propositions.read|propositions.write:sk_orc_xxxxx,n8n-couvreur:client-couvreur:prospects.write:sk_cli_yyyyy"
```

| Portée | Donne le droit de |
|---|---|
| `etat.read` | lire l'état du pipe (sans coordonnées) |
| `prospects.read` / `prospects.write` | lire / injecter des prospects |
| `propositions.read` | lister les propositions |
| `propositions.write` | **déposer** une proposition (n'exécute rien) |

- Une clé **sans** portée ne peut rien. C'est le comportement voulu d'une clé
  mal configurée.
- Une entrée **mal formée** est ignorée, jamais devinée.
- Une clé **nue** (ancien format) reste une clé opérateur complète — on ne
  casse pas les intégrations existantes pour un refactor.
- Refus distincts : **401** = clé fausse ou absente · **403** = clé valide sans
  la portée, avec le nom de la clé et la portée manquante dans le message.

Génère des secrets longs et aléatoires :

```bash
openssl rand -hex 32
```

---

## Brancher Claude (Cowork / Claude Code)

Le serveur MCP est à **`POST /api/mcp`** — JSON-RPC 2.0, écrit à la main
(aucune dépendance ajoutée). Il implémente `initialize`, `tools/list`,
`tools/call`.

### Configuration côté client MCP

```json
{
  "mcpServers": {
    "alpha-sales-os": {
      "type": "http",
      "url": "https://TON-DOMAINE/api/mcp",
      "headers": { "Authorization": "Bearer sk_orc_xxxxx" }
    }
  }
}
```

### Vérifier avant de brancher

```bash
curl -s https://TON-DOMAINE/api/mcp \
  -H "Authorization: Bearer sk_orc_xxxxx" | jq
```

Doit rendre `"authentifie": true` avec la liste des portées. Si `false`, le
champ `pourquoi` dit exactement quoi corriger.

### Les trois outils exposés

| Outil | Effet |
|---|---|
| `etat_du_pipe` | lecture seule |
| `lister_propositions` | lecture seule |
| `proposer` | **dépose** une proposition — n'envoie rien |

Un outil dont la clé n'a pas la portée **disparaît de la liste** au lieu
d'échouer à l'appel : un outil qui échoue, l'agent le retente.

**Il n'existe aucun outil qui envoie, appelle ou modifie.** Ce n'est pas une
omission, c'est la conception — et un test refuse tout outil pointant hors de
`/api/v1/etat` et `/api/v1/propositions`.

---

## Les tables Supabase

Sans elles, rien de tout ça ne fonctionne : le serveur ne voit pas le pipe et
les propositions ne survivent pas à la requête.

⚠ Ce SQL ne vit plus ici. Il vivait dans cette documentation, donc personne ne
l'exécutait en appliquant `schema.sql` — et l'orchestrateur ne pouvait rien
proposer sans que rien ne plante. Il est maintenant dans le schéma, avec deux
autres tables qui étaient dans le même cas (`call_sessions`,
`push_subscriptions`).

**Base neuve** → `supabase/schema.sql`.

**Base qui tourne déjà** → `supabase/migrations/001-proprietaire-et-tables-serveur.sql`.
`schema.sql` est écrit en `create table if not exists` : sur une base existante
il ne modifie **rien**, et le SQL Editor annonce quand même « Success ». La
migration porte les `alter table` et se relance sans danger.

Un test refuse désormais qu'une table interrogée par le code soit absente du
schéma.

La table `prospects` du schéma principal (`supabase/schema.sql`) sert aux deux
écrivains serveur. ⚠ Elle a été corrigée : `user_id` était `NOT NULL`, ce qui
rendait toute écriture sans session **impossible** — les deux routes
documentées ne pouvaient pas écrire dans leur propre table. Il est devenu
nullable, et une colonne `proprietaire` distingue les lignes :

| Écrivain | `proprietaire` | Peut être supprimé par |
|---|---|---|
| Synchro de l'opérateur (`/api/sync/prospects`) | `operateur` | l'opérateur |
| Ingestion par clé API (`/api/v1/prospects`) | le propriétaire de la clé | personne |

**La synchro navigateur → Supabase existe** : *Réglages → Synchro du pipe vers
le serveur*. Elle est **éteinte par défaut** — l'activer transfère vers le
serveur les coordonnées de vraies personnes, et c'est une décision.

Elle réconcilie : elle écrit ce qui a changé et supprime ce qui a été supprimé.
Un garde-fou refuse d'envoyer si plus d'un tiers du pipe serveur disparaîtrait
d'un coup — c'est le symptôme d'un navigateur qui a perdu ses données, pas d'un
nettoyage. Le plafond est **revérifié côté route** : le client n'est pas une
source de vérité sur sa propre prudence.

---

## Le cycle complet

```
  Agent                          Serveur                    Toi
    │                               │                        │
    ├─ etat_du_pipe ───────────────▶│                        │
    │◀── prêts / endormis / saturés ┤                        │
    ├─ lister_propositions ────────▶│   (ne pas répéter      │
    │◀── déjà proposé / rejeté ─────┤    ce qui a été rejeté)│
    ├─ proposer ───────────────────▶│                        │
    │◀── "en-attente, RIEN envoyé" ─┤                        │
    │                               │── Salle de contrôle ──▶│
    │                               │◀── approuve / rejette ─┤
    │                               │                        │
    │                        approuvée ≠ exécutée ───────────┤
    │                                        tu exécutes ────┘
```

**« Approuver » et « faire » restent deux gestes.** Un seul clic qui ferait les
deux finit par partir tout seul un soir de fatigue.

Une proposition non tranchée **expire après 48 h** : le contexte a bougé, le
prospect a peut-être répondu, et l'approuver ferait partir un message qui ne
correspond plus à rien. Le statut suit la **date**, pas un cron.

**Le motif de rejet est la seule chose qui remonte à l'agent.** Sans motif, il
repropose la même chose demain — il n'a aucune mémoire entre deux sessions.

---

## Pour les clients : brancher leurs propres outils

Un client peut intégrer ses outils (n8n, Zapier, son CRM, un formulaire) via la
même API, avec une clé à portée réduite.

```bash
# Injecter des prospects — portée prospects.write
curl -X POST https://TON-DOMAINE/api/v1/prospects \
  -H "Authorization: Bearer sk_cli_yyyyy" \
  -H "content-type: application/json" \
  -d '{"prospects":[{"company":"Toiture Durand","sector":"artisan","city":"Lyon 7e"}]}'
```

La réponse rend ce qui est **entré**, ce qui est **refusé** avec l'index et la
raison, les **avertissements** par ligne (un intégrateur qui envoie `telephone`
au lieu de `phone` doit l'apprendre à la première requête), et le **triage** du
lot : importer 1 000 lignes ne veut rien dire, savoir que 40 sont appelables,
si.

**Cloisonnement** : une clé client ne voit que les propositions de son
propriétaire. Seul l'opérateur voit tout — c'est lui qui tranche.

**Ne donne jamais `propositions.write` à un client.** Sa clé sert à alimenter
son pipe, pas à proposer des actions sur le tien.

---

## Ce qui reste à faire

- [ ] Créer les tables `propositions` et `prospects` (`supabase/schema.sql`).
- [x] ~~Construire la synchro navigateur → Supabase.~~ Faite. Reste à
      l'**activer** dans Réglages une fois Supabase branché.
- [ ] Générer les clés et poser `ALPHA_API_KEYS`.
- [ ] Brancher le client MCP et vérifier avec le `curl` ci-dessus.
- [ ] Faire tourner **une** proposition de bout en bout avant d'en automatiser
      la production.

Rien de tout ça n'a été testé contre un vrai projet Supabase ni un vrai client
MCP : l'environnement de développement n'atteint pas les services live.
