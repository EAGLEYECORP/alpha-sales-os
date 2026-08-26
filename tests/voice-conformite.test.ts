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

// ─────────── LE DÉROULÉ D'APPEL — ce qui se voyait au téléphone ───────────

test("appel — la fin de session est déclarée AU RACCROCHÉ, pas à la première réponse", () => {
  /**
   * L'ancienne version postait `end(outcome="repondu")` juste après
   * `generate_reply()`, donc dès la première réponse de l'agent — alors que
   * la conversation continue. La session passait en « terminee » côté CRM
   * pendant que la personne parlait, Live Assist arrêtait de suivre l'appel,
   * et `applyOutcome` réconciliait la timeline AVANT la fin : un « ne me
   * rappelez plus » prononcé ensuite n'était plus appliqué.
   */
  assert.match(
    agent,
    /add_shutdown_callback\(\s*_cloturer\s*\)/,
    "la clôture doit être branchée sur l'extinction du job"
  );
  // Et surtout : plus aucun `reporter.end` immédiatement après generate_reply.
  const apresReply = agent.slice(agent.indexOf("await session.generate_reply()"));
  assert.doesNotMatch(
    apresReply.slice(0, 400),
    /await reporter\.end\(/,
    "la fin ne doit plus être postée dans la foulée de la première réponse"
  );
});

test("appel — un incident ne raccroche pas au nez de l'interlocuteur", () => {
  /**
   * Le `raise` faisait tomber le job : la personne entendait un silence puis
   * la tonalité. Un LLM en 429, une TTS à court de crédit, un hoquet réseau —
   * tout coupait l'appel.
   */
  const bloc = agent.slice(agent.indexOf("await session.generate_reply()"));
  assert.match(bloc, /except Exception as e/, "l'incident doit être rattrapé");
  assert.match(
    bloc,
    /session\.say\(\s*\n?\s*"Pardon, j'ai eu une coupure technique/,
    "l'agent doit DIRE quelque chose au lieu de laisser un silence"
  );
  // La phrase de repli ne doit jamais laisser croire à un humain (art. 50).
  assert.doesNotMatch(bloc, /je suis (une personne|un humain|quelqu'un)/i);
});

test("appel — le démarrage de session, lui, reste fatal", () => {
  // Distinction volontaire : si la pile audio ne démarre pas, il n'y a aucun
  // appel à sauver. Continuer donnerait un appel muet, pire qu'un échec net.
  const bloc = agent.slice(agent.indexOf("await session.start("));
  assert.match(bloc.slice(0, 900), /la session n'a pas démarré[\s\S]{0,200}raise/);
});

test("LLM — OpenAI passe AVANT NVIDIA dès qu'une clé OpenAI existe", () => {
  /**
   * Deux raisons : la conversation est plus fluide (constaté sur un appel
   * réel — le tier gratuit NVIDIA met les requêtes en file), et l'accès
   * gratuit build.nvidia.com est réservé au dev/test, pas à des appels
   * clients facturés.
   */
  assert.match(agent, /a_openai\s*=\s*bool\(os\.getenv\("OPENAI_API_KEY"/);
  // Une clé générique Groq/NVIDIA ne doit PAS passer pour un signal OpenAI.
  assert.match(agent, /generique\.startswith\("sk-"\)/);
  // Et une ligne `VOICE_MODEL=` vide dans .env doit retomber sur le défaut.
  assert.match(agent, /os\.getenv\("VOICE_MODEL"\) or ""\)\.strip\(\) or defaut_modele/);
  assert.match(
    agent,
    /"https:\/\/api\.openai\.com\/v1"\s*if a_openai else\s*"https:\/\/integrate\.api\.nvidia\.com\/v1"/,
    "OpenAI doit être le défaut quand la clé est là, NVIDIA le repli"
  );
  // Le modèle par défaut doit suivre l'endpoint : un id namespacé envoyé à
  // OpenAI rend un 404, et l'inverse aussi.
  assert.match(agent, /defaut_modele = "gpt-4o-mini" if "openai\.com" in base_url\.lower\(\) else "openai\/gpt-oss-20b"/);
});
