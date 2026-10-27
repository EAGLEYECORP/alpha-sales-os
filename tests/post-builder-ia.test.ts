import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { INTERDITS, verifierNomsEnCapitales } from "./film-outils";

/**
 * ─────────────────────────────────────────────────────────────────────
 * LE POST « CE QUI EMPÊCHE L'IA DE MENTIR » (27/10/2026).
 *
 * Un post de preuve se juge sur ses faits : chacun est recompté ici, dans le
 * dépôt, au lieu d'être cru. S'il cesse d'être vrai, le test tombe AVANT que
 * le post parte — pas après qu'un recruteur l'a vérifié.
 * ─────────────────────────────────────────────────────────────────────
 */

const RACINE = process.cwd();
const postMd = readFileSync(join(RACINE, "marketing/post-builder-ia-2026-10-27.md"), "utf8");
const post = /## Texte du post[\s\S]*?```\n([\s\S]*?)\n```/.exec(postMd)?.[1] ?? "";
const lire = (f: string) => readFileSync(join(RACINE, f), "utf8");

test("le post tient dans LinkedIn et passe par les MÊMES interdits que les films", () => {
  assert.ok(post.length > 400 && post.length <= 3000, `${post.length} caractères`);
  for (const [motif, raison] of INTERDITS) assert.doesNotMatch(post, motif, raison);
  verifierNomsEnCapitales(post);
  assert.doesNotMatch(post, /\bseul\b|\bseule\b/i, "il est écrit avec des agents IA : « seul » serait faux");
  assert.match(post, /avec des agents IA/);
  assert.doesNotMatch(post, /diffusé à la télé|à l'antenne/i);
});

test("⚠⚠ « plus de 2 600 tests » se recompte dans le dépôt", () => {
  const n = readdirSync(join(RACINE, "tests"))
    .filter((f) => f.endsWith(".test.ts"))
    .reduce((s, f) => s + (lire(`tests/${f}`).match(/(?:^|[^.\w])test\(/gm) ?? []).length, 0);
  assert.match(post, /plus de 2 600 tests automatisés/);
  assert.ok(n > 2600, `${n} tests déclarés : « plus de 2 600 » est faux`);
});

test("⚠⚠ chaque garde-fou CITÉ existe dans le code qui l'applique", () => {
  // AI Act, article 50 : la première phrase de l'appel est prononcée par le code.
  assert.match(post, /AI Act, article 50/);
  assert.match(lire("voice/agent.py"), /first_sentence/);
  // Le plafond légal de sollicitations (décret n° 2022-1313).
  assert.match(lire("lib/call-cadence.ts"), /export function plafondRappels\(/);
  // Les mentions obligatoires d'un email, vérifiées sur ce qui part.
  assert.match(lire("lib/conformite.ts"), /export function verifieMentions/);
  // Une campagne bloquée tant qu'un humain n'a pas relu.
  assert.match(lire("components/campaigns/campaign-review.tsx"), /const allReviewed = pending\.length === 0/);
  // Le BODACC : exclusion et remontée en tête.
  assert.match(lire("lib/call-session.ts"), /!exclusionPublique\(p\)/);
  assert.match(lire("lib/call-session.ts"), /momentFrais\(p, now\)/);
  // Le défaut trouvé en tournant le spot existe, corrigé.
  assert.match(lire("lib/ne-pas-ecrire.ts"), /TROUVÉ EN TOURNANT LE SPOT TV/);
});

test("le statut se DIT : prêt et non publié, ou publié avec sa date et son identifiant", () => {
  // Un post TEXTE seul rend un `share` ; un post vidéo, un `ugcPost`. Les deux sont des posts.
  assert.match(postMd, /\*\*Statut : (?:PRÊT, PAS PUBLIÉ|PUBLIÉ le \d{2}\/\d{2}\/\d{4}[^*]*\*\*[\s\S]{0,40}urn:li:(?:ugcPost|share):\d+)/);
});
