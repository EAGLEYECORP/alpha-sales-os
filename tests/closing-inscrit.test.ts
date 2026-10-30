import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { NextRequest } from "next/server";
import { prospectDefaults } from "../lib/seed";
import type { Prospect } from "../lib/types";
import {
  TAG_A_TRAITER,
  TAG_LIEN_ENVOYE,
  closingPret,
  deciderReponse,
  envoiLienSignature,
  reponsePrix,
} from "../lib/reponses-inscrit";
import { DIVULGATION_ECRITE } from "../lib/signature-ia";
import { PACK_SETUP_HT, PRIX_SIEGE_HT, SOCLE_PLATEFORME_HT } from "../lib/offres-publiques";
import { prixAlphaVendAlpha } from "../lib/alpha-vend-alpha";
import { GET } from "../app/api/autopilote/configuration/route";

/**
 * ⚠⚠ ALPHA CONCLUT PAR ÉCRIT (29/10/2026, décision de Zakaria : « même le
 * closing »). Le prix et le lien sont DÉCLARÉS par l'opérateur ; ALPHA ne les
 * invente jamais. Non déclarés : ça remonte, comme avant. Le doute remonte
 * toujours.
 */

const MARDI_10H = new Date("2026-11-03T09:00:00Z");
const RACINE = process.cwd().endsWith(".test-build") ? join(process.cwd(), "..") : process.cwd();
const fiche = (o: Partial<Prospect> = {}): Prospect =>
  ({
    ...prospectDefaults,
    id: "p-closing",
    name: "Camille Démo",
    company: "AGENCE (DÉMO)",
    sector: "autre",
    city: "Lyon",
    stage: "contact",
    email: "camille@example.com",
    createdAt: "2026-10-01T00:00:00.000Z",
    updatedAt: "2026-10-01T00:00:00.000Z",
    ...o,
  }) as Prospect;
const lu = (texte: string) => ({ de: "camille@example.com", date: MARDI_10H.toISOString(), sujet: "Re: votre message", messageId: "<m>", inReplyTo: null, autoReponse: false, texte });
const CLOSING = { prix: "L'installation est à 1 200 € HT, puis 90 € HT par mois.", lienSignature: "https://pay.example.com/abc" };

test("closingPret : un prix lisible et un lien HTTPS, sinon « non déclaré »", () => {
  assert.deepEqual(closingPret(CLOSING), { prix: CLOSING.prix, lien: "https://pay.example.com/abc" });
  assert.deepEqual(closingPret({ prix: "cher", lienSignature: "http://pay.example.com" }), { prix: null, lien: null });
  assert.deepEqual(closingPret({ lienSignature: "javascript:alert(1)" }), { prix: null, lien: null });
  assert.deepEqual(closingPret(undefined), { prix: null, lien: null });
  assert.equal(closingPret({ prix: "x".repeat(601) }).prix, null, "un devis entier n'est pas une phrase de prix");
});

test("⚠⚠ prix DÉCLARÉ → ALPHA répond seul ; non déclaré → ça remonte, daté", () => {
  const avec = deciderReponse(fiche(), lu("Bonjour, c'est combien ?"), null, MARDI_10H, CLOSING);
  assert.equal(avec.repondre, "prix");
  assert.equal(avec.escalade, null);
  assert.equal(avec.patch.stage, "offre");
  const sans = deciderReponse(fiche(), lu("Bonjour, c'est combien ?"), null, MARDI_10H, { lienSignature: CLOSING.lienSignature });
  assert.equal(sans.repondre, null);
  assert.ok(sans.escalade);
  assert.ok(sans.patch.tags!.includes(TAG_A_TRAITER));
});

test("⚠⚠ « on y va » + lien DÉCLARÉ → le lien part, la fiche dit quoi vérifier ; sans lien → ça remonte", () => {
  const avec = deciderReponse(fiche(), lu("On est prêts, envoyez le contrat."), null, MARDI_10H, CLOSING);
  assert.equal(avec.repondre, "signer");
  assert.equal(avec.escalade, null);
  assert.ok(avec.patch.tags!.includes(TAG_LIEN_ENVOYE));
  assert.equal(avec.patch.nextStep!.date, "2026-11-05");
  assert.match(avec.patch.nextStep!.action, /signé/);
  const sans = deciderReponse(fiche(), lu("On est prêts, envoyez le contrat."), null, MARDI_10H, { prix: CLOSING.prix });
  assert.equal(sans.repondre, null);
  assert.ok(sans.escalade);
});

test("⚠ le DOUTE remonte toujours, même avec tout déclaré ; une fiche signée ne recule pas", () => {
  const doute = deciderReponse(fiche(), lu("C'est trop cher pour nous, on a déjà un outil."), null, MARDI_10H, CLOSING);
  assert.equal(doute.repondre, null);
  assert.ok(doute.escalade);
  const signee = deciderReponse(fiche({ stage: "signe" }), lu("Et c'est combien pour un second site ?"), null, MARDI_10H, CLOSING);
  assert.equal(signee.patch.stage, "signe");
});

test("ce qui part : le prix déclaré mot pour mot, le lien, la divulgation — et ni signature ni STOP (le rendu les pose)", () => {
  const m = reponsePrix(fiche(), { prix: CLOSING.prix, lien: CLOSING.lienSignature }, "Re: votre message");
  assert.match(m.body, /^Bonjour Camille,/);
  assert.ok(m.body.includes(CLOSING.prix));
  assert.ok(m.body.includes(CLOSING.lienSignature));
  assert.ok(m.body.includes(DIVULGATION_ECRITE));
  // Un seul « STOP » : celui de la divulgation. Le pied du rendu ajoute le sien ; un second ici en ferait trois.
  assert.equal(m.body.match(/STOP/g)?.length, 1);
  assert.doesNotMatch(m.body, /^— /m);
  const s = envoiLienSignature(fiche(), CLOSING.lienSignature, "votre message");
  assert.equal(s.subject, "Re: votre message");
  assert.ok(s.body.includes(CLOSING.lienSignature) && s.body.includes(DIVULGATION_ECRITE));
});

test("⚠⚠ le moteur passe le closing DÉCLARÉ à la décision, et envoie les deux réponses", () => {
  // La boucle vit dans l'exécuteur PARTAGÉ (navigateur + serveur) : `lib/pilote-executeur.ts`.
  const src = readFileSync(join(RACINE, "lib/pilote-executeur.ts"), "utf8");
  assert.match(src, /deciderReponse\(p, m, profil, maintenant, pp\.closing\(\)\)/);
  assert.match(src, /reponsePrix\(/);
  assert.match(src, /envoiLienSignature\(/);
  const page = readFileSync(join(RACINE, "app/(app)/autopilote/page.tsx"), "utf8");
  assert.match(page, /settings\.closing\?\.prix/);
  assert.match(page, /settings\.closing\?\.lienSignature/);
});

test("ALPHA vend ALPHA : le prix est DÉRIVÉ des constantes, et le lien est la création de compte du domaine servi", async () => {
  const prix = prixAlphaVendAlpha();
  for (const n of [PACK_SETUP_HT, SOCLE_PLATEFORME_HT, PRIX_SIEGE_HT]) assert.ok(prix.includes(n.toLocaleString("fr-FR")), `${n} absent`);
  assert.match(prix, /gratuit/);
  assert.ok(closingPret({ prix }).prix, "la phrase passe les bornes du closing");
  for (const k of ["SITE_PASSWORD", "NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_JWT_SECRET", "ALPHA_INSTALLATION"]) delete process.env[k];
  const r = await GET(new NextRequest("https://alphasalesos.example.com/api/autopilote/configuration"));
  const c = (await r.json()) as { closing: { prix: string; lienSignature: string } };
  assert.equal(c.closing.lienSignature, "https://alphasalesos.example.com/compte");
  assert.equal(c.closing.prix, prix);
});
