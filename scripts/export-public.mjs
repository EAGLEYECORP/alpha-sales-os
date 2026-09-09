#!/usr/bin/env node
/**
 * ─────────────────────────────────────────────────────────────────────
 * L'EXPORT PUBLIC — ce qu'on montre, et surtout ce qu'on ne montre pas.
 *
 * ── POURQUOI CE SCRIPT EXISTE ──
 *
 * Le dépôt a été public une fois. Ce qu'il coûtait n'était pas le code : les
 * marges (`lib/voice-costs`, `lib/offres-marge`), la grille tarifaire, l'ICP,
 * les conditions d'un PARTENAIRE nommé, et « zéro vente à ce jour » écrit
 * quatre fois. Un prospect qui lit ça ne négocie plus contre ce qu'il perd, il
 * négocie contre notre coût — et un partenaire qui lit le mot « levier de
 * négociation » à côté de son nom ne redevient pas partenaire.
 *
 * Ce qui avait de la valeur à montrer, en revanche, est réel : l'architecture,
 * l'installation, la doctrine de sécurité, la façon dont ce dépôt teste ses
 * propres gardes. C'est ce que cet export publie, et rien d'autre.
 *
 * ── LES DEUX MOITIÉS, ET AUCUNE NE SUFFIT SEULE ──
 *
 * 1. **UNE LISTE D'AUTORISATION**, jamais une liste d'exclusion. Un fichier
 *    ajouté demain n'est PAS exporté tant que personne ne l'a mis ici. C'est
 *    l'inverse du réflexe et c'est le seul choix tenable : on ajoute des docs
 *    sans y penser, et un fichier oublié en mode « exporté par défaut » est
 *    une fuite qui ne se voit jamais. Même règle que `ACCES_PAR_CHEMIN`.
 *
 * 2. **UN SCANNER SUR CE QUI SORT RÉELLEMENT.** La liste dit quels fichiers ;
 *    elle ne dit rien de ce qu'ils CONTIENNENT aujourd'hui. `ARCHITECTURE.md`
 *    est propre ce matin ; rien n'empêche quelqu'un d'y coller un tableau de
 *    prix cet après-midi, et l'export le publierait sans un mot. Le scanner
 *    relit chaque fichier autorisé au moment de l'écrire et REFUSE d'exporter
 *    au premier motif trouvé.
 *
 * ⚠ Le scanner cherche des FORMES (un montant, une adresse email, un numéro
 * français), pas une liste de secrets connus. Une liste de ce qu'il faut
 * cacher serait une copie de ce qu'on cache — c'est déjà la règle de
 * `tests/donnees-reelles.test.ts`, et elle vaut ici aussi.
 *
 * ⚠⚠ CE SCRIPT NE REND RIEN PUBLIC. Il écrit un dossier local. La publication
 * est un geste humain, dans un dépôt distinct, et elle doit le rester : la
 * chose qu'on ne veut surtout pas, c'est un chemin automatique du privé vers
 * le public.
 *
 * Usage : node scripts/export-public.mjs [dossier-de-sortie]
 *         (défaut : .export-public/, ignoré par git)
 * ─────────────────────────────────────────────────────────────────────
 */

import { readFileSync, writeFileSync, mkdirSync, rmSync, existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

/**
 * CE QUI SORT. Chaque entrée porte la RAISON de sortir — sans elle, la
 * prochaine session ajoutera une ligne « ça a l'air utile » et la liste
 * cessera d'être une décision.
 *
 * `source` est relatif à la racine du dépôt ; `cible` au dossier exporté.
 */
export const AUTORISES = [
  {
    source: "docs/public-readme.md",
    cible: "README.md",
    pourquoi: "La porte d'entrée, écrite POUR le public — pas le README privé, qui porte l'ancre tarifaire.",
  },
  {
    source: "docs/public-architecture.md",
    cible: "docs/ARCHITECTURE.md",
    pourquoi:
      "Comment c'est construit — écrit POUR le public. La version interne se termine par l'état d'exploitation de NOTRE déploiement (ce qui reste à prouver contre les vrais services) : utile en interne, publié c'est une carte pour qui cherche par où entrer.",
  },
  {
    source: "docs/INSTALLATION.md",
    cible: "docs/INSTALLATION.md",
    pourquoi: "Le guide d'installation — la raison invoquée pour garder le dépôt ouvert. Il se sert très bien tout seul.",
  },
  {
    source: "docs/DEMARRAGE.md",
    cible: "docs/DEMARRAGE.md",
    pourquoi: "La prise en main et le contrôle DNS. Utile à qui installe, muet sur notre économie.",
  },
  {
    source: "docs/BOUCLE.md",
    cible: "docs/BOUCLE.md",
    pourquoi: "La boucle terrain — la partie conception qui a le plus de valeur d'exemple, et zéro chiffre commercial.",
  },
  {
    source: "docs/ALPHA-CEO.md",
    cible: "docs/ALPHA-CEO.md",
    pourquoi:
      "Le refus d'automatiser ce qui fabriquerait de la preuve. C'est la page qui montre un jugement d'ingénierie, pas une fonctionnalité.",
  },
  {
    source: "docs/public-security.md",
    cible: "SECURITY.md",
    pourquoi:
      "Politique de signalement — un dépôt public sans elle demande aux gens de deviner où écrire. Ce n'est PAS le SECURITY.md interne, qui est un rapport d'audit : avis npm en cours, faiblesse CSP exacte, liste des routes publiques par conception. Un rapport d'audit sur un service en ligne se lit d'abord par qui cherche l'entrée.",
  },
];

/**
 * CE QUI NE SORT JAMAIS, quelle que soit la liste au-dessus.
 *
 * Chaque motif a coûté quelque chose, ou en coûterait. L'ordre n'a pas
 * d'importance : le premier qui matche arrête l'export.
 */
export const INTERDITS = [
  {
    id: "montant",
    // Un prix, une marge, un coût. `€` ou `EUR` précédé d'un nombre.
    motif: /\d[\d\s  .]*\s?(?:€|\bEUR\b)/u,
    pourquoi:
      "Un montant. La grille, l'ancre à cinq chiffres et les marges sont ce que le dépôt public coûtait vraiment : le prospect cesse de négocier contre ce qu'il perd et négocie contre notre coût.",
  },
  {
    id: "email",
    motif: /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/u,
    pourquoi:
      "Une adresse email. Nos boîtes se moissonnent, et un exemple qui nomme un vrai domaine finit copié-collé tel quel — les rapports DMARC d'un inconnu partiraient chez son propriétaire.",
    /**
     * ⚠ L'EXCEPTION EST NORMATIVE, PAS COSMÉTIQUE. La RFC 2606 réserve
     * `example.com/.net/.org` et le TLD `.example` à la documentation : ils
     * n'appartiendront jamais à personne. C'est la seule forme d'adresse qu'on
     * a le droit d'écrire dans un doc public.
     */
    tolere: /@(?:[A-Za-z0-9.-]+\.)?example(?:\.com|\.net|\.org)?$/u,
  },
  {
    id: "telephone",
    // La FORME d'un numéro français, jamais une liste de numéros connus.
    motif: /(?:\+33[\s.-]?|\b0)[1-9](?:[\s.-]?\d{2}){4}/u,
    pourquoi:
      "Un numéro français. Notre ligne entrante Alpha Voice est facturée à la minute : publiée, elle s'abuse. Et un numéro de terrain est une donnée personnelle.",
  },
  {
    id: "partenaire",
    motif: /nuwacom/iu,
    pourquoi:
      "Le nom d'un partenaire. Son taux, son dirigeant et la phrase « levier de négociation » vivent dans la doctrine privée. Un partenaire finit toujours par lire le dépôt de son partenaire.",
  },
  {
    id: "absence-de-vente",
    motif: /z[ée]ro vente|aucune vente [àa] ce jour/iu,
    pourquoi:
      "« Zéro vente ». C'est vrai, c'est honnête en interne, et publié c'est l'objection n°1 tendue à chaque prospect qui fait ses devoirs.",
  },
  {
    id: "posture-securite",
    /**
     * ⚠ CE MOTIF A ÉTÉ AJOUTÉ APRÈS COUP, ET C'EST LA LEÇON DU FICHIER.
     *
     * La première version du scanner cherchait des montants, des adresses et
     * des numéros — des formes. Elle a laissé passer trois documents que
     * personne n'aurait dû publier, et elle les a laissés passer PROPREMENT :
     * aucun ne contenait un seul chiffre interdit.
     *
     * Ce qu'ils contenaient : « npm audit : 9 restantes, 3 hautes », la
     * faiblesse CSP exacte, « la clé partagée en clair → à régénérer », et
     * « l'isolation reste à prouver avant de facturer ». Chaque phrase est
     * honnête et a sa place en interne. Publiées à côté d'une application EN
     * LIGNE, elles forment un plan d'attaque daté.
     *
     * ⚠⚠ Un scanner de formes ne remplace pas la lecture. Ce motif attrape la
     * récidive mécanique ; il n'attrapera pas la prochaine phrase du même
     * genre écrite autrement. La règle qui tient vraiment est plus haut, dans
     * la liste d'autorisation : on ne publie que ce qu'on a LU.
     */
    motif: /\bCVE\b|npm audit|vuln[ée]rabilit|unsafe-inline|en clair|[àa] r[ée]g[ée]n[ée]rer|[àa] prouver|non prouv[ée]/iu,
    pourquoi:
      "Un aveu de posture de sécurité. Sur un service en ligne, « ce qui reste à corriger » est un plan d'attaque daté — et ça se traite en privé, avec la personne qui opère le déploiement.",
  },
  {
    id: "cible-commerciale",
    motif: /permis de construire|ma[îi]tres? d'ouvrage/iu,
    pourquoi: "Notre ciblage. L'ICP est du travail de recherche : le publier, c'est l'offrir au premier concurrent qui passe.",
  },
];

/**
 * ─────────────────────────────────────────────────────────────────────
 * LES LIENS QUI NE MÈNENT PLUS NULLE PART.
 *
 * Les docs internes se citent entre elles et citent le code : `[lib/x](../lib/x.ts)`.
 * Copiées telles quelles dans un dépôt qui n'a ni `lib/` ni les trois quarts
 * des docs, ces quatorze liens deviennent autant de 404.
 *
 * ⚠ Ce n'est pas un détail cosmétique, et le dépôt le dit déjà ailleurs :
 * « une référence morte rend le micro impossible — quelqu'un clique pour aller
 * voir, il n'y a rien, donc il conclut que la carte est périmée, donc il cesse
 * de la lire. » Un extrait public criblé de liens morts dit « bricolé »
 * exactement à la personne qu'on voulait impressionner.
 *
 * On ne réécrit pas la cible et on n'invente pas d'URL : le lien devient un
 * simple `code`. Le nom du fichier reste lisible — c'est l'information utile —
 * et plus rien ne promet une page qui n'existe pas.
 * ─────────────────────────────────────────────────────────────────────
 */
export function delier(contenu, cible, exportees) {
  const dossier = cible.includes("/") ? cible.slice(0, cible.lastIndexOf("/")) : "";

  return contenu.replace(/\[([^\]]+)\]\(([^)\s]+)\)/gu, (entier, texte, lien) => {
    // Externe ou ancre interne : on ne touche pas.
    if (/^(?:https?:|mailto:|#)/u.test(lien)) return entier;

    const sansAncre = lien.split("#")[0];
    if (!sansAncre) return entier;

    // Résolution manuelle : pas de `path.resolve`, qui préfixerait la racine
    // du disque et ferait échouer la comparaison avec des chemins relatifs.
    const morceaux = [];
    for (const bout of `${dossier}/${sansAncre}`.split("/")) {
      if (bout === "" || bout === ".") continue;
      if (bout === "..") morceaux.pop();
      else morceaux.push(bout);
    }
    if (exportees.has(morceaux.join("/"))) return entier;
    // Le libellé est souvent DÉJÀ un `code` : le réencadrer produirait des
    // doubles accents graves. On garde le texte tel quel dans ce cas.
    return /^`.*`$/su.test(texte) ? texte : `\`${texte}\``;
  });
}

/** Un motif interdit trouvé dans un contenu, ou `null`. */
export function scanner(contenu) {
  for (const regle of INTERDITS) {
    const global = new RegExp(regle.motif.source, regle.motif.flags.includes("g") ? regle.motif.flags : regle.motif.flags + "g");
    for (const m of contenu.matchAll(global)) {
      // Une tolérance ne s'applique qu'à SON motif, et sur l'extrait trouvé —
      // pas sur le fichier entier, sinon un seul `@example.com` blanchirait
      // toutes les autres adresses du document.
      if (regle.tolere && regle.tolere.test(m[0])) continue;
      const ligne = contenu.slice(0, m.index ?? 0).split("\n").length;
      return { id: regle.id, extrait: m[0], ligne, pourquoi: regle.pourquoi };
    }
  }
  return null;
}

/** Vérifie toute la liste sans rien écrire. Rend les motifs trouvés. */
export function verifier(racine = process.cwd()) {
  const problemes = [];
  for (const entree of AUTORISES) {
    const chemin = join(racine, entree.source);
    if (!existsSync(chemin)) {
      problemes.push({ fichier: entree.source, id: "absent", pourquoi: "Fichier autorisé mais introuvable : la liste ment." });
      continue;
    }
    const trouve = scanner(readFileSync(chemin, "utf8"));
    if (trouve) problemes.push({ fichier: entree.source, ...trouve });
  }
  return problemes;
}

// ── Exécution ──────────────────────────────────────────────────────────
// `import.meta.main` n'existe pas partout ; on compare les chemins.
const lanceDirectement = process.argv[1] && resolve(process.argv[1]) === resolve(new URL(import.meta.url).pathname);

if (lanceDirectement) {
  const racine = process.cwd();
  const sortie = resolve(racine, process.argv[2] ?? ".export-public");

  const problemes = verifier(racine);
  if (problemes.length > 0) {
    console.error("\n⛔ EXPORT REFUSÉ — rien n'a été écrit.\n");
    for (const p of problemes) {
      console.error(`  ${p.fichier}${p.ligne ? `:${p.ligne}` : ""}  [${p.id}]`);
      if (p.extrait) console.error(`      trouvé : « ${p.extrait} »`);
      console.error(`      ${p.pourquoi}\n`);
    }
    console.error("Corrige le fichier, ou retire-le de AUTORISES. On ne publie pas « juste cette fois ».\n");
    process.exit(1);
  }

  const exportees = new Set(AUTORISES.map((e) => e.cible));

  rmSync(sortie, { recursive: true, force: true });
  let deliés = 0;
  for (const entree of AUTORISES) {
    const dest = join(sortie, entree.cible);
    mkdirSync(dirname(dest), { recursive: true });
    const brut = readFileSync(join(racine, entree.source), "utf8");
    const propre = delier(brut, entree.cible, exportees);
    if (propre !== brut) deliés++;
    writeFileSync(dest, propre);
    console.log(`  ✓ ${entree.source}  →  ${entree.cible}${propre !== brut ? "  (liens internes déliés)" : ""}`);
  }

  console.log(`\n${AUTORISES.length} fichiers exportés dans ${sortie} · ${deliés} fichier(s) déliés`);
  console.log("Aucun motif interdit trouvé. Ce dossier ne contient PAS de dépôt git —");
  console.log("la publication reste un geste humain, dans un dépôt distinct.\n");
}
