import { test } from "node:test";
import assert from "node:assert/strict";
import { PLATFORMS, shareIntentUrl, splitThread, fitPlatform } from "../lib/social";
import { buildSimpleMovie } from "../lib/video-gen";

test("social — X pré-remplit texte + url ; LinkedIn/Meta seulement l'url", () => {
  const x = shareIntentUrl("x", { text: "Salut", url: "https://eagleyecorp.fr" });
  assert.ok(x?.includes("twitter.com/intent/tweet"));
  assert.ok(x?.includes("text=Salut"));
  assert.ok(x?.includes("eagleyecorp.fr"));

  const li = shareIntentUrl("linkedin", { text: "ignoré", url: "https://eagleyecorp.fr" });
  assert.ok(li?.includes("linkedin.com/sharing/share-offsite"));
  assert.ok(!li?.includes("ignoré"), "LinkedIn ne pré-remplit pas le texte");

  const meta = shareIntentUrl("meta", { url: "https://eagleyecorp.fr" });
  assert.ok(meta?.includes("facebook.com/sharer"));

  assert.equal(shareIntentUrl("linkedin", {}), null, "sans url, pas d'intent LinkedIn");
});

test("social — un texte court reste un seul tweet", () => {
  assert.deepEqual(splitThread("court message"), ["court message"]);
});

test("social — un texte long devient un fil numéroté, chaque partie ≤ 280", () => {
  const long = "mot ".repeat(200).trim(); // ~800 caractères
  const parts = splitThread(long, 280);
  assert.ok(parts.length > 1, "plusieurs tweets");
  for (const p of parts) assert.ok(p.length <= 280, `chaque tweet ≤ 280 (${p.length})`);
  assert.ok(parts[0].endsWith(`(1/${parts.length})`), "suffixe de fil");
});

test("social — fitPlatform coupe au mot entier avec ellipse", () => {
  const t = "phrase ".repeat(500);
  const out = fitPlatform(t, "x");
  assert.ok(out.length <= PLATFORMS.x.limit + 1);
  assert.ok(out.endsWith("…"));
});

test("video — buildSimpleMovie fait une scène par réplique (max 12)", () => {
  const movie = buildSimpleMovie(["A", "B", "C"], { subtitle: "test" }) as {
    scenes: unknown[];
    resolution: string;
  };
  assert.equal(movie.scenes.length, 3);
  assert.equal(movie.resolution, "instagram-story");
  const many = buildSimpleMovie(Array.from({ length: 30 }, (_, i) => `L${i}`)) as { scenes: unknown[] };
  assert.equal(many.scenes.length, 12, "borné à 12 scènes");
});
