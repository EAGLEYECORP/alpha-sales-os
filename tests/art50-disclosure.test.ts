// tests/art50-disclosure.test.ts
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Adjust imports to the real modules that enforce disclosure
// (voice-script, campaign-runner, conformite, etc.)
import { /* the function that validates a script before send/call */ } from "../lib/...";

describe("Art. 50 — disclosure is non-bypassable", () => {
  it("rejects a voice or email script that omits the required AI disclosure", () => {
    const badScript = "Bonjour, je vous appelle au sujet de votre permis.";
    // Expect the real validator to throw or return a failure
    assert.throws(
      () => validateOutboundScript(badScript, { canal: "appel" }),
      /divulgation|article.?50|IA|intelligence artificielle/i
    );
  });

  it("accepts a script that contains the required disclosure sentence", () => {
    const goodScript =
      "Bonjour, je suis un assistant conversationnel d'intelligence artificielle. " +
      "Je vous appelle au sujet de votre permis.";
    assert.doesNotThrow(() => validateOutboundScript(goodScript, { canal: "appel" }));
  });
});
