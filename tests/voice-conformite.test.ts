import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { DISCLOSURE_REQUIREMENTS, buildVoiceScript, auditScript } from "../lib/voice-script";

const agent = readFileSync(join(process.cwd(), "voice/agent.py"), "utf8");

/**
 * L'app construit le script, l'agent Python le vérifie avant de parler. Les
 * deux portent leur propre copie des mentions de l'article 50, et le
 * commentaire du Python dit « miroir exact » — mais RIEN ne l'imposait.
 *
 * Les deux dérives possibles sont mauvaises, dans les deux sens : soit l'app
 * produit des scripts que l'agent refuse et les appels échouent en silence,
 * soit l'agent accepte un script auquel il manque une mention légalement
 * obligatoire. Ce test est la seule chose qui tient la frontière.
 */
test("conformité — la liste Python est le miroir exact de la liste TypeScript", () => {
  const bloc = agent.slice(agent.indexOf("DISCLOSURE_REQUIREMENTS = ["), agent.indexOf("]", agent.indexOf("DISCLOSURE_REQUIREMENTS = [")));
  const motifsPython = [...bloc.matchAll(/re\.compile\(r"([^"]+)"/g)].map((m) => m[1]);

  assert.equal(
    motifsPython.length,
    DISCLOSURE_REQUIREMENTS.length,
    `TypeScript exige ${DISCLOSURE_REQUIREMENTS.length} mentions, Python en vérifie ${motifsPython.length}`
  );

  DISCLOSURE_REQUIREMENTS.forEach((r, i) => {
    // On compare la SOURCE du motif : deux expressions différentes qui
    // « se ressemblent » finissent par diverger sur un cas limite.
    assert.equal(
      motifsPython[i],
      r.pattern.source,
      `mention « ${r.label} » : TypeScript /${r.pattern.source}/ ≠ Python /${motifsPython[i]}/`
    );
  });
});

test("conformité — l'agent refuse de démarrer, il n'avertit pas", () => {
  // Un avertissement se contourne. Ici il faut une exception qui arrête tout :
  // un appel non conforme est une infraction, pas une imperfection.
  assert.match(agent, /raise DisclosureError/, "audit_script doit LEVER, pas journaliser");
  assert.match(agent, /audit_script\(script\)/, "et être appelé à la construction de l'agent");
});

test("conformité — la divulgation est prononcée par le code, sans interruption", () => {
  // Un modèle peut reformuler, écourter ou sauter une consigne. Une ligne de
  // code, non.
  assert.match(agent, /session\.say\(first_sentence\(script\), allow_interruptions=False\)/);
});

test("conformité — le script de repli entrant passe lui aussi l'audit", () => {
  // Un appel entrant n'apporte pas de script construit par l'app : sans repli
  // conforme, soit l'agent se tait, soit il parle sans se déclarer.
  const repli = agent.slice(agent.indexOf("DEFAULT_INBOUND_SCRIPT"));
  for (const r of DISCLOSURE_REQUIREMENTS) {
    assert.ok(r.pattern.test(repli), `le script d'accueil par défaut ne porte pas « ${r.label} »`);
  }
});

test("conformité — aucun script construit par l'app ne peut sortir sans mentions", () => {
  const script = buildVoiceScript({
    onBehalfOf: "EAGLEYE CORP",
    agentName: "ALPHA",
    mode: "demo-sortante",
    company: "Toitures du Rhône",
  } as Parameters<typeof buildVoiceScript>[0]);

  assert.equal(auditScript(script).ok, true);
  // La divulgation est en TÊTE : c'est la première chose entendue, pas une
  // mention glissée en fin de script.
  assert.ok(script.indexOf("Première phrase") < 40);
});
