# ALPHA SALES OS — mémoire de projet

> Ce fichier se charge à CHAQUE session. Il porte la doctrine stable pour ne
> jamais relire toute la conversation. Ce qui bouge (plan, avancement) vit dans
> `docs/ROADMAP-TRILLION.md`. Mets à jour ici quand une RÈGLE change, pas quand
> une tâche avance.

## Qui / quoi
- **Propriétaire** : Zakaria Tazi — EAGLEYE CORP, Lyon. Français par défaut dans
  tout ce qui est produit (code en anglais, UI + docs + prompts en français).
- **Produit** : Alpha Sales OS — OS de vente white-label. Next.js 15 / React 19 /
  TS strict, Zustand persist (`alpha-sales-os-v2`), **zéro dépendance runtime**
  (crypto, CSV, RAG, PDF : tout est fait main). Ne JAMAIS ajouter une dépendance
  npm sans raison impérieuse.
- **Branche de travail** : `claude/crm-n8n-email-tracking-4qxtwr`. Commit + push
  systématiques. Tests : `npm test` (node:test, ~235). Types : `npx tsc --noEmit`.
  Les deux doivent être verts avant push.

## Ton
Brutalement honnête. Pas de flatterie, pas de « tu as raison ». Si un chiffre
est faux, une idée irréaliste ou un truc pas testé — le dire net. L'utilisateur
demande explicitement ça et il a besoin de **ventes réelles**, pas de démos.

## Les 3 comptes (portefeuille white-label) — `lib/accounts.ts`
Le compte MAÎTRE (EAGLEYE) est l'interface qui pilote tout. Basculer de compte
change l'identité + l'offre + la commission, **pas** les données.

| Compte | Ce qu'il prend | Commission |
|---|---|---|
| **EAGLEYE CORP** (maître) | **tout ce qui est faisable par nous** : visibilité (sites, growth), digitalisation **< 40 k**, ex-« ScintIA Lab » | 30 % + setup |
| **ScintIA** | **Callflow UNIQUEMENT**, vendu comme un PRODUIT | 990 € HT setup → **30 %** + **10 % du mensuel** |
| **Nuwacom** | chantiers **> 40 k** (sinon trop lourd pour nous) | **15 %** |

**Règle de routage (négociée, définitive)** : faisable par nous → EAGLEYE ·
Callflow → ScintIA · > 40 k → Nuwacom.

### L'ESCALIER — le check de CHAQUE prospect (`lib/ladder.ts`)
Cascade, pas aiguillage : un prospect peut déclencher plusieurs marches, et
chacune revient à un compte. On monte **une marche à la fois**, jamais tout d'un
coup.
1. **Visibilité** détectée → **EAGLEYE** (30 %).
2. **Volume de demandes très élevé** → **Callflow / ScintIA** (30 % + 10 % mensuel).
3. **Automatisation demandée en plus** → **EAGLEYE** (30 %). *Argument clé* :
   Callflow est le **point d'entrée** — il capte l'info exacte sur chaque
   appelant, donc l'automatisation qui suit coûte **moins de setup** (les données
   sont déjà là, le process est cartographié). Cet argument n'est servi QUE si
   Callflow est effectivement en amont.
4. **Trop gros pour nous (> 40 k)** → **NUWACOM** : le gros devis justifie les
   **15 %**, puis **100 % de toute la maintenance mensuelle**.

**Nuwacom** : sites `nuwacom.fr` / `nuwacom.com/en`. CEO **Christophe** (visio
faite, réglo). Fort en Allemagne + Benelux, **entre sur le marché FR**. Le
contrat se dresse **après le cadrage** → levier de négociation. Doctrine :
**si un open-source GitHub ou nous-mêmes pouvons le faire vite → on le fait
nous** (meilleur levier) ; si trop lourd, ou si on leur a présenté et qu'ils
n'en veulent pas → on passe par leur plateforme.
**ScintIA** : sites `scintia.ai` / `scintiacallflow.ai`. Ils veulent se
concentrer sur Callflow comme produit.

## Tarifs Alpha Sales OS (à refléter sur le site)
- **10 000 € VIP** (offre haute), OU **30 % + frais de setup** (local / cloud)
  sur devis.
- **Cadrage OBLIGATOIRE** avant devis : visio, appel ou SMS, avec **date + heure
  décidées** et validation de la suite côté Zakaria.
- **Prix à la carte par brique** : un client peut ne prendre qu'Alpha Voice.
  Il ne voit QUE sa brique ; nous voyons tout.
- Callflow (ScintIA) : **990 € HT** setup + paliers minutes (59/115/169/219/319).

## Alpha Voice (opérationnel)
- Pile : Deepgram STT · LLM **NVIDIA NIM `openai/gpt-oss-20b`** (défaut — sans
  latence ; le 70B fait la file d'attente ~14 s, ne pas y revenir) · Fish TTS ·
  Silero VAD. `voice/agent.py`.
- **Entrant OK** : Telnyx `+33451222182` → FQDN `5mwzznpudte.sip.livekit.cloud`
  (préfixe SIP LiveKit ALÉATOIRE, ≠ slug projet — c'était le bug), port 5060 UDP
  → trunk → dispatch rule → agent `alpha-voice`. Voir `voice/INBOUND.md`.
- **Art. 50 EU AI Act** : la 1re phrase (IA + pas une personne + pour le compte
  de X) est prononcée par le CODE (`first_sentence`, `allow_interruptions=False`)
  et `audit_script` refuse un script non conforme. **Ne jamais contourner.**
- **Cadence de relance Callflow (exigée par ScintIA)** : après le 1er appel sans
  réponse → **5 rappels sur 2 jours**. Dès qu'il répond : Alpha Voice **arrête**,
  met à jour le pipeline, et **passe la main à l'humain** (closer).

## Sécurité — non négociable
- L'utilisateur a déjà collé des **clés API réelles en clair** (NVIDIA, Fish).
  Elles sont à **rotate**. Ne JAMAIS écrire une clé collée dans un fichier, un
  commit ou un artefact. Scanner chaque commit. Lui redire de ne pas les coller.
- `SITE_PASSWORD`, JWT Supabase, RLS : le cloisonnement des données est la RLS +
  le JWT (`lib/tenant.ts`). Un « compte » du portefeuille est une frontière
  d'**identité commerciale**, pas de sécurité. Ne pas confondre.

## Contraintes d'environnement (sandbox)
Le proxy sortant bloque : github.com, data.grandlyon.com, data.gouv, et les clés
live NVIDIA/Supabase/Stripe. pypi passe. **Je ne peux pas tester un service live
depuis ici** — tout ce qui touche Telnyx/LiveKit/Vercel se vérifie côté Zakaria.
Ne pas prétendre avoir testé ce qui ne l'a pas été.

## Conventions de code
- Commentaires en français, denses, qui expliquent le POURQUOI (le style du repo).
- Modules purs et testables dans `lib/`, testés dans `tests/*.test.ts`.
- Pas de `any`. Pas de dépendance nouvelle. Pas de secret en dur.
- Fin de commit :
  `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>` (+ la ligne
  `Claude-Session:` fournie par le harness). Jamais d'identifiant de modèle
  ailleurs que dans le chat.
