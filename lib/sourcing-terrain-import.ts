import { prospectDefaults } from "./seed";
import { normaliserSiren } from "./siren";
import { csvToProspects } from "./csv";
import { champsReconnus, lireTableau, normCle, type Lecture } from "./tabulaire";
import { toE164 } from "./voice-script";
import type { Prospect, Sector } from "./types";
import {
  qualifierTerrain, trierTerrain, type CiblageTerrain, type FicheTerrain,
} from "./sourcing-terrain";

/**
 * ─────────────────────────────────────────────────────────────────────
 * ENTRÉE DES FICHES TERRAIN — d'un relevé d'annuaire vers une file d'appels.
 *
 * Même chaîne que le sourcing LinkedIn, même lecteur mutualisé
 * (`lib/tabulaire.ts`), mais une DIFFÉRENCE de fond dans ce qui est produit :
 * ici, ce qui sort est destiné à être COMPOSÉ. Une fiche sans numéro
 * exploitable n'est pas une fiche faible, c'est une fiche hors sujet.
 *
 * Les signaux de demande relevés (volume d'avis, plainte d'injoignabilité,
 * trou horaire) atterrissent dans `deepAudit` — pas dans les notes. C'est là
 * que `buildLadder` va les chercher pour décider si la marche Alpha Voice se
 * déclenche. Les ranger ailleurs reviendrait à faire le travail deux fois.
 * ─────────────────────────────────────────────────────────────────────
 */

/** Ce que les annuaires et les cartes appellent chaque colonne. */
const ALIAS: Record<string, keyof FicheTerrain> = {
  entreprise: "entreprise", nom: "entreprise", name: "entreprise", raisonsociale: "entreprise",
  etablissement: "entreprise", company: "entreprise", title: "entreprise",
  secteur: "secteur", activite: "secteur", metier: "secteur", categorie: "secteur",
  category: "secteur", type: "secteur", industry: "secteur",
  ville: "ville", city: "ville", commune: "ville", localite: "ville",
  adresse: "adresse", address: "adresse", rue: "adresse",
  telephone: "telephone", tel: "telephone", phone: "telephone", phonenumber: "telephone",
  numero: "telephone", mobile: "telephone",
  siteweb: "siteWeb", site: "siteWeb", website: "siteWeb", web: "siteWeb", url: "siteWeb",
  avis: "avis", nombreavis: "avis", reviews: "avis", reviewcount: "avis", usertotal: "avis",
  // « Nombre d'avis » et « Note Google » sont les en-têtes les plus naturels en
  // français — et ils n'étaient PAS lus : l'apostrophe donne « nombredavis ».
  // `ressembleAuTerrain` les voyait (\b), le parseur non : la feuille était
  // aiguillée vers le tri, qui jugeait alors sur des colonnes vides.
  nombredavis: "avis", avisgoogle: "avis", googlereviews: "avis",
  note: "note", rating: "note", etoiles: "note", stars: "note", score: "note",
  notegoogle: "note", googlerating: "note",
  horaires: "horaires", hours: "horaires", openinghours: "horaires", ouverture: "horaires",
  extraitsavis: "extraitsAvis", avistexte: "extraitsAvis", commentaires: "extraitsAvis",
  extraitdavis: "extraitsAvis", extraitsdavis: "extraitsAvis", extraitavis: "extraitsAvis",
  reviewtext: "extraitsAvis", extraits: "extraitsAvis", verbatim: "extraitsAvis",
  taille: "taille", effectif: "taille", employees: "taille", size: "taille",
  // Croisement avec le registre des entreprises : le code APE prime sur
  // l'enseigne dans le tri, donc ces deux colonnes valent d'être lues.
  naf: "naf", ape: "naf", codenaf: "naf", codeape: "naf", activiteprincipale: "naf",
  siren: "siren", siret: "siren",
};

export const COLONNES_TERRAIN = champsReconnus(ALIAS);

export interface ParseTerrain extends Lecture<FicheTerrain> {
  fiches: FicheTerrain[];
}

export function parserFiches(texte: string): ParseTerrain {
  const lu = lireTableau<FicheTerrain>(texte, ALIAS);
  const fiches = lu.entrees as FicheTerrain[];
  return { ...lu, entrees: fiches, fiches };
}

/** Un extrait d'avis plus long que ça n'apporte plus rien au téléphone. */
const CITATION_MAX = 220;

/**
 * ─────────────────────────────────────────────────────────────────────
 * LES NOTES D'UNE FICHE TERRAIN — des FAITS, pas de la doctrine recopiée.
 *
 * La version d'avant écrivait `s.fait` pour chaque signal, c'est-à-dire la
 * PHRASE D'EXPLICATION du signal (« C'est LEUR phrase, pas notre estimation —
 * utilisable en question, jamais en reproche »). Deux conséquences mesurées :
 *
 *  · 825 octets par fiche, soit 47 % du poids d'un prospect, pour recopier
 *    mille fois le même paragraphe de doctrine. À 1 744 octets la fiche,
 *    1 000 numéros pèsent ~3,3 Mo en UTF-16 : les deux tiers du quota
 *    localStorage, avant le Cerveau et les campagnes. Le mur était à ~1 500.
 *  · Et pendant ce temps, LA PHRASE DU CLIENT — le seul texte qui serve
 *    vraiment au téléphone, celui qu'on relit avant de composer — n'était
 *    PAS conservée. On gardait le commentaire du code et on jetait la preuve.
 *
 * Ici on ne garde que ce qui ne se recalcule pas : le métier, le SIREN, la
 * verticale, et la citation brute. Le MÉTIER reste en clair et ce n'est pas
 * décoratif : l'enum `Sector` ne compte que cinq valeurs, « carrosserie » ou
 * « régie immobilière » y tomberaient dans « autre », et `verticalForProspect`
 * lit les notes pour retrouver la verticale. Les explications de signaux se
 * régénèrent à tout moment par `qualifierTerrain` — elles vivent dans le
 * code, pas dans mille copies.
 * ─────────────────────────────────────────────────────────────────────
 */
function notesDepuisFiche(f: FicheTerrain, c: CiblageTerrain): string {
  const bouts: string[] = [];
  if (f.secteur) bouts.push(`Métier : ${f.secteur}.`);
  /**
   * Le SIREN est écrit EN CLAIR dans les notes, et ce n'est pas cosmétique :
   * c'est lui que `campaign-runner` relit pour savoir si la cible est une
   * entreprise inscrite au registre — donc si la cadence complète
   * peut s'appliquer, ou si le plafond légal B2C s'impose.
   */
  if (f.siren) bouts.push(`SIREN : ${(f.siren ?? "").replace(/\D/g, "").slice(0, 9)}.`);
  if (c.verticaleLabel) bouts.push(`Verticale : ${c.verticaleLabel}.`);

  // LA CITATION. C'est elle qu'on lit trente secondes avant de composer, et
  // c'est la seule chose ici qui soit irremplaçable : elle ne se recalcule pas.
  const avis = (f.extraitsAvis ?? "").replace(/\s+/g, " ").trim();
  if (avis) {
    const court = avis.length > CITATION_MAX ? `${avis.slice(0, CITATION_MAX - 1).trimEnd()}…` : avis;
    bouts.push(`Avis client : « ${court.replace(/^["«\s]+|["»\s]+$/g, "")} »`);
  }

  // Les LABELS des signaux, jamais leurs explications : « Volume de demandes
  // élevé » suffit à savoir pourquoi la fiche est là ; le paragraphe qui va
  // avec est dans le playbook.
  if (c.signaux.length) bouts.push(`Signaux : ${c.signaux.map((s) => s.label).join(" · ")}.`);
  if (c.manque.length) bouts.push(`À vérifier : ${c.manque.join(" · ")}.`);
  return bouts.join(" ");
}

/**
 * Verticale détectée → valeur de l'enum `Sector`, quand elle existe.
 *
 * ⚠ CE MAILLON MANQUAIT, ET IL CASSAIT LA FILE D'APPELS.
 *
 * L'import forçait `sector: "autre"` pour tout le monde. Or la file d'appels
 * (`buildCallSession`) relit la verticale via `verticalForProspect`, qui
 * cherche d'abord des MOTS-CLÉS dans les notes, puis retombe sur le secteur.
 *
 * Et `VERTICAL_KEYWORDS` ne contient aucune entrée pour la restauration, les
 * bars ni les ambulances : ces trois verticales-là ne se reconnaissent QUE par
 * le secteur. Résultat mesuré : un restaurant sourcé sur le terrain était
 * correctement classé « restauration » par le tri, puis tombait dans
 * « generique » dans la file d'appels — donc sans son script, sans son miroir,
 * sans ses questions de diagnostic. Silencieusement.
 *
 * L'enum compte cinq valeurs et trois n'étaient jamais utilisées. Les voilà.
 */
const VERTICALE_SECTEUR: Record<string, Sector> = {
  restauration: "restaurant",
  "bar-pub": "pub",
  ambulance: "ambulance",
  "artisan-batiment": "artisan",
};

/**
 * Traduit la plainte d'injoignabilité en un nombre d'appels manqués.
 *
 * ⚠ C'est une ESTIMATION DE DÉCLENCHEMENT, pas une mesure — et elle est
 * volontairement calée juste au-dessus du seuil de l'escalier
 * (`HIGH_DEMAND_PER_WEEK`), rien de plus. Mettre un chiffre flatteur ici
 * gonflerait la Taxe d'Ignorance affichée sur la fiche, et le premier prospect
 * qui demande d'où il sort n'aurait pas de réponse.
 *
 * La doctrine est explicite : tout chiffre € est diagnostique, jamais audité,
 * et on le dit. Ce champ sert à faire remonter la fiche, pas à argumenter.
 */
const MANQUES_ESTIMES_SI_PLAINTE = 6;

/**
 * Une fiche retenue devient un prospect appelable.
 *
 * ⚠ `stage` est toujours « prospect » : une entreprise relevée dans un annuaire
 * n'a rien demandé. L'avancer ferait mentir toutes les prévisions.
 */
export function ficheVersProspect(f: FicheTerrain, c: CiblageTerrain, now = new Date()): Prospect {
  const iso = now.toISOString();
  const entreprise = (f.entreprise ?? "").trim() || "Établissement sans nom";
  const plainte = c.signaux.some((s) => s.id === "plainte-injoignable");

  // Identifiant stable sur le NUMÉRO : c'est lui qui définit l'unicité d'une
  // cible d'appel. Deux fiches au même numéro sont le même standard, donc le
  // même appel — et un doublon ici, c'est appeler deux fois la même personne.
  const graine = (c.telephone ?? entreprise).toLowerCase().replace(/[^a-z0-9+]+/g, "-").replace(/^-|-$/g, "");

  const nAvis = Number((f.avis ?? "").replace(/[^\d]/g, "")) || undefined;
  const note = Number((f.note ?? "").replace(",", ".").replace(/[^\d.]/g, "")) || undefined;

  return {
    ...prospectDefaults,
    id: `tr-${graine}`.slice(0, 60),
    company: entreprise,
    name: "",
    sector: (c.verticaleId && VERTICALE_SECTEUR[c.verticaleId]) ?? ("autre" as Sector),
    city: (f.ville ?? "").trim(),
    phone: c.telephone ?? undefined,
    siren: normaliserSiren(f.siren) || undefined,
    stage: "prospect",
    preferredChannel: "tel",
    notes: notesDepuisFiche(f, c),
    tags: ["terrain", ...(c.verticaleId ? [c.verticaleId] : []), ...(plainte ? ["injoignable"] : [])],
    deepAudit: {
      ...prospectDefaults.deepAudit,
      googleReviews: nAvis,
      googleRating: note,
      websiteState: (f.siteWeb ?? "").trim() || (f.siteWeb === undefined ? "" : "aucun"),
      // Ne se renseigne QUE sur une plainte constatée. Sans plainte, on ne sait
      // rien du volume manqué et inventer un chiffre serait pire que le vide.
      missedCallsPerWeek: plainte ? MANQUES_ESTIMES_SI_PLAINTE : undefined,
      // Le FAIT seul (« fermé sur la pause déjeuner »), pas le paragraphe qui
      // l'explique : celui-là se régénère, et recopié mille fois il pèse.
      currentProcess: (c.signaux.find((s) => s.id === "trou-horaire")?.fait ?? "").split(" — ")[0],
      updatedAt: nAvis || plainte ? iso : undefined,
    },
    createdAt: iso,
    updatedAt: iso,
  } as Prospect;
}

export interface ImportTerrain {
  parse: ParseTerrain;
  retenus: { fiche: FicheTerrain; ciblage: CiblageTerrain; prospect: Prospect }[];
  /**
   * Les fiches de `ecartes` qui ne sont PAS hors sujet : trop peu de preuve
   * de demande, ou un numéro à recollecter. Elles sont COMPLÉTABLES, pas
   * mortes — un sous-ensemble de `ecartes` (que l'écran de tri terrain
   * continue d'afficher avec ses motifs), jamais un second décompte.
   */
  aQualifier: { fiche: FicheTerrain; ciblage: CiblageTerrain; prospect: Prospect }[];
  ecartes: { fiche: FicheTerrain; ciblage: CiblageTerrain }[];
  resume: string[];
}

/** Les écartées qui ne sont pas hors sujet, converties en fiches « à qualifier ». */
function aQualifierDepuis(ecartes: ImportTerrain["ecartes"], now: Date): ImportTerrain["aQualifier"] {
  return ecartes
    .filter((e) => !e.ciblage.horsSujet)
    .map(({ fiche, ciblage }) => {
      const prospect = ficheVersProspect(fiche, ciblage, now);
      prospect.tags = Array.from(new Set([...prospect.tags, "a-qualifier"]));
      return { fiche, ciblage, prospect };
    });
}

/** Le parcours complet : texte → fiches → tri → prospects appelables. */
export function importerFiches(texte: string, now = new Date()): ImportTerrain {
  const parse = parserFiches(texte);
  const lot = trierTerrain(parse.fiches);

  const retenus = lot.retenus.map(({ fiche, ciblage }) => ({
    fiche,
    ciblage,
    prospect: ficheVersProspect(fiche, ciblage, now),
  }));

  const resume = [...lot.resume];
  if (parse.rejets.length) {
    resume.push(`${parse.rejets.length} ligne(s) illisibles — voir le détail avant de conclure que le lot est mauvais.`);
  }

  return { parse, retenus, aQualifier: aQualifierDepuis(lot.ecartes, now), ecartes: lot.ecartes, resume };
}

// ── L'IMPORT CRM : le tri DÉCIDE QUI ON APPELLE, il ne décide pas qui existe ──

/**
 * ─────────────────────────────────────────────────────────────────────
 * ⚠⚠ UN TRI D'APPELS TENAIT LIEU DE PORTE D'ENTRÉE DU CRM.
 *
 * Mesuré (20/10/2026) sur un export de trois PME lyonnaises — téléphone, email,
 * site, secteur, audit, tous renseignés ; les seules colonnes vides étaient
 * « note » et « avis » : `ressembleAuTerrain` voyait deux marqueurs, aiguillait
 * l'import vers le tri terrain, et chaque fiche sortait à 20/100 pour un seuil
 * de 45. Elles étaient « écartées » — jamais créées. L'écran répondait
 * « ✓ Relevé terrain : 0 nouveau(x) », et comme `ecartes.length > 0` le repli
 * vers l'import générique ne se déclenchait pas non plus.
 *
 * Le fond du défaut : le tri répond à « QUI APPELER dans ce relevé ? » (une
 * question de file d'appels, calibrée sur l'avis Google d'un artisan), et on
 * lui avait confié « QU'EST-CE QUI ENTRE dans le CRM ? ». Une donnée facultative
 * manquante — un avis — fermait la porte à une fiche par ailleurs complète.
 * C'est exactement ce que le tri a le droit de dire sur une file, et pas sur
 * une fiche.
 *
 * Désormais :
 *  · la lecture GÉNÉRIQUE (`csvToProspects`) crée TOUTES les lignes — elle
 *    lit email, décideur, étape, historique, que le parseur terrain ignore ;
 *  · le tri terrain est une SURCOUCHE : une fiche qu'il juge appelable gagne
 *    ses signaux (avis, plainte, trou horaire) ; une fiche qu'il juge faible
 *    reçoit le tag `a-qualifier` — elle existe, elle n'a simplement pas de
 *    preuve de demande ;
 *  · SEULES les fiches HORS SUJET ne sont pas créées (enseigne nationale,
 *    standard déjà en place) : l'offre n'y a pas d'objet, et ce n'est pas un
 *    champ qu'on complète. Elles sont COMPTÉES et nommées, jamais tues ;
 *  · le seuil de 45 reste une DÉCISION non validée : il ordonne la file, il
 *    ne l'interdit pas (même principe que `LOGEMENTS_MIN` : on COMPTE).
 * ─────────────────────────────────────────────────────────────────────
 */
export interface ImportCrm {
  /** Ce qui s'écrit dans le CRM : la lecture générique, enrichie, hors-sujet retirés. */
  aCreer: Prospect[];
  /** Combien le tri terrain juge appelables (signaux de demande relevés). */
  nbAppelables: number;
  /** Combien existent sans preuve de demande — créées, tag `a-qualifier`. */
  nbAQualifier: number;
  /** Non créées, avec le motif : la seule porte qui reste fermée. */
  horsSujet: { entreprise: string; motif: string }[];
  /** Colonnes de la feuille que NI l'import générique NI le tri n'ont lues. */
  colonnesIgnorees: string[];
  /** Lignes sans nom d'entreprise : rien à créer, et on le dit. */
  lignesSansNom: number;
  resume: string[];
}

const nomNorm = (s?: string) => (s ?? "").trim().toLowerCase().replace(/\s+/g, " ");

export function importerPourCrm(texte: string, now = new Date()): ImportCrm {
  const gen = csvToProspects(texte);
  const terrain = importerFiches(texte, now);
  // `aQualifier` est un sous-ensemble d'`ecartes` : on part de `ecartes` pour ne
  // rien compter deux fois.
  const jugees = [
    ...terrain.retenus.map((r) => ({ fiche: r.fiche, ciblage: r.ciblage, prospect: r.prospect as Prospect | null })),
    ...terrain.ecartes.map((r) => ({ fiche: r.fiche, ciblage: r.ciblage, prospect: null as Prospect | null })),
  ];

  // Le prospect générique qui correspond à une fiche : par numéro d'abord (un
  // numéro est unique, un nom ne l'est pas), puis par nom.
  const parTel = new Map<string, Prospect>();
  const parNom = new Map<string, Prospect>();
  for (const p of gen.prospects) {
    const tel = p.phone ? toE164(p.phone) : null;
    if (tel && !parTel.has(tel)) parTel.set(tel, p);
    if (!parNom.has(nomNorm(p.company))) parNom.set(nomNorm(p.company), p);
  }
  const retrouver = (f: FicheTerrain, c: CiblageTerrain): Prospect | undefined =>
    (c.telephone ? parTel.get(c.telephone) : undefined) ?? parNom.get(nomNorm(f.entreprise));

  const horsSujet: ImportCrm["horsSujet"] = [];
  const retires = new Set<Prospect>();
  const surcouche = new Map<Prospect, "appelable" | "a-qualifier">();
  let nbAppelables = 0;
  let nbAQualifier = 0;

  for (const j of jugees) {
    const base = retrouver(j.fiche, j.ciblage);
    if (j.ciblage.horsSujet) {
      horsSujet.push({
        entreprise: (j.fiche.entreprise ?? "").trim() || "Établissement sans nom",
        motif: j.ciblage.exclusions.find((e) => /nationale|standard/.test(e))?.split(" — ")[0] ?? "l'offre n'a pas d'objet ici",
      });
      if (base) retires.add(base);
      continue;
    }
    const retenu = j.ciblage.retenu;
    if (retenu) nbAppelables++;
    else nbAQualifier++;
    if (!base) continue;
    surcouche.set(base, retenu ? "appelable" : "a-qualifier");
    if (retenu && j.prospect) {
      // La fiche générique reste la base (étape, historique, email, décideur) ;
      // le tri y ajoute ce qu'il est seul à savoir.
      base.tags = Array.from(new Set([...base.tags, ...j.prospect.tags]));
      base.notes = [base.notes, j.prospect.notes].filter(Boolean).join(" ");
      if (base.sector === "autre") base.sector = j.prospect.sector;
      base.preferredChannel = base.preferredChannel ?? j.prospect.preferredChannel;
      base.deepAudit = {
        ...base.deepAudit,
        ...Object.fromEntries(Object.entries(j.prospect.deepAudit).filter(([, v]) => v !== undefined && v !== "")),
      };
    } else {
      base.tags = Array.from(new Set([...base.tags, "a-qualifier"]));
    }
  }

  let aCreer = gen.prospects.filter((p) => !retires.has(p));

  // Aucune colonne « entreprise » reconnue par la lecture générique (« nom »
  // y désigne le décideur) alors que le tri a lu des fiches : on les crée
  // depuis le tri plutôt que de ne rien créer.
  if (gen.prospects.length === 0) {
    aCreer = [...terrain.retenus, ...terrain.aQualifier].map((r) => r.prospect);
  }

  // Une colonne que le tri sait lire n'est pas « ignorée ».
  const colonnesIgnorees = gen.headersIgnored.filter((h) => !(normCle(h) in ALIAS));

  const resume: string[] = [];
  const lues = terrain.parse.fiches.length;
  let ligne = `${lues} fiche(s) lue(s) — ${nbAppelables} appelable(s) selon le tri terrain, ${nbAQualifier} à qualifier`;
  if (nbAQualifier) ligne += " (aucune preuve de demande relevée : créées quand même, tag « a-qualifier »)";
  ligne += ".";
  resume.push(ligne);
  if (horsSujet.length) {
    resume.push(
      `${horsSujet.length} NON créée(s) — l'offre n'y a pas d'objet : ${horsSujet.slice(0, 5).map((h) => `${h.entreprise} (${h.motif})`).join(", ")}${horsSujet.length > 5 ? ", …" : ""}.`
    );
  }
  if (colonnesIgnorees.length) resume.push(phraseColonnesIgnorees(colonnesIgnorees));
  if (gen.skipped) resume.push(`${gen.skipped} ligne(s) sans nom d'entreprise, ignorée(s).`);

  return { aCreer, nbAppelables, nbAQualifier, horsSujet, colonnesIgnorees, lignesSansNom: gen.skipped, resume };
}

/** La phrase unique : l'import générique et l'import terrain la disent pareil. */
export function phraseColonnesIgnorees(colonnes: string[]): string {
  return `Colonnes NON lues (ignorées) : ${colonnes.join(", ")}. Renomme-les en « notes » ou « tags » si elles comptent.`;
}

/**
 * Ce que l'écran affiche une fois l'import écrit.
 *
 * ⚠ Le « ✓ » ne se pose QUE si quelque chose a été écrit. Il s'affichait sur
 * « 0 nouveau(x), 3 écartée(s) » : une coche verte sur un import vide est une
 * panne qui a l'air d'un succès.
 */
export function messageImport(ecrit: { added: number; updated: number }, r: ImportCrm): { ok: boolean; texte: string } {
  const total = ecrit.added + ecrit.updated;
  const tete = total > 0
    ? `✓ Import : ${ecrit.added} nouveau(x), ${ecrit.updated} mis à jour.`
    : "⚠ RIEN n'a été écrit.";
  return { ok: total > 0, texte: [tete, ...r.resume].join(" ") };
}

/** Qualification d'une fiche unique, pour la saisie à la main. */
export const qualifierFiche = qualifierTerrain;

/**
 * Ce tableau est-il un relevé TERRAIN, ou un import CRM ordinaire ?
 *
 * ── POURQUOI CETTE DÉTECTION EXISTE ──
 *
 * Le flux réel est : relevé sur une carte → Google Sheet → Alpha. Or l'import
 * de feuille passait par `csvToProspects`, l'import CRM générique. Les
 * colonnes qui portent tout le tri — nombre d'avis, extraits d'avis, code
 * APE — y étaient simplement IGNORÉES. Les fiches entraient, et la plainte
 * d'injoignabilité, la verticale confirmée et le plan d'appels ne sortaient
 * jamais. Rien ne le disait : l'import annonçait « ✓ 200 nouveaux ».
 *
 * ── POURQUOI ON DÉTECTE AU LIEU DE DEMANDER ──
 *
 * Une case « c'est un relevé terrain » de plus, au moment exact où on colle
 * 200 lignes, est une case qu'on oublie de cocher. Les colonnes disent déjà
 * ce que le fichier est.
 *
 * Le seuil est DEUX marqueurs, pas un : « note » seul apparaît dans des
 * exports CRM ordinaires, et router à tort un import CRM vers le tri terrain
 * ferait exclure toutes les fiches sans téléphone — c'est-à-dire l'inverse du
 * service rendu.
 */
export function ressembleAuTerrain(texte: string): boolean {
  const entete = (texte ?? "").split(/\r?\n/)[0] ?? "";
  if (!entete.trim() || entete.trimStart().startsWith("{") || entete.trimStart().startsWith("[")) return false;

  const marqueurs = [
    /\b(avis|reviews|reviewcount|nombreavis|usertotal)\b/i,
    /\b(extraitsavis|reviewtext|avistexte|verbatim|commentaires)\b/i,
    /\b(naf|ape|codenaf|codeape|activiteprincipale)\b/i,
    /\b(horaires|hours|openinghours|ouverture)\b/i,
    /\b(note|rating|etoiles|stars)\b/i,
  ];
  return marqueurs.filter((re) => re.test(entete)).length >= 2;
}

// ── L'API PLACES DE GOOGLE ─────────────────────────────────────────────

/**
 * ─────────────────────────────────────────────────────────────────────
 * ADAPTATEUR PLACES — la seule source qui rend le signal fort, légalement.
 *
 * ── POURQUOI UN ADAPTATEUR DÉDIÉ ──
 *
 * Le lecteur générique (`lib/tabulaire.ts`) mappe des colonnes PLATES. La
 * réponse de l'API Places est imbriquée : `displayName.text`,
 * `reviews[].text.text`, `regularOpeningHours.weekdayDescriptions[]`. Aucune
 * table d'alias ne descend là-dedans, et bricoler des chemins pointés dans le
 * lecteur générique le rendrait illisible pour tous les autres usages.
 *
 * ── ET POURQUOI PLACES PLUTÔT QUE DU SCRAPING ──
 *
 * Aspirer les pages Google Maps viole les conditions d'utilisation de Google.
 * C'est exactement la même catégorie que le backend LinkedIn à session qu'on a
 * refusé — refuser l'un et faire l'autre serait une doctrine à géométrie
 * variable.
 *
 * L'API rend précisément ce dont le tri a besoin, y compris **le texte des
 * avis** : c'est le signal qui pèse plus que tous les autres, et c'est la
 * seule voie propre pour l'obtenir en volume.
 *
 * ⚠ Elle est PAYANTE et plafonne à 5 avis par établissement. Le tarif et les
 * quotas gratuits changent régulièrement — à vérifier sur la grille Google
 * avant de lancer 1 000 requêtes. Je n'ai pas pu la joindre d'ici.
 * ─────────────────────────────────────────────────────────────────────
 */

/** La forme (partielle) d'un `Place` de l'API v1. Tout est optionnel côté Google. */
interface PlaceV1 {
  displayName?: { text?: string };
  primaryTypeDisplayName?: { text?: string };
  types?: string[];
  shortFormattedAddress?: string;
  formattedAddress?: string;
  nationalPhoneNumber?: string;
  internationalPhoneNumber?: string;
  websiteUri?: string;
  rating?: number;
  userRatingCount?: number;
  regularOpeningHours?: { weekdayDescriptions?: string[] };
  reviews?: { text?: { text?: string }; originalText?: { text?: string } }[];
}

/** La ville se lit dans l'adresse courte : « 12 rue X, 69003 Lyon » → « Lyon ». */
function villeDepuisAdresse(adresse?: string): string {
  const a = (adresse ?? "").trim();
  const m = a.match(/\b\d{5}\s+(.+)$/);
  return m ? m[1].trim() : "";
}

/** Une place de l'API → une fiche terrain, sans rien inventer. */
export function placeVersFiche(p: PlaceV1): FicheTerrain {
  const adresse = p.shortFormattedAddress ?? p.formattedAddress ?? "";

  /**
   * Tous les avis sont concaténés, pas seulement le premier.
   *
   * L'API en rend jusqu'à cinq. La plainte d'injoignabilité peut être dans le
   * quatrième — n'en garder qu'un ferait manquer le signal le plus fort sur
   * une bonne partie du lot, silencieusement.
   */
  const avisTexte = (p.reviews ?? [])
    .map((r) => r.text?.text ?? r.originalText?.text ?? "")
    .filter(Boolean)
    .join(" · ");

  return {
    entreprise: p.displayName?.text ?? "",
    // Le type affiché est en langue lisible (« Atelier de carrosserie ») ; les
    // `types` bruts sont en anglais technique (« car_repair ») et servent de
    // repli. Les deux nourrissent la détection de verticale.
    secteur: [p.primaryTypeDisplayName?.text, ...(p.types ?? [])].filter(Boolean).join(" "),
    ville: villeDepuisAdresse(adresse),
    adresse,
    telephone: p.nationalPhoneNumber ?? p.internationalPhoneNumber ?? "",
    // ⚠ Distinguer « pas de site » de « champ absent » : le premier est un
    // signal (marche visibilité), le second est une lacune de la requête.
    siteWeb: p.websiteUri ?? (Object.prototype.hasOwnProperty.call(p, "websiteUri") ? "" : undefined),
    avis: p.userRatingCount !== undefined ? String(p.userRatingCount) : undefined,
    note: p.rating !== undefined ? String(p.rating) : undefined,
    horaires: (p.regularOpeningHours?.weekdayDescriptions ?? []).join(" · ") || undefined,
    extraitsAvis: avisTexte || undefined,
  };
}

/**
 * Lit une réponse brute de l'API Places (ou un tableau de `Place`).
 *
 * Accepte `{ places: [...] }` — la forme de `searchText` et `searchNearby` —
 * comme un tableau nu, parce que c'est ce qu'on obtient en concaténant
 * plusieurs pages de résultats à la main.
 */
export function importerPlaces(json: string, now = new Date()): ImportTerrain {
  let places: PlaceV1[];
  try {
    const brut = JSON.parse(json) as unknown;
    const src = Array.isArray(brut)
      ? brut
      : ((brut as { places?: unknown[] })?.places ?? []);
    places = (Array.isArray(src) ? src : []) as PlaceV1[];
  } catch {
    return {
      parse: { entrees: [], fiches: [], rejets: [{ ligne: 1, raison: "JSON invalide", extrait: json.slice(0, 60) }], avertissements: [], format: "aucun" },
      retenus: [],
      aQualifier: [],
      ecartes: [],
      resume: ["JSON invalide — colle la réponse complète de l'API, accolades comprises."],
    };
  }

  const fiches = places.map(placeVersFiche);
  const lot = trierTerrain(fiches);
  const retenus = lot.retenus.map(({ fiche, ciblage }) => ({
    fiche,
    ciblage,
    prospect: ficheVersProspect(fiche, ciblage, now),
  }));

  const resume = [...lot.resume];
  const sansAvisTexte = fiches.filter((f) => !f.extraitsAvis).length;
  if (sansAvisTexte) {
    resume.push(
      `${sansAvisTexte} fiche(s) sans texte d'avis : vérifie que le champ « reviews » est bien demandé dans le masque de champs, sinon le signal le plus fort est perdu.`
    );
  }

  return {
    parse: { entrees: fiches, fiches, rejets: [], avertissements: [], format: "json" },
    retenus,
    aQualifier: aQualifierDepuis(lot.ecartes, now),
    ecartes: lot.ecartes,
    resume,
  };
}

/**
 * Le masque de champs à demander à l'API.
 *
 * Places facture au champ demandé : réclamer tout coûte plus cher pour rien.
 * `reviews` est le seul champ non négociable — c'est lui qui porte le signal.
 */
export const CHAMPS_PLACES =
  "places.displayName,places.primaryTypeDisplayName,places.shortFormattedAddress," +
  "places.nationalPhoneNumber,places.websiteUri,places.rating,places.userRatingCount," +
  "places.regularOpeningHours.weekdayDescriptions,places.reviews";
