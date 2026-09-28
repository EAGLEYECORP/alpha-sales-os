import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { BATTEMENT_INTERVALLE_S, TOLERANCE_S, presenceAgent } from "../lib/presence-agent";

/**
 * ─────────────────────────────────────────────────────────────────────
 * Y A-T-IL QUELQU'UN AU BOUT ?
 *
 * `voice/agent.py` tourne en local. `/api/voice/call` crée un dispatch LiveKit
 * et rend `dispatched: true` que l'agent tourne ou non. Sans cette garde, un
 * poste éteint un vendredi soir laisse le cron composer tout le week-end : la
 * ligne sonne, le prospect décroche, personne ne parle — et les journaux
 * restent verts.
 * ─────────────────────────────────────────────────────────────────────
 */

const T0 = new Date("2026-09-09T18:00:00.000Z");
const ilYA = (s: number) => new Date(T0.getTime() - s * 1000).toISOString();
const sansCommentaires = (x: string) => x.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
const lire = (f: string) => readFileSync(join(process.cwd(), f), "utf8");

// ═══════════ L'ASYMÉTRIE, QUI EST TOUT LE SUJET ═══════════

test("⚠ L'INCONNU VAUT REFUS — pas « on verra bien »", () => {
  /**
   * ⚠ ICI, CONTRAIREMENT AUX ÉCRANS DE MESURE, `null` NE SE CONTENTE PAS DE
   * SE DIRE : IL REFUSE.
   *
   * Sur un tableau de bord, « je n'ai pas regardé » ne doit pas alarmer — une
   * alerte sur une absence de mesure remplit l'écran de rouge et on apprend à
   * ne plus le lire. Sur une décision de COMPOSER UN NUMÉRO, l'arbitrage
   * s'inverse : ne pas appeler coûte un créneau, appeler dans le vide coûte
   * une fiche, un numéro et de l'argent. On choisit toujours l'erreur la moins
   * chère.
   *
   * Mutation vérifiée : passer `peutAppeler: true` sur la branche `inconnu`
   * fait tomber ce test.
   */
  for (const cas of [null, undefined, "", "pas une date"]) {
    const p = presenceAgent(cas, T0);
    assert.equal(p.etat, "inconnu", `« ${String(cas)} » ne doit pas se lire comme une preuve de vie`);
    assert.equal(p.peutAppeler, false);
    assert.ok(p.phrase.length > 60, "le refus doit dire quoi faire, pas seulement refuser");
  }
});

test("un battement RÉCENT autorise, un battement vieux refuse", () => {
  // La moitié qui prouve que la garde n'est pas un refus systématique — une
  // garde qui refuse tout se fait désactiver au premier lundi matin.
  const frais = presenceAgent(ilYA(5), T0);
  assert.equal(frais.etat, "vivant");
  assert.equal(frais.peutAppeler, true);

  const vieux = presenceAgent(ilYA(TOLERANCE_S + 60), T0);
  assert.equal(vieux.etat, "silencieux");
  assert.equal(vieux.peutAppeler, false);
});

test("⚠ la tolérance absorbe un hoquet, pas une soirée", () => {
  /**
   * Quatre intervalles : assez pour un redémarrage ou une coupure réseau,
   * assez court pour qu'un poste fermé cesse de composer en deux minutes. Le
   * cron passe toutes les dix minutes — une tolérance plus large ne servirait
   * qu'à laisser passer un tick de plus dans le vide.
   */
  assert.equal(TOLERANCE_S, BATTEMENT_INTERVALLE_S * 4);
  assert.ok(TOLERANCE_S < 600, "la tolérance doit être PLUS COURTE que la période du cron (10 min)");

  // Juste sous la limite : encore vivant. Juste au-dessus : silencieux.
  assert.equal(presenceAgent(ilYA(TOLERANCE_S - 1), T0).etat, "vivant");
  assert.equal(presenceAgent(ilYA(TOLERANCE_S + 1), T0).etat, "silencieux");
});

// ═══════════ LE BRANCHEMENT ═══════════

test("⚠ LE TICK REFUSE DE COMPOSER SANS AGENT — et seulement à l'exécution", () => {
  /**
   * ⚠ Les deux moitiés comptent.
   *
   * Sans la garde, le cron compose dans le vide. Mais si la garde s'appliquait
   * AUSSI à `dryRun`, on perdrait l'outil qui sert précisément à comprendre
   * pourquoi rien ne part — et on chercherait la panne dans la file d'appels.
   *
   * Mutation vérifiée : retirer le `if (!presence.peutAppeler)` fait tomber ce
   * test ; le déplacer avant le bloc `dryRun` le fait tomber aussi.
   */
  const src = sansCommentaires(lire("app/api/campaign/tick/route.ts"));

  assert.match(src, /presenceAgent\(/, "le tick doit interroger la présence");
  assert.match(src, /if \(!presence\.peutAppeler\)/, "…et refuser quand elle est absente");

  const iDry = src.indexOf("if (dryRun)");
  const iGarde = src.indexOf("if (!presence.peutAppeler)");
  assert.ok(iDry > 0 && iGarde > iDry, "la garde doit venir APRÈS la simulation, jamais avant");

  // Et elle est AVANT la boucle qui appelle réellement.
  const iBoucle = src.indexOf("for (const t of tasks)");
  assert.ok(iBoucle > iGarde, "la garde doit précéder l'exécution");
});

test("⚠ le battement n'est PAS falsifiable", () => {
  /**
   * Un battement que n'importe qui peut poser est pire que pas de battement :
   * il ferait croire qu'un agent écoute, et l'autopilote se remettrait à
   * composer dans le vide en toute confiance. La garde qu'on ajoute doit être
   * au moins aussi dure que ce qu'elle autorise.
   */
  const src = sansCommentaires(lire("app/api/voice/presence/route.ts"));
  assert.match(src, /CRON_SECRET/, "le POST doit exiger un secret");
  assert.match(src, /safeEqual/, "…comparé en temps constant, comme le cron");
  assert.match(src, /if \(!autorise\(req\)\)/, "et le refus doit précéder toute écriture");

  // La table refuse aussi la clé anonyme.
  const sql = lire("supabase/migrations/005-presence-agent.sql");
  assert.match(sql, /enable row level security/, "RLS activée");
  assert.ok(!/create policy/i.test(sql), "aucune politique : seul le service role écrit");
});

test("⚠ l'agent bat vraiment, et son absence de configuration se DIT", () => {
  /**
   * Le module serveur peut être parfait : sans l'émetteur, il rend `inconnu`
   * pour toujours et l'autopilote ne part jamais. C'est le défaut récurrent du
   * dépôt, appliqué à la garde qui vient de le corriger ailleurs.
   *
   * Et le cas « pas configuré » doit être BRUYANT côté agent : sinon on lance
   * l'agent, on voit qu'il tourne, et on ne comprend pas pourquoi rien
   * n'appelle.
   */
  const py = lire("voice/agent.py");
  assert.match(py, /def demarrer_battement\(\)/, "l'agent doit savoir s'annoncer");
  assert.match(py, /demarrer_battement\(\)\n\s*cli\.run_app/, "…et le faire au démarrage, pas seulement le définir");
  assert.match(py, /api\/voice\/presence/, "il doit viser la bonne route");
  assert.match(py, /L'autopilote refusera de composer/, "le cas non configuré doit se dire à l'écran");

  // Pas de dépendance nouvelle : la maison n'en ajoute pas pour poster un JSON.
  assert.ok(!/^import requests/m.test(py), "urllib de la stdlib suffit");
});
