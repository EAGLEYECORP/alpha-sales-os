# Alpha chez vous — l'installation sur le serveur d'un client

> Décidé le 20/10/2026 : **en ligne, Alpha est gratuit ; chez vous, il se vend**,
> au prix de la grille complète (`OFFRE_CHEZ_VOUS` = Business : 10 000 € HT
> d'installation, puis 600 € HT/mois + 80 € HT par utilisateur).
> C'est une prestation **fait pour vous** : c'est nous qui installons, réglons
> et formons. Le client ne touche à aucune ligne de commande.

⚠ **Aucune installation n'a encore été faite hors de chez nous.** La première
est le test. Compter une demi-journée, et garder le retour arrière (étape 9).

---

## 0. Le cadrage — avant tout devis (obligatoire)

Une date et une heure décidées. On en sort avec, par écrit :

| Question | Pourquoi elle décide de l'installation |
|---|---|
| Combien d'utilisateurs ? | **Une personne** : le mot de passe suffit. **Une équipe** : il faut des comptes (étape 4) — sans eux, chaque navigateur garde SON CRM, et rien n'est partagé. |
| Quelles briques font-ils tourner ? | La voix change tout : elle demande une ligne et des comptes de téléphonie à son nom (étape 6). |
| Avec quels comptes ? | **Tout est à son nom** : boîte d'envoi, nom de domaine, téléphonie, clé d'IA. Rien ne passe par les nôtres. |
| Quel serveur ? | Le sien, ou un serveur qu'on commande **à son nom** (étape 1). |

---

## 1. Le serveur

- Un VPS à son nom : **4 vCPU · 8 Go de RAM · 80 Go SSD**, Ubuntu 24.04 LTS.
  L'IA locale (Ollama, modèle 3B) en prend 3 à 4 Go ; en dessous, elle rame.
- Docker et le plugin Compose installés.
- Un sous-domaine à lui, par exemple `alpha.client.fr`, pointé sur le serveur
  (enregistrement A).

## 2. L'image — construite chez nous, jamais le code source chez lui

Sur NOTRE machine, depuis le dépôt :

```bash
docker build -t alpha-sales-os:AAAA-MM-JJ .
docker save alpha-sales-os:AAAA-MM-JJ | gzip > alpha-AAAA-MM-JJ.tar.gz
scp alpha-AAAA-MM-JJ.tar.gz client@alpha.client.fr:~
```

Puis sur SON serveur : `docker load < alpha-AAAA-MM-JJ.tar.gz`.

- `.dockerignore` exclut `donnees-privees/` (nos fiches réelles), `tests/`,
  `scripts/`, `site/` et la doctrine (`*.md`). `tests/installation-client.test.ts`
  l'exige : cette image part chez un tiers.
- On copie sur le serveur **seulement** `docker-compose.yml` et le `.env`. Dans
  ce `docker-compose.yml`, remplacer la ligne `build: .` du service `app` par
  `image: alpha-sales-os:AAAA-MM-JJ`.

## 3. Le `.env` du client (sur son serveur, jamais dans un message)

```bash
ALPHA_INSTALLATION=client          # tout le produit, rien de notre économie
SITE_PASSWORD=<long, à lui>         # la serrure — SANS elle, l'app retombe au gratuit
APP_BASE_URL=https://alpha.client.fr
CLOSER_NAME=<son nom ou sa société> # le signataire : on ne le devine jamais
SMTP_HOST= SMTP_PORT=587 SMTP_USER= SMTP_PASS= SMTP_FROM=   # SA boîte
OLLAMA_MODEL=qwen2.5:3b
```

- `ALPHA_INSTALLATION=client` ouvre **toutes** les briques, **ALPHA CEO**
  (`/ceo`, `/moniteur` : la console d'exploitation de SON serveur), et
  **refuse** nos pages d'économie (`/payouts`, `/offre`, nos coûts et marges,
  notre playbook).
  Ne JAMAIS la poser sur notre production : on y perdrait nos propres pages.
- Sans `SITE_PASSWORD` ni comptes, l'installation retombe **au socle gratuit** :
  joignable sans serrure, son SMTP enverrait pour n'importe qui. C'est voulu.

## 4. Une équipe : les comptes

Plusieurs utilisateurs ⇒ un projet Supabase **à son nom** (offre gratuite
possible), les migrations de `supabase/` jouées, puis dans le `.env` :
`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
`SUPABASE_JWT_SECRET`, `SUPABASE_SERVICE_ROLE_KEY`, et le réglage **pipe
serveur** activé dans l'app. Sans ça, chaque navigateur garde son CRM, et un
historique effacé efface les fiches.

## 5. HTTPS et démarrage

Caddy devant l'app (certificat automatique) — `/etc/caddy/Caddyfile` :

```
alpha.client.fr {
  reverse_proxy 127.0.0.1:3000
}
```

Puis :

```bash
docker compose up -d
docker compose exec ollama ollama pull qwen2.5:3b
```

Les trois services sont liés à `127.0.0.1` : seul Caddy est exposé. N'ouvrir
ni `5678` (n8n) ni `11434` (Ollama, aucune authentification) au pare-feu.

## 6. La voix (si elle est au périmètre)

`voice/agent.py` tourne sur le même serveur, avec **ses** comptes LiveKit et
Telnyx — procédure dans `voice/README.md` et `voice/INBOUND.md` (la faute n°1 :
l'hôte SIP de LiveKit a un préfixe aléatoire).

- La première phrase (IA, pas une personne, pour le compte de qui) est dite
  par le code et ne se coupe pas. **Ne jamais contourner.**
- ⚠ L'appel **sortant en autopilote** refuse de composer sans battement de
  présence de l'agent — et ce battement s'écrit en base. Sans comptes (étape 4),
  seuls l'entrant et les appels lancés à la main fonctionnent. À dire au cadrage.

## 7. Les vérifications, avant de dire « c'est en ligne »

- [ ] `https://alpha.client.fr` demande le mot de passe.
- [ ] Une fois entré : `/campaigns` et `/voice` s'ouvrent.
- [ ] `https://alpha.client.fr/api/voice-costs` répond **403** (nos marges).
- [ ] `/payouts` ne s'ouvre pas.
- [ ] `/ceo` s'ouvre (ALPHA CEO) et ne parle ni de Stripe ni d'essais : ce
      n'est pas son affaire. Les pannes qui restent (SMTP, agent vocal,
      ordonnanceur) sont les siennes — les lire avec lui le premier jour.
- [ ] Un email de test vers SA propre adresse : il part de SA boîte, porte le
      signataire et le moyen de refus (« STOP »).
- [ ] Son domaine d'envoi a SPF, DKIM et DMARC (`/deliverability`).
- [ ] Si voix : un appel entrant décroche et dit la phrase IA en premier.

## 8. Le gant blanc — ce qu'on règle POUR lui

- Réglages : sa société, son signataire, sa ville, son lien de rendez-vous.
- Ses contacts importés (CSV ou Google Sheet), ses offres dans le catalogue.
- Son Cerveau : ses objections, ses scripts, ses mots.
- **Le palier d'envoi** : 5 emails/jour la première semaine sur une boîte
  neuve, +5 par semaine. Son domaine se grille en une soirée, pas en un mois.
- La formation : un nombre de séances **écrit au devis**. « On est là si
  besoin » sans limite devient du travail gratuit illimité.

## 9. Passation, sauvegardes, mises à jour

- On lui remet : le mot de passe, les accès à ses comptes, cette fiche.
- Sauvegardes : les volumes `n8n_data` et `ollama_data`, et sa base Supabase
  s'il y en a une.
- Mise à jour = une nouvelle image (étape 2), `docker compose up -d`. Garder
  l'image précédente : en cas de souci, on remet son nom dans le compose et on
  relance — c'est le retour arrière.
