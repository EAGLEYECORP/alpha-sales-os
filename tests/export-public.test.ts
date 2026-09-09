import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { join } from "node:path";

/**
 * ─────────────────────────────────────────────────────────────────────
 * L'EXPORT PUBLIC — le garde qui vit ENTRE deux exports.
 *
 * Le script refuse d'écrire quand un fichier autorisé porte un montant, une
 * adresse ou un partenaire. Mais il ne tourne que le jour où quelqu'un le
 * lance : entre-temps, `docs/ARCHITECTURE.md` peut très bien recevoir un
 * tableau de prix, et personne ne l'apprendra avant la prochaine publication.
 *
 * Ces tests déplacent la découverte au moment du `npm test`, c'est-à-dire au
 * moment du commit qui casse la règle — pas six semaines plus tard.
 *
 * ⚠ On importe le SCRIPT, on ne recopie pas ses motifs. Deux définitions de
 * « qu'est-ce qui ne doit pas sortir ? » divergeraient, et c'est la plus
 * permissive qui gagnerait le jour où ça compte.
 * ─────────────────────────────────────────────────────────────────────
 */

interface EntreeAutorisee {
  source: string;
  cible: string;
  pourquoi: string;
}
interface MotifInterdit {
  id: string;
  motif: RegExp;
  pourquoi: string;
  tolere?: RegExp;
}
interface Trouvaille {
  id: string;
  extrait: string;
  ligne: number;
  pourquoi: string;
}
interface Probleme {
  fichier: string;
  id: string;
  ligne?: number;
  extrait?: string;
  pourquoi: string;
}
interface Exporteur {
  AUTORISES: EntreeAutorisee[];
  INTERDITS: MotifInterdit[];
  scanner(contenu: string): Trouvaille | null;
  delier(contenu: string, cible: string, exportees: Set<string>): string;
  verifier(racine?: string): Probleme[];
}

// `require` d'un module ESM : supporté par Node ≥ 22. Le chemin part de
// `process.cwd()` (la racine du dépôt) parce que les tests sont compilés dans
// `.test-build/tests/` — un chemin relatif au fichier source pointerait à côté.
const exporteur = require(join(process.cwd(), "scripts/export-public.mjs")) as Exporteur;

// ═══════════ LA LISTE D'AUTORISATION ═══════════

test("⚠ le dépôt public part d'une AUTORISATION, jamais d'une exclusion", () => {
  /**
   * ⚠ C'EST LE CHOIX QUI REND L'EXPORT SÛR, ET IL EST CONTRE-INTUITIF.
   *
   * Une liste de ce qu'on cache oublie toujours le fichier ajouté la semaine
   * suivante — et un fichier oublié en mode « exporté par défaut » est une
   * fuite qui ne se voit jamais. Même règle que `ACCES_PAR_CHEMIN`, où une
   * page non classée est REFUSÉE.
   *
   * Ce test ne peut pas prouver l'absence d'une liste d'exclusion ; il tient
   * ce qui en découle : chaque sortie est nommée, existe, et porte sa raison.
   */
  assert.ok(exporteur.AUTORISES.length > 0);
  for (const e of exporteur.AUTORISES) {
    assert.ok(existsSync(join(process.cwd(), e.source)), `« ${e.source} » est autorisé mais n'existe pas`);
    assert.ok(
      e.pourquoi.length > 40,
      `« ${e.source} » sort sans raison écrite — la liste cesse d'être une décision et devient une habitude`
    );
  }
});

test("⚠ AUCUN CODE NE SORT — seulement de la documentation", () => {
  /**
   * Structurel, et volontairement plus strict que nécessaire. Le jour où
   * quelqu'un ajoute `lib/quelque-chose.ts` « parce que c'est un bel exemple »,
   * il ouvre la porte à `lib/voice-costs.ts` par le même raisonnement — et
   * celui-là porte nos marges. On ne discute pas au cas par cas : la ligne
   * est « de la doc, rien d'autre ».
   */
  for (const e of exporteur.AUTORISES) {
    assert.match(e.source, /\.md$/u, `« ${e.source} » n'est pas un document`);
    assert.ok(
      e.source.startsWith("docs/") || !e.source.includes("/"),
      `« ${e.source} » sort d'un dossier de code : seuls docs/ et la racine sont admis`
    );
  }
});

test("⚠ CE QUI EST AUTORISÉ AUJOURD'HUI EST PROPRE AUJOURD'HUI", () => {
  /**
   * ⚠ LE TEST QUI TRAVAILLE VRAIMENT, et il travaille dans le futur.
   *
   * La liste dit QUELS fichiers. Elle ne dit rien de ce qu'ils contiendront
   * après le prochain commit. Ce test relit leur contenu réel : coller une
   * grille tarifaire dans `ARCHITECTURE.md` fait passer `npm test` au rouge
   * le jour même, pas le jour de la publication.
   */
  const problemes = exporteur.verifier(process.cwd());
  assert.deepEqual(
    problemes,
    [],
    problemes.map((p) => `${p.fichier}:${p.ligne} [${p.id}] « ${p.extrait} » — ${p.pourquoi}`).join("\n")
  );
});

// ═══════════ LE SCANNER MORD-IL ? ═══════════

test("⚠ chaque motif interdit attrape RÉELLEMENT son cas", () => {
  /**
   * ⚠ LE PIÈGE DE TEST RENCONTRÉ CINQ FOIS DANS CE DÉPÔT : asserter la
   * PRÉSENCE du refus au lieu de la CONDITION qui y mène. Le test précédent
   * passe parfaitement avec un scanner qui ne trouve jamais rien — c'est même
   * l'issue la plus probable d'une regex mal écrite.
   *
   * Ici on nourrit chaque motif de son cas, et on exige qu'il tombe.
   */
  const cas: { texte: string; attendu: string }[] = [
    { texte: "Le pack complet est à 1 234 € HT.", attendu: "montant" },
    { texte: "Facture en 4200 EUR sur douze mois.", attendu: "montant" },
    { texte: "Écris à contact@eagleyecorp.fr pour la suite.", attendu: "email" },
    // Plage ARCEP réservée à la fiction (décision 2018-0881) : ce fichier est
    // committé, et un numéro appelable n'a rien à y faire — cf.
    // `tests/donnees-reelles.test.ts`.
    { texte: "Appelle le 06 39 98 76 54 pour la démo.", attendu: "telephone" },
    { texte: "Le chantier part chez Nuwacom au-delà du seuil.", attendu: "partenaire" },
    { texte: "Zéro vente à ce jour, donc zéro témoignage.", attendu: "absence-de-vente" },
    { texte: "Cible : les maîtres d'ouvrage avec un permis de construire actif.", attendu: "cible-commerciale" },
    // ⚠ Le motif ajouté après avoir relu ce que la première version laissait
    // sortir : trois documents sans un seul chiffre interdit, et porteurs du
    // plan d'attaque d'une application en ligne.
    { texte: "npm audit : 9 restantes, 3 hautes. Montée de version à planifier.", attendu: "posture-securite" },
    { texte: "L'isolation reste à prouver avec deux comptes réels.", attendu: "posture-securite" },
  ];

  for (const c of cas) {
    const trouve = exporteur.scanner(c.texte);
    assert.ok(trouve, `le scanner laisse passer « ${c.texte} »`);
    assert.equal(trouve!.id, c.attendu, `mauvais motif déclenché sur « ${c.texte} »`);
  }

  // Et chaque motif déclaré doit être couvert : un motif ajouté sans cas de
  // test est un motif dont personne ne sait s'il fonctionne.
  const couverts = new Set(cas.map((c) => c.attendu));
  for (const r of exporteur.INTERDITS) {
    assert.ok(couverts.has(r.id), `le motif « ${r.id} » n'a aucun cas de test : rien ne prouve qu'il attrape quoi que ce soit`);
  }
});

test("un texte propre passe — le scanner n'est pas un refus systématique", () => {
  // La moitié qui empêche l'erreur inverse : un scanner qui refuse tout est
  // aussi inutile qu'un scanner qui n'attrape rien, et il se contourne au
  // premier « bon, on désactive pour cette fois ».
  assert.equal(exporteur.scanner("Le refus par défaut est la seule règle tenable."), null);
});

test("⚠ la tolérance email est BORNÉE aux domaines de documentation", () => {
  /**
   * La RFC 2606 réserve `example.com/.net/.org` et le TLD `.example` : ils
   * n'appartiendront jamais à personne, donc un exemple qui les utilise ne
   * peut pas envoyer de courrier à un inconnu.
   *
   * ⚠ La tolérance s'applique à L'EXTRAIT TROUVÉ, pas au fichier. Sans ça, un
   * seul `@example.com` en tête de page blanchirait toutes les vraies adresses
   * du reste du document. Mutation vérifiée : élargir la tolérance au fichier
   * fait tomber la troisième assertion.
   */
  assert.equal(exporteur.scanner("rua=mailto:postmaster@ton-domaine.example"), null);
  assert.equal(exporteur.scanner("alerte@example.com reçoit les erreurs"), null);
  assert.equal(
    exporteur.scanner("Exemple : alerte@example.com — et en vrai : zakaria@eagleyecorp.fr")?.id,
    "email",
    "une adresse réelle ne se fait pas blanchir par un exemple voisin"
  );
});

// ═══════════ LES LIENS ═══════════

test("⚠ un lien vers un fichier NON exporté devient du texte, pas un 404", () => {
  /**
   * Les docs internes se citent entre elles et citent le code. Copiées telles
   * quelles, quatorze de ces liens pointaient dans le vide.
   *
   * Le dépôt dit déjà pourquoi ça compte : « une référence morte rend le micro
   * impossible — quelqu'un clique, il n'y a rien, donc il conclut que la carte
   * est périmée, donc il cesse de la lire. »
   */
  const exportees = new Set(["README.md", "docs/ALPHA-CEO.md"]);

  // Vers un fichier exporté : le lien survit.
  assert.equal(
    exporteur.delier("voir [la carte](ALPHA-CEO.md)", "docs/BOUCLE.md", exportees),
    "voir [la carte](ALPHA-CEO.md)"
  );
  // Vers du code resté privé : le nom reste lisible, la promesse disparaît.
  // Le libellé était déjà un `code` — on ne le réencadre pas.
  assert.equal(
    exporteur.delier("voir [`lib/alpha-ceo.ts`](../lib/alpha-ceo.ts)", "docs/ALPHA-CEO.md", exportees),
    "voir `lib/alpha-ceo.ts`"
  );
  // Un libellé en texte simple, lui, devient du code.
  assert.equal(
    exporteur.delier("voir [le schéma](../supabase/schema.sql)", "docs/ARCHITECTURE.md", exportees),
    "voir `le schéma`"
  );
  // Une URL externe et une ancre interne ne se touchent pas.
  assert.equal(
    exporteur.delier("[site](https://example.com) et [plus bas](#section)", "README.md", exportees),
    "[site](https://example.com) et [plus bas](#section)"
  );
});

// ═══════════ LE BOUT À BOUT — ON LANCE LE VRAI SCRIPT ═══════════

/**
 * ⚠ POURQUOI ON EXÉCUTE LE SCRIPT AU LIEU DE TESTER SES FONCTIONS.
 *
 * `scanner` et `delier` peuvent être parfaits et n'être appelés par personne :
 * c'est LE défaut récurrent de ce dépôt — un mécanisme juste, branché nulle
 * part. Un test qui appellerait `delier` lui-même pour vérifier le résultat
 * passerait avec un script qui a oublié de l'appeler.
 *
 * On lance donc le binaire et on lit ce qu'il a réellement écrit sur le
 * disque. C'est le seul niveau où « branché » se prouve.
 */
function lancer(cwd: string, sortie: string) {
  const { execFileSync } = require("node:child_process") as typeof import("node:child_process");
  try {
    const stdout = execFileSync("node", [join(process.cwd(), "scripts/export-public.mjs"), sortie], {
      cwd,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
    return { code: 0, stdout };
  } catch (e) {
    const err = e as { status?: number; stderr?: string };
    return { code: err.status ?? 1, stdout: err.stderr ?? "" };
  }
}

test("⚠ LE SCRIPT ÉCRIT VRAIMENT DES FICHIERS PROPRES ET SANS LIEN MORT", () => {
  const { mkdtempSync, readFileSync, existsSync: existe } = require("node:fs") as typeof import("node:fs");
  const { tmpdir } = require("node:os") as typeof import("node:os");

  const sortie = join(mkdtempSync(join(tmpdir(), "export-")), "out");
  const r = lancer(process.cwd(), sortie);
  assert.equal(r.code, 0, `l'export a échoué :\n${r.stdout}`);

  const exportees = new Set(exporteur.AUTORISES.map((e) => e.cible));

  for (const e of exporteur.AUTORISES) {
    const chemin = join(sortie, e.cible);
    assert.ok(existe(chemin), `${e.cible} n'a pas été écrit`);
    const rendu = readFileSync(chemin, "utf8");

    // Rien d'interdit n'a atteint le disque.
    assert.equal(exporteur.scanner(rendu), null, `${e.cible} contient un motif interdit APRÈS export`);

    // Et plus aucune cible relative ne pointe hors du lot.
    const dossier = e.cible.includes("/") ? e.cible.slice(0, e.cible.lastIndexOf("/")) : "";
    for (const m of rendu.matchAll(/\[[^\]]+\]\(([^)\s]+)\)/gu)) {
      const lien = m[1];
      if (/^(?:https?:|mailto:|#)/u.test(lien)) continue;
      const morceaux: string[] = [];
      for (const bout of `${dossier}/${lien.split("#")[0]}`.split("/")) {
        if (bout === "" || bout === ".") continue;
        if (bout === "..") morceaux.pop();
        else morceaux.push(bout);
      }
      assert.ok(exportees.has(morceaux.join("/")), `${e.cible} pointe vers « ${lien} », absent de l'export`);
    }
  }
});

test("⚠ UN SEUL FICHIER SALE ET RIEN N'EST ÉCRIT — pas d'export partiel", () => {
  /**
   * ⚠ LA GARDE QUI COMPTE VRAIMENT, et elle porte sur le comportement, pas
   * sur un message. Un script qui exporterait les sept fichiers propres et
   * sauterait le huitième publierait quand même — en donnant l'impression
   * d'avoir fait attention. Le refus doit être TOTAL et AVANT la première
   * écriture.
   *
   * On reconstruit un faux dépôt : tous les fichiers autorisés, dont un
   * empoisonné par un montant.
   */
  const fs = require("node:fs") as typeof import("node:fs");
  const { tmpdir } = require("node:os") as typeof import("node:os");

  const faux = fs.mkdtempSync(join(tmpdir(), "depot-"));
  for (const e of exporteur.AUTORISES) {
    const dest = join(faux, e.source);
    fs.mkdirSync(join(dest, ".."), { recursive: true });
    fs.copyFileSync(join(process.cwd(), e.source), dest);
  }
  // Le poison : un montant, dans le DERNIER fichier de la liste — pour que
  // les précédents aient eu le temps d'être écrits si le refus arrivait trop
  // tard.
  const victime = exporteur.AUTORISES[exporteur.AUTORISES.length - 1];
  fs.appendFileSync(join(faux, victime.source), "\n\nOffre de lancement : 1 234 € HT.\n");

  const sortie = join(faux, "out");
  const r = lancer(faux, sortie);

  assert.notEqual(r.code, 0, "un fichier sale doit faire échouer l'export");
  assert.match(r.stdout, /montant/u, "le refus doit nommer le motif, sinon il est incompréhensible");
  assert.equal(fs.existsSync(sortie), false, "⛔ des fichiers ont été écrits malgré le refus : l'export est partiel");
});
