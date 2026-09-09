import { test } from "node:test";
import assert from "node:assert/strict";
import { PERMIS_DEMO, PERMIS_PAR_FICHE, seedProspects, isDemoProspect, DOMAINES_RESERVES } from "../lib/seed";
import { lirePermis, trierPermis, communeDansLaZone } from "../lib/permis-construire";
import { deepDive } from "../lib/deep-dive";

/**
 * ─────────────────────────────────────────────────────────────────────
 * LE JEU DE DÉMONSTRATION NE PEUT PAS CONTREDIRE LA DOCTRINE DE CIBLAGE.
 *
 * ══ CE QUE CE FICHIER GARDE ══
 *
 * Le premier bouton de l'app est « Explorer la démo ». Ce que ces fiches
 * montrent est donc la première chose qu'un prospect apprend du produit — et
 * pendant des mois, elles décrivaient un bouchon lyonnais, un pub irlandais et
 * deux sociétés d'ambulances, c'est-à-dire le marché d'AVANT l'avatar.
 *
 * L'avatar décidé est le maître d'ouvrage professionnel à permis actif, sur
 * Lyon et Villeurbanne. Le module qui l'implémente existe
 * (`lib/permis-construire.ts`). Écrire des fiches « qui y ressemblent » à
 * la main suffirait à les faire diverger dès la session suivante : on ajoute
 * une fiche, personne ne rejoue le trieur, et la démo se met à montrer une
 * cible que le produit refuse.
 *
 * On rejoue donc chaque arrêté dans le VRAI `lirePermis`. C'est ce qui rend
 * ce lien mécanique plutôt que déclaratif.
 * ─────────────────────────────────────────────────────────────────────
 */

const numeroDe = (p: { numero?: string }) => (p.numero ?? "").trim();

// ═══════════ LE LIEN FICHE → ARRÊTÉ ═══════════

test("⚠ CHAQUE FICHE DE DÉMO DESCEND D'UN ARRÊTÉ QUE LE TRIEUR RETIENT", () => {
  /**
   * ⚠ Mutation vérifiée : passer la commune d'un permis de `PERMIS_DEMO` à
   * « Bron », ou son demandeur à « M. et Mme X », ou sa date à trois ans, fait
   * tomber CE test et lui seul. C'est exactement le geste qu'on veut rendre
   * impossible en silence.
   */
  const parNumero = new Map(PERMIS_DEMO.map((p) => [numeroDe(p), p]));

  for (const fiche of seedProspects) {
    const numero = PERMIS_PAR_FICHE[fiche.id];
    assert.ok(numero, `la fiche ${fiche.id} ne déclare aucun arrêté — elle sort d'où ?`);

    const permis = parNumero.get(numero);
    assert.ok(permis, `${fiche.id} déclare ${numero}, absent de PERMIS_DEMO`);

    const lecture = lirePermis(permis!);
    assert.equal(
      lecture.retenu,
      true,
      `${fiche.id} — le trieur REFUSE son propre arrêté (${lecture.risques.join(" | ") || "score " + lecture.score})`
    );
    assert.equal(lecture.problemeDeVente, true, `${fiche.id} — ce maître d'ouvrage n'a rien à vendre`);
    assert.equal(communeDansLaZone(permis!.commune), true, `${fiche.id} — hors de Lyon + Villeurbanne`);
  }

  // Et la table ne contient PAS de fiche fantôme : une entrée qui ne
  // correspond à rien laisserait croire qu'une fiche est couverte.
  const ids = new Set(seedProspects.map((p) => p.id));
  for (const id of Object.keys(PERMIS_PAR_FICHE)) {
    assert.ok(ids.has(id), `PERMIS_PAR_FICHE nomme ${id}, qui n'existe plus dans le jeu de démo`);
  }
});

test("⚠ le lot de démonstration MONTRE le filtre en train de travailler", () => {
  /**
   * Les trois arrêtés écartés ne produisent aucune fiche, et c'est tout leur
   * intérêt : « 8 fiches » ne dit rien du travail fait, « 8 retenus sur 11 »
   * le dit. Chacun sort par une règle DIFFÉRENTE — si les trois sortaient pour
   * la même raison, le lot ne prouverait qu'une chose sur trois.
   */
  const lot = trierPermis([...PERMIS_DEMO]);

  assert.equal(lot.retenus.length, seedProspects.length, "un retenu, une fiche — pas plus, pas moins");
  assert.ok(lot.ecartes.length >= 3, `le lot doit montrer des écartés (${lot.ecartes.length})`);

  const raisons = lot.ecartes.map((e) => e.ciblage.risques.join(" ") + " " + e.ciblage.typeMoa);
  assert.ok(
    raisons.some((r) => /particulier/.test(r)),
    "une personne physique doit être écartée : elle construit une fois et ne vend rien"
  );
  assert.ok(
    raisons.some((r) => /hors zone/i.test(r)),
    "un permis hors Lyon + Villeurbanne doit être écarté"
  );
  assert.ok(
    raisons.some((r) => /validité|périm/i.test(r)),
    "un permis au-delà de sa validité doit être écarté"
  );

  // Le résumé compte les hors-zone À PART : « rien à vendre » est le
  // fonctionnement normal d'un export, « hors zone » veut dire que le fichier
  // a été tiré trop large — deux gestes différents.
  assert.ok(
    lot.resume.some((r) => /hors zone/i.test(r)),
    `le résumé doit nommer les hors-zone : ${lot.resume.join(" | ")}`
  );
});

// ═══════════ LES QUATRE GARANTIES, SUR LE JEU ÉCRIT À LA MAIN ═══════════

test("⚠ les garanties structurelles valent AUSSI pour les fiches écrites à la main", () => {
  /**
   * ⚠ ELLES ÉTAIENT TENUES PAR `lib/demo-icp.ts` ET PAS PAR `lib/seed.ts`.
   *
   * Le jeu ENGENDRÉ respectait les quatre depuis le début ; le jeu écrit à la
   * main — celui qu'on voit en premier — n'en respectait qu'une et demie :
   * identifiants `p-…` couverts par une liste tenue à la main, et surtout des
   * adresses sur des domaines INVENTÉS en `.fr`. Un domaine inventé peut être
   * déposé par n'importe qui demain ; `example.com` est réservé à jamais par
   * la RFC 2606. Corrigé d'un côté, oublié de l'autre — le motif du dépôt.
   */
  for (const p of seedProspects) {
    assert.ok(p.id.startsWith("demo-"), `${p.id} — le préfixe réservé rend la détection STRUCTURELLE`);
    assert.equal(isDemoProspect(p.id), true, `${p.id} n'est pas reconnu comme fiche de démo`);
    assert.match(p.company, /\(démo\)/, `${p.company} — le marqueur doit être DANS le nom, pas dans un champ à côté`);

    if (p.email) {
      /**
       * ⚠ ON N'INTERROGE PAS `estAdresseDeDemo` ICI, ET C'EST LE POINT.
       *
       * Cette fonction répond vrai par deux chemins : appartenance à
       * `EMAILS_DE_DEMO` — une liste DÉRIVÉE de `seedProspects` — ou domaine
       * réservé. Sur les fiches du seed, le premier chemin répond toujours
       * oui : l'assertion serait une tautologie.
       *
       * Mesuré : la première version de ce test passait encore après avoir
       * remis une adresse sur un `.fr` inventé. C'est exactement le piège du
       * dépôt — asserter la PRÉSENCE du bon résultat au lieu de la CONDITION
       * qui doit le produire. On vérifie donc la moitié STRUCTURELLE, celle
       * qui protège quand l'identifiant n'arrive pas jusqu'au serveur.
       */
      const a = p.email.trim().toLowerCase();
      assert.ok(
        DOMAINES_RESERVES.some((d) => a.endsWith(d)),
        `${p.email} — une adresse de démo doit vivre sur un domaine RÉSERVÉ (RFC 2606), pas sur un .fr inventé qui peut être déposé demain`
      );
    }
    if (p.phone) {
      const compact = p.phone.replace(/[\s.-]/g, "");
      assert.ok(
        ["019900", "026191", "035301", "046571", "053649", "063998"].some((f) => compact.startsWith(f)),
        `${p.phone} — hors des plages ARCEP réservées à la fiction (décision 2018-0881) : ce numéro peut sonner chez quelqu'un`
      );
    }
  }
});

// ═══════════ CE QUE LA DÉMO DOIT MONTRER DU PRODUIT ═══════════

test("⚠ la démo route vers PLUSIEURS offres, sinon elle ne montre qu'un tiers du produit", () => {
  /**
   * ⚠ CE TEST EXISTE PARCE QUE LE CAS S'EST DÉJÀ PRODUIT : `deepAudit` était
   * vide sur les huit fiches, le routeur n'avait aucun signal, et les huit
   * partaient en « visibilité ». Alpha Voice — le diagnostic central du
   * produit — ne s'affichait NULLE PART, sur le jeu de données prévu pour
   * montrer le produit.
   */
  const offres = seedProspects.map((p) => deepDive(p, "eagleye").offer);
  const distinctes = new Set(offres);
  assert.ok(distinctes.size >= 2, `toutes les fiches routent pareil (${[...distinctes].join(", ")})`);
  assert.ok(
    offres.filter((o) => o === "alpha-voice").length >= 2,
    "une démonstration d'Alpha Voice ne tient pas sur un cas unique"
  );
});

test("⚠ aucune fiche de démo ne cite une AUTRE fiche comme référence client", () => {
  /**
   * ⚠ CE QUE LE JEU PRÉCÉDENT FAISAIT, ET QU'AUCUN GARDE N'ATTRAPAIT.
   *
   * Il contenait une chaîne de recommandation complète : une menuiserie
   * « signée », puis une fiche dont l'offre personnalisée disait « même
   * formule que Charbonnier (preuve sociale directe) » et dont les notes
   * portaient « la preuve pour lui est déjà faite par Sylvie ». Le concurrent
   * de démonstration, lui, annonçait « Preuve : Paddy's Corner nous
   * recontactera ».
   *
   * `tests/preuve-sociale.test.ts` ne l'a pas vu : son motif cherche des
   * POSSESSIFS (« nos clients », « qu'on équipe »). Une référence NOMMÉE n'en
   * porte aucun — et c'est la forme la plus convaincante des trois. Zéro vente
   * à ce jour : une consigne qui dit à l'opérateur de citer un client fabrique
   * la preuve qu'on n'a pas, et un « lequel ? » y met fin.
   *
   * On teste la PROPRIÉTÉ plutôt qu'une liste de noms interdits : aucun champ
   * destiné à l'opérateur ne doit nommer une autre fiche du jeu.
   */
  const noms = seedProspects.map((p) => ({
    id: p.id,
    // Le nom distinctif, sans la forme juridique ni le marqueur de démo :
    // c'est sous cette forme-là qu'une référence se cite.
    mots: p.company
      .replace(/\(démo\)/g, " ")
      .split(/[\s—·,'’-]+/)
      .filter((m) => m.length >= 6 && /^[A-ZÉÈÀ]/.test(m)),
  }));

  const fautes: string[] = [];
  for (const p of seedProspects) {
    const texte = [p.personalizedOffer, p.solution, p.notes, p.wonReason ?? "", ...p.problems].join(" ");
    for (const autre of noms) {
      if (autre.id === p.id) continue;
      for (const mot of autre.mots) {
        if (texte.includes(mot)) fautes.push(`${p.id} cite « ${mot} » (${autre.id})`);
      }
    }
  }
  assert.deepEqual(
    fautes,
    [],
    "zéro vente : une fiche qui en cite une autre comme référence fabrique de la preuve sociale.\n  " +
      fautes.join("\n  ")
  );
});
