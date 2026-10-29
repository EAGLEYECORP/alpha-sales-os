import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { NextRequest } from "next/server";
import { CONFIGURATION_ALPHA_VEND_ALPHA as C } from "../lib/alpha-vend-alpha";
import { codeNafValide } from "../lib/naf";
import { lireZone } from "../lib/trouver-clients";
import { profilExploitable } from "../lib/profil-operateur";
import { imapSaisiAcceptable } from "../lib/identifiants-assistes";
import { preRequis } from "../lib/autopilote-inscrit";
import { signataire } from "../lib/signature";
import { GET } from "../app/api/autopilote/configuration/route";

/**
 * ALPHA VEND ALPHA — la configuration du maître, servie par le serveur.
 * Elle doit (1) être EXPLOITABLE par le vrai pilote, (2) n'aller qu'au maître,
 * (3) ne jamais descendre dans un fichier client, (4) ne rien lancer.
 */

const RACINE = process.cwd().endsWith(".test-build") ? join(process.cwd(), "..") : process.cwd();
const sansComptes = () => {
  for (const k of ["SITE_PASSWORD", "NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_JWT_SECRET", "REQUIRE_AUTH", "ALPHA_INSTALLATION"]) delete process.env[k];
};

test("la configuration passe les pré-requis du VRAI pilote — sauf les deux secrets qui sont à lui", () => {
  assert.ok(C.autopilote.activites.length > 0 && C.autopilote.activites.every(codeNafValide));
  assert.ok(lireZone(C.autopilote.zone).ok);
  assert.ok(profilExploitable(C.profil));
  const manques = preRequis({ metier: C.profil.metier, reglages: C.autopilote, boite: true, cleDropcontact: false })
    .filter((p) => !p.ok)
    .map((p) => p.id);
  assert.deepEqual(manques, ["cle"], "seule la clé Dropcontact (secret à lui) doit manquer");
});

test("le serveur de lecture est du domaine du SMTP d'Amen — sinon le mot de passe ne part pas", () => {
  assert.ok(C.autopilote.imapHost);
  assert.ok(imapSaisiAcceptable(C.autopilote.imapHost!, "smtp-fr.securemail.pro"));
});

test("⚠ elle ne LANCE rien, et ne porte aucun secret", () => {
  assert.ok(!("actif" in C.autopilote), "lancer reste un geste humain");
  const texte = JSON.stringify(C);
  assert.doesNotMatch(texte, /api[-_ ]?key|password|mot de passe|secret|token|https?:\/\//i);
  assert.ok(C.autopilote.envoisParJour <= 5, "au-dessus du palier de la première semaine, ce ne sont que des 429");
});

test("⚠⚠ la route ne sert qu'au MAÎTRE : un déploiement sans serrure (gratuit) reçoit 403", async () => {
  const nodeEnv = process.env.NODE_ENV;
  sansComptes();
  try {
    Object.assign(process.env, { NODE_ENV: "production" });
    const refus = await GET(new NextRequest("https://alpha.exemple.test/api/autopilote/configuration"));
    assert.equal(refus.status, 403);
    assert.doesNotMatch(await refus.text(), /immobili|68\.31Z/);

    Object.assign(process.env, { NODE_ENV: "test" }); // solo de développement = maître
    const ok = await GET(new NextRequest("https://alpha.exemple.test/api/autopilote/configuration"));
    assert.equal(ok.status, 200);
    assert.deepEqual(await ok.json(), JSON.parse(JSON.stringify(C)));
  } finally {
    Object.assign(process.env, { NODE_ENV: nodeEnv });
  }
});

test("⚠⚠ notre cible ne descend jamais dans le navigateur : aucun fichier client n'IMPORTE le module (un `import type` s'efface)", () => {
  const fichiers: string[] = [];
  const parcourir = (d: string) => {
    for (const n of readdirSync(d)) {
      const p = join(d, n);
      if (statSync(p).isDirectory()) parcourir(p);
      else if (/\.(ts|tsx)$/.test(n)) fichiers.push(p);
    }
  };
  for (const d of ["app", "components", "lib"]) parcourir(join(RACINE, d));
  const fautifs = fichiers.filter((f) => {
    const src = readFileSync(f, "utf8");
    if (!/^["']use client["']/m.test(src) && !/useState|useEffect/.test(src)) return false;
    return /^import\s+(?!type\b)[^;]*["']@\/lib\/alpha-vend-alpha["']/m.test(src);
  });
  assert.deepEqual(fautifs, []);
  // Et l'écran l'utilise bien — sinon la configuration serait un module mort.
  const page = readFileSync(join(RACINE, "app/(app)/autopilote/page.tsx"), "utf8");
  assert.match(page, /\/api\/autopilote\/configuration/);
});

test("sans nom saisi, les emails signent la SOCIÉTÉ — jamais « Le Closer », jamais un prénom inventé", () => {
  // L'écran efface le libellé d'usine ; la signature retombe alors sur la société.
  assert.deepEqual(signataire("", C.agencyName), { nom: "EAGLEYE CORP", usine: false });
  const page = readFileSync(join(RACINE, "app/(app)/autopilote/page.tsx"), "utf8");
  assert.match(page, /settings\.closerName === CLOSER_USINE \? \{ closerName: "" \}/);
  assert.ok(!("closerName" in C), "aucun nom humain dans la configuration");
});
