# Déploiement — eagleyecorp.fr + sous-domaines

> Hébergeur DNS : **Amen.fr**. Hébergement applicatif : **Vercel**.
> À faire une fois, dans cet ordre.

> ⚠ **Rien de tout ça n'est un prérequis.** L'application tourne déjà sur
> l'URL `*.vercel.app` fournie par Vercel, et l'autopilote comme le journal
> d'appels fonctionnent avec. Les domaines ci-dessous sont un CONFORT
> (crédibilité, mémorisation), pas une condition technique — à faire quand tu
> as le temps, pas avant d'encaisser.

## L'architecture retenue

| Domaine | Sert | Public ? |
|---|---|---|
| `eagleyecorp.fr` | La **vitrine** (`/vitrine`) — la page qui vend | oui |
| `alphasalesos.eagleyecorp.fr` | L'**application** Alpha Sales OS | non (SITE_PASSWORD) |

### Sur les sous-domaines par brique

Tu évoquais `alphavoice.eagleyecorp.fr`, `cerveau.eagleyecorp.fr`, etc.
**Je te le déconseille pour l'instant, et voici pourquoi :**

- Chaque sous-domaine est une **origine différente** pour le navigateur. Le
  store (`localStorage`), le cookie d'accès et la session Supabase ne se
  partagent PAS entre origines. Un client qui a Alpha Voice + le Cerveau
  devrait se reconnecter sur chaque sous-domaine.
- Le cloisonnement par brique existe déjà **dans l'app** :
  `unlockedRoutes()` (lib/bricks.ts) ne montre au client que les routes de
  ses briques. C'est le même résultat, sans casser la session.
- Un sous-domaine par brique multiplie les certificats, les déploiements et
  les points de panne — pour un bénéfice purement cosmétique.

**Quand ça deviendra justifié** : le jour où une brique est vendue à un
public qui n'a *aucune* raison de voir le reste (ex. une page publique de prise
de RDV pour les clients de ton client). Là, un sous-domaine dédié a du sens.

## 1. Vercel — rattacher les domaines

Dans le projet Vercel → **Settings → Domains** :

1. Ajouter `eagleyecorp.fr`
2. Ajouter `www.eagleyecorp.fr` (Vercel proposera la redirection vers l'apex — accepter)
3. Ajouter `alphasalesos.eagleyecorp.fr`

Vercel affiche alors les enregistrements DNS à créer. Les valeurs ci-dessous
sont les valeurs standard Vercel — **utilise celles que Vercel t'affiche**,
elles font foi.

## 2. Amen.fr — la zone DNS

Espace client Amen → **Domaines → eagleyecorp.fr → Gestion DNS**.

| Type | Nom / Hôte | Valeur | TTL |
|---|---|---|---|
| `A` | `@` | `76.76.21.21` | 3600 |
| `CNAME` | `www` | `cname.vercel-dns.com.` | 3600 |
| `CNAME` | `alphasalesos` | `cname.vercel-dns.com.` | 3600 |

> ⚠ Amen ajoute parfois automatiquement le domaine au champ « Nom ». Si le
> champ affiche déjà `.eagleyecorp.fr`, saisis seulement `alphasalesos`, pas
> `alphasalesos.eagleyecorp.fr` — sinon tu crées
> `alphasalesos.eagleyecorp.fr.eagleyecorp.fr`.

> ⚠ Ne supprime pas tes enregistrements **MX** (mails `contact@eagleyecorp.fr`)
> ni tes **TXT** (SPF/DKIM/DMARC). Toucher au A/CNAME n'affecte pas le mail,
> mais une suppression en masse, si.

**Propagation** : quelques minutes à 24 h. Vercel affiche « Valid Configuration »
quand c'est bon.

## 3. Router l'apex vers la vitrine

Par défaut, `eagleyecorp.fr/` sert le tableau de bord (protégé). Il faut que
l'apex serve la **vitrine**. Deux options :

**Option A — la plus simple (recommandée).** Dans Vercel → Settings → Domains,
sur `eagleyecorp.fr`, configurer une **redirection** vers `/vitrine`.

**Option B — plus propre pour le SEO.** Une réécriture dans `next.config.js`
conditionnée à l'hôte : `eagleyecorp.fr/` → `/vitrine` en *rewrite* (l'URL
reste `eagleyecorp.fr/`, pas de redirection visible).

## 4. Variables d'environnement Vercel

| Variable | Rôle |
|---|---|
| `SITE_PASSWORD` | La porte de l'app. **Sans elle, tout est public.** |
| `NEXT_PUBLIC_SUPABASE_URL` | Base de données |
| `SUPABASE_SERVICE_ROLE_KEY` | Écriture serveur (journal d'appels durable) |
| `SUPABASE_JWT_SECRET` | Multi-locataire |
| `LIVEKIT_URL` / `LIVEKIT_API_KEY` / `LIVEKIT_API_SECRET` | Alpha Voice |
| `VOICE_WEBHOOK_SECRET` | Journal d'appels — **sans lui, la route refuse tout sauf localhost** |

> La vitrine reste accessible même avec `SITE_PASSWORD` actif : `/vitrine` est
> dans `PUBLIC_PREFIXES` (middleware.ts). C'est voulu — une page de vente
> derrière un mot de passe ne vend rien.

## 5. Vérifications après mise en ligne

- [ ] `https://eagleyecorp.fr` affiche la vitrine, **sans** mot de passe
- [ ] `https://alphasalesos.eagleyecorp.fr` demande le mot de passe
- [ ] Le certificat HTTPS est valide sur les deux (Vercel le pose seul)
- [ ] Un mail envoyé à `contact@eagleyecorp.fr` arrive toujours
- [ ] La vitrine est lisible sur téléphone (c'est là que la moitié du trafic lira)
