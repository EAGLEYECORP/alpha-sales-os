# Alpha Sales OS sur Netlify — le runbook

> Décidé le 17/09/2026. `eagleyecorp.fr` est déjà sur Netlify ; l'app Alpha l'y
> rejoint, pour consolider l'hébergement sur une plateforme que l'assistant
> peut piloter (tracking, scale, délégation des ops).

## Ce qui a été fait côté code (par l'assistant, déjà poussé)

- **`netlify.toml` racine** construit désormais l'app Next.js (`npm run build` +
  `@netlify/plugin-nextjs`). Il ne déclare **aucun** `publish` statique — le
  runtime Next sert la sortie du build, jamais l'arbre du dépôt.
- **`lib/url-publique.ts`** se replie sur les variables Netlify (`URL`,
  `DEPLOY_PRIME_URL`) en plus de `VERCEL_URL` — sinon `metadataBase` retombe sur
  `localhost` sur Netlify et les cartes LinkedIn sortent sans vignette.
- **La garde `tests/site-vitrine.test.ts`** a changé de mécanisme : elle exige
  que la racine construise (runtime Next présent) et ne publie rien en statique.
  Intention identique — jamais exposer `donnees-privees/`.

## ⚠⚠ Le fait de sécurité qui rend la bascule sûre

`donnees-privees/` (78 fiches prospects RÉELLES) est à la racine, **hors de
`public/`**. Un build Next ne sert que `public/` + la sortie du build — **jamais
la racine**. Le danger d'exposition était propre à une publication STATIQUE de
la racine, que ce dépôt interdit toujours. Vérifié, pas supposé.

## Ce qui reste sur Zakaria (les gestes que l'assistant ne peut pas faire)

Aucun de ces gestes n'est du code : ce sont des actions dans des tableaux de
bord, avec des identifiants et des secrets qui n'appartiennent qu'à toi.

1. **Relier le repo GitHub au site Netlify `alphasalesos`** (UI Netlify →
   *Add new site* → *Import from Git* → GitHub → `eagleyecorp/alpha-sales-os`,
   branche à choisir). C'est l'OAuth GitHub↔Netlify : il passe par ton compte.
   - Laisser le **base directory VIDE** (racine) : c'est là que vit
     `netlify.toml` qui construit l'app.
   - Netlify détecte Next.js et applique le runtime automatiquement.

2. **Poser les variables d'environnement** sur le site `alphasalesos`
   (Site settings → Environment variables). L'ordre et la raison de chacune
   sont dans `docs/A-FAIRE-ZAKARIA.md`. Les 4 secrets (clé anon Supabase,
   `SUPABASE_JWT_SECRET`, `SMTP_*`) ne se collent QUE là — jamais dans le dépôt,
   jamais dans un message. `REQUIRE_AUTH=1` **en dernier**.
   - ⚠ Ajouter **`APP_BASE_URL=https://alphasalesos.eagleyecorp.fr`** : ça cloue
     l'URL publique en dur au lieu de dépendre de la variable de plateforme.
     Le tracking OG est alors garanti quel que soit l'hébergeur.

3. **Le site vitrine `eagleyecorp.fr`** ne bouge pas. S'il est un jour relié au
   même repo, régler son **base directory sur `site/`** dans SES réglages
   Netlify — il lit alors `site/netlify.toml` et jamais la config de l'app.

## Ce qui n'a PAS pu être vérifié depuis la sandbox

Le **build Netlify lui-même**. Le réseau de l'environnement de développement
bloque Netlify, et `next build` local passe mais n'exerce pas l'adaptateur
Netlify. **Le premier déploiement est le test.** Deux choses à surveiller sur
ce premier build :

- `next.config` porte `output: "standalone"`. Les versions récentes du runtime
  Netlify le gèrent, mais si le build échoue là-dessus, c'est le premier
  suspect — le retirer (ou le conditionner hors Netlify) débloque.
- Le `Content-Security-Policy` du `next.config` autorise `puter.com` : rien de
  spécifique à Netlify, mais à vérifier si une ressource est bloquée en prod.

Une fois le premier build vert et les variables posées, `GET /api/health`
(connecté) dit l'état réel de la bascule d'authentification — à lire AVANT et
APRÈS avoir posé `REQUIRE_AUTH`.
