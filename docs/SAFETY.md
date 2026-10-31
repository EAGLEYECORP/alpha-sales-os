# SAFETY, RED TEAMING & HUMAN-IN-THE-LOOP PROTOCOL
**System:** Alpha Sales OS (`eagleyecorp/alpha-sales-os`)  
**Compliance Standards:** EU AI Act Article 50 & Article 14  

---

## 1. Transparency & Disclosure Enforcement (Article 50)

1. **Programmatic Disclosure:** `audit_script` mandates that every automated phone or text interaction starts with explicit disclosure of synthetic identity.
2. **Hard Halt Circuit:** If a script or prompt template omits the required disclosure sentence, `lib/campaign-runner.ts` rejects the execution payload.

---

## 2. Human-in-the-Loop (HITL) Escalation Matrix

Automated agents are constrained to strict confidence bounds. The system triggers immediate human escalation under the following conditions:

| Trigger Condition | Agent Action | Human Handoff Mechanism |
|---|---|---|
| **Explicit Objection / Negotiation** | Halts response generation | Places prospect in "Needs Review" band (`app/controle/page.tsx`) |
| **Unrecognized Intent / Low Confidence (<0.75)** | Suppresses auto-reply | Generates draft response for manual review (`app/campaigns/page.tsx`) |
| **Opt-Out / Opposition Request** | Immediately logs permanent block | Blacklists prospect email/phone across all tables (`lib/store.ts`) |

---

## 3. Red Teaming & Anti-Prompt Injection

* **System/User Prompt Separation:** User inputs (e.g., incoming prospect reply emails) are sanitized and isolated inside structured Zod schemas before being passed to LLM contexts.
* **Tool Hijacking Prevention:** Sub-agents running via Model Context Protocol (MCP) do not have permissions to alter organization settings, change bank credentials, or bypass RLS boundaries.

* ---

## 4. Mapping Article 15 (Exactitude, Robustesse, Cybersécurité)

Voir le document dédié : [ARTICLE_15_ROBUSTNESS_CYBERSECURITY.md](./ARTICLE_15_ROBUSTNESS_CYBERSECURITY.md)

Résumé des défenses actives :
- Prompt injection → Zod + séparation system/user + HITL
- Tool hijacking → permissions minimales des agents
- Feedback loops → pas de retrain live
- Provider failure → cascade locale + templates
- Exactitude → règle « null jamais 0 » codée en types
