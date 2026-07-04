import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Optional Supabase client. The app is local-first (Zustand + localStorage);
 * when NEXT_PUBLIC_SUPABASE_URL / ANON_KEY are set, sync + auth light up.
 * Schema: see supabase/schema.sql (RLS on, per-user rows).
 */
let client: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  if (!client) client = createClient(url, key);
  return client;
}

export const supabaseEnabled = () =>
  Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

/** Push the whole local state to Supabase (upsert by id). Fire-and-forget sync. */
export async function pushSnapshot(payload: {
  prospects: unknown[];
  campaigns: unknown[];
  meetings: unknown[];
  activities: unknown[];
}): Promise<{ ok: boolean; error?: string }> {
  const sb = getSupabase();
  if (!sb) return { ok: false, error: "Supabase non configuré" };
  const { data: userData } = await sb.auth.getUser();
  const userId = userData.user?.id;
  if (!userId) return { ok: false, error: "Non connecté" };

  const tag = (rows: unknown[]) =>
    (rows as Record<string, unknown>[]).map((r) => ({ id: r.id, user_id: userId, data: r }));

  for (const [table, rows] of [
    ["prospects", payload.prospects],
    ["campaigns", payload.campaigns],
    ["meetings", payload.meetings],
    ["activities", payload.activities],
  ] as const) {
    const { error } = await sb.from(table).upsert(tag(rows), { onConflict: "id" });
    if (error) return { ok: false, error: `${table}: ${error.message}` };
  }
  return { ok: true };
}

/** Pull remote rows back into local shape. */
export async function pullSnapshot(): Promise<
  { ok: true; data: Record<string, unknown[]> } | { ok: false; error: string }
> {
  const sb = getSupabase();
  if (!sb) return { ok: false, error: "Supabase non configuré" };
  const out: Record<string, unknown[]> = {};
  for (const table of ["prospects", "campaigns", "meetings", "activities"]) {
    const { data, error } = await sb.from(table).select("data");
    if (error) return { ok: false, error: `${table}: ${error.message}` };
    out[table] = (data ?? []).map((r) => r.data);
  }
  return { ok: true, data: out };
}
