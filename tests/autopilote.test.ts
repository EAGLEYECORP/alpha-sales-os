import { test } from "node:test";
import assert from "node:assert/strict";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  REGLAGE_ID,
  autopiloteArmeEnv,
  estArme,
  lireDrapeauAutopilote,
  ecrireDrapeauAutopilote,
  etatAutopilote,
} from "../lib/autopilote";

/**
 * ─────────────────────────────────────────────────────────────────────
 * L'ARMEMENT DE L'AUTOPILOTE — le test tient l'invariant qui coûte cher :
 * TOUTE PANNE PENCHE VERS LA SIMULATION, jamais vers « ça part ».
 *
 * C'est la gâchette la plus chère du produit (de vrais emails depuis notre
 * domaine). Une base injoignable, une ligne absente, une exception : aucun de
 * ces états ne doit ARMER. Seuls deux gestes DÉLIBÉRÉS le font — la variable
 * d'env (ops) ou un drapeau `actif=true` écrit en base (le bouton).
 * ─────────────────────────────────────────────────────────────────────
 */

// ── Un faux client Supabase minimal : juste la chaîne que le module appelle. ──
// `select().eq().maybeSingle()` en lecture, `upsert()` en écriture. On simule
// aussi les pannes (erreur renvoyée, exception jetée) car ce sont ELLES le sujet.
type ReponseLecture = { data: { actif?: unknown } | null; error: { message: string } | null };

function dbLecture(rep: ReponseLecture | (() => never)): SupabaseClient {
  return {
    from() {
      return {
        select() {
          return {
            eq() {
              return {
                maybeSingle: async () => {
                  if (typeof rep === "function") return rep(); // jette
                  return rep;
                },
              };
            },
          };
        },
      };
    },
  } as unknown as SupabaseClient;
}

function dbEcriture(rep: { error: { message: string } | null } | (() => never)): {
  db: SupabaseClient;
  vues: Array<Record<string, unknown>>;
} {
  const vues: Array<Record<string, unknown>> = [];
  const db = {
    from() {
      return {
        upsert: async (row: Record<string, unknown>) => {
          vues.push(row);
          if (typeof rep === "function") return rep();
          return rep;
        },
      };
    },
  } as unknown as SupabaseClient;
  return { db, vues };
}

// ─────────────────────────────── estArme : la règle pure ───────────────────────────────

test("estArme : l'env SEUL suffit à armer (le disjoncteur d'ops)", () => {
  assert.equal(estArme({ env: true, dbActif: null }), true);
  assert.equal(estArme({ env: true, dbActif: false }), true);
});

test("estArme : le drapeau base SEUL suffit à armer (le bouton)", () => {
  assert.equal(estArme({ env: false, dbActif: true }), true);
});

test("⚠ estArme : ni env ni drapeau ⇒ ÉTEINT (simulation)", () => {
  assert.equal(estArme({ env: false, dbActif: false }), false);
});

test("⚠⚠ estArme : dbActif=null (panne, ligne absente) ne s'arme JAMAIS seul", () => {
  // C'est l'invariant : « on ne sait pas » ne vaut PAS « ça part ». Seul l'env
  // peut alors armer — un geste délibéré depuis l'infra, jamais une panne.
  assert.equal(estArme({ env: false, dbActif: null }), false);
  assert.equal(estArme({ env: true, dbActif: null }), true);
});

// ─────────────────────────── autopiloteArmeEnv : la variable ───────────────────────────

test("autopiloteArmeEnv : seule la valeur `on` (insensible à la casse/espaces) arme", () => {
  const avant = process.env.CAMPAIGN_AUTOPILOT;
  try {
    process.env.CAMPAIGN_AUTOPILOT = "on";
    assert.equal(autopiloteArmeEnv(), true);
    process.env.CAMPAIGN_AUTOPILOT = "  ON  ";
    assert.equal(autopiloteArmeEnv(), true);
    process.env.CAMPAIGN_AUTOPILOT = "true"; // pas `on` ⇒ n'arme pas
    assert.equal(autopiloteArmeEnv(), false);
    process.env.CAMPAIGN_AUTOPILOT = "1";
    assert.equal(autopiloteArmeEnv(), false);
    delete process.env.CAMPAIGN_AUTOPILOT;
    assert.equal(autopiloteArmeEnv(), false);
  } finally {
    if (avant === undefined) delete process.env.CAMPAIGN_AUTOPILOT;
    else process.env.CAMPAIGN_AUTOPILOT = avant;
  }
});

// ─────────────────────────── lireDrapeauAutopilote : lecture ───────────────────────────

test("lireDrapeauAutopilote : ligne actif=true ⇒ true", async () => {
  const v = await lireDrapeauAutopilote(dbLecture({ data: { actif: true }, error: null }));
  assert.equal(v, true);
});

test("lireDrapeauAutopilote : ligne actif=false ⇒ false", async () => {
  const v = await lireDrapeauAutopilote(dbLecture({ data: { actif: false }, error: null }));
  assert.equal(v, false);
});

test("lireDrapeauAutopilote : AUCUNE ligne ⇒ false (état de départ, pas une panne)", async () => {
  const v = await lireDrapeauAutopilote(dbLecture({ data: null, error: null }));
  assert.equal(v, false);
});

test("⚠⚠ lireDrapeauAutopilote : erreur base ⇒ null (jamais false — `estArme` ne s'arme pas dessus)", async () => {
  const v = await lireDrapeauAutopilote(dbLecture({ data: null, error: { message: "réseau" } }));
  assert.equal(v, null);
});

test("⚠⚠ lireDrapeauAutopilote : exception jetée ⇒ null (pas de crash, pas d'armement)", async () => {
  const v = await lireDrapeauAutopilote(
    dbLecture(() => {
      throw new Error("boom");
    }),
  );
  assert.equal(v, null);
});

// ─────────────────────────── ecrireDrapeauAutopilote : écriture ───────────────────────────

test("ecrireDrapeauAutopilote : upsert réussi ⇒ true, et il vise la ligne globale", async () => {
  const { db, vues } = dbEcriture({ error: null });
  const ok = await ecrireDrapeauAutopilote(db, true, "contact@eagleyecorp.fr");
  assert.equal(ok, true);
  assert.equal(vues.length, 1);
  assert.equal(vues[0].id, REGLAGE_ID);
  assert.equal(vues[0].actif, true);
  assert.equal(vues[0].updated_by, "contact@eagleyecorp.fr");
});

test("ecrireDrapeauAutopilote : erreur base ⇒ false (l'appelant rend 500, il n'affirme pas le succès)", async () => {
  const { db } = dbEcriture({ error: { message: "RLS" } });
  assert.equal(await ecrireDrapeauAutopilote(db, true, "maitre"), false);
});

test("ecrireDrapeauAutopilote : exception ⇒ false", async () => {
  const { db } = dbEcriture(() => {
    throw new Error("boom");
  });
  assert.equal(await ecrireDrapeauAutopilote(db, false, null), false);
});

// ─────────────────────────── etatAutopilote : l'état complet ───────────────────────────

test("etatAutopilote : drapeau=true en base ⇒ armé, même sans env", async () => {
  const avant = process.env.CAMPAIGN_AUTOPILOT;
  try {
    delete process.env.CAMPAIGN_AUTOPILOT;
    const etat = await etatAutopilote(dbLecture({ data: { actif: true }, error: null }));
    assert.deepEqual(etat, { drapeau: true, env: false, arme: true });
  } finally {
    if (avant === undefined) delete process.env.CAMPAIGN_AUTOPILOT;
    else process.env.CAMPAIGN_AUTOPILOT = avant;
  }
});

test("⚠⚠ etatAutopilote : base injoignable ⇒ drapeau null MAIS non armé (panne = simulation)", async () => {
  const avant = process.env.CAMPAIGN_AUTOPILOT;
  try {
    delete process.env.CAMPAIGN_AUTOPILOT;
    const etat = await etatAutopilote(dbLecture({ data: null, error: { message: "down" } }));
    assert.deepEqual(etat, { drapeau: null, env: false, arme: false });
  } finally {
    if (avant === undefined) delete process.env.CAMPAIGN_AUTOPILOT;
    else process.env.CAMPAIGN_AUTOPILOT = avant;
  }
});

test("⚠ etatAutopilote : env forcé arme même si la base est éteinte/injoignable", async () => {
  const avant = process.env.CAMPAIGN_AUTOPILOT;
  try {
    process.env.CAMPAIGN_AUTOPILOT = "on";
    const etat = await etatAutopilote(dbLecture({ data: null, error: { message: "down" } }));
    assert.equal(etat.env, true);
    assert.equal(etat.arme, true);
  } finally {
    if (avant === undefined) delete process.env.CAMPAIGN_AUTOPILOT;
    else process.env.CAMPAIGN_AUTOPILOT = avant;
  }
});
