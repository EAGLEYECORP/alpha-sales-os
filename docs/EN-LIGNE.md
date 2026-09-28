# Mettre ALPHA en ligne — Vercel, Supabase, et le micro qui marche

**EAGLEYE CORP · ALPHA SALES OS®**

Trois choses, dans l'ordre. La première explique le « Micro refusé » du
Débrief ; les deux autres mettent l'app en ligne pour de bon.

---

## 1. Pourquoi le micro était refusé — et ce qui est corrigé

Le Débrief terrain et l'assistant d'appel utilisent la reconnaissance vocale
du navigateur (Web Speech API). Elle a **deux exigences non négociables** :

1. **Une connexion sécurisée (HTTPS).** C'est le cœur du « ça marche pas ». Sur
   ton téléphone, si tu ouvres l'app par son **adresse locale** (`http://192.168…:3000`
   ou l'IP du PC), le navigateur **bloque le micro sans explication utile**. La
   Web Speech API n'existe que sur `https://…` (ou `localhost` sur la même
   machine). Il faut donc l'app **EN LIGNE** — l'adresse `https://…` de Vercel.

2. **La permission micro accordée.** Une fois refusée, Chrome s'en souvient.

**Ce qui a été corrigé dans le code :**

- Avant de lancer l'écoute, l'app **demande explicitement le micro** (invite
  système fiable, surtout sur Android) au lieu de démarrer à l'aveugle.
- Si la connexion n'est **pas** en HTTPS, le message le dit clairement :
  *« Le micro exige une connexion sécurisée (HTTPS). Ouvre l'app EN LIGNE. »*
- Si la permission est refusée, le message donne le geste exact :
  *« Touche le cadenas (ou « aA ») → Autorisations du site → Microphone → Autoriser. »*

**Sur ton téléphone, une fois l'app en ligne (https) :**

| Navigateur | Geste |
|---|---|
| **Chrome Android** | Cadenas à gauche de l'adresse → Autorisations → Micro → Autoriser → recharge |
| **Safari iPhone** | « aA » à gauche de l'adresse → Réglages du site → Microphone → Autoriser |

> Firefox ne sait pas transcrire (aucun OS). Le repli **« Écrire au clavier »**
> existe partout : même résultat, sans micro.

---

## 2. L'app en ligne sur Vercel

> Ce que je ne peux pas faire depuis ici : me connecter à **ton** compte Vercel
> (je n'ai pas tes accès). Ce qui suit, c'est ce qu'il te reste à cliquer — le
> code, lui, est **prêt à déployer** (build vérifié).

### a. Connecter le dépôt (une seule fois)

1. [vercel.com/new](https://vercel.com/new) → *Import Git Repository* →
   `EAGLEYECORP/alpha-sales-os`.
2. Framework détecté : **Next.js**. Laisse les réglages par défaut. *Deploy*.

### b. Mettre CE travail en production

Ton travail récent est sur la branche `claude/crm-n8n-email-tracking-4qxtwr`,
pas sur `main`. Deux façons de le rendre visible sur l'adresse principale :

- **Le plus simple** — Vercel → *Settings → Git → Production Branch* → choisis
  `claude/crm-n8n-email-tracking-4qxtwr`. Chaque `push` redéploie la prod.
- **Ou** fusionne la branche dans `main` (je peux préparer la Pull Request si
  tu me le demandes).

Chaque push sur une autre branche crée de toute façon une **URL de
prévisualisation** (https) — suffisante pour tester le micro tout de suite.

### c. Les variables d'environnement (Vercel → Settings → Environment Variables)

**Rien n'est obligatoire pour que l'app tourne et que le micro marche.** Chaque
variable débloque une capacité. Copie-colle depuis `.env.example`.

| Pour… | Variables | Sans elle |
|---|---|---|
| **Protéger l'accès public** (recommandé) | `SITE_PASSWORD` | l'app est ouverte à tous |
| Envoyer / brouillonner des emails | `SMTP_USER` `SMTP_PASS` `SMTP_FROM` | Boîte d'envoi et brouillons Gmail inactifs |
| IA (affinage débrief, extraction) | `NVIDIA_API_KEY` *(gratuit)* ou `ANTHROPIC_API_KEY` | repli sur les moteurs déterministes |
| Durabilité multi-appareil | Supabase → voir §3 | l'app reste locale au navigateur |
| Agent vocal Alpha Voice (`/voice`) | `LIVEKIT_URL` `LIVEKIT_API_KEY` `LIVEKIT_API_SECRET` | `/voice` montre le script sans passer d'appel |

Après avoir ajouté des variables : Vercel → *Deployments* → *Redeploy* (elles
sont lues au build).

---

## 3. Supabase — sans redéploiement

La synchro (prospects, tracking, réponses entrantes durables) s'allume avec
Supabase. Le plus beau : **tu n'as pas besoin de redéployer** — l'app accepte
la config **depuis Réglages**, en direct.

1. [supabase.com](https://supabase.com) → *New project* (région Europe, ex.
   Paris). Note l'**URL du projet** et la clé **anon public** (*Settings → API*).
2. *SQL Editor* → *New query* → colle **tout** le contenu de
   `supabase/schema.sql` → *Run*. Ça crée les tables et la sécurité par
   utilisateur (RLS).
3. Dans ALPHA : **Réglages → Supabase** → colle l'URL + la clé anon → *Lier*.
   C'est instantané, stocké dans ce navigateur.
4. Pour la durabilité **côté serveur** (compteurs de tracking, webhooks
   entrants sur Vercel), ajoute aussi en variable Vercel la clé **service role**
   (`SUPABASE_SERVICE_ROLE_KEY`) — *Settings → API → service_role*. À ne mettre
   QUE côté serveur, jamais dans le navigateur.

Vérifier : `/api/health` renvoie l'état des branchements (Supabase, SMTP, IA).

---

## Récapitulatif — l'ordre qui marche

1. **Déploie** sur Vercel (b). Tu obtiens une adresse `https://…`.
2. **Ouvre-la sur ton téléphone**, autorise le micro (§1). Le Débrief parle.
3. **Crée Supabase** et lie-le depuis Réglages (§3) — synchro multi-appareil.
4. **Ajoute les clés** dont tu as besoin (c) : SMTP pour les emails, NVIDIA
   pour l'IA, LiveKit pour l'agent vocal.

Le seul point que je ne peux pas faire à ta place, c'est cliquer dans **tes**
tableaux de bord Vercel et Supabase — je n'ai pas tes accès. Tout le reste est
prêt.
