import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { NextRequest } from "next/server";
import { middleware } from "../middleware";
import { pageOuverteAuVisiteur } from "../lib/entitlements";

/**
 * ─────────────────────────────────────────────────────────────────────
 * ESSAYER SANS COMPTE (27/10/2026) — les écrans gratuits s'ouvrent au visiteur.
 *
 * Mesuré en production le jour même : toute page de l'app renvoyait un
 * visiteur sans session vers `/compte`, puis exigeait un email confirmé. Six
 * comptes en tout, aucun depuis le 13/10. Ces tests APPELLENT le middleware :
 * la porte s'ouvre sur les PAGES gratuites, et sur rien d'autre.
 * ─────────────────────────────────────────────────────────────────────
 */

function avecEnv(vars: Record<string, string | undefined>, fn: () => Promise<void>): () => Promise<void> {
  return async () => {
    const avant: Record<string, string | undefined> = {};
    for (const k of Object.keys(vars)) {
      avant[k] = process.env[k];
      if (vars[k] === undefined) delete process.env[k];
      else process.env[k] = vars[k];
    }
    try {
      await fn();
    } finally {
      for (const k of Object.keys(vars)) {
        if (avant[k] === undefined) delete process.env[k];
        else process.env[k] = avant[k];
      }
    }
  };
}

const lire = (f: string) => readFileSync(join(process.cwd(), f), "utf8");

const COMPTES = {
  SUPABASE_JWT_SECRET: "secret-de-test-hs256-0123456789abcdef",
  NEXT_PUBLIC_SUPABASE_URL: "https://exemple.supabase.co",
  SUPABASE_SERVICE_ROLE_KEY: undefined,
  SITE_PASSWORD: undefined,
  REQUIRE_AUTH: undefined,
  OWNER_EMAILS: undefined,
  ALPHA_INSTALLATION: undefined,
};

/** La requête a-t-elle TRAVERSÉ le middleware (ni redirection, ni refus) ? */
function traverse(r: Response): boolean {
  return r.status === 200 && r.headers.get("location") === null;
}

const ECRANS_GRATUITS = ["/aujourdhui", "/pipeline", "/appels", "/linkedin", "/cerveau", "/closer"];

test(
  "⚠⚠ un visiteur SANS compte ouvre les écrans gratuits — il n'est plus renvoyé vers /compte",
  avecEnv(COMPTES, async () => {
    for (const p of ECRANS_GRATUITS) {
      const r = await middleware(new NextRequest(`https://alpha.exemple${p}`));
      assert.ok(traverse(r), `${p} : ${r.status} ${r.headers.get("location") ?? ""}`);
    }
  })
);

test(
  "…mais un écran PAYANT reste derrière le compte, et la raison le dit",
  avecEnv(COMPTES, async () => {
    const r = await middleware(new NextRequest("https://alpha.exemple/campaigns"));
    assert.match(r.headers.get("location") ?? "", /\/compte\?bloque=%2Fcampaigns&raison=sans-session$/);
  })
);

test(
  "…et NOTRE exploitation aussi (écran maître seul)",
  avecEnv(COMPTES, async () => {
    const r = await middleware(new NextRequest("https://alpha.exemple/moniteur"));
    assert.ok(!traverse(r), "/moniteur ne s'ouvre pas à un visiteur");
  })
);

test(
  "⚠⚠ AUCUNE API ne s'ouvre au visiteur — pas même celle d'un écran gratuit",
  avecEnv(COMPTES, async () => {
    /**
     * L'écran gratuit lit le CRM du NAVIGATEUR ; ses API lisent et écrivent
     * côté serveur. Ouvrir la page n'ouvre pas la donnée : c'est toute la
     * différence entre ce changement et un relâchement de `autorise`.
     */
    for (const api of ["/api/crm", "/api/brain", "/api/import"]) {
      const r = await middleware(new NextRequest(`https://alpha.exemple${api}`));
      assert.ok(!traverse(r), `${api} répond ${r.status} à un visiteur`);
    }
  })
);

test(
  "…et avec REQUIRE_AUTH, la réponse est le 401 « compte requis »",
  avecEnv({ ...COMPTES, REQUIRE_AUTH: "1" }, async () => {
    const r = await middleware(new NextRequest("https://alpha.exemple/api/crm"));
    assert.equal(r.status, 401);
    // La page, elle, s'ouvre toujours : REQUIRE_AUTH garde les API.
    assert.ok(traverse(await middleware(new NextRequest("https://alpha.exemple/aujourdhui"))));
  })
);

test(
  "une installation « chez vous » reste réservée à SES comptes",
  avecEnv({ ...COMPTES, ALPHA_INSTALLATION: "client" }, async () => {
    const r = await middleware(new NextRequest("https://alpha.exemple/aujourdhui"));
    assert.ok(!traverse(r), "le serveur privé d'une équipe n'est pas une vitrine");
  })
);

test("pageOuverteAuVisiteur : des PAGES gratuites, jamais une API", () => {
  assert.equal(pageOuverteAuVisiteur("/aujourdhui"), true);
  assert.equal(pageOuverteAuVisiteur("/campaigns"), false);
  assert.equal(pageOuverteAuVisiteur("/api/crm"), false);
  /**
   * ⚠ LA MUTATION L'A DIT : retirer la garde `/api/` ne fait tomber aucune
   * assertion de comportement. Sondé le 27/10/2026 : aucune clé de
   * `CHEMIN_PAR_API` n'est ouverte par `autorise(DROIT_GRATUIT, …)` — un chemin
   * d'API brut n'est jamais une page connue. La garde est donc une CEINTURE
   * pour demain (une entrée `/api/…` dans la carte des chemins, un appelant qui
   * passerait le chemin métier), pas une protection active aujourd'hui. On
   * fige sa présence, en première ligne, plutôt que de prétendre la mesurer.
   * Le vrai risque — le chemin MÉTIER d'une API d'écran gratuit — est tenu par
   * le test « aucune API ne s'ouvre au visiteur », qui, lui, mord.
   */
  const src = lire("lib/entitlements.ts");
  assert.match(
    src,
    /export function pageOuverteAuVisiteur\(pathname: string\): boolean \{\s*if \(pathname\.startsWith\("\/api\/"\)\) return false;/
  );
});

// ══════════ L'ÉCRAN DE CONNEXION (composant client : lu à la source) ══════════

const sansCommentaires = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "").replace(/\{\/\*[\s\S]*?\*\/\}/g, "");
const gate = sansCommentaires(lire("components/security/auth-gate.tsx"));

test("⚠⚠ le mur ne se ferme plus sur « le serveur a des comptes » : il protège un navigateur qui en a PORTÉ un", () => {
  assert.match(
    gate,
    /Boolean\(requireAuth\) \|\| \(dejaVu && serveur\?\.compteRequis !== false\)/,
    "mur = réglage du poste OU navigateur déjà connecté — et une panne du serveur ne le lève pas"
  );
  // Une session vue marque le navigateur.
  assert.match(gate, /if \(!user\) return;\s*marquerCompteVu\(\);/);
  // Les deux traces : notre marque, et la clé de session de Supabase.
  assert.match(gate, /\^sb-\.\+-auth-token\$/);
});

test("le visiteur voit l'app ET un bandeau qui dit ce qui est vrai sans compte", () => {
  assert.match(gate, /\{visiteur && <BandeauVisiteur \/>\}/);
  assert.match(gate, /Sans compte : tes fiches restent dans ce navigateur\./);
  // On ne promet pas de retrouver ses fiches ailleurs : un compte gratuit ne le fait pas.
  assert.doesNotMatch(gate, /autre appareil|tous tes appareils|partout/);
});

test("« Continuer sans compte » n'existe que là où le mur est OUVERT", () => {
  assert.match(gate, /\{!murFerme && \(\s*<button className="btn-ghost mt-4 w-full" onClick=\{continuerSansCompte\}>/);
});

// ══════════ CE QUE LE VISITEUR VOYAIT EN PREMIER (vu au rendu, 27/10/2026) ══════════

test("⚠⚠ un verdict de droits NON PROUVÉ n'ouvre jamais l'assistant de NOTRE pile", () => {
  /**
   * Le visiteur reçoit 401 sur `/api/compte/droits` ; `chargerDroits` rend
   * alors l'optimisme d'attente (maître, solo) — et l'assistant « Google
   * Sheets = la mémoire, n8n = le cerveau » barrait son premier écran.
   */
  const onboarding = sansCommentaires(lire("components/onboarding.tsx"));
  assert.match(onboarding, /if \(!vivant \|\| !estProuve\(d\)\) return;/);
  const droits = sansCommentaires(lire("lib/use-droits.ts"));
  assert.match(droits, /export function estProuve\(d: Droits\): boolean \{\s*return d !== OPTIMISTE;/);
});

test("⚠ NOTRE plan de traction (cible, taux de juillet) ne s'affiche qu'au maître PROUVÉ", () => {
  const bandeau = sansCommentaires(lire("components/traction/bandeau-traction.tsx"));
  assert.match(bandeau, /const maitre = useMaitreProuve\(\);\s*if \(!maitre\) return null;/);
  // Pessimiste : `useDroits` (optimiste) l'aurait servi pendant le chargement.
  assert.doesNotMatch(bandeau, /useDroits\(/);
});

test("⚠⚠ un 401 sur les droits est une RÉPONSE (visiteur), pas une panne (optimisme maître)", () => {
  const droits = sansCommentaires(lire("lib/use-droits.ts"));
  assert.match(droits, /if \(r\.status === 401\) \{\s*enCours = null;\s*return VISITEUR;/);
  // Le visiteur reçoit le socle gratuit importé, jamais le maître.
  assert.match(droits, /const VISITEUR: Droits = \{\s*session: false,\s*bricks: \[\.\.\.BRIQUES_GRATUITES\],\s*statut: "actif",\s*maitre: false,\s*solo: false,/);
});
