import test from "node:test";
import assert from "node:assert/strict";
import { renderEmail } from "../lib/email-html";

test("email HTML — un href de schéma inattendu devient inerte", () => {
  // `esc()` empêche de sortir de l'attribut, pas d'y mettre « javascript: » —
  // et ce rendu est copié puis ouvert dans un navigateur via la prévisualisation.
  const piege = renderEmail({
    subject: "Test",
    body: "Bonjour",
    ctaLabel: "Cliquer",
    ctaUrl: "javascript:alert(document.cookie)",
  });
  assert.ok(!/href="javascript:/i.test(piege), "aucun href javascript: ne doit sortir du rendu");
  assert.ok(piege.includes('href="#"'));

  // Et les schémas légitimes passent intacts.
  const ok = renderEmail({ subject: "T", body: "B", ctaLabel: "RDV", ctaUrl: "https://cal.com/zakaria" });
  assert.ok(ok.includes('href="https://cal.com/zakaria"'));
  const tel = renderEmail({ subject: "T", body: "B", ctaLabel: "Appeler", ctaUrl: "tel:+33451222182" });
  assert.ok(tel.includes('href="tel:+33451222182"'));
});
