import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROUTE = join(process.cwd(), "app/api/voice/call/route.ts");
const src = readFileSync(ROUTE, "utf8");

const sansCommentaires = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

const code = sansCommentaires(src);

/**
 * ─────────────────────────────────────────────────────────────────────
 * LE 422 EST LA SEULE CHOSE ENTRE UNE TRAME ÉDITÉE ET UN VRAI APPEL.
 *
 * ⚠ CE FICHIER EXISTE PARCE QU'UNE MUTATION A SURVÉCU.
 *
 * En rendant la trame d'appel à froid éditable depuis `/prompts`, j'ai
 * introduit un chemin NAVIGATEUR → SERVEUR → TÉLÉPHONE. J'ai muté la route
 * pour qu'elle n'applique plus le refus (`if (!audit.ok)` → `if (false)`) :
 * **1252 tests sont restés verts.**
 *
 * Autrement dit, rien ne vérifiait que la route refuse réellement un script
 * non conforme. La divulgation de l'article 50, l'objectif unique, l'absence
 * de prix, le droit d'opposition : tout cela était vérifié dans les modules
 * purs, et RIEN ne garantissait que la route s'en serve.
 *
 * ── POURQUOI UN TEST DE SOURCE ET PAS UN APPEL RÉEL ──
 *
 * `tsconfig.test.json` ne compile que `tests/` et `lib/` : les routes Next ne
 * sont pas dans le build de test, et les y ajouter tirerait tout le runtime
 * Next dans node:test. Le dépôt garde déjà d'autres routes par lecture de
 * source (`vitrine-fuite`, `rendu-reel`) — c'est le motif maison.
 *
 * Ce qui compte ici n'est pas la PRÉSENCE de l'audit mais son ORDRE : un
 * audit qui journalise après avoir composé le numéro ne protège de rien.
 * ─────────────────────────────────────────────────────────────────────
 */
test("⚠ la route REFUSE un script non conforme, et refuse AVANT de composer", () => {
  const iAudit = code.indexOf("auditScript(script");
  assert.ok(iAudit > 0, "la route doit auditer le script qu'elle vient de construire");

  // Le refus doit exister, et porter un 422 (requête recevable, contenu non conforme).
  const iRefus = code.indexOf("if (!audit.ok)");
  assert.ok(iRefus > iAudit, "le refus doit suivre l'audit");
  const blocRefus = code.slice(iRefus, iRefus + 400);
  assert.match(blocRefus, /status:\s*422/, "un script non conforme doit être refusé, pas seulement signalé");
  assert.match(blocRefus, /return NextResponse\.json/, "le refus doit INTERROMPRE le traitement");

  /**
   * L'ordre : le refus doit précéder TOUT ce qui déclenche l'appel. On repère
   * le déclenchement par le dispatch LiveKit — c'est lui qui met l'agent en
   * ligne avec le numéro.
   */
  const iDispatch = code.indexOf("createDispatch(");
  assert.ok(iDispatch > 0, "le point de déclenchement de l'appel est introuvable — le garde ne sait plus quoi borner");
  assert.ok(
    iRefus < iDispatch,
    "le refus doit être évalué AVANT le dispatch : auditer après avoir composé ne protège de rien"
  );
});

test("la trame venue du navigateur traverse le MÊME audit que le texte livré", () => {
  /**
   * ⚠ `corpsFroid` arrive du navigateur. C'est une entrée non fiable : un
   * opérateur — ou n'importe qui capable de poster sur la route — pourrait
   * envoyer une trame amputée de la divulgation IA.
   *
   * La validation d'écran (`/prompts`) n'est qu'un confort. Celle qui décide
   * est ici, et elle s'applique au script ASSEMBLÉ, donc après substitution :
   * c'est le texte réellement prononcé qui est jugé, pas la trame.
   */
  assert.match(code, /corpsFroid\?: string/, "la route doit accepter la trame éditée");
  assert.match(code, /corpsFroid: body\.corpsFroid/, "et la passer au constructeur de script");

  // L'audit porte sur le script construit, jamais sur la trame brute.
  assert.match(code, /const script = buildVoiceScript\(cfg\)/);
  assert.ok(
    code.indexOf("const script = buildVoiceScript(cfg)") < code.indexOf("auditScript(script"),
    "on audite le script assemblé, pas la trame reçue"
  );
});

test("les portes DURES restent non contournables par `force`", () => {
  /**
   * `force` existe pour la fenêtre horaire — un humain peut décider d'appeler
   * un samedi. Il ne doit JAMAIS pouvoir passer outre la conformité : droit
   * d'opposition, cible professionnelle, divulgation. Ce sont des conditions
   * de licéité, pas des préférences.
   */
  const iRefusConformite = code.indexOf("if (!audit.ok)");
  const blocAvant = code.slice(0, iRefusConformite);
  assert.ok(
    !/body\.force/.test(blocAvant.slice(blocAvant.lastIndexOf("const audit"))),
    "aucun `force` ne doit intervenir entre l'audit et son refus"
  );
  // Et la porte de conformité dure existe toujours, séparée de la fenêtre.
  assert.match(code, /outboundComplianceGate/, "la porte de licéité doit rester dans la route");
});
