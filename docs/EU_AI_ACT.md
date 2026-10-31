# EU AI Act — Positionnement réglementaire & Dossier technique
**Règlement (UE) 2024/1689 · Alpha Sales OS**

## Classification

Alpha Sales OS est un système d’IA destiné à l’automatisation de la prospection et de la qualification commerciale B2B.

- **Risque principal** : limité (obligations de transparence Art. 50).
- **Pas de haut risque Annexe III** : pas de scoring de crédit, de recrutement automatisé, d’évaluation de travailleurs, d’infrastructure critique, de maintien de l’ordre, etc.
- **Approche volontaire** : le dossier technique ci-dessous applique le niveau de rigueur attendu des systèmes à haut risque (Annexe IV) parce que c’est le standard de qualité que l’on s’impose.

## Art. 50 — Transparence

La divulgation que l’interlocuteur interagit avec une IA est **forcée par le code** (`lib/voice-script.ts`, `audit_script` pattern, tests). Un script qui omet la phrase est rejeté avant envoi ou appel.

## Dossier technique (éléments Annexe IV — version réaliste)

1. **Description générale**  
   OS de vente vertical pour services B2B. Local-first + option multi-tenant. Cascade IA Ollama → NVIDIA → Anthropic → templates.

2. **Architecture**  
   Voir `docs/ARCHITECTURE.md` (topologie trois zones : navigateur local-first → middleware JWT fail-closed → serveur).

3. **Données & gouvernance**  
   - RAG 100 % lexical + extraction in-memory (`lib/knowledge.ts`, `lib/file-extract.ts`).  
   - Aucun retrain sur données live.  
   - Isolation prévue par `user_id` + RLS Supabase (preuve réelle encore à exécuter).

4. **Modèle / hyperparamètres**  
   Température basse, schémas Zod, budgets de jetons prioritaires, fallback déterministe.

5. **Métriques de performance**  
   - Pilot mesuré : 78 prospects → 6 RDV (7,7 %).  
   - Aucune projection de CA tant qu’aucune vente n’est close (règle codée).  
   - Latence voix : objectif < 500 ms (LiveKit + Deepgram + VAD), non encore benchmarké en production.

6. **Supervision humaine (Art. 14)**  
   Ambiguïté, objection, négociation → gel + escalade vers l’opérateur (`HITL`).

7. **Robustesse & cybersécurité**  
   Voir `docs/ARTICLE_15.md`.

8. **Gestion des risques**  
   Conformité B2B codée (`lib/conformite.ts`), secteurs interdits, anti-harcèlement, STOP prioritaire.

9. **Journalisation des modifications**  
   Historique Git complet + tests unitaires.

10. **Surveillance post-marché**  
    Écran `/controle` + logs d’appels + tracking.

Ce document n’est pas une déclaration de conformité CE. C’est la preuve que la conformité est traitée comme une exigence d’ingénierie, pas comme une note juridique.
