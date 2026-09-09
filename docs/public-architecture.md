# Architecture

> Version publique de la carte technique. Elle décrit **comment le produit est
> construit** — pas l'état d'exploitation d'un déploiement particulier, qui
> n'a rien à faire dans un dépôt ouvert.

Next.js 15 · React 19 · TypeScript strict. Les briques qui touchent la donnée
**métier** (RAG, extraction, CSV, crypto) sont faites main ; le framework et
les clients de service sont des dépendances normales.

> ⚠ Les compteurs (pages, routes, modules) ne sont pas recopiés ici : ils
> périment au commit suivant sans que personne les rouvre. `find app -name
> page.tsx | wc -l` répond, et il ne ment pas. C'est une règle générale du
> dépôt — un chiffre recopié est un chiffre qui va diverger.

## Topologie — trois zones

```
                     👤 Opérateur / Commercial
                              │
        ┌─────────────────────▼───────────────────────┐
        │  NAVIGATEUR — local-first                    │
        │  • Pages (/pipeline /voice /prospects/:id …) │
        │  • Store Zustand (persist)                   │
        │  • Réglages white-label (identité · offre ·  │
        │    tarifs · règles) ⇢ pilote docs/IA/voix    │
        └─────────────────────┬───────────────────────┘
                              │
                   ╔══════════▼══════════╗
                   ║  MIDDLEWARE — JWT   ║  ← la frontière, fail-closed
                   ╚══════════╤══════════╝
        ┌─────────────────────▼───────────────────────┐
        │  SERVEUR — routes API · clés côté serveur    │
        │  IA · Envoi · Tracking · Voix · Facturation  │
        └───┬─────────┬──────────┬─────────┬──────────┘
            │         │          │         │
     ┌──────▼───┐ ┌───▼─────┐ ┌──▼─────┐ ┌─▼───────────────┐
     │ Moteurs  │ │Postgres │ │Paiement│ │ Automatisation ·│
     │ IA       │ │Auth·RLS │ │        │ │ téléphonie SIP  │
     └──────────┘ └────┬────┘ └────────┘ └─────────────────┘
                       │ RLS : un compte ne voit que SES lignes
```

## Les couches

| Couche | Rôle |
|---|---|
| **Client — local-first** | la source de vérité vit dans le navigateur |
| **Auth & multi-locataire** | un compte = ses données, isolées par `user_id` en RLS |
| **IA — white-label** | l'IA parle au nom du compte et vend SON offre, jamais la nôtre |
| **Envoi & délivrabilité** | composition, rendu, mentions obligatoires, montée en charge |
| **Tracking** | ouvertures et clics, cloisonnés par compte |
| **Voix** | agent vocal, divulgation IA non contournable (art. 50 AI Act) |
| **Audits** | un audit à la marque du compte, généré par prospect |
| **Facturation** | gratuit → payant, webhook signé, droits résolus côté serveur |

## Les décisions qui structurent le code

### La frontière est le serveur, jamais l'écran

Les clés IA, paiement et service-role ne quittent pas le serveur. Le client ne
tranche rien : il transmet, le serveur arbitre. Un écran peut afficher une
porte fermée — c'est même préférable à ne pas savoir qu'elle existe — mais la
sécurité ne dépend jamais de ce qu'il affiche.

En mode authentifié, toute route de données est **fail-closed** : une
configuration incomplète répond en erreur, jamais en accès ouvert. Une
misconfiguration n'ouvre pas.

### Où vivent les fiches — et le mur qui oblige à choisir

Par défaut le pipe vit dans le navigateur (`localStorage`). **Mesuré** : une
fiche d'import pèse ~1,9 Ko, sa timeline autant sur six touches, et le quota
est de 5 Mo.

| | Fiches |
|---|---|
| Alerte (80 %) | ~1 200 |
| Dépassement (100 %) | ~1 500 |

Au-delà, l'écriture échoue **en silence** : l'écran continue d'afficher les
fiches, elles disparaissent en fermant l'onglet. Aucun élagage ne repousse
cette limite — supprimer les phrases répétées des événements ne gagne que 30 %.
C'est pour ça que le mur se montre **avant** de coller un lot, pas après.

### La sortie : le pipe serveur, et son invariant

Au-delà du mur, les fiches ne sont plus persistées localement ; elles se
chargent au démarrage depuis la base.

> ⚠ **L'invariant unique qui rend ça sûr : on ne pousse JAMAIS depuis un état
> qu'on n'a pas chargé.** Un navigateur qui a raté son chargement a une liste
> vide, et la synchro sortante calcule des **suppressions**. Pousser de là
> effacerait le pipe.

Corollaire non évident : **l'état d'hydratation ne se persiste pas**. Le relire
du disque affirmerait « chargé » sur une liste vide, et rouvrir l'onglet
effacerait tout. La persistance réécrit donc l'état de DÉPART, jamais l'état
courant.

Deux filets se recouvrent, et c'est voulu : celui-ci empêche d'essayer, un
seuil d'effacement empêche d'aboutir. Une seule aurait suffi le jour où elle
marche.

### Le moteur de synchro vit dans la coquille, pas dans un écran

Il est monté une fois, dans la coquille de l'application. Tant qu'il vivait
dans l'écran de réglages, un opérateur en mode pipe serveur qui n'ouvrait
jamais cette page ne poussait rien — et perdait sa journée en fermant l'onglet.

Et parce que les secondes de silence avant un envoi sont des secondes pendant
lesquelles la saisie n'existe nulle part : `sendBeacon` sur `pagehide` et
`visibilitychange` (une requête normale est annulée avec la page). Écritures
uniquement, jamais de suppression — on ne vérifie pas l'accusé de réception
d'un beacon.

---

Chacune de ces décisions a coûté un bug avant d'être écrite. C'est la raison
d'être des commentaires denses dans le code : ils portent le **pourquoi**, la
seule partie qu'un diff ne raconte pas.
