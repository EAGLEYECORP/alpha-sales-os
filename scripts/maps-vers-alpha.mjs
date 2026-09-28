#!/usr/bin/env node
/**
 * ─────────────────────────────────────────────────────────────────────
 * MAPS → ALPHA : le pont entre un collecteur EXTÉRIEUR et notre import.
 *
 * Écrit le 17/09/2026, après lecture de `Mahanaicoach/google-maps-scraper-kit`
 * (MIT, lui-même enveloppe de `gosom/google-maps-scraper`).
 *
 * ══ POURQUOI UN SCRIPT, ET PAS UNE BRIQUE DU PRODUIT ══
 *
 * La doctrine le dit déjà, et elle nomme ce cas précis : « refuser d'embarquer
 * un collecteur dans le produit (scraping d'annuaire, session LinkedIn,
 * **aspiration de Maps**) sans perdre le service : la collecte reste dehors,
 * remplaçable, et sous la responsabilité de celui qui la fait. »
 *
 * Trois raisons qui tiennent debout séparément :
 * · le kit tourne en **Docker**, contre Google Maps, depuis l'IP de celui qui
 *   le lance. Son propre README dit que c'est contraire aux CGU de Google et
 *   que l'IP peut être bloquée. Embarquer ça dans un produit vendu ferait
 *   porter ce risque à NOS clients, sur NOTRE infrastructure ;
 * · une brique de plus se recopie dans huit fichiers (catalogue, offres,
 *   provisionnement, vitrine, relevé de marché) — la doctrine refuse déjà d'en
 *   créer une pour moins que ça ;
 * · le collecteur est **remplaçable**. Demain un autre annuaire, un autre kit :
 *   seul ce fichier change.
 *
 * ══ ⚠⚠ CE QUE MAPS NE FAIT PAS, ET IL FAUT LE DIRE AVANT DE S'EN SERVIR ══
 *
 * **Maps ne source PAS notre ICP.** Notre cible depuis le 09/09 est le maître
 * d'ouvrage dont le permis est ACTIF — un déclencheur daté. Une SCCV de
 * programme n'a pas de fiche Google Maps, et « promoteurs à Lyon » rend une
 * liste par SECTEUR : elle dit QUI, jamais OÙ EN EST l'affaire. C'est
 * exactement le ciblage que `docs/PERMIS-LYON.md` a écarté.
 *
 * Ce que Maps fait, en revanche, et qui manquait : **la troisième colonne**.
 * « Un export de permis ne porte AUCUN numéro ; le téléphone se relève À LA
 * MAIN. » C'est ce relevé-là que le mode `--enrichir` automatise.
 *
 * ══ DEUX MODES ══
 *
 *   node scripts/maps-vers-alpha.mjs --fiches results.csv --secteur artisan \
 *        --ville "Lyon" > leads.csv
 *   node scripts/maps-vers-alpha.mjs --enrichir permis.csv --maps results.csv \
 *        > permis-enrichi.csv
 *
 * Aucune dépendance : Node seul, comme `permis-lyon.mjs`.
 * ─────────────────────────────────────────────────────────────────────
 */

/**
 * L'en-tête que `lib/csv.ts` sait relire, recopié ici parce qu'un script doit
 * pouvoir tourner seul.
 *
 * ⚠ La recopie est RATTRAPÉE PAR UN TEST : `tests/maps-vers-alpha.test.ts`
 * exige qu'il soit identique à `CSV_TEMPLATE_HEADER`. Sans ce test, la
 * divergence serait silencieuse et produirait un fichier bien formé que
 * l'import ignore — c'est-à-dire une file vide, qui ressemble trait pour trait
 * à « aucun lead trouvé ».
 */
export const ENTETE_ALPHA =
  "company;name;sector;city;phone;email;stage;monthlyValue;setupValue;ignoranceTax;googleRating;googleReviews;missedCallsPerWeek;avgTicket;conversionRate;website;social;concurrence;process;problems;notes";

/** Les colonnes que le kit produit par défaut (son jeu « LEAD »). */
export const COLONNES_MAPS = [
  "title",
  "phone",
  "emails",
  "website",
  "category",
  "address",
  "review_rating",
  "review_count",
];

// ── CSV : lecture et écriture, sans dépendance ───────────────────────────────

/** Découpe un CSV (virgule, guillemets doublés) en lignes d'objets. */
export function parserCsv(texte, separateur = ",") {
  const lignes = [];
  let champ = "";
  let ligne = [];
  let dansGuillemets = false;
  const t = String(texte ?? "").replace(/\r\n?/g, "\n");
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (dansGuillemets) {
      if (c === '"') {
        if (t[i + 1] === '"') { champ += '"'; i++; } else dansGuillemets = false;
      } else champ += c;
      continue;
    }
    if (c === '"') { dansGuillemets = true; continue; }
    if (c === separateur) { ligne.push(champ); champ = ""; continue; }
    if (c === "\n") { ligne.push(champ); lignes.push(ligne); ligne = []; champ = ""; continue; }
    champ += c;
  }
  if (champ !== "" || ligne.length) { ligne.push(champ); lignes.push(ligne); }
  if (!lignes.length) return [];

  const entete = lignes[0].map((h) => h.trim());
  return lignes.slice(1)
    .filter((l) => l.some((v) => v.trim() !== ""))
    .map((l) => Object.fromEntries(entete.map((h, i) => [h, (l[i] ?? "").trim()])));
}

/** Échappe une valeur pour un CSV à point-virgule. */
export function champCsv(v) {
  const s = String(v ?? "");
  return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

// ── La transformation ────────────────────────────────────────────────────────

/**
 * ⚠⚠ UN SITE ABSENT DE MAPS N'EST PAS UN SITE ABSENT.
 *
 * Le défaut réparé le jour même dans `lib/offer-match.ts` : la chaîne vide y
 * valait « site absent ou obsolète », +3 sur l'offre Visibilité, sur 8 fiches
 * ICP sur 8. Écrire « aucun » ici quand la colonne `website` est vide le
 * réintroduirait **par l'import**, et cette fois avec l'air d'une mesure —
 * puisque la valeur viendrait d'un relevé.
 *
 * Or une fiche Maps sans site veut dire « le commerçant n'a pas renseigné de
 * site sur Google », ce qui n'est pas « il n'a pas de site ». On laisse donc
 * VIDE, c'est-à-dire « pas regardé », et c'est la vérité.
 */
export function etatDuSite(website) {
  const s = String(website ?? "").trim();
  return s ? s : "";
}

/**
 * Une ligne Maps → une ligne d'import Alpha.
 *
 * ⚠ LE SECTEUR SE DÉCLARE, IL NE SE DEVINE PAS. La colonne `category` du kit
 * porte le libellé Google (« Plombier », « Restaurant »). Le rapprocher de nos
 * six secteurs par ressemblance de mots serait la devinette que ce dépôt
 * refuse partout — « la verticale se lit sur le tag, jamais sur le texte », et
 * la file du matin a déjà servi le script du moniteur d'auto-école à des
 * directeurs de programmes pour cette raison exacte. L'opérateur passe donc
 * `--secteur`, et la catégorie Google part dans les NOTES, où elle informe
 * sans router.
 */
export function ligneMapsVersAlpha(row, opts = {}) {
  const r = row ?? {};
  const notes = [];
  if (r.category) notes.push(`Catégorie Google : ${r.category}`);
  if (r.address) notes.push(`Adresse : ${r.address}`);
  notes.push("Source : export Google Maps (collecte hors produit).");

  return {
    company: r.title ?? "",
    name: "",
    sector: opts.secteur ?? "autre",
    // La ville du relevé fait foi ; à défaut celle que l'opérateur a demandée.
    city: opts.ville ?? "",
    phone: r.phone ?? "",
    // Le kit peut rendre plusieurs adresses ; on garde la première, les autres
    // partiraient dans un champ qui n'en attend qu'une.
    email: String(r.emails ?? "").split(/[;,|\s]+/).filter(Boolean)[0] ?? "",
    stage: "",
    monthlyValue: "",
    setupValue: "",
    ignoranceTax: "",
    googleRating: r.review_rating ?? "",
    googleReviews: r.review_count ?? "",
    missedCallsPerWeek: "",
    avgTicket: "",
    conversionRate: "",
    website: etatDuSite(r.website),
    social: "",
    concurrence: "",
    process: "",
    problems: "",
    notes: notes.join(" · "),
  };
}

/** Les lignes converties, dans l'ordre exact de l'en-tête Alpha. */
export function versCsvAlpha(lignes) {
  const cles = ENTETE_ALPHA.split(";");
  return [ENTETE_ALPHA, ...lignes.map((l) => cles.map((c) => champCsv(l[c])).join(";"))].join("\n");
}

// ── L'enrichissement : la troisième colonne, automatisée ─────────────────────

/**
 * Nom d'entreprise ramené à ce qui l'identifie.
 *
 * On retire les formes juridiques et la ponctuation : « SCCV LES TERRASSES DES
 * CANUTS » et « Les Terrasses des Canuts » doivent se rejoindre. Les accents
 * partent aussi — un export d'open data et un relevé Maps ne les écrivent pas
 * toujours pareil.
 */
export function normaliserNom(nom) {
  return String(nom ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\b(sccv|sci|sas|sasu|sarl|eurl|sa|snc|scp|scm|ste|societe|groupe)\b/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/**
 * Remplit `phone` et `website` des fiches à partir d'un relevé Maps.
 *
 * ⚠⚠ RAPPROCHEMENT EXACT SEULEMENT, ET C'EST UNE DÉCISION COÛTEUSE ASSUMÉE.
 * Un rapprochement approximatif poserait le numéro d'une entreprise sur la
 * fiche d'une autre — et ce numéro part dans une file d'appels. On appellerait
 * quelqu'un en lui parlant du programme du voisin. Le coût des deux erreurs
 * n'est pas le même : rater un rapprochement coûte un relevé à la main (ce
 * qu'on fait déjà aujourd'hui) ; en fabriquer un faux coûte l'appel, la fiche
 * et la crédibilité.
 *
 * ⚠ ON NE REMPLACE JAMAIS UNE VALEUR EXISTANTE. Ce qui est déjà sur la fiche a
 * été relevé par un humain ; un scraper ne passe pas devant.
 */
export function enrichirFiches(fiches, releveMaps) {
  const index = new Map();
  for (const m of releveMaps) {
    const cle = normaliserNom(m.title);
    if (!cle) continue;
    // Une clé ambiguë (deux établissements du même nom) est ÉCARTÉE, pas
    // arbitrée : choisir le premier serait tirer au sort un numéro.
    index.set(cle, index.has(cle) ? null : m);
  }

  const rapport = { enrichies: 0, ambigues: 0, sansCorrespondance: 0 };
  const sortie = fiches.map((f) => {
    const trouve = index.get(normaliserNom(f.company));
    if (trouve === null) { rapport.ambigues++; return { ...f }; }
    if (!trouve) { rapport.sansCorrespondance++; return { ...f }; }

    const enrichie = { ...f };
    let touchee = false;
    if (!String(f.phone ?? "").trim() && trouve.phone) { enrichie.phone = trouve.phone; touchee = true; }
    if (!String(f.website ?? "").trim() && etatDuSite(trouve.website)) {
      enrichie.website = etatDuSite(trouve.website);
      touchee = true;
    }
    if (touchee) rapport.enrichies++;
    else rapport.sansCorrespondance++;
    return enrichie;
  });

  return { fiches: sortie, rapport };
}

// ── Entrée en ligne de commande ──────────────────────────────────────────────

function options(argv) {
  const o = {};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i].startsWith("--")) o[argv[i].slice(2)] = argv[i + 1]?.startsWith("--") ? true : argv[++i];
  }
  return o;
}

async function main() {
  const { readFileSync } = await import("node:fs");
  const o = options(process.argv.slice(2));

  if (o.fiches && typeof o.fiches === "string") {
    const lignes = parserCsv(readFileSync(o.fiches, "utf8"));
    const converties = lignes.map((r) => ligneMapsVersAlpha(r, { secteur: o.secteur, ville: o.ville }));
    process.stdout.write(versCsvAlpha(converties) + "\n");
    process.stderr.write(`${converties.length} ligne(s) converties. Secteur déclaré : ${o.secteur ?? "autre"}.\n`);
    return;
  }

  if (o.enrichir && typeof o.enrichir === "string" && typeof o.maps === "string") {
    const fiches = parserCsv(readFileSync(o.enrichir, "utf8"), ";");
    const releve = parserCsv(readFileSync(o.maps, "utf8"));
    const { fiches: sortie, rapport } = enrichirFiches(fiches, releve);
    process.stdout.write(versCsvAlpha(sortie) + "\n");
    process.stderr.write(
      `${rapport.enrichies} fiche(s) enrichies · ${rapport.ambigues} nom(s) ambigu(s) écarté(s) · ` +
        `${rapport.sansCorrespondance} sans correspondance (à relever à la main).\n`
    );
    return;
  }

  process.stderr.write(
    "Usage :\n" +
      "  --fiches <maps.csv> [--secteur <secteur>] [--ville <ville>]   → un CSV d'import Alpha\n" +
      "  --enrichir <fiches.csv> --maps <maps.csv>                     → les mêmes fiches, téléphone rempli\n"
  );
  process.exitCode = 1;
}

// Ne tourne que lancé en direct : le test importe les fonctions sans exécuter.
if (process.argv[1] && process.argv[1].endsWith("maps-vers-alpha.mjs")) main();
