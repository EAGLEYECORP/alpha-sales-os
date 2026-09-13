import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { urlPublique, baseMetadonnees, URL_DEV } from "../lib/url-publique";

/**
 * ─────────────────────────────────────────────────────────────────────
 * Ce que ce fichier protège, et pourquoi la partie « branchement » compte
 * PLUS que la partie « calcul ».
 *
 * Le module rendait déjà la bonne réponse avant d'exister — n'importe qui sait
 * écrire `process.env.APP_BASE_URL || "..."`. Ce qui manquait, c'est que
 * QUELQU'UN LA LISE au bon endroit. Le défaut trouvé au rendu était exactement
 * celui-là : trois layouts déclaraient des `og:image`, aucun ne déclarait la
 * base contre laquelle les résoudre.
 * ─────────────────────────────────────────────────────────────────────
 */

const RACINE = readFileSync(join(process.cwd(), "app/layout.tsx"), "utf8");
const VITRINE = readFileSync(join(process.cwd(), "app/vitrine/layout.tsx"), "utf8");
const SOUSCRIRE = readFileSync(join(process.cwd(), "app/souscrire/layout.tsx"), "utf8");

test("⚠⚠ LA RACINE DÉCLARE metadataBase, ET ELLE LE PREND DU MODULE", () => {
  // On ne cherche pas la CHAÎNE « metadataBase » : `metadataBase: new URL("http://localhost:3000")`
  // la contiendrait et réintroduirait le défaut mot pour mot. On exige le
  // branchement sur la seule fonction qui sait lire l'environnement.
  assert.match(
    RACINE,
    /metadataBase:\s*baseMetadonnees\(\)/,
    "app/layout.tsx doit poser `metadataBase: baseMetadonnees()` — sans quoi tout og:image du site est résolu contre localhost dans le HTML livré",
  );
  assert.match(
    RACINE,
    /import\s*\{[^}]*baseMetadonnees[^}]*\}\s*from\s*"@\/lib\/url-publique"/,
    "le symbole doit venir de lib/url-publique, pas d'une redéfinition locale",
  );
});

test("⚠ UNE SEULE DÉFINITION : aucun layout enfant ne repose la question", () => {
  // Next fait hériter `metadataBase`. Trois endroits qui décident de la même
  // chose finiraient par diverger, et c'est celui qu'on ne relit pas qui
  // mentirait — la page où l'on ACHÈTE, en l'occurrence.
  for (const [nom, source] of [
    ["app/vitrine/layout.tsx", VITRINE],
    ["app/souscrire/layout.tsx", SOUSCRIRE],
  ] as const) {
    assert.ok(
      !/metadataBase/.test(source),
      `${nom} ne doit PAS redéclarer metadataBase : il en hérite de la racine`,
    );
  }
});

test("⚠ LES DEUX PAGES PUBLIQUES ONT UNE VIGNETTE, ET LE FICHIER EXISTE", () => {
  // Contre-test du précédent. Si ces pages perdaient leurs balises Open Graph,
  // le test ci-dessus passerait au vert pour la pire des raisons : il n'y
  // aurait plus rien à mal résoudre.
  //
  // ⚠⚠ ET ON VA JUSQU'AU FICHIER. Une base absolue qui pointe vers une image
  // supprimée donne exactement le même résultat visible qu'un localhost — une
  // carte sans vignette — pour une cause différente. Corriger l'URL sans
  // vérifier la cible aurait été une correction creuse, et elle aurait eu
  // l'air faite.
  for (const [nom, source] of [
    ["app/vitrine/layout.tsx", VITRINE],
    ["app/souscrire/layout.tsx", SOUSCRIRE],
  ] as const) {
    assert.match(source, /openGraph/, `${nom} doit porter des balises Open Graph`);
    assert.match(source, /alternates:\s*\{\s*canonical/, `${nom} doit porter un canonical`);

    const images = [...source.matchAll(/url:\s*"(\/media\/[^"]+)"|images:\s*\["(\/media\/[^"]+)"\]/g)]
      .map((m) => m[1] ?? m[2])
      .filter((v): v is string => Boolean(v));
    assert.ok(
      images.length > 0,
      `${nom} : page publique SANS og:image — partagée sur LinkedIn, elle sort en carte nue`,
    );
    for (const img of new Set(images)) {
      assert.ok(
        existsSync(join(process.cwd(), "public", img)),
        `${nom} annonce ${img}, qui n'existe pas dans public/ — la vignette serait vide malgré une URL correcte`,
      );
    }
  }
});

test("l'ordre de repli reprend celui des routes d'API : APP_BASE_URL d'abord", () => {
  assert.equal(
    urlPublique({ APP_BASE_URL: "https://a.example", NEXT_PUBLIC_APP_URL: "https://b.example", VERCEL_URL: "c.example" }),
    "https://a.example",
  );
  assert.equal(
    urlPublique({ NEXT_PUBLIC_APP_URL: "https://b.example", VERCEL_URL: "c.example" }),
    "https://b.example",
  );
  assert.equal(urlPublique({ VERCEL_URL: "c.example" }), "https://c.example");
});

test("⚠ VERCEL_URL arrive SANS protocole — la passer nue ferait tomber le build", () => {
  // `new URL("mon-app.vercel.app")` jette. Une métadonnée qui jette ne dégrade
  // pas l'affichage : elle casse `next build` en entier.
  assert.equal(urlPublique({ VERCEL_URL: "mon-app.vercel.app" }), "https://mon-app.vercel.app");
  assert.doesNotThrow(() => baseMetadonnees({ VERCEL_URL: "mon-app.vercel.app" }));
});

test("⚠ une variable POSÉE MAIS VIDE n'est pas une adresse", () => {
  // Précédent dans ce dépôt : `SITE_PASSWORD=""` qui n'est pas une serrure.
  // Même piège, même correction — le `.trim()` et pas un `??`.
  assert.equal(
    urlPublique({ APP_BASE_URL: "   ", NEXT_PUBLIC_APP_URL: "https://vrai.example" }),
    "https://vrai.example",
  );
});

test("⚠ une valeur ILLISIBLE se refuse, elle ne fait pas tomber le build", () => {
  assert.doesNotThrow(() => urlPublique({ APP_BASE_URL: "http://[pas une url" }));
  assert.equal(
    urlPublique({ APP_BASE_URL: "http://[pas une url", VERCEL_URL: "repli.example" }),
    "https://repli.example",
  );
});

test("le `/` final est retiré — sinon la vignette devient //media", () => {
  assert.equal(urlPublique({ APP_BASE_URL: "https://a.example/" }), "https://a.example");
  // Le rendu final : c'est CE calcul que Next applique aux og:image.
  assert.equal(
    new URL("/media/hero-poster.jpg", baseMetadonnees({ APP_BASE_URL: "https://a.example/" })).href,
    "https://a.example/media/hero-poster.jpg",
  );
});

test("sans aucune variable, on retombe sur le dev — et JAMAIS ailleurs", () => {
  // Important : on ne code pas un domaine de repli « au cas où ». Le produit
  // est white-label ; remettre notre domaine dans le HTML d'un client serait
  // exactement le défaut que `lib/signature.ts` a déjà payé quatre fois.
  assert.equal(urlPublique({}), URL_DEV);
  assert.ok(!/eagleye/i.test(readFileSync(join(process.cwd(), "lib/url-publique.ts"), "utf8")), "aucun domaine maison en repli : le produit est white-label");
});
