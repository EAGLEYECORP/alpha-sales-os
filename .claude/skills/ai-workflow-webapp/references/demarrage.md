# Démarrer un repo — checklist opérationnelle

Ordre pensé pour éviter les chantiers de reprise. Les trois premiers points
sont ceux qu'on ne peut plus corriger à bon marché après.

---

## Jour 1 — les décisions irréversibles

### 1. Où vit la donnée

| Type de produit | Réponse |
|---|---|
| Outil personnel mono-utilisateur | navigateur acceptable |
| Produit multi-utilisateur | **base dès le premier jour** |
| Données de santé (Tabib, dentiste) | **base, hébergement décidé et documenté** |

Le stockage navigateur (~5 Mo, écriture synchrone, non chiffré, survit à la
déconnexion) est un cul-de-sac. La migration coûte des semaines : ne pas la
provoquer par confort initial.

### 2. Qui accède à quoi, prouvé côté serveur

- RLS activée sur **chaque** table, pas seulement les sensibles.
- Le JWT vérifié dans le **middleware**, pas dans un composant.
- Un « compte », un « cabinet », un « praticien » : décider dès maintenant si
  c'est une frontière de **sécurité** ou d'**identité**. Confondre les deux est
  le bug qu'on ne rattrape pas — l'un se contourne côté client, l'autre non.
- **Fail-closed** : si le secret de vérification manque, refuser. Jamais servir
  des données sans pouvoir prouver l'identité.

### 3. Le garde-fou du graphe d'imports

À poser **avant** d'avoir des secrets. Après, c'est un chantier de plusieurs
jours. Voir `garde-fous.md`.

---

## Jour 2 — la structure

### 4. Middleware : fermé par défaut

```ts
const PUBLIC_PREFIXES = [ /* liste EXPLICITE et courte */ ];
const INTERNAL       = [ /* même origine exigée en plus de la porte */ ];
// tout le reste : fermé
```

Chaque route ajoutée doit être **classée**. Le test dérivé (`garde-fous.md` §3)
rattrape l'oubli.

Trois pièges vécus :
- une route de cron derrière la porte d'accès reçoit « non autorisé » et le
  planificateur ne part jamais — rien dans la réponse ne relie ça au mot de
  passe ;
- un service worker doit être servi **à la racine, en JavaScript** : derrière
  une redirection il reçoit du HTML et échoue avec une erreur de type MIME que
  rien ne relie à la cause ;
- un flux lu par un serveur tiers (calendrier, webhook) n'a **aucun cookie** :
  il lui faut sa propre authentification, pas une exception.

### 5. Modules métier purs

Un module par domaine dans `lib/`, sans réseau ni clé, testé isolément. C'est
ce qui permet de tester la logique sans monter l'app — et de la faire tourner
côté serveur *et* client selon le besoin.

Règle : **si ça a besoin d'une clé ou du réseau, ce n'est pas un module métier,
c'est une route.**

### 6. Le repli déterministe AVANT l'appel IA

Écrire le gabarit d'abord. Toujours. Voir `prompts-ia.md` §3.

---

## Jour 3 — ce qui évite les mauvaises surprises

### 7. Le banc d'essai de volume

Avant toute optimisation. Mesurer :
- poids sérialisé d'un enregistrement réaliste (avec son historique) ;
- coût d'une écriture d'état ;
- coût d'une recherche/filtrage à 100, 1 000, 5 000 ;
- ce qui grossit sans plafond.

**Ne jamais optimiser sans mesure** : sur un produit réel, le mur ressenti
(saccade à 500 fiches) n'était pas le mur supposé (quota à 1 200).

### 8. Les plafonds

Tout ce qui s'empile — journaux, activités, mémoire, historiques — a un plafond
défini dans **un seul** helper, et un test qui interdit la forme brute.

### 9. Les fuseaux

`Intl.DateTimeFormat`, jamais `getHours()`. Le serveur tourne en UTC ; un
rappel « à 9 h » part à 10 h ou 8 h selon la saison.

```ts
const heureLocale = (at: Date, tz: string) =>
  Number(new Intl.DateTimeFormat("fr-FR", { hour: "2-digit", hour12: false, timeZone: tz }).format(at));
```

Piège vécu : un test qui utilisait des dates ISO **sans décalage** passait
uniquement parce qu'il partageait le bug qu'il devait empêcher.

---

## Secrets — non négociable

- `.gitignore` : `.env` **et** `.env.*`, avec `!.env.example`. La règle
  `.env` + `.env*.local` laisse passer `.env.production`, `.env.prod`,
  `.env.staging` — exactement les fichiers qui portent les vraies clés.
- Un secret poussé sur un dépôt distant reste dans l'historique après
  suppression. **Le considérer comme brûlé et le faire tourner.**
- Scanner chaque commit avant de pousser :

```bash
git diff --cached | grep -nE 'sk-[A-Za-z0-9]{20}|nvapi-|eyJhbGciOi|-----BEGIN'
```

- Ne jamais écrire dans un fichier une clé collée dans une conversation.

---

## Spécifique santé — à trancher avant le code

Ces réponses changent l'architecture. Les obtenir par écrit.

1. **Hébergement** : où physiquement ? Le droit marocain encadre les transferts
   hors du pays. Un hébergeur européen ou américain est une décision, pas un
   défaut.
2. **Autorisation CNDP** : les données de santé sont sensibles sous la loi
   09-08 — traitement soumis à autorisation, pas à simple déclaration.
   **Faire vérifier par un juriste ; ne pas traiter cette page comme un avis
   juridique.**
3. **Conservation** : combien de temps, et qu'est-ce qui supprime ? Une
   suppression qui n'existe pas est une conservation illimitée par défaut.
4. **Journalisation** : identifiants, jamais de motifs. « RDV créé — patient
   #4172 », pas « — Mme X, détartrage ».
5. **Envoi à un fournisseur d'IA** : c'est une transmission à un tiers.
   Pseudonymiser avant l'appel, ou tourner en local, ou ne pas le faire.
6. **Poste partagé de cabinet** : ne rien laisser en clair dans le navigateur,
   et couper la session à l'inactivité.

---

## Ce qui se répète dans ce type de produit

Composants métier qu'on réécrit à chaque fois — les prévoir tôt :

- **agenda + créneaux** : disponibilités, chevauchements, fuseaux, jours fériés ;
- **rappels** : cadence, canal, arrêt à la réponse, arrêt définitif sur
  opposition — l'arrêt prime toujours sur la cadence ;
- **file d'attente / relances** : idempotente, plafonnée, **et qui dit quand
  elle tronque** ;
- **import de données** : CSV et champs libres = donnée non fiable, à clôturer
  avant tout prompt ;
- **audit** : qui a vu quoi, quand. Sur un dossier patient, ce n'est pas une
  option.
