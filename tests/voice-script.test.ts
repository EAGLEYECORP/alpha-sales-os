import test from "node:test";
import assert from "node:assert/strict";
import {
  auditScript,
  buildVoiceScript,
  callAllowedNow,
  CALL_MODES,
  DISCLOSURE_REQUIREMENTS,
  disclosure,
  toE164,
  type CallMode,
  type VoiceConfig,
} from "../lib/voice-script";

/**
 * La divulgation n'est pas une préférence : c'est une obligation légale
 * en vigueur (art. 50 du règlement européen sur l'IA, applicable depuis
 * le 2 août 2026). Ces tests existent pour qu'aucune refonte future ne
 * puisse produire, même par distraction, un script qui appelle quelqu'un
 * sans se déclarer artificiel.
 */

const cfg = (over: Partial<VoiceConfig> = {}): VoiceConfig => ({
  mode: "demo-sortante",
  agentName: "ALPHA",
  onBehalfOf: "EAGLEYE CORP",
  company: "***NOM-RETIRE***",
  verticalId: "garage-carrosserie",
  ...over,
});

const ALL_MODES: CallMode[] = ["demo-entrante", "demo-sortante", "rappel-entrant"];

test("divulgation — les trois mentions imposées sont présentes", () => {
  const d = disclosure(cfg());
  for (const r of DISCLOSURE_REQUIREMENTS) {
    assert.match(d, r.pattern, `mention manquante : ${r.label}`);
  }
  assert.match(d, /EAGLEYE CORP/, "le mandant doit être nommé");
});

test("divulgation — AUCUN mode ne produit un script sans elle", () => {
  // Le test central. Si une refonte introduit un chemin sans divulgation,
  // c'est ici que ça casse — avant la mise en production, pas après un
  // appel en infraction.
  for (const mode of ALL_MODES) {
    const script = buildVoiceScript(cfg({ mode }));
    const audit = auditScript(script);
    assert.equal(audit.ok, true, `${mode} : ${audit.manquantes.join(", ")}`);
    // Et elle doit être EN TÊTE, pas noyée au milieu.
    const lines = script.split("\n").filter(Boolean);
    assert.match(lines[0], /Première phrase/);
    assert.match(lines[1], /intelligence artificielle/);
  }
});

test("divulgation — un script bricolé sans les mentions est refusé", () => {
  const faux = "Bonjour, je suis Julie de chez EAGLEYE. Vous avez deux minutes ?";
  const audit = auditScript(faux);
  assert.equal(audit.ok, false);
  assert.equal(audit.manquantes.length, DISCLOSURE_REQUIREMENTS.length);
});

test("script — l'obligation de répondre OUI à « êtes-vous un robot ? »", () => {
  // Se déclarer au début ne suffit pas : la question revient en cours
  // d'appel, et c'est là que le mensonge serait le plus tentant.
  for (const mode of ALL_MODES) {
    const s = buildVoiceScript(cfg({ mode }));
    assert.match(s, /robot ou une IA : tu réponds OUI/);
    assert.match(s, /ne prétends jamais être humain/);
  }
});

test("script — jamais de prix, et une sortie immédiate sur refus", () => {
  for (const mode of ALL_MODES) {
    const s = buildVoiceScript(cfg({ mode }));
    assert.match(s, /aucun prix/i);
    assert.match(s, /ne plus être appelée[\s\S]{0,80}confirmes/i);
  }
});

test("script — le playbook de la verticale entre dans le contexte", () => {
  const avec = buildVoiceScript(cfg({ mode: "demo-entrante", verticalId: "garage-carrosserie" }));
  const sans = buildVoiceScript(cfg({ mode: "demo-entrante", verticalId: null }));
  assert.ok(avec.length > sans.length, "la verticale doit ajouter du contexte métier");
  assert.match(avec, /Contexte métier/);
});

test("modes — le démarchage à froid n'est pas exposé", () => {
  // Techniquement identique à la démo sortante. C'est une décision, pas
  // une limite : voir docs/MARCHE.md §4.2.
  const ids = CALL_MODES.map((m) => m.id);
  assert.ok(!ids.some((id) => /froid|cold|prospection/i.test(id)));
  assert.deepEqual(ids.sort(), [...ALL_MODES].sort());
  for (const m of CALL_MODES) {
    assert.equal(m.allowed, true);
    assert.ok(m.legal.length > 60, `${m.id} : la base légale doit être explicitée`);
  }
});

test("numéro — conversion en E.164, et refus de ce qui n'en est pas un", () => {
  assert.equal(toE164("06 12 34 56 78"), "+33612345678");
  assert.equal(toE164("04.78.52.72.81"), "+33478527281");
  assert.equal(toE164("+33612345678"), "+33612345678");
  assert.equal(toE164("33612345678"), "+33612345678");
  // Un numéro incomplet composé en SIP tombe dans le vide ou, pire, sur
  // quelqu'un d'autre.
  assert.equal(toE164("06 12 34"), null);
  assert.equal(toE164("pas un numéro"), null);
  assert.equal(toE164(""), null);
});

test("fenêtre — pas d'appel le week-end ni à la pause déjeuner", () => {
  const at = (iso: string) => callAllowedNow(new Date(iso));
  assert.equal(at("2026-08-03T10:00:00").allowed, true, "lundi 10h");
  assert.equal(at("2026-08-03T15:00:00").allowed, true, "lundi 15h");
  assert.equal(at("2026-08-02T10:00:00").allowed, false, "dimanche");
  assert.equal(at("2026-08-08T10:00:00").allowed, false, "samedi");
  assert.equal(at("2026-08-03T12:30:00").allowed, false, "pause déjeuner");
  assert.equal(at("2026-08-03T08:00:00").allowed, false, "avant ouverture");
  assert.equal(at("2026-08-03T19:00:00").allowed, false, "après fermeture");
  // Et la raison doit être dite, pas seulement le refus.
  assert.ok(at("2026-08-02T10:00:00").why.length > 30);
});
