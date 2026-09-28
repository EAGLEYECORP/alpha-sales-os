import test from "node:test";
import assert from "node:assert/strict";
import {
  auditScript,
  buildVoiceScript,
  callAllowedNow,
  CALL_MODES,
  DISCLOSURE_REQUIREMENTS,
  disclosure,
  outboundComplianceGate,
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
  company: "Carrosserie Corvane",
  verticalId: "garage-carrosserie",
  ...over,
});

const ALL_MODES: CallMode[] = ["demo-entrante", "demo-sortante", "rappel-entrant", "prospection-b2b"];

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

test("modes — chaque mode expose une base légale, prospection incluse", () => {
  const ids = CALL_MODES.map((m) => m.id);
  assert.deepEqual(ids.sort(), [...ALL_MODES].sort());
  assert.ok(ids.includes("prospection-b2b"), "la prospection B2B est désormais exposée");
  for (const m of CALL_MODES) {
    assert.equal(m.allowed, true);
    assert.ok(m.legal.length > 60, `${m.id} : la base légale doit être explicitée`);
  }
});

test("prospection B2B — la porte de conformité tranche (dur, non forçable)", () => {
  // Sans confirmation « cible professionnelle », la prospection ne part pas.
  assert.equal(outboundComplianceGate({ mode: "prospection-b2b", isProfessional: false }).ok, false);
  // Avec la confirmation B2B, elle passe.
  assert.equal(outboundComplianceGate({ mode: "prospection-b2b", isProfessional: true }).ok, true);
  // Une fiche qui s'est opposée est bloquée, quel que soit le mode.
  assert.equal(outboundComplianceGate({ mode: "prospection-b2b", isProfessional: true, optedOut: true }).ok, false);
  assert.equal(outboundComplianceGate({ mode: "rappel-entrant", optedOut: true }).ok, false);
  // Les modes démo/rappel ne réclament pas de confirmation professionnelle.
  assert.equal(outboundComplianceGate({ mode: "demo-sortante" }).ok, true);
  assert.equal(outboundComplianceGate({ mode: "demo-entrante" }).ok, true);
});

test("numéro — conversion en E.164, et refus de ce qui n'en est pas un", () => {
  assert.equal(toE164("06 39 98 56 78"), "+33639985678");
  assert.equal(toE164("04.65.71.72.81"), "+33465717281");
  assert.equal(toE164("+33639985678"), "+33639985678");
  assert.equal(toE164("33639985678"), "+33639985678");
  // Un numéro incomplet composé en SIP tombe dans le vide ou, pire, sur
  // quelqu'un d'autre.
  assert.equal(toE164("06 12 34"), null);
  assert.equal(toE164("pas un numéro"), null);
  assert.equal(toE164(""), null);
});

test("fenêtre — pas d'appel le week-end ni à la pause déjeuner", () => {
  // ⚠ Les heures portent leur DÉCALAGE, volontairement. Sans lui, JavaScript
  // les lit dans le fuseau du processus : ce test passait en local et
  // décrivait, en production (UTC), une fenêtre décalée de deux heures. Il
  // était le miroir exact du bug qu'il était censé prévenir.
  const at = (iso: string) => callAllowedNow(new Date(iso));
  assert.equal(at("2026-08-03T10:00:00+02:00").allowed, true, "lundi 10h à Lyon");
  assert.equal(at("2026-08-03T15:00:00+02:00").allowed, true, "lundi 15h à Lyon");
  assert.equal(at("2026-08-02T10:00:00+02:00").allowed, false, "dimanche");
  assert.equal(at("2026-08-08T10:00:00+02:00").allowed, false, "samedi");
  assert.equal(at("2026-08-03T12:30:00+02:00").allowed, false, "pause déjeuner");
  assert.equal(at("2026-08-03T08:00:00+02:00").allowed, false, "avant ouverture");
  assert.equal(at("2026-08-03T19:00:00+02:00").allowed, false, "après fermeture");
  // Et la raison doit être dite, pas seulement le refus.
  assert.ok(at("2026-08-02T10:00:00+02:00").why.length > 30);
});

/**
 * ─────────────────────────────────────────────────────────────────────
 * ⚠⚠ AUCUNE PROSE NE DÉCLARE INDISPONIBLE UN MODE QUE `CALL_MODES` AUTORISE.
 *
 * Panne signature du dépôt, troisième fois en deux jours : le 28/08/2026,
 * `COLD_CALLING_REFUSED` a été renommée `COLD_CALLING_DISCIPLINE` parce
 * qu'elle affirmait une protection inexistante — `prospection-b2b` était
 * `allowed: true` depuis un moment. La correction a été faite dans `lib/`.
 *
 * `app/(app)/voice/page.tsx` a gardé, treize jours de plus, « Le démarchage à
 * froid n'est pas proposé » — dans un écran qui mappe sur `CALL_MODES`, donc
 * qui le PROPOSE, et qui porte même une branche `isProspection`.
 *
 * Un commentaire faux ne fait rien tomber : il ment à la session suivante,
 * qui le croit et raisonne dessus. Ce test relie donc la PROSE à la DONNÉE —
 * il ne cherche pas une phrase interdite dans l'absolu, il refuse une phrase
 * que `CALL_MODES` contredit. Le jour où un mode repasse `allowed: false`,
 * l'écrire redevient licite et le test le laisse passer.
 * ─────────────────────────────────────────────────────────────────────
 */
test("⚠ aucun écran n'affirme l'indisponibilité d'un mode d'appel autorisé", async () => {
  const { readFileSync } = await import("node:fs");
  const { join } = await import("node:path");

  const prospection = CALL_MODES.find((m) => m.id === "prospection-b2b");
  assert.ok(prospection, "le mode de prospection doit exister pour que ce test ait un objet");
  // ⚠ LA CONDITION, PAS LA PRÉSENCE. Si le mode devient interdit, la prose qui
  // l'annonce devient VRAIE et ce test n'a plus rien à refuser.
  if (!prospection.allowed) return;

  /**
   * Les citations sont retirées avant la recherche. Une phrase entre
   * guillemets est RAPPORTÉE, pas affirmée : `lib/voice-script.ts` cite
   * l'ancienne formule pour expliquer pourquoi elle a été corrigée, et
   * effacer cette explication laisserait la décision sans sa raison.
   */
  const sansCitations = (s: string) => s.replace(/«[^»]*»/g, " ").replace(/"[^"\n]*"/g, " ");

  const NIE_LA_DISPONIBILITE = [
    /\b(?:démarchage|appel)s? à froid n(?:'|’)(?:est|sont) pas (?:proposés?|exposés?|offerts?|disponibles?|permis)/i,
    /\bpas de (?:démarchage|appel) à froid\b/i,
    /\bdélibérément absent de CALL_MODES\b/i,
    /\bprospection à froid (?:refusée|interdite|non proposée)\b/i,
  ];

  const fautes: string[] = [];
  for (const f of ["app/(app)/voice/page.tsx", "lib/voice-script.ts", "app/(app)/agent/page.tsx", "docs/VOIX.md", "voice/README.md"]) {
    let src: string;
    try {
      src = readFileSync(join(process.cwd(), f), "utf8");
    } catch {
      continue; // l'écran a été renommé : les autres gardes le diront
    }
    const texte = sansCitations(src);
    for (const motif of NIE_LA_DISPONIBILITE) {
      const m = texte.match(motif);
      if (m) fautes.push(`${f} → « ${m[0].trim()} »`);
    }
  }

  assert.deepEqual(
    fautes,
    [],
    "ces phrases annoncent une protection que CALL_MODES ne donne pas — `prospection-b2b` y est `allowed: true` :\n  " +
      fautes.join("\n  ")
  );
});
