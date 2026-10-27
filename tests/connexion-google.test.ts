import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { googleActif } from "../lib/auth";

/**
 * ─────────────────────────────────────────────────────────────────────
 * « CONTINUER AVEC GOOGLE » (27/10/2026) — décision de Zakaria.
 *
 * L'inscription exigeait un email confirmé (`mailer_autoconfirm: false`, lu en
 * production) : 30 envois/h, partis de la boîte de prospection. Google rend une
 * adresse déjà vérifiée et n'envoie rien. Le bouton ne s'affiche que si
 * Supabase sert le fournisseur — sinon un inscrit cliquerait sur une erreur.
 * ─────────────────────────────────────────────────────────────────────
 */

test("googleActif : seul un `external.google === true` explicite ouvre le bouton", () => {
  assert.equal(googleActif({ external: { google: true, email: true } }), true);
  assert.equal(googleActif({ external: { google: false } }), false);
  assert.equal(googleActif({ external: {} }), false);
  // Une réponse inattendue n'ouvre rien : on ne montre pas une porte qu'on n'a pas vue ouverte.
  assert.equal(googleActif({ external: { google: "true" } }), false);
  assert.equal(googleActif(null), false);
  assert.equal(googleActif("google"), false);
});

const lire = (f: string) => readFileSync(join(process.cwd(), f), "utf8");
const sansCommentaires = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "").replace(/\{\/\*[\s\S]*?\*\/\}/g, "");

test("⚠⚠ le bouton n'existe que si le serveur d'authentification sert Google", () => {
  const gate = sansCommentaires(lire("components/security/auth-gate.tsx"));
  assert.match(gate, /\{google && \(\s*<>\s*<button className="btn-bronze mt-4 w-full" onClick=\{versGoogle\}/);
  assert.match(gate, /connexionGoogleDisponible\(\)\.then\(\(ok\) => vivant && setGoogle\(ok\)\)/);
  // Le défaut est FERMÉ : rien n'affiche Google avant la réponse.
  assert.match(gate, /const \[google, setGoogle\] = useState\(false\);/);
});

test("la disponibilité se lit sur /auth/v1/settings, et une panne vaut « non »", () => {
  const auth = sansCommentaires(lire("lib/auth.ts"));
  const i = auth.indexOf("export async function connexionGoogleDisponible");
  const bloc = auth.slice(i, i + 500);
  assert.match(bloc, /\/auth\/v1\/settings/);
  assert.match(bloc, /r\.ok \? googleActif\(await r\.json\(\)\) : false/);
  assert.match(bloc, /catch \{\s*return false;/);
});

test("Google revient au MÊME endroit que la confirmation d'email (une seule entrée de liste blanche)", () => {
  const auth = sansCommentaires(lire("lib/auth.ts"));
  assert.match(auth, /provider: "google",\s*options: \{ redirectTo: urlRetourAuth\("\?bienvenue=1"\) \}/);
  assert.match(auth, /emailRedirectTo: urlRetourAuth\("\?bienvenue=1"\)/);
});
