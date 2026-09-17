import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

/**
 * ─────────────────────────────────────────────────────────────────────
 * LE DÉFAUT N°1 DU DÉPÔT DEVIENT MESURABLE — 17/09/2026.
 *
 * `CLAUDE.md` le dit depuis des semaines, en prose :
 *
 *   « Avant de dire qu'une fonctionnalité est livrée : chercher qui
 *     l'importe. Un export `lib/` que rien ne consomme est MORT, pas prêt. »
 *
 * ⚠⚠ ET RIEN NE LE VÉRIFIAIT. C'est-à-dire : la règle qui décrit la panne la
 * plus fréquente de ce dépôt souffrait elle-même de cette panne. Une règle en
 * prose n'est pas une règle — `forbidden`, `structuralPain`, la faisabilité
 * de routage et la cadence de cadrage l'ont déjà payé.
 *
 * ══ CE QUE CE TEST MESURE, ET POURQUOI C'EST CETTE UNITÉ-LÀ ══
 *
 * Trois granularités ont été essayées, et les deux premières sont fausses :
 *
 * · **Le MODULE** : mesuré, 2 sur 199 ne sont importés que par un test
 *   (`valeur-produite`, `ceo-historique`), et les deux sont documentés comme
 *   délibérément inertes. À cette échelle, le dépôt est sain — et le défaut de
 *   ce matin (`renderDevis`) serait passé, puisqu'il vit dans un module
 *   parfaitement branché.
 * · **Le SYMBOLE, sans distinguer l'usage interne** : 141 résultats, presque
 *   tous faux. Un helper appelé par sa propre fonction publique n'est pas mort.
 * · **La FONCTION exportée qu'AUCUN fichier de production n'appelle — pas même
 *   son propre module** : 43. C'est l'unité juste, et c'est celle qui attrape
 *   `renderDevis`.
 *
 * ══ CE QUE LE TEST FAIT, ET CE QU'IL NE FAIT PAS ══
 *
 * Il **gèle l'inventaire**. Il ne supprime rien et n'exige pas qu'on répare les
 * 43 : beaucoup sont légitimes (voir les motifs plus bas). Ce qu'il empêche,
 * c'est la **44ᵉ** — écrire une règle juste, la tester, et la laisser sans
 * appelant en croyant l'avoir livrée.
 *
 * ⚠ Une entrée s'ajoute avec son MOTIF, jamais seule. Sans ça la liste devient
 * une décharge où l'on inscrit une fonction plutôt que de la brancher — le
 * risque nommé pour la liste d'exceptions de `tests/marque-morte.test.ts`.
 *
 * ⚠ LA LIMITE, ÉCRITE PLUTÔT QUE TUE : le test regarde UN niveau. Une fonction
 * appelée uniquement par une autre fonction elle-même morte passe au travers.
 * Une vraie accessibilité transitive demanderait un graphe d'appels ; ce n'est
 * pas fait, et le savoir vaut mieux que croire le contrôle total.
 * ─────────────────────────────────────────────────────────────────────
 */

const R = process.cwd();
const sansCommentaires = (s: string) => s.replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, "");

function fichiers(): string[] {
  const out: string[] = [];
  const parcourir = (d: string) => {
    for (const e of readdirSync(join(R, d), { withFileTypes: true })) {
      if ([".next", ".git", ".test-build", "node_modules", "donnees-privees"].includes(e.name)) continue;
      const rel = `${d}/${e.name}`;
      if (e.isDirectory()) parcourir(rel);
      else if (/\.tsx?$/.test(e.name)) out.push(rel.replace(/^\.\//, ""));
    }
  };
  for (const racine of ["app", "components", "lib", "tests", "scripts"]) {
    try {
      parcourir(racine);
    } catch {
      /* dossier absent : rien à parcourir */
    }
  }
  return out;
}

/**
 * Les fonctions dont AUCUN fichier de production n'a besoin, avec la raison de
 * leur présence. Le motif se lit en une ligne ; s'il tient mal debout, c'est
 * que la fonction demande à être branchée ou supprimée.
 */
const TOLEREES: Record<string, string> = {
  // ── Inertes par DÉCISION, et la doctrine le dit dans CLAUDE.md ──
  "lib/valeur-produite.ts:peutFacturerSur": "cohorte non mesurée : mesurer se DÉCIDE, ça ne se code pas en douce",
  "lib/valeur-produite.ts:lireCohorte": "idem — le serveur ne voit rien d'un compte gratuit, et c'est la promesse",
  "lib/valeur-produite.ts:etatDuDispositif": "distingue « rien ne remonte » de « personne n'utilise » — sans cohorte, rien à distinguer",
  "lib/ceo-historique.ts:appliquerReleve": "l'historique du CEO attend une base ; inerte assumé",
  "lib/ceo-historique.ts:resoluesDepuis": "lit les pannes résolues depuis un relevé, qui n'est pas encore stocké",
  "lib/veille.ts:capacitesPour": "la table CAPACITES est VIDE, et c'est l'état honnête",
  "lib/marche.ts:prixConseille": "relevé de marché : il informe une DÉCISION humaine, il ne fixe aucun prix",
  "lib/positionnement.ts:positionnerBriques": "idem — rapprochement lu par un humain, jamais appliqué",
  "lib/taux-horaire.ts:coutHoraireSalarie": "ancrage de négociation, pas un calcul de facture",

  // ── Attendent une brique que Zakaria n'a pas encore posée ──
  "lib/webpush.ts:generateVapidKeys": "outil de génération de clés : s'exécute une fois, à la main",
  "lib/apporteur-attribution.ts:engendreCode": "programme d'apport pas ouvert ; migration 007 posée, pas d'écran",
  "lib/apporteur-attribution.ts:parrainageMemorise": "lit le code d'apport mémorisé dans le navigateur ; rien ne le pose encore",
  "lib/apporteur-attribution.ts:oublieParrainage": "efface ce code une fois l'attribution faite ; sans écran, rien à effacer",
  "lib/organisation.ts:peutCreerSousCompte": "multi-utilisateur livré côté base (003), pas côté écran",
  "lib/organisation.ts:accesContenuAutorise": "arbitre l'accès support au CONTENU d'un client ; aucun écran ne le demande encore",
  "lib/gmail-draft.ts:buildDraftBatch": "brouillons Gmail : connecteur non branché",
  "lib/gmail-draft.ts:sendableDrafts": "filtre les brouillons réellement envoyables ; pas de connecteur Gmail branché",
  "lib/linkedin-plan.ts:hygieneInvitations": "plan LinkedIn : rampe et hygiène calculées, écran pas encore fait",
  "lib/linkedin-plan.ts:entonnoir": "entonnoir invitations→acceptations→réponses ; aucun écran ne l'affiche",
  "lib/registre-entreprises.ts:nafPourVerticale": "appariement au registre : pas de source de données branchée",
  "lib/registre-entreprises.ts:apparier": "apparie une fiche à une entreprise du registre ; aucune source de données branchée",

  // ── Vérifications de cohérence : elles servent AU TEST, c'est leur emploi ──
  "lib/entitlements-provision.ts:offresSansDroits": "audit de cohérence offres↔droits, joué par le test",
  "lib/offres-publiques.ts:validerOffres": "audit de cohérence de la grille publique, joué par son test",

  // ── Helpers exposés pour être testés unitairement ──
  "lib/credentials.ts:cleOuvreLeChemin": "BYOK : dit si une clé apportée ouvre un chemin ; le serveur tranche via credentials-secret",
  "lib/offres-publiques.ts:palierLifetime": "palier à vie : offre non ouverte, aucune place en vente aujourd'hui",
  "lib/ai-context.ts:estimateCostEUR": "estimation de coût jetons, lue par aucun écran aujourd'hui",
  "lib/alpha-ceo.ts:parNature": "regroupement de sondes, utilisé par le test de forme",
  "lib/bricks.ts:unlockedRoutes": "dérivation de routes, doublée côté entitlements",
  "lib/call-cadence.ts:plannedRecalls": "la cadence servie passe par les fonctions de plus haut niveau",
  "lib/call-log.ts:conversationContext": "contexte d'appel assemblé ailleurs",
  "lib/call-outcome.ts:transcriptNote": "note de transcription : RESULTATS_MANUELS est la source servie",
  "lib/capacite-appels.ts:fichesNecessaires": "dimensionnement inverse, lu à la main",
  "lib/email-ramp.ts:mailboxesNeeded": "conseil de dimensionnement, jamais une borne",
  "lib/offer-catalogue.ts:offrePourFamille": "recherche par famille : le routage passe par la famille elle-même",
  "lib/offer-match.ts:auditBenefice": "bénéfice d'audit, calculé par le module appelant",
  "lib/opportunites.ts:opportunityById": "recherche par id, l'écran itère sur la liste",
  "lib/references.ts:utilisables": "filtre de références, le Cerveau applique le sien",
  "lib/segments.ts:segmentsForBrick": "segments par brique : l'écran passe par le compte",
  "lib/segments.ts:segmentsForAccount": "segments par compte ; l'écran les dérive de la famille d'offre",
  "lib/vital-signs.ts:triageByReadiness": "tri par état vital, l'écran trie lui-même",

  // ── ⚠ CEUX-LÀ SONT DE VRAIS RESTES, ET ILS SONT NOMMÉS COMME TELS ──
  "lib/proposition-commerciale.ts:renderDevis":
    "⚠ RESTE. Deuxième rendu de devis, inatteignable. Sûr (il appelle la règle), mais à trancher : l'enrichir ou le supprimer.",
  "lib/proposition-commerciale.ts:estRefus":
    "⚠ RESTE. Discriminant du précédent : il meurt ou vit avec lui.",
  "lib/essai.ts:finDEssai":
    "⚠ RESTE. L'état de fin d'essai se calcule dans `etatEssai` ; celui-ci n'a jamais eu d'appelant.",
  "lib/secteurs-interdits.ts:interdictionPour":
    "⚠ RESTE, et INATTEIGNABLE PAR CONSTRUCTION : il s'indexe sur des identifiants (formation-cpf, renovation-energetique, assurance) qui n'existent ni dans `Sector` ni dans les verticales. Aucun appelant n'est possible sans inventer un vocabulaire de plus.",
};

function fonctionsSansAppelant(): string[] {
  const tous = fichiers();
  const texte = new Map(tous.map((p) => [p, sansCommentaires(readFileSync(join(R, p), "utf8"))]));
  const production = tous.filter((p) => !p.startsWith("tests/"));
  const tests = tous.filter((p) => p.startsWith("tests/"));
  const corpusTests = tests.map((p) => texte.get(p)!).join("\n");

  const mortes: string[] = [];
  for (const f of tous.filter((p) => p.startsWith("lib/"))) {
    const src = texte.get(f)!;
    for (const m of src.matchAll(/^export\s+(?:async\s+)?function\s+([A-Za-z_$][\w$]*)/gm)) {
      const nom = m[1];
      const mot = new RegExp(`\\b${nom}\\b`);
      // Un autre fichier de PRODUCTION l'appelle ⇒ vivante.
      if (production.some((p) => p !== f && mot.test(texte.get(p)!))) continue;
      // Son propre module l'utilise ⇒ vivante si le module l'est (voir la limite en tête).
      if ((src.match(new RegExp(`\\b${nom}\\b`, "g")) ?? []).length > 1) continue;
      if (mot.test(corpusTests)) mortes.push(`${f}:${nom}`);
    }
  }
  return mortes.sort();
}

test("⚠⚠ AUCUNE NOUVELLE FONCTION `lib/` SANS APPELANT DE PRODUCTION", () => {
  const trouvees = fonctionsSansAppelant();
  const nouvelles = trouvees.filter((c) => !(c in TOLEREES));

  assert.deepEqual(
    nouvelles,
    [],
    "Ces fonctions sont testées et appelées par AUCUN code de production.\n" +
      "C'est le défaut le plus fréquent de ce dépôt : un mécanisme juste, testé, branché à rien.\n" +
      "Branche-les, supprime-les, ou inscris-les dans TOLEREES AVEC LEUR MOTIF :\n  " +
      nouvelles.join("\n  "),
  );
});

test("⚠ LA LISTE NE GARDE PAS D'ENTRÉE PÉRIMÉE", () => {
  /**
   * Le pendant obligatoire. Sans lui, la liste ne fait que grossir : une
   * fonction branchée ou supprimée y resterait, et la prochaine session
   * lirait un inventaire qui ment. Même règle que les autorisations de
   * `tests/marque-morte.test.ts`, qui refusent de survivre à leur fichier.
   */
  const trouvees = new Set(fonctionsSansAppelant());
  const perimees = Object.keys(TOLEREES).filter((c) => !trouvees.has(c) && !c.endsWith(":__placeholder"));

  assert.deepEqual(
    perimees,
    [],
    "Ces entrées ne décrivent plus rien — la fonction a été branchée ou supprimée. Retire-les :\n  " +
      perimees.join("\n  "),
  );
});

test("⚠⚠ CHAQUE TOLÉRANCE PORTE UN MOTIF QUI TIENT DEBOUT", () => {
  /**
   * Une liste d'exceptions sans motifs devient une décharge où l'on inscrit
   * une fonction plutôt que de la brancher. Le motif n'est pas décoratif : il
   * est ce qu'on relit pour décider si l'exception a encore lieu d'être.
   */
  for (const [cle, motif] of Object.entries(TOLEREES)) {
    assert.ok(motif.trim().length >= 25, `${cle} : motif trop court pour dire quoi que ce soit`);
  }

  /**
   * ⚠ Et les VRAIS restes se comptent. Ils sont marqués « ⚠ RESTE » : ce sont
   * ceux qu'on a décidé de ne pas trancher tout de suite, pas ceux qui ont une
   * bonne raison d'exister. Si ce nombre grossit, la liste est en train de
   * devenir la décharge qu'on voulait éviter.
   */
  const restes = Object.entries(TOLEREES).filter(([, m]) => m.startsWith("⚠ RESTE"));
  assert.ok(
    restes.length <= 6,
    `${restes.length} vrais restes tolérés — au-delà de 6, on ne tolère plus, on accumule :\n  ` +
      restes.map(([c]) => c).join("\n  "),
  );
});
