# Veille outils → ce qui matche l'architecture d'ALPHA SALES OS

Analyse des outils vus dans la veille (carrousels syntaix.ai / coderss_world :
Headroom, Graphify, LLMLingua, GPTCache, LiteLLM, Outlines, vLLM, tiktoken,
Buzz…) confrontés à **notre** archi : Next.js local-first, store Zustand,
cascade IA `Ollama → NVIDIA → Claude`, n8n, tracking maison, zéro dépendance.

Verdict en une ligne : **on n'ajoute pas ces libs (Python, lourdes) — on en
reprend l'IDÉE, faite maison, là où elle rapporte.** Voici le tri.

---

## 🟢 À reprendre (fort ROI, faible risque, dans notre philosophie)

### 1. Compression de contexte — LLMLingua / Headroom  ✅ FAIT
**Le match.** Notre agent injecte un gros dossier prospect + doctrine Hormozi
avant l'appel IA. Sur le palier payant (Claude), chaque token compte.
**Fait ce passage :** `lib/ai-context.ts` (`estimateTokens`, `estimateCostEUR`,
`compressContext`) + branchement **opt-in** au seul point de passage IA
(`lib/ai-engine.ts`, `opts.compress`). Normalise les espaces (gain gratuit),
puis garde tête (consignes) + queue (récent) en élidant le milieu. 6 tests.
**À adopter ensuite :** passer `compress` dans les routes agent/sparring avec un
budget (ex. 8 000 caractères) — gain direct sur la facture IA.

### 2. Compter les tokens — tiktoken  ✅ AMORCÉ
`estimateTokens` (heuristique ~4 c/token, sans BPE embarqué) suffit pour décider
de compresser et **estimer un coût**. `runAI` renvoie maintenant `promptTokens`.
**À adopter :** un petit compteur « tokens/coût estimé » dans l'État du système
ou le débrief IA (l'idée CodeBurn : voir ce que l'IA coûte).

### 3. Sorties structurées — Outlines  ⏳ PROCHAIN
**Le match fort.** On extrait déjà du JSON (`/api/audit/extract`, patch CRM,
classification d'objections). Aujourd'hui via `runAIJson` + parse tolérant.
**À faire :** un mode « schéma » — prompt qui impose les clés + validation stricte
(rejet → repli déterministe). Fiabilise l'extraction sans dépendance. Petit,
ciblé, à forte valeur pour l'agent et les audits.

### 4. Cache de réponses IA — GPTCache  ⏳ CANDIDAT
**Le match.** Beaucoup de générations se répètent (même objection, même secteur).
Un cache clé = hash(prompt normalisé) → réponse évite de re-payer.
**À faire (prudent) :** table Supabase `ai_cache` (ou mémoire) scopée par
locataire, TTL court, opt-in par type de tâche. Gain : plus rapide + moins cher.
À cadrer pour ne pas servir du périmé (invalidation par version de doctrine).

---

## 🟡 Intéressant, mais plus tard / selon échelle

- **LiteLLM (routeur multi-LLM + fallback).** On a DÉJÀ ce pattern, fait main :
  la cascade `Ollama → NVIDIA → Claude` EST un LiteLLM-lite (routage + repli +
  moteur réellement utilisé exposé). Rien à ajouter tant qu'on reste sur 3
  moteurs ; si on en veut 10, LiteLLM comme proxy deviendrait pertinent.
- **vLLM (moteur d'inférence haut débit).** Utile seulement si on **auto-héberge**
  un modèle pour beaucoup de locataires. Hors sujet en local-first / BYO-creds ;
  à garder en tête si un jour on mutualise un LLM maison.
- **Graphify (graphe de connaissances).** Séduisant pour interroger un très gros
  CRM (« l'agent requête ce dont il a besoin »). Overkill à notre volume ; la
  compression + le ciblage de contexte couvrent 90 % du besoin pour 5 % du coût.

---

## 🔩 Ce qu'on NE prend pas (et pourquoi)

- Rien en **dépendance Python lourde** : casse le zéro-dépendance et le déploiement
  Next simple. On reprend l'idée en TS testé, pas le paquet.
- Les **sites « outils IA gratuits »** (yupp.ai, artflo.ai) ne rentrent pas dans
  le produit — mais ils débloquent la **production du contenu de lancement**
  (voir `marketing/LANCEMENT-VIRAL.md`, section production gratuite).

---

## Le vrai enseignement stratégique : Buzz (Block / Jack Dorsey)

Le pitch de **Buzz** — *« run your own server, keep everything in one place, add
AI agents that work like teammates, decide what each agent can do, no monthly
subscriptions, one-person business »* — **c'est exactement notre positionnement**,
côté vente au lieu de code. Ça valide deux choix d'archi qu'on a déjà faits :

1. **Local-first / BYO-creds.** Chaque commercial fait tourner SON instance avec
   SES identifiants (Supabase, SMTP, IA). C'est le modèle que tu décris
   (« les clients rajoutent leurs creds pour que ça marche pour eux »). Notre
   travail multi-locataire (RLS, JWT, tables scopées, facturation) sert LES DEUX
   modèles : une instance mutualisée OU une instance par client.
2. **L'agent comme coéquipier, périmètre maîtrisé.** Notre Agent ALPHA + les
   garde-fous (compliance voix, human-in-the-loop, doctrine) = « decide what each
   agent can do ». On est sur la même vague de fond, avant qu'elle ne déferle.

**À exploiter en marketing :** se positionner comme *« le Buzz de la vente — l'OS
du commercial one-person, tes agents, tes données, ton serveur »*. C'est un angle
viral qui surfe sur une tendance déjà validée (24k+ ⭐).
