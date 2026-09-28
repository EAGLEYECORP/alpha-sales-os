import { test } from "node:test";
import assert from "node:assert/strict";
import { chercheurConfigure, domaineDe, trouverEmail } from "@/lib/email-finder";

function sansCle<T>(fn: () => T): T {
  const k = process.env.HUNTER_API_KEY;
  delete process.env.HUNTER_API_KEY;
  try {
    return fn();
  } finally {
    if (k !== undefined) process.env.HUNTER_API_KEY = k;
  }
}

test("configure — fail-closed sans clé", () => {
  sansCle(() => {
    assert.equal(chercheurConfigure(), false);
    process.env.HUNTER_API_KEY = "   ";
    assert.equal(chercheurConfigure(), false, "une clé d'espaces ne compte pas");
    process.env.HUNTER_API_KEY = "k";
    assert.equal(chercheurConfigure(), true);
  });
});

test("domaine — nettoie site ou email en domaine nu", () => {
  assert.equal(domaineDe("https://www.cogedim.com/programmes"), "cogedim.com");
  assert.equal(domaineDe("klucas@cogedim.com"), "cogedim.com");
  assert.equal(domaineDe("WWW.Groupe-Confiance.FR"), "groupe-confiance.fr");
  assert.equal(domaineDe(""), "");
});

test("trouverEmail — lève sans clé (jamais d'email inventé)", async () => {
  await sansCle(async () => {
    await assert.rejects(trouverEmail({ firstName: "Kevin", lastName: "Lucas", domain: "cogedim.com" }), /HUNTER_API_KEY absent/);
  });
});

test("trouverEmail — parse une réponse Hunter (fetch simulé)", async () => {
  const k = process.env.HUNTER_API_KEY;
  const vraiFetch = globalThis.fetch;
  process.env.HUNTER_API_KEY = "k";
  globalThis.fetch = (async () =>
    new Response(
      JSON.stringify({ data: { email: "klucas@cogedim.com", score: 95, verification: { status: "valid" } } }),
      { status: 200, headers: { "content-type": "application/json" } },
    )) as typeof fetch;
  try {
    const r = await trouverEmail({ firstName: "Kevin", lastName: "Lucas", domain: "cogedim.com" });
    assert.equal(r?.email, "klucas@cogedim.com");
    assert.equal(r?.score, 95);
    assert.equal(r?.etat, "valid");
    assert.equal(r?.source, "hunter");
  } finally {
    globalThis.fetch = vraiFetch;
    if (k === undefined) delete process.env.HUNTER_API_KEY;
    else process.env.HUNTER_API_KEY = k;
  }
});

test("trouverEmail — Hunter ne trouve rien (404) → null, pas d'erreur", async () => {
  const k = process.env.HUNTER_API_KEY;
  const vraiFetch = globalThis.fetch;
  process.env.HUNTER_API_KEY = "k";
  globalThis.fetch = (async () => new Response("{}", { status: 404 })) as typeof fetch;
  try {
    const r = await trouverEmail({ firstName: "Personne", lastName: "Inconnue", domain: "example.com" });
    assert.equal(r, null);
  } finally {
    globalThis.fetch = vraiFetch;
    if (k === undefined) delete process.env.HUNTER_API_KEY;
    else process.env.HUNTER_API_KEY = k;
  }
});
