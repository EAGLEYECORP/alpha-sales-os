import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { CADRAGE_VIDE, creneauPasse, lireCadrage, peutEmettreDevis, type EtatCadrage } from "../lib/cadrage";
import { POST } from "../app/api/catalogue/route";

/**
 * ─────────────────────────────────────────────────────────────────────
 * LA RÈGLE ÉTAIT BRANCHÉE SUR LE CHEMIN MORT — 17/09/2026.
 *
 * ══ CE QUI A ÉTÉ MESURÉ ══
 *
 * « Cadrage OBLIGATOIRE avant devis » est dans la doctrine depuis des semaines,
 * et `peutEmettreDevis` l'exécute correctement. Son SEUL appelant applicatif
 * était `renderDevis` — un export que **personne n'importe** (vérifié :
 * `grep -rn renderDevis` ne rend que le module et son test).
 *
 * Pendant ce temps, le devis qui PART réellement est `quoteText` : un texte
 * titré `DEVIS — <client>`, daté, avec quinze jours de validité, fabriqué par
 * `/api/catalogue` et copié depuis la fiche par le panneau « Devis à la
 * carte ». Il ne posait la question à personne.
 *
 * ⚠ Le défaut récurrent du dépôt, avec une aggravation : la règle n'était pas
 * seulement branchée à un endroit sur deux — l'endroit branché était le MORT.
 * Un lecteur de `lib/cadrage.ts` en concluait que la porte tenait.
 *
 * ⚠⚠ Et `EtatCadrage` n'avait AUCUN PRODUCTEUR. Aucun champ de la fiche ne le
 * portait : même en appelant la règle, il n'y avait rien à lui donner. Poser la
 * garde sans l'endroit où consigner aurait fabriqué un mur, et un outil qui
 * refuse sans issue se contourne — en recopiant la grille à la main,
 * c'est-à-dire en se trompant de montant au dernier mètre.
 *
 * ══ CE QUE CE FICHIER TESTE, ET POURQUOI IL APPELLE LA VRAIE ROUTE ══
 *
 * Il exécute `POST /api/catalogue`, pas une imitation. Une assertion sur le
 * texte source (« la route importe bien `peutEmettreDevis` ») serait satisfaite
 * par un import inutilisé. Le dépôt a déjà payé ça quatre fois avec les 422 de
 * `validation-partenaire` : on asserte la CONDITION, jamais la présence du
 * refus.
 * ─────────────────────────────────────────────────────────────────────
 */

const CADRAGE_COMPLET: EtatCadrage = {
  creneauIso: "2026-09-15T10:00:00.000Z",
  reelementTenu: true,
  validePar: "Zakaria",
};

async function devis(cadrage: unknown) {
  const res = await POST(
    new Request("http://local/api/catalogue", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ bricks: ["crm"], client: "Client (démo)", cadrage }),
    }),
  );
  return (await res.json()) as {
    texte: string;
    quote: { setupHT: number } | null;
    pack: { setupHT: number } | null;
    cadrage: { autorise: boolean; manquants: string[]; motif: string };
  };
}

test("⚠⚠ SANS CADRAGE, LE DOCUMENT NE SE FABRIQUE PAS — sur la vraie route", async () => {
  const sans = await devis(null);
  assert.equal(sans.texte, "", "aucun texte de devis ne doit sortir sans cadrage");
  assert.equal(sans.cadrage.autorise, false);
  assert.equal(sans.cadrage.manquants.length, 3, "les trois conditions manquent, et elles sont nommées");

  const avec = await devis(CADRAGE_COMPLET);
  assert.ok(avec.texte.includes("DEVIS —"), "cadrage complet : le document se fabrique");
  assert.equal(avec.cadrage.autorise, true);
});

test("⚠⚠ LE CHIFFRAGE SURVIT AU REFUS — on ne coupe pas l'outil, on retient le document", async () => {
  /**
   * La distinction qui empêche cette garde de se faire contourner. Ce qu'on
   * refuse est le DOCUMENT QUI PART. Les nombres sont ses prix appliqués à son
   * dossier : chiffrer pour soi n'est pas émettre.
   *
   * Couper les nombres aussi transformerait une discipline commerciale en
   * panne d'outil — et devant un outil en panne, on recopie la grille à la
   * main. C'est exactement l'erreur de montant que le cadrage existe pour
   * éviter.
   */
  const sans = await devis(null);
  assert.ok(sans.quote && sans.quote.setupHT > 0, "le chiffrage reste lisible malgré le refus");
  assert.ok(sans.pack && sans.pack.setupHT > 0, "l'ancre pack aussi");

  /**
   * ⚠ ET CE N'EST PAS UNE COMMODITÉ : deux AUTRES écrans appellent ce POST et
   * ne lisent QUE les nombres — le calculateur de `/offre` et le prix du deck
   * (`lib/client-catalogue.ts`). Couper le chiffrage sur un dossier non cadré
   * les aurait cassés tous les deux, très loin de l'intention, et pour une
   * règle qui ne les concerne pas. Mesuré en lisant leurs appels, pas supposé.
   */
});

test("⚠ LE VERDICT VOYAGE AUSSI QUAND C'EST BON", async () => {
  /**
   * Sinon l'appelant ne peut pas distinguer « autorisé » de « cette route ne
   * connaît pas la règle » — et c'est comme ça qu'on rebranche un second
   * chemin sans garde en croyant que le premier n'en avait pas.
   */
  const avec = await devis(CADRAGE_COMPLET);
  assert.equal(typeof avec.cadrage?.autorise, "boolean");
  assert.deepEqual(avec.cadrage.manquants, []);
});

test("⚠⚠ CHAQUE CONDITION BLOQUE SEULE — et les trois sont distinctes", async () => {
  /**
   * « Un rendez-vous est posé » n'est pas « le cadrage a eu lieu », et « le
   * cadrage a eu lieu » n'est pas « on a validé qu'on y va ». Les confondre
   * produit le devis envoyé après un appel de dix minutes où personne n'a rien
   * décidé.
   */
  for (const manque of [{ creneauIso: null }, { reelementTenu: false }, { validePar: null }]) {
    const d = await devis({ ...CADRAGE_COMPLET, ...manque });
    assert.equal(d.texte, "", `${JSON.stringify(manque)} : aucun document ne doit sortir`);
    assert.equal(d.cadrage.manquants.length, 1, "une seule condition manque, et c'est elle qui est nommée");
  }
});

test("⚠⚠ UN CADRAGE ILLISIBLE VAUT REFUS — jamais l'inverse", () => {
  /**
   * `JSON.parse` rend `any`. Sans filtre, `{ reelementTenu: "non" }` passerait
   * pour vrai (chaîne non vide), et un dossier non cadré émettrait un devis en
   * ayant l'air parfaitement normal.
   *
   * ⚠ C'est le même arbitrage que `presence-agent` : l'inconnu ne se contente
   * pas de se dire, il BLOQUE. Ne pas émettre coûte dix secondes de saisie ;
   * émettre un devis non cadré coûte une renégociation à la livraison.
   */
  assert.deepEqual(lireCadrage(undefined), CADRAGE_VIDE);
  assert.deepEqual(lireCadrage("oui"), CADRAGE_VIDE);
  assert.deepEqual(lireCadrage({ reelementTenu: "non" }), CADRAGE_VIDE);
  assert.deepEqual(lireCadrage({ reelementTenu: 1 }), CADRAGE_VIDE);
  assert.equal(lireCadrage({ validePar: "   " }).validePar, null, "un nom d'espaces n'est pas un nom");

  // ⚠ « jeudi » n'est pas un créneau : la règle dit date ET HEURE décidées.
  assert.equal(lireCadrage({ creneauIso: "jeudi" }).creneauIso, null);
  assert.equal(lireCadrage({ creneauIso: "" }).creneauIso, null);
  assert.equal(lireCadrage({ creneauIso: 1758000000000 }).creneauIso, null, "un nombre n'est pas une date ISO");

  // Et un cadrage bien formé traverse intact.
  assert.deepEqual(lireCadrage(CADRAGE_COMPLET), CADRAGE_COMPLET);
  assert.equal(peutEmettreDevis(lireCadrage(CADRAGE_COMPLET)).autorise, true);
});

test("⚠⚠ ON NE DÉCLARE PAS TENUE UNE VISIO À VENIR", () => {
  /**
   * Trois cases cochées en dix secondes rendent la règle décorative — pire que
   * pas de règle, parce qu'on croit alors être protégé. « Le cadrage a eu
   * lieu » est un point DÉCLARATIF, et la doctrine des paliers est nette : un
   * point déclaratif ne s'offre pas tant que sa condition n'existe pas.
   */
  const t = Date.parse("2026-09-17T12:00:00.000Z");
  assert.equal(creneauPasse({ ...CADRAGE_COMPLET, creneauIso: "2026-09-20T10:00:00.000Z" }, t), false);
  assert.equal(creneauPasse({ ...CADRAGE_COMPLET, creneauIso: "2026-09-15T10:00:00.000Z" }, t), true);
  assert.equal(creneauPasse(CADRAGE_VIDE, t), false, "pas de créneau : rien à déclarer");
  assert.equal(creneauPasse({ ...CADRAGE_COMPLET, creneauIso: "jeudi" }, t), false);

  /**
   * ⚠ ET L'HORLOGE EST INJECTÉE. Une fonction qui lirait `Date.now()` rendrait
   * un test qui devient vert TOUT SEUL le jour où la date fixe est dépassée —
   * c'est le piège qui dormait déjà dans `tests/cadrage.test.ts`, dont la
   * fixture porte un créneau au 20/09/2026.
   */
  const src = readFileSync(join(process.cwd(), "lib/cadrage.ts"), "utf8").replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, "");
  assert.ok(!/Date\.now\(\)/.test(src), "lib/cadrage.ts ne lit jamais l'horloge : elle se reçoit");
});

test("⚠⚠ IL N'EXISTE QU'UN SEUL FABRICANT DE DEVIS", () => {
  /**
   * La question que ce dépôt pose à chaque règle : *combien d'endroits la
   * posent, et répondent-ils tous pareil ?* Un second appelant de `quoteText`
   * serait une deuxième porte, et celle-là n'aurait pas de garde — c'est
   * exactement l'état qu'on vient de corriger.
   */
  const sansCommentaires = (s: string) => s.replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, "");
  const fabricants: string[] = [];
  const parcourir = (dir: string) => {
    for (const e of readdirSync(join(process.cwd(), dir), { withFileTypes: true })) {
      if (e.name === "node_modules" || e.name.startsWith(".")) continue;
      const rel = `${dir}/${e.name}`;
      if (e.isDirectory()) parcourir(rel);
      else if (/\.tsx?$/.test(e.name) && /quoteText\s*\(/.test(sansCommentaires(readFileSync(join(process.cwd(), rel), "utf8")))) {
        fabricants.push(rel);
      }
    }
  };
  for (const racine of ["app", "components", "lib"]) parcourir(racine);

  assert.deepEqual(
    fabricants.sort(),
    ["app/api/catalogue/route.ts", "lib/bricks.ts"],
    "seuls le module qui définit et la route qui arbitre peuvent fabriquer un devis",
  );
});

test("⚠⚠ LE CHAMP QU'ON VÉRIFIE NE SE PRÉ-REMPLIT PAS", () => {
  /**
   * La tentation était de mettre `settings.closerName` dans « validé par » :
   * c'est presque toujours la bonne réponse. Ç'aurait satisfait la troisième
   * condition par CONFIGURATION et non par un ACTE — au premier créneau saisi,
   * deux conditions sur trois se seraient remplies sans que personne ne décide
   * rien, et la garde n'aurait plus rien gardé.
   */
  const panneau = readFileSync(join(process.cwd(), "components/prospects/cadrage-panel.tsx"), "utf8").replace(
    /\/\*[\s\S]*?\*\/|\/\/.*$/gm,
    "",
  );
  assert.ok(!/useAlpha|settings|closerName/.test(panneau), "le panneau ne lit aucun réglage : il consigne un acte");

  // La case « tenu » est fermée tant que le créneau n'est pas passé.
  assert.match(panneau, /disabled=\{!passe\}/);
  // Et reprogrammer le créneau invalide la déclaration : un tampon qui survit
  // à la réécriture atteste d'une rencontre qui n'a pas eu lieu
  // (même défaut que `perimee` dans `validation-partenaire`).
  assert.match(panneau, /creneauIso:[^,]+,\s*reelementTenu: false/);
});
