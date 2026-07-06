import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Optional Supabase client. The app is local-first (Zustand + localStorage);
 * sync + auth light up when Supabase is configured — either via env
 * (NEXT_PUBLIC_SUPABASE_URL / ANON_KEY) or **linked at runtime from the
 * Settings UI** (stored in localStorage). Runtime config wins over env.
 * Schema: see supabase/schema.sql (RLS on, per-user rows).
 */
const LS_KEY = "alpha_supabase";

let client: SupabaseClient | null = null;
let clientUrl: string | null = null;

export interface SupabaseConfig {
  url: string;
  key: string;
}

/** Config saved from the Settings UI (client only). */
function readRuntimeConfig(): SupabaseConfig | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(LS_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<SupabaseConfig>;
    if (parsed.url && parsed.key) return { url: parsed.url, key: parsed.key };
  } catch {
    /* ignore malformed */
  }
  return null;
}

function envConfig(): SupabaseConfig | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  return url && key ? { url, key } : null;
}

/** Resolved config: runtime (localStorage) first, then env. */
export function getSupabaseConfig(): SupabaseConfig | null {
  return readRuntimeConfig() ?? envConfig();
}

/** Where the active config comes from — for the Settings UI. */
export function supabaseConfigSource(): "runtime" | "env" | null {
  if (readRuntimeConfig()) return "runtime";
  if (envConfig()) return "env";
  return null;
}

/** Link Supabase at runtime (Settings UI). Rebuilds the client next call. */
export function setSupabaseConfig(url: string, key: string): void {
  if (typeof window !== "undefined")
    window.localStorage.setItem(LS_KEY, JSON.stringify({ url: url.trim(), key: key.trim() }));
  client = null;
  clientUrl = null;
}

/** Unlink the runtime config (falls back to env if present). */
export function clearSupabaseConfig(): void {
  if (typeof window !== "undefined") window.localStorage.removeItem(LS_KEY);
  client = null;
  clientUrl = null;
}

export function getSupabase(): SupabaseClient | null {
  const cfg = getSupabaseConfig();
  if (!cfg) {
    client = null;
    clientUrl = null;
    return null;
  }
  if (!client || clientUrl !== cfg.url) {
    client = createClient(cfg.url, cfg.key);
    clientUrl = cfg.url;
  }
  return client;
}

export const supabaseEnabled = () => getSupabaseConfig() !== null;

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
