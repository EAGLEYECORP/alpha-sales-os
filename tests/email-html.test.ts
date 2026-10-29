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

test("⚠ toute table à largeur fixe se replie sur téléphone — sinon l'email entier défile de côté", () => {
  // Vu le 29/10/2026 en filmant le pilote : à 480 px, le bandeau « Envoyé avec »
  // (600 px, sans classe) gardait tout l'email à 600 px.
  const html = renderEmail({ subject: "Objet", body: "Bonjour,\n\nUne ligne.", closerName: "Camille Démo", addressLine: "ATELIER (DÉMO)" });
  const regle = /@media only screen and \(max-width:600px\) \{([\s\S]*?)\n  \}/.exec(html)?.[1] ?? "";
  const replient = new Set([...regle.matchAll(/\.([\w-]+)(?=[\s,{])/g)].map((m) => m[1]).filter((c) => /width:100%/.test(regle.slice(regle.indexOf(`.${c}`)).split("}")[0])));
  const fixes = [...html.matchAll(/<table\b[^>]*\bwidth="(\d{3,})"[^>]*>/g)];
  assert.ok(fixes.length >= 2, "le gabarit n'a plus de table fixe : le test ne mesure plus rien");
  for (const [balise] of fixes) {
    const classes = /class="([^"]+)"/.exec(balise)?.[1].split(/\s+/) ?? [];
    assert.ok(classes.some((c) => replient.has(c)), `table fixe sans repli mobile : ${balise.slice(0, 90)}…`);
  }
});
