# ALPHA 100 % AUTONOME — la carte complète

> Tu m'as demandé de regarder **tout** ce qu'il faut pour qu'Alpha tourne seul,
> et de rendre ça **facile à utiliser**. Voici la carte honnête, sans vernis.

Écrit le 28/09/2026.

---

## 0. LA VÉRITÉ SUR « 100 % »

« Zéro humain » est **impossible ET indésirable** sur deux points — par
conception, pas par manque de code :

1. **Le closing reste humain.** La réassurance, la voix, la poignée de main au
   moment de signer : c'est la doctrine (`lib/promesse.ts` — « les humains
   closent, Alpha fait tourner la machine »). Un bot qui signe à ta place, c'est
   le jour où tu perds le deal au dernier mètre.
2. **L'armement de l'envoi et l'approbation restent un acte humain.** C'est le
   garde qui protège ta réputation d'expéditeur et ta conformité (art. 50,
   décret 2022-1313, CNIL). Le retirer, ce n'est pas « plus d'autonomie »,
   c'est la panne qui grille le domaine sans que ça se voie avant des semaines.

**Donc « autonome » ici veut dire** : la MACHINE tourne seule — elle source,
rédige, envoie **dans les règles**, relance, trie les réponses, propose — et
l'humain **approuve** puis **close**. Tout le reste s'automatise. C'est ça,
le 100 % atteignable, et c'est déjà beaucoup.

---

## 1. CE QUI EST DÉJÀ AUTONOME (construit et testé)

- **Ordonnanceur `pg_cron`** (migration 004) → `/api/campaign/tick`,
  `/api/campaign/mail-tick`, `/api/push/tick`. Tourne sans machine allumée.
- **Envoi à froid autonome** (`mail-tick`), une fois armé : gardes palier +
  mentions + divulgation art. 50 + tracking, à chaque envoi.
- **Tri automatique des réponses** (`reply-tick`) : le modèle classe, le code
  dispose (`auto` / `escalade` / `clore`).
- **Cadence de relance** (`call-cadence`, `[3,24,32]h`) + plafond légal 4/30 j.
- **Moniteur serveur** + **présence agent** (refuse de composer sans agent vivant).
- **Bouton autopilote** (arme/désarme, `/controle`).
- **Serveur MCP** : un agent lit le pipe et **prépare une campagne**
  (`preparer_campagne`), sans envoyer.
- **Toutes les gardes** : conformité, palier, divulgation, validation partenaire,
  provenance CNIL au 1er message.

---

## 2. CE QU'IL MANQUE — par couche

### A. INFRA — le socle (bloquant dur, sur toi, physique)
Sans ces points, **rien** ne tourne seul. Le serveur `/api/health` en voit la
plupart (d'où le panneau UX ci-dessous).

| # | Quoi | Vu par /api/health ? |
|---|---|---|
| 1 | Supabase serveur (`SUPABASE_SERVICE_ROLE_KEY`) | ✅ `supabase.serviceRole` |
| 2 | Comptes maître cohérents (`OWNER_EMAILS` ×2) | ✅ `proprietaire.coherent` |
| 3 | SMTP posé (`SMTP_*`) | ✅ `email.configured` |
| 4 | **DKIM aligné** `d=eagleyecorp.fr` | ❌ DNS — à relever à la main |
| 5 | URL publique (`APP_BASE_URL`) | ✅ `tracking.baseUrl` |
| 6 | IA (classement des réponses) | ✅ `ai.configured` |
| 7 | `CRON_SECRET` (Vault + Netlify) + migration **004** posée | ❌ Vault |
| 8 | **`pipeServeur`** activé + fiches importées (les 982) | ❌ réglage navigateur |

### B. LA BOUCLE D'EXÉCUTION (code, après l'infra)
1. **Auto-réponse aux réponses sûres — ✅ BRANCHÉE (inerte jusqu'au DKIM).**
   `reply-tick` envoie désormais une réponse DÉTERMINISTE au milieu de tunnel
   (`veut-rdv` / `renseignement`), dans les mêmes gardes que `mail-tick`
   (mentions, divulgation art. 50, lint, palier, tracking), et marque la réponse
   traitée sur un envoi réussi. **Fail-closed** (`lib/reply-autosend.ts`) : trois
   conditions cumulatives — intention automatisable, autopilote armé, et
   `REPLY_AUTOSEND=on` (ton **attestation DKIM**, que le serveur ne peut pas
   vérifier seul). Tant que la variable manque, la boucle planifie sans envoyer.
   → Activation : relève `d=eagleyecorp.fr`, puis pose `REPLY_AUTOSEND=on`, puis arme.
2. **Auto-relance email — ✅ BRANCHÉE (inerte jusqu'à l'armement).**
   `/api/campaign/relance-tick` envoie les rappels après un 1er contact sans
   réponse : ESPACÉS (`RELANCE_GAPS_H`), PLAFONNÉS à 4/30 j (décret 2022-1313,
   dérivé de `RAPPELS_MAX`), et chacun avec une RAISON NEUVE ou pas du tout
   (`lib/relance-mail.ts` + `raison-neuve` — jamais « je me permets de
   relancer »). Mêmes gardes que `mail-tick`. Gate : autopilote armé (famille
   cold). À SCHEDULER (pg_cron, comme la 014).
3. **Prise de RDV.** Une réponse « veut-rdv » doit proposer 2 créneaux depuis un
   calendrier. Aujourd'hui : passage de main humain. Semi-auto faisable ; le
   close reste humain.
4. **Sourcing autonome → CRM.** Le serveur ne peut PAS appeler GetLeads (c'est
   un connecteur Claude, pas de l'infra serveur). Le sourcing autonome vit donc
   dans une **Routine Cowork**. Bonne nouvelle : le pont existe déjà —
   `/api/v1/prospects` accepte une écriture par clé (`prospects.write`), donc un
   agent Cowork peut **pousser ses fiches dans le CRM sans CSV manuel**. C'est la
   pièce qui ferme la boucle sourcing → pipe.
5. **Mesure / tarification.** `valeur-produite` (cohorte) n'est pas branché —
   nécessaire pour que les prix s'auto-calibrent, mais ça se **décide** (ça
   touche l'argument de souveraineté), ça ne se code pas en douce.

### C. L'ORCHESTRATION (le « cerveau » qui tourne seul)
Deux moteurs qui se rejoignent sur **les propositions que tu approuves** :
- **Le serveur** (`pg_cron`) : envoi / relance / tri, en continu, gardé.
- **Cowork** (une **Routine quotidienne**) : source (GetLeads) → pousse au CRM
  (`prospects.write`) → `preparer_campagne` → `proposer` → te fait un rapport.
  À armer une fois le connecteur Alpha posé sur ton compte (`docs/COWORK-CONNEXION.md`).

### D. UX — rendre ça FACILE (ta 2ᵉ demande)
Le problème aujourd'hui : l'état et les actions sont **éparpillés** (`/controle`,
`/moniteur`, `/outbox`, le bouton autopilote, les propositions, `/api/health`).
Sur un téléphone, au salon, ça fait renoncer.

**Le principe** (doctrine CLAUDE.md) : une seule question par écran, un seul
geste. Le cockpit d'autonomie tient sur **un écran, au pouce** :
1. **« Prêt pour l'autonomie ? »** — une ligne verte/rouge par prérequis, tirée
   de `/api/health`, avec l'action exacte. → **construit dans cette passe**
   (`lib/autonomie-checklist.ts` + `components/autonomie/pret-autonomie.tsx`,
   monté sur `/controle`).
2. **Le bouton autopilote** — déjà là.
3. **« Ce que la machine a fait aujourd'hui »** — le moniteur, résumé.
4. **« En attente de ton OK »** — les propositions, approuve/rejette en un tap.

Les points 3-4 sont la suite : brancher le moniteur et la file de propositions
dans le même cockpit, en lecture serveur, mobile-first.

---

## 3. ORDRE DE BATAILLE

```
1. INFRA (A)                 → sans ça, rien ne tourne     (sur toi)
2. Le cockpit « prêt ? » (D1) → tu VOIS ce qui bloque       (fait dans cette passe)
3. Brancher la boucle (B)    → après DKIM                   (code)
4. Armer la Routine Cowork (C) → l'agent tourne le matin    (après connecteur)
```

**Ce qui reste toujours à toi, et c'est voulu** : approuver les propositions,
armer l'envoi, closer. Le reste, la machine le porte.
