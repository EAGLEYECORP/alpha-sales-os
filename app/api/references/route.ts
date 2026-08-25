import { NextResponse } from "next/server";
import { REFERENCES_LIVREES } from "@/lib/references-seed";

export const runtime = "nodejs";

/**
 * ─────────────────────────────────────────────────────────────────────
 * LES RÉFÉRENCES LIVRÉES — servies, jamais embarquées.
 *
 * Même raison que `/api/knowledge/seed` : le catalogue pèse et n'a aucune
 * raison d'être compilé dans le bundle d'une page publique. Il descend ici,
 * pour une session authentifiée, et l'opérateur choisit ce qu'il importe.
 *
 * ⚠ Rien n'est semé d'office. Une référence entre dans le Cerveau parce que
 * quelqu'un a lu son verdict — combien de leçons contredisent la doctrine —
 * et a cliqué. C'est le contraire d'un socle : un socle, on le subit.
 * ─────────────────────────────────────────────────────────────────────
 */
export async function GET() {
  return NextResponse.json({ references: REFERENCES_LIVREES });
}
