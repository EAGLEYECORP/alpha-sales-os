import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * La liste des chemins publics est un point de bascule silencieux : une
 * omission ne casse rien en local (la porte est désactivée sans
 * SITE_PASSWORD) et casse TOUT en production, sans que le message d'erreur
 * n'ait le moindre rapport avec le mot de passe.
 *
 * Deux cas se sont produits dans ce repo :
 *   · `/api/campaign/tick` — n8n recevait « Accès non autorisé » et
 *     l'autopilote d'appels ne partait jamais ;
 *   · `/sw.js` — le navigateur recevait la redirection HTML vers /gate et
 *     refusait d'enregistrer le service worker, avec une erreur de type MIME.
 *
 * On lit la source plutôt que d'exécuter le middleware (il dépend du runtime
 * Edge) : ça suffit pour verrouiller la liste elle-même.
 */
const src = readFileSync(join(process.cwd(), "middleware.ts"), "utf8");
const bloc = src.slice(src.indexOf("const PUBLIC_PREFIXES"), src.indexOf("function startsWithAny"));
const publics = [...bloc.matchAll(/"(\/[^"]*)"/g)].map((m) => m[1]);

test("chemins publics — tout ce qui est appelé SANS navigateur y figure", () => {
  // Appelés par des tiers qui n'ont aucun cookie : clients mail, fournisseurs,
  // ordonnanceurs. Chacun porte sa propre authentification.
  for (const p of [
    "/api/track/open",
    "/api/track/click",
    "/api/webhooks/inbound",
    "/api/webhooks/stripe",
    "/api/v1",
    "/api/campaign/tick",
    "/api/push/tick",
    "/api/calendar",
  ]) {
    assert.ok(publics.includes(p), `${p} est appelé sans cookie : il doit passer la porte`);
  }
});

test("chemins publics — le service worker et le manifeste passent", () => {
  // Un service worker DOIT arriver en JavaScript. Derrière la porte, le
  // navigateur reçoit du HTML et refuse l'enregistrement.
  assert.ok(publics.includes("/sw.js"));
  // Le manifeste conditionne « ajouter à l'écran d'accueil » — seul chemin
  // vers les notifications sur iPhone.
  assert.ok(publics.includes("/manifest.webmanifest"));
});

test("chemins publics — aucune route de DONNÉES n'y figure par erreur", () => {
  // La liste est un contournement de la porte : tout ce qui lit ou écrit des
  // données client doit rester derrière. `/api/v1` et les crons font
  // exception parce qu'ils portent leur propre clé ET refusent tout sans elle.
  const porteurDeCle = new Set([
    "/api/v1",
    "/api/campaign/tick",
    "/api/push/tick",
    "/api/calendar",
    "/api/webhooks/inbound",
    "/api/webhooks/stripe",
    // Serveur MCP : porte sa propre clé À PORTÉES et refuse tout sans clé
    // configurée. Vérifié pour de vrai plus bas — l'inscrire ici ne suffit pas.
    "/api/mcp",
  ]);
  for (const p of publics) {
    if (!p.startsWith("/api/")) continue;
    if (porteurDeCle.has(p)) continue;
    assert.ok(
      ["/api/track/open", "/api/track/click", "/api/health", "/api/gate"].includes(p),
      `${p} est public sans porter de clé — est-ce voulu ?`
    );
  }
});

test("les routes à clé la vérifient VRAIMENT, pas seulement sur la liste", () => {
  /**
   * L'allowlist ci-dessus est déclarative : y inscrire une route suffirait à
   * la faire passer, même sans authentification. C'est précisément le
   * raccourci qu'on prendrait un soir de rush. On vérifie donc la SOURCE.
   */
  for (const [f, motif] of [
    ["app/api/mcp/route.ts", /autoriserApi\(/],
    ["app/api/v1/prospects/route.ts", /ALPHA_API_KEYS|autoriserApi\(/],
    ["app/api/v1/etat/route.ts", /autoriserApi\(/],
    ["app/api/v1/propositions/route.ts", /autoriserApi\(/],
  ] as const) {
    const src = readFileSync(join(process.cwd(), f), "utf8");
    assert.match(src, motif, `${f} est déclarée « porteuse de clé » mais ne la vérifie pas`);
  }
});

test("MCP — aucun outil ne peut agir, seulement lire et proposer", () => {
  /**
   * C'est LA garde de tout le dispositif. Un agent branché sur un pipe réel
   * doit pouvoir se tromper sans que ça coûte un client. Le jour où un outil
   * envoie un email, cette ligne de diff doit sauter aux yeux en revue.
   */
  const src = readFileSync(join(process.cwd(), "app/api/mcp/route.ts"), "utf8");
  const chemins = [...src.matchAll(/chemin:\s*"([^"]+)"/g)].map((m) => m[1]);
  assert.ok(chemins.length >= 2, "les outils doivent être déclarés avec leur chemin");
  const AUTORISES = ["/api/v1/etat", "/api/v1/propositions"];
  for (const c of chemins) {
    assert.ok(AUTORISES.includes(c), `l'outil MCP appelle ${c} — hors du périmètre lecture/proposition`);
  }
  // Et aucun chemin d'action ne doit apparaître dans le fichier, même commenté
  // en exemple : un exemple se copie.
  assert.doesNotMatch(src, /api\/send|api\/voice\/call|api\/gmail/, "un chemin d'ACTION apparaît dans le serveur MCP");
});

test("les routes de cron exigent leur secret, et refusent tout sans lui", () => {
  // Être public ne veut pas dire ouvert : ces deux routes déclenchent des
  // appels téléphoniques et font vibrer des téléphones.
  for (const f of ["app/api/campaign/tick/route.ts", "app/api/push/tick/route.ts"]) {
    const r = readFileSync(join(process.cwd(), f), "utf8");
    assert.match(r, /CRON_SECRET/, `${f} doit exiger CRON_SECRET`);
    assert.match(r, /if \(!secret\) return false/, `${f} doit refuser quand le secret n'est pas configuré`);
    assert.match(r, /safeEqual/, `${f} doit comparer en temps constant`);
  }
});
