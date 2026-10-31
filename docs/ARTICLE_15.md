# Article 15 — Exactitude, Robustesse & Cybersécurité
**Règlement (UE) 2024/1689 · Application volontaire**

## Exactitude (§§ 1 & 3)

- Règle codée : « Aucun chiffre inventé. Zéro donnée rend `null`, jamais `0`. »
- Budgets de jetons prioritaires (`lib/token-budget.ts`) : la doctrine et les règles de sécurité (priorité 1) ne sont jamais coupées.
- Fallback templates hors-ligne quand aucun moteur IA ne répond.
- Métriques déclarées : pilot 7,7 % (6/78), fourchette réelle 3,6–15,8 %. Aucune projection de CA.

## Robustesse (§ 4)

- Cascade IA explicite et ordonnée (`lib/ai-engine.ts`) : Ollama → NVIDIA → Anthropic → templates.
- HITL : toute ambiguïté / objection / faible confiance → gel et escalade.
- Pas de boucle de rétroaction d’apprentissage sur données live (`lib/apprentissage.ts` stocke du contexte, ne retraine pas).
- Local-first : le produit reste utilisable même si tous les providers externes sont down.

## Cybersécurité (§ 5)

| Menace | Surface réelle | Mitigation actuelle |
|--------|----------------|---------------------|
| Prompt injection | Réponses prospects, contenu entrant | Contenu traité comme non fiable ; IA n’a pas d’outils d’écriture dans l’app ; rate-limit + même-origine |
| Tool hijacking | Agents / orchestrateurs | Permissions minimales ; pas de modification d’entitlements ou de credentials |
| Fuite multi-tenant | Supabase | RLS par `user_id` conçue ; preuve deux-comptes encore à exécuter (`docs/PREUVE-RLS.md`) |
| Supply-chain / provider | Ollama / NVIDIA / Anthropic / LiveKit / Deepgram | Cascade + BYOK + secrets côté serveur uniquement |
| Abus d’envoi | SMTP / LiveKit | Entitlements fail-closed + rate-limit + pas de credentials par locataire (volontaire) |
| XSS / CSRF / SSRF | Surface web | Headers stricts, même-origine, allowlist, échappement systématique (voir `SECURITY.md`) |

## Ce qui reste à fermer avant le premier client payant

1. Exécuter et documenter la preuve RLS à deux comptes réels.
2. Red-teaming ciblé sur les réponses email + tool calls.
3. Journal d’audit des décisions d’agent (déjà amorcé).
4. Rotation et isolation des secrets.
