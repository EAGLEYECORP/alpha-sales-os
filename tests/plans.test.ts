import { test } from "node:test";
import assert from "node:assert/strict";
import { startOfMonthMs, FREE_TIER } from "../lib/plans";
import { accountTier } from "../lib/stripe";

test("plans — startOfMonthMs renvoie le 1er du mois à 00:00 UTC", () => {
  const mid = Date.UTC(2026, 7, 9, 12, 47, 0); // 9 août 2026 12:47 UTC
  assert.equal(startOfMonthMs(mid), Date.UTC(2026, 7, 1, 0, 0, 0));
  // Idempotent au tout début du mois.
  const start = Date.UTC(2026, 7, 1, 0, 0, 0);
  assert.equal(startOfMonthMs(start), start);
});

test("plans — FREE_TIER porte des bornes de volume cohérentes", () => {
  assert.ok(FREE_TIER.emailsPerMonth > 0);
  assert.ok(FREE_TIER.maxProspects > 0);
});

// accountTier — branches déterministes (sans Supabase).
async function withEnv(env: Record<string, string | undefined>, fn: () => Promise<void>) {
  const saved: Record<string, string | undefined> = {};
  for (const k of Object.keys(env)) {
    saved[k] = process.env[k];
    if (env[k] === undefined) delete process.env[k];
    else process.env[k] = env[k];
  }
  try {
    await fn();
  } finally {
    for (const k of Object.keys(saved)) {
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k];
    }
  }
}

test("plans — accountTier: facturation non exigée → unmetered (mode solo inchangé)", async () => {
  await withEnv({ REQUIRE_SUBSCRIPTION: undefined }, async () => {
    assert.equal(await accountTier("u1", "x@y.fr"), "unmetered");
  });
});

test("plans — accountTier: propriétaire → owner", async () => {
  await withEnv({ REQUIRE_SUBSCRIPTION: "1", OWNER_EMAILS: "@eagleyecorp.fr" }, async () => {
    assert.equal(await accountTier("u1", "zak@eagleyecorp.fr"), "owner");
  });
});

test("plans — accountTier: exigé mais aucun compte → anon (bloqué)", async () => {
  await withEnv({ REQUIRE_SUBSCRIPTION: "1", OWNER_EMAILS: "" }, async () => {
    assert.equal(await accountTier(null, null), "anon");
  });
});

test("plans — accountTier: compte non-proprio sans abonnement/Supabase → free", async () => {
  await withEnv(
    { REQUIRE_SUBSCRIPTION: "1", OWNER_EMAILS: "", NEXT_PUBLIC_SUPABASE_URL: undefined, SUPABASE_SERVICE_ROLE_KEY: undefined },
    async () => {
      assert.equal(await accountTier("u1", "client@gmail.com"), "free");
    }
  );
});
