import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buildDraftBatch,
  draftContentFor,
  hasSendableEmail,
  sendableDrafts,
} from "../lib/gmail-draft";
import { imapQuote, appendCommand, parseDraftsMailbox } from "../lib/imap-append";
import type { Prospect } from "../lib/types";

// Une fiche minimale, complétée par des valeurs par défaut plausibles.
function fiche(over: Partial<Prospect>): Prospect {
  const base = {
    id: "p1",
    company: "Garage Test",
    name: "Marc",
    email: "marc@garage-test.fr",
    phone: "",
    city: "Lyon",
    sector: "garage",
    stage: "prospect",
    probability: 0.5,
    trust: 0.5,
    events: [],
  };
  return Object.assign(base, over) as Prospect;
}

test("hasSendableEmail — accepte un vrai email, refuse le vide et le malformé", () => {
  assert.equal(hasSendableEmail(fiche({ email: "a@b.fr" })), true);
  assert.equal(hasSendableEmail(fiche({ email: "" })), false);
  assert.equal(hasSendableEmail(fiche({ email: undefined })), false);
  assert.equal(hasSendableEmail(fiche({ email: "pas-un-email" })), false);
});

test("draftContentFor — rend un HTML « calme » et un texte, vers la bonne adresse", () => {
  const c = draftContentFor(fiche({ email: "  m@x.fr  " }), {
    closerName: "Zakaria",
    agencyName: "EAGLEYE CORP",
  });
  assert.equal(c.to, "m@x.fr", "l'adresse est nettoyée");
  assert.match(c.html, /<!doctype html>/i);
  assert.match(c.html, /EAGLEYE CORP/);
  assert.ok(c.subject.length > 0);
  assert.match(c.text, /STOP/, "le pied RGPD est dans l'alternative texte");
});

/**
 * ⚠ Ce test attendait `/Eagleye/` dans le HTML sans jamais passer d'agence :
 * il validait que NOTRE marque était écrite en dur dans le papier à en-tête
 * d'un produit white-label. Le brouillon d'un revendeur portait donc notre
 * nom. L'invariant est l'inverse : l'en-tête suit l'agence de l'opérateur.
 */
test("⚠ le brouillon porte l'agence de l'OPÉRATEUR, pas la nôtre", () => {
  const c = draftContentFor(fiche({ email: "m@x.fr" }), {
    closerName: "Camille",
    agencyName: "Partenaire Démo",
  });
  assert.match(c.html, /Partenaire Démo/, "l'en-tête doit porter l'agence qui envoie");
  const sansPlateforme = c.html.replace(/Envoy[ée] avec[\s\S]{0,200}?Alpha Sales OS[\s\S]{0,80}/gi, "");
  assert.ok(
    !/Eagleye/i.test(sansPlateforme),
    "notre marque ne doit pas apparaître dans le brouillon d'un autre compte"
  );
});

test("buildDraftBatch — exclut signé/perdu et sans email, garde et trie le reste", () => {
  const batch = buildDraftBatch([
    fiche({ id: "a", email: "a@x.fr", probability: 0.3 }),
    fiche({ id: "b", email: "b@x.fr", probability: 0.9 }),
    fiche({ id: "c", email: "", probability: 0.8 }), // sans email → out
    fiche({ id: "d", email: "d@x.fr", stage: "signe" }), // gagné → out
    fiche({ id: "e", email: "e@x.fr", stage: "perdu" }), // perdu → out
  ]);
  assert.deepEqual(
    batch.map((it) => it.prospect.id),
    ["b", "a"],
    "seules a et b restent, la plus probable d'abord"
  );
});

test("sendableDrafts — écarte les fiches de démonstration (adresse inventée)", () => {
  // Les ids de démo sont ceux du seed ; une fiche réelle n'est jamais démo.
  const batch = buildDraftBatch([fiche({ id: "real-1", email: "r@x.fr" })]);
  assert.equal(batch.length, 1);
  assert.equal(sendableDrafts(batch).length, 1, "une fiche réelle est déposable");
});

test("imapQuote — échappe les guillemets et antislashs", () => {
  assert.equal(imapQuote('a"b'), '"a\\"b"');
  assert.equal(imapQuote("a\\b"), '"a\\\\b"');
  assert.equal(imapQuote("[Gmail]/Drafts"), '"[Gmail]/Drafts"');
});

test("appendCommand — littéral synchronisant avec le drapeau \\Draft et la longueur en octets", () => {
  assert.equal(
    appendCommand("A3", "[Gmail]/Drafts", 512),
    'A3 APPEND "[Gmail]/Drafts" (\\Draft) {512}\r\n'
  );
});

test("parseDraftsMailbox — trouve le dossier \\Drafts, même localisé et entre guillemets", () => {
  const resp = [
    '* LIST (\\HasNoChildren \\Sent) "/" "[Gmail]/Messages envoyés"',
    '* LIST (\\HasNoChildren \\Drafts) "/" "[Gmail]/Brouillons"',
    "A2 OK done",
  ].join("\r\n");
  assert.equal(parseDraftsMailbox(resp), "[Gmail]/Brouillons");
});

test("parseDraftsMailbox — renvoie null si aucun dossier \\Drafts", () => {
  const resp = '* LIST (\\HasNoChildren \\Sent) "/" "[Gmail]/Sent"\r\nA2 OK done';
  assert.equal(parseDraftsMailbox(resp), null);
});
