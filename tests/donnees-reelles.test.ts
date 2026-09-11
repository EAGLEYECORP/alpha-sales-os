import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { nomsReels, enseignesToponymiques, DONNEE_PRIVEE_PRESENTE, MOTIF_SKIP_NOMS } from "./noms-reels";

/**
 * ─────────────────────────────────────────────────────────────────────
 * AUCUNE DONNÉE PERSONNELLE RÉELLE DANS LE DÉPÔT.
 *
 * ══ CE QUI EST ARRIVÉ, ET POURQUOI AUCUNE GARDE NE L'A VU ══
 *
 * Le dépôt a été rendu public sur GitHub. Il contenait :
 *  · seize fiches prospects réelles (raison sociale, ville, téléphone,
 *    étape de vente, montant du deal, notes de ce qui s'est dit) ;
 *  · au moins une PERSONNE PHYSIQUE identifiée — nom complet, MOBILE
 *    personnel, poste, employeur, et la note qu'elle avait posé un lapin ;
 *  · une vingtaine d'entreprises lyonnaises avec leurs numéros, dont des
 *    mobiles.
 *
 * ⚠ TROIS GARDES EXISTAIENT DÉJÀ, ET LES TROIS ONT FAIT LEUR TRAVAIL.
 * `tests/vitrine-fuite` tenait ces modules hors du bundle navigateur,
 * `/api/pipeline` est réservé au compte maître, et `store.ts` avait été purgé
 * de son `require()`. Elles empêchaient toutes la donnée d'atteindre un
 * NAVIGATEUR.
 *
 * Aucune n'empêchait le FICHIER d'être lu. Et un dépôt public se lit sans
 * navigateur — il se clone. Le modèle de menace entier supposait un
 * attaquant qui passe par le produit ; celui-là est passé par `git clone`.
 *
 * ══ CE QUE CE TEST GARDE, ET POURQUOI SUR LA FORME ══
 *
 * Il ne connaît aucun nom, aucune liste, aucun prospect — une liste de ce
 * qu'il faut cacher serait elle-même une copie de ce qu'on cache. Il
 * cherche la FORME d'un numéro de téléphone français hors des plages
 * réservées à la fiction. C'est la seule signature commune à toutes ces
 * données, et c'est celle qu'on ne peut pas oublier de mettre à jour.
 * ─────────────────────────────────────────────────────────────────────
 */

const RACINE = process.cwd();

/**
 * Un numéro français : 0X suivi de huit chiffres, séparés ou non.
 * On accepte aussi la forme internationale `+33 X …`.
 */
const NUMERO_FR = /(?:\+33[\s.-]?|0)[1-9](?:[\s.-]?\d{2}){4}/g;

/**
 * Les plages RÉSERVÉES à la fiction par l'ARCEP (décision 2018-0881). Ces
 * numéros ne peuvent ni appeler, ni être appelés, ni être attribués : ils
 * sont la seule façon honnête d'écrire un téléphone dans du code.
 */
const FICTION = ["0199 00", "0261 91", "0353 01", "0465 71", "0536 49", "0639 98"];

/** Numéros de service et d'urgence : publics par nature, jamais personnels. */
const PUBLICS = [
  "0800", "0805", "0806", "0809", // numéros gratuits / spéciaux
  "3244", "3949",
];

/**
 * ── LA SEULE EXCEPTION NOMMÉE, ET ELLE EST À NOUS ──
 *
 * `+33 4 51 22 21 82` est NOTRE ligne entrante Alpha Voice (Telnyx →
 * LiveKit). Elle est publiée sur la vitrine : elle EXISTE pour être appelée,
 * et la documenter dans le dépôt est le contraire d'une fuite — c'est la
 * seule façon de retrouver quel numéro pointe sur quel trunk le jour où
 * l'entrant retombe en panne.
 *
 * ⚠ Elle est listée ICI plutôt que tolérée par une règle de forme, parce
 * qu'une exception qui ne se nomme pas devient une famille. Et il faut
 * savoir ce qu'elle coûte : un dépôt public expose une ligne qui nous est
 * FACTURÉE À LA MINUTE. Ce n'est pas une fuite de données personnelles,
 * c'est une surface d'abus — quelqu'un peut la faire sonner en boucle.
 * Le dépôt repassant en privé, le point devient théorique ; il reste vrai
 * le jour où on le rouvrira.
 */
const NOTRE_LIGNE = "0451222182";

function estFictionOuPublic(brut: string): boolean {
  const n = brut.replace(/[\s.\-]/g, "").replace(/^\+33/, "0");
  const compact = n.slice(0, 6);
  if (FICTION.some((f) => compact.startsWith(f.replace(/\s/g, "")))) return true;
  if (PUBLICS.some((p) => n.startsWith(p))) return true;
  if (n === NOTRE_LIGNE) return true;
  /**
   * ⚠ LES NUMÉROS À CHIFFRES RÉPÉTÉS OU EN SUITE sont manifestement des
   * exemples (une suite croissante, une série de zéros). Les interdire ferait
   * échouer le test sur de la documentation évidente, et pousserait à
   * l'affaiblir. On les tolère par la FORME, pas par une liste.
   */
  const corps = n.slice(2);
  if (/^(\d)\1+$/.test(corps)) return true;

  /**
   * ⚠⚠ LA SUITE CROISSANTE ÉTAIT PROMISE DEUX FOIS EN PROSE ET IMPLÉMENTÉE
   * NULLE PART. Les deux commentaires de cette fonction annoncent qu'on tolère
   * « les chiffres répétés ou EN SUITE » ; seul le cas répété était codé. Le
   * défaut signature du dépôt, dans le garde qui protège la donnée
   * personnelle — trouvé parce qu'il a refusé `0123456789`, qui est un
   * ALPHABET de codes d'apport, pas un numéro.
   *
   * ⚠ LA CONDITION PORTE SUR LE NUMÉRO ENTIER, ET C'EST TOUT LE SUJET. Le
   * commentaire juste en dessous rappelle le cas qui a coûté cher : un
   * indicatif mobile suivi d'une suite croissante ressemble à un exemple et
   * n'en est pas un — c'est un numéro valide qui peut sonner chez quelqu'un.
   * Exiger que la progression couvre TOUS les chiffres exclut ce cas : dès
   * que l'indicatif casse la suite, le numéro reste refusé.
   *
   * ⚠⚠ AUCUN NUMÉRO N'EST ÉCRIT DANS CETTE EXPLICATION, et ce n'est pas une
   * coquetterie : la première rédaction en citait deux en exemple, et le
   * garde a fait tomber SON PROPRE FICHIER. Un garde qui cherche une forme ne
   * distingue pas l'illustration de la donnée — expliquer une règle de
   * non-divulgation reste le moment précis où l'on redivulgue. On décrit la
   * forme, on ne l'écrit pas.
   */
  const suiteConsecutive = (s: string, pas: 1 | -1) =>
    s.length > 2 && [...s].every((c, i) => i === 0 || Number(c) === Number(s[i - 1]) + pas);
  if (suiteConsecutive(n, 1) || suiteConsecutive(n, -1)) return true;
  /**
   * ⚠ « 00 00 00 00 » ET LES SUITES CROISSANTES sont des exemples manifestes,
   * et ils sont partout dans les tests et la doc. Les refuser ne protégerait
   * personne — un numéro à zéros n'est attribué à personne — et pousserait à
   * affaiblir la garde pour faire passer la suite de tests.
   *
   * ⚠⚠ ET C'EST LÀ QUE LE JEU DE DÉMONSTRATION S'EST FAIT ATTRAPER. Un
   * indicatif lyonnais suivi d'une suite de chiffres a l'air d'un exemple et
   * n'en est pas un : c'est un numéro PARFAITEMENT VALIDE qui peut sonner
   * chez quelqu'un. Les huit fiches de démo écrites à la main en portaient.
   * Tout le dépôt a été rebasculé sur la plage ARCEP réservée à la fiction,
   * comme les fiches ENGENDRÉES (`lib/demo-icp.ts`) l'étaient déjà — c'est
   * exactement le défaut qu'on avait corrigé d'un côté et pas de l'autre.
   */
  return false;
}

/** Les fichiers COMMITÉS qu'on inspecte. `donnees-privees/` est hors dépôt. */
function fichiers(): string[] {
  const out: string[] = [];
  const ignore = new Set([
    "node_modules",
    ".git",
    ".next",
    ".test-build",
    "donnees-privees",
    "package-lock.json",
  ]);
  const visiter = (rel: string) => {
    for (const e of readdirSync(join(RACINE, rel), { withFileTypes: true })) {
      if (e.name.startsWith(".") || ignore.has(e.name)) continue;
      const chemin = rel ? `${rel}/${e.name}` : e.name;
      if (e.isDirectory()) visiter(chemin);
      else if (/\.(ts|tsx|js|mjs|json|md|css|html|sql|py)$/.test(e.name)) out.push(chemin);
    }
  };
  visiter("");
  return out;
}

test("⚠ AUCUN NUMÉRO DE TÉLÉPHONE RÉEL DANS LE DÉPÔT", () => {
  /**
   * ⚠ LA GARDE QUI MANQUAIT, ET QUI AURAIT ÉVITÉ LA PUBLICATION.
   *
   * Un numéro de téléphone est la signature la plus fiable d'une donnée
   * personnelle réelle : on n'en écrit pas par hasard, et il en fallait un
   * dans chacune des fiches qui ont fuité. Chercher la FORME plutôt qu'une
   * liste de numéros connus est ce qui rend ce test durable — il attrape
   * celui qu'on ajoutera demain, que personne n'aura pensé à lister.
   *
   * Ce qui reste autorisé : les plages ARCEP réservées à la fiction, les
   * numéros de service publics, et les exemples manifestes (chiffres
   * répétés ou en suite). Tout le reste appartient à quelqu'un.
   */
  const fautes: string[] = [];
  for (const f of fichiers()) {
    const src = readFileSync(join(RACINE, f), "utf8");
    for (const m of src.matchAll(NUMERO_FR)) {
      if (estFictionOuPublic(m[0])) continue;
      const ligne = src.slice(0, m.index).split("\n").length;
      fautes.push(`${f}:${ligne} → ${m[0]}`);
    }
  }
  assert.deepEqual(
    fautes,
    [],
    "numéro(s) de téléphone réel(s) dans le dépôt. Un dépôt se clone : ce qui est ici est publiable.\n" +
      fautes.join("\n")
  );
});

test(
  "⚠ AUCUN NOM DE PROSPECT RÉEL DANS LE DÉPÔT",
  { skip: !DONNEE_PRIVEE_PRESENTE && MOTIF_SKIP_NOMS },
  () => {
    /**
     * ⚠⚠ LA GARDE QUI MANQUAIT PENDANT UN JOUR ENTIER, ET QUI EST LE PENDANT
     * EXACT DE CELLE DES TÉLÉPHONES, JUSTE AU-DESSUS.
     *
     * Les téléphones étaient cherchés dans TOUT fichier commité, parce qu'« un
     * dépôt public ne se visite pas, il se clone ». Les NOMS, eux, n'étaient
     * cherchés que dans le bundle client (`vitrine-fuite.test.ts`) — c'est-à-dire
     * sous le modèle de menace « atteindre un navigateur », précisément celui
     * dont ce fichier explique en tête qu'il était insuffisant.
     *
     * Deux portées pour la même question, et c'est la plus étroite qui gardait
     * les noms. Mesuré : dix-huit fichiers de `lib/`, `tests/`, `docs/` et
     * `voice/` portaient des raisons sociales réelles, hors bundle, donc hors
     * garde. Aucune n'avait jamais fait tomber un test.
     *
     * Le garde du bundle a été RETIRÉ, pas doublé : il posait la même question
     * sur un sous-ensemble strict, et deux définitions d'une règle divergent
     * toujours — c'est celle qu'on ne relit pas qui cesse de mordre.
     */
    const noms = nomsReels();
    const enseignes = enseignesToponymiques();

    // Non-vacuité : sans elle, une extraction cassée rendrait `[]` et ce test
    // passerait en vert sans rien chercher. C'est le piège déjà payé ici.
    assert.ok(noms.length >= 10, `extraction des noms cassée : ${noms.length} nom(s) lu(s)`);

    /**
     * ⚠⚠ IL Y AVAIT UNE EXEMPTION ICI, ET ELLE A LAISSÉ PASSER UN VRAI NOM.
     *
     * Elle disait : « le module d'extraction cite forcément ce qu'il extrait »
     * et sautait `tests/noms-reels.ts`. C'était faux — ce module lit les
     * sources privées À L'EXÉCUTION, il n'a aucun besoin de citer un nom. Son
     * commentaire en citait pourtant un, en exemple pédagogique, et
     * l'exemption que j'avais écrite de ma main l'a rendu invisible.
     *
     * Trouvé en construisant la liste de réécriture d'historique, PAS par ce
     * test : l'invariant « aucun motif ne doit matcher l'arbre propre » a
     * signalé l'enseigne, et c'est ce qui a révélé le trou.
     *
     * La règle générale, écrite dans `CLAUDE.md` le même jour : **expliquer
     * une règle de non-divulgation est exactement le moment où l'on
     * redivulgue.** Plus aucun fichier n'est exempté ici.
     */
    const fautes: string[] = [];
    for (const f of fichiers()) {
      const src = readFileSync(join(RACINE, f), "utf8");
      for (const nom of noms) {
        const re = new RegExp(`\\b${nom.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`);
        if (re.test(src)) fautes.push(`${f} → « ${nom} »`);
      }
      for (const re of enseignes) {
        const m = src.match(re);
        if (m) fautes.push(`${f} → « ${m[0]} »`);
      }
    }

    assert.deepEqual(
      fautes,
      [],
      "des noms de prospects réels sont écrits dans des fichiers commités :\n  " + fautes.join("\n  ")
    );
  }
);

test("⚠ le dossier des données réelles est IGNORÉ PAR GIT", () => {
  /**
   * Sortir la donnée du code ne sert à rien si le dossier qui l'accueille
   * finit commité au premier `git add -A`. C'est le geste le plus courant du
   * dépôt, et il ne demande jamais confirmation.
   */
  const ignore = readFileSync(join(RACINE, ".gitignore"), "utf8");
  assert.match(ignore, /^donnees-privees\/?$/m, "`donnees-privees/` doit être dans .gitignore");
});

test("⚠ les modules de données réelles CHARGENT, ils ne CONTIENNENT plus", () => {
  /**
   * Le défaut inverse du câblage : ici, on veut qu'un module reste VIDE. Le
   * risque est qu'une session suivante « répare » le pipeline de juillet en
   * recollant les fiches dans le fichier, en croyant réparer une régression.
   * Le test dit ce qui est voulu.
   */
  /**
   * ⚠⚠ CETTE GARDE A LAISSÉ PASSER SIX RENDEZ-VOUS RÉELS PENDANT UN JOUR.
   *
   * Elle refusait `phone: "…"`. Or `lib/pipeline-juillet.ts` gardait un
   * tableau de six rendez-vous datés — raison sociale réelle dans `title`,
   * date et heure dans `date` — et un rendez-vous ne porte pas de téléphone.
   * Le garde était écrit sur LA FORME QU'ON VENAIT DE VOIR fuiter, donc il
   * n'attrapait que celle-là. Même leçon que `MOTIF_APPELS_NON_PRIS`, payée
   * une troisième fois.
   *
   * La règle est donc devenue STRUCTURELLE, et c'est la seule qui tienne :
   * dans un module CHARGEUR, aucun champ d'enregistrement ne reçoit un
   * littéral de chaîne. `company: s.company` (un identifiant, une projection)
   * reste permis ; `company: "…"` (une donnée) ne l'est pas. Le module décrit
   * une FORME et va chercher le CONTENU ailleurs — c'est toute sa raison
   * d'être, et c'est vérifiable sans jamais lister ce qu'on cache.
   *
   * ⚠ `id:` est volontairement absent de la liste : les identifiants
   * techniques engendrés (`${s.id}-obj-${i}`) en portent légitimement, et un
   * identifiant seul ne désigne personne. C'est le couple champ + littéral
   * PORTEUR DE SENS qu'on refuse.
   */
  const CHAMPS_DE_DONNEE = ["phone", "email", "company", "name", "title", "notes", "summary", "city", "address", "adresse"];

  /**
   * ⚠⚠ LE MOTIF A ÉTÉ ANCRÉ EN DÉBUT DE LIGNE À MA PREMIÈRE ÉCRITURE, ET IL
   * N'AURAIT PAS ATTRAPÉ LA FUITE QU'IL EST CENSÉ INTERDIRE.
   *
   * Les six rendez-vous fuités tenaient chacun sur UNE ligne :
   * `{ id: "…", prospectId: "…", title: "Démo …", date: "…" }`. Un `^\s*title:`
   * ne voit rien là-dedans — il ne voit que le champ mis en tête de ligne par
   * un formateur. J'ai écrit le garde, puis muté, et c'est la mutation qui l'a
   * dit : elle est repassée VERTE. Écrire le commentaire « un garde par motif
   * n'attrape que ce qu'on a déjà vu » ne dispense pas de le vérifier sur le
   * garde qu'on est en train d'écrire.
   *
   * Le champ se reconnaît donc après `{`, après `,` ou en début de ligne —
   * c'est-à-dire partout où une propriété d'objet peut réellement commencer.
   */
  const litteral = new RegExp(`(?:^|[{,])\\s*(?:${CHAMPS_DE_DONNEE.join("|")}):\\s*["'\`]`);

  /**
   * Les commentaires sont retirés AVANT la recherche. Ils sont autorisés à
   * citer la forme interdite — la doctrine du dépôt tient à ce qu'une garde
   * explique ce qu'elle refuse, et ce fichier même écrit `phone: "…"` pour
   * dire ce qui ne doit pas revenir. Sans cette découpe, le garde mordrait
   * sur sa propre explication, et on l'assouplirait au mauvais endroit.
   */
  const sansCommentaires = (src: string) =>
    src.replace(/\/\*[\s\S]*?\*\//g, (bloc) => bloc.replace(/[^\n]/g, " ")).replace(/\/\/[^\n]*/g, "");

  for (const f of ["lib/pipeline-juillet.ts", "lib/prospects-icp.ts"]) {
    const src = readFileSync(join(RACINE, f), "utf8");
    assert.match(src, /donnees-privees/, `${f} doit charger depuis le dossier privé`);
    const fautes = sansCommentaires(src)
      .split("\n")
      .map((l, i) => [i + 1, l] as const)
      .filter(([, l]) => litteral.test(l));
    assert.deepEqual(
      fautes.map(([n, l]) => `${f}:${n} → ${l.trim()}`),
      [],
      `${f} est un CHARGEUR : il décrit une forme, il ne contient pas de donnée. ` +
        "Un champ d'enregistrement assigné à un littéral de chaîne est une fiche recollée dans le dépôt."
    );
  }
});

test("un module de données absent rend VIDE, jamais une exception", () => {
  /**
   * Sur une machine sans le dossier privé — un contributeur, la CI, un
   * déploiement neuf — le pipeline de juillet doit être vide, pas cassé.
   * Jeter ferait tomber une route entière pour une donnée qui, par
   * construction, n'est pas censée être partout.
   */
  return import("../lib/pipeline-juillet").then(({ pipelineJuillet }) => {
    const r = pipelineJuillet();
    assert.ok(Array.isArray(r.prospects), "doit rendre un tableau, même vide");
    assert.ok(Array.isArray(r.meetings));
  });
});

test("⚠ les CHIFFRES agrégés restent — ils n'identifient personne", () => {
  /**
   * Ce qu'on protège, ce sont les personnes, pas les enseignements. « 78
   * prospects travaillés, 132 appels, 6 RDV, 0 gagné » ne désigne personne
   * et c'est la seule chose dont la doctrine se sert. Les effacer par excès
   * de prudence détruirait la mesure sans protéger qui que ce soit.
   */
  return import("../lib/pipeline-juillet").then(({ JUILLET_REEL }) => {
    assert.ok(JUILLET_REEL.prospectsTravailles > 0);
    assert.ok(JUILLET_REEL.appels > 0);
    assert.equal(JUILLET_REEL.gagnes, 0, "zéro gagné : le chiffre le plus utile du lot");
  });
});
