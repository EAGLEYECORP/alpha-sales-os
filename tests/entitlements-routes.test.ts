// tests/entitlements-routes.test.ts
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { DROIT_GRATUIT, /* resoudreDroits or the real guard */ } from "../lib/entitlements";
import { /* the helper that checks a route against an entitlement */ } from "../lib/bricks-access";

describe("Free tier cannot burn paid resources", () => {
  const free = DROIT_GRATUIT;

  const paidRoutes = [
    "/api/send",
    "/api/voice/call",
    // add any other routes that consume SMTP, LiveKit or frontier tokens
  ];

  for (const route of paidRoutes) {
    it(`refuses ${route} for a free-tier account`, () => {
      const allowed = peutOuvrir(route, free); // or whatever the real guard is named
      assert.equal(allowed, false, `${route} must be closed for free tier`);
    });
  }

  it("still opens the free bricks (crm, closer, cerveau, pilotage, alpha-live)", () => {
    // assert the free bricks remain open
  });
});
