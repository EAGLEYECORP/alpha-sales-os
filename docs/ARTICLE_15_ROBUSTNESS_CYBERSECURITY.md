# ARTICLE 15 — Exactitude, Robustesse & Cybersécurité
**Règlement (UE) 2024/1689 — Alpha Sales OS**  
**Classification retenue :** Risque limité (Art. 50) avec application volontaire du niveau haut-risque pour la documentation technique.

## 1. Exactitude (Art. 15 §§1 & 3)
- Règle codée : « Aucun chiffre inventé. Zéro donnée rend `null`, jamais `0`. »
- Métriques déclarées :
  - Latence pipeline voix cible : < 500 ms (LiveKit + Deepgram Nova-2 + VAD Silero)
  - Conversion RDV (pilot juillet 2026) : 7,7 % (6/78) — fourchette réelle 3,6–15,8 %
  - Aucune projection de CA tant qu’aucune vente n’est close
- Fallback déterministe : moteur de templates hors-ligne quand les providers LLM sont indisponibles ou hors budget.

## 2. Robustesse (Art. 15 §4)
### Erreurs, défaillances et fail-safe
- HITL hard : toute ambiguïté, objection, négociation ou confiance < 0.75 → gel automatique et escalade (`app/controle/page.tsx`, `lib/reponse-auto.ts`)
- Dégradation gracieuse : Ollama local → NVIDIA NIM → Anthropic → templates purs
- Voice pipeline : Silero VAD + interruption detection ; en cas de panne provider → handoff humain immédiat

### Boucles de rétroaction
- Le module `lib/apprentissage.ts` stocke du contexte, **ne retraine pas** de modèle sur les données live.
- RAG = BM25 lexical 100 % in-memory (`lib/knowledge.ts`) — aucune base vectorielle externe, aucune contamination cross-tenant.

## 3. Cybersécurité (Art. 15 §5)
### Prompt injection & tool hijacking
- Entrées utilisateur isolées dans des schémas Zod stricts avant injection dans le contexte LLM
- Les agents / orchestrateurs n’ont **jamais** les permissions de modifier les entitlements, les credentials bancaires ou les politiques RLS
- Disclosure Art. 50 forcée par le code (`audit_script`) : tout script non conforme est rejeté avant envoi

### Supply-chain & providers tiers
- Secrets et quotas gérés côté serveur uniquement
- Entitlements fail-closed : panne réseau ou service role absent → retour au tier 0 (gratuit)
- Surface d’attaque limitée : pas de vector DB externe, RAG local, extraction PDF/DOCX/CSV écrite à la main et ne sort rien

### Isolation multi-tenant
- Supabase RLS (`supabase/migrations/`) : isolation stricte par organisation + visibilité descendante uniquement pour les managers
- Local-first (Zustand + localStorage) pour le CRM de l’utilisateur final

## 4. Mesures techniques déjà en production
| Mesure | Fichier / composant |
|---|---|
| Disclosure IA forcée | `lib/campaign-runner.ts` + `audit_script` |
| HITL escalade | `components/autopilote/moteur-autopilote.tsx`, `app/controle/page.tsx` |
| Token budgeting & routing | `lib/token-budget.ts`, `lib/ai-engine.ts` |
| RLS multi-tenant | `supabase/migrations/003-organisation.sql` + `lib/entitlements.ts` |
| RAG zero-leakage | `lib/knowledge.ts` (BM25 in-memory) |
| Fallback local | `lib/ollama.ts` + cascade dans `lib/ai-engine.ts` |

## 5. Prochaines actions prioritaires (pour fermer 100 % Art. 15)
1. Ajouter un red-teaming script automatisé (prompt injection sur réponses email + tool calls).
2. Logger explicitement chaque décision d’agent + tool-call dans un audit trail append-only.
3. Documenter les métriques d’exactitude dans les instructions d’utilisation (page publique + README).
4. Mettre en place un post-market monitoring minimal (déjà partiellement dans `/controle`).

Ce document fait partie intégrante du dossier technique (Annexe IV) et prouve que la conformité n’est pas une note de bas de page : elle est exécutée dans le code.
