import { test } from "node:test";
import assert from "node:assert/strict";
import { deepDive, briefForScript } from "../lib/deep-dive";
import { buildArgumentaire } from "../lib/argumentaire";
import { buildVoiceScript } from "../lib/voice-script";
import { emailSubject, emailBody } from "../lib/mail-compose";
import { messageText } from "../lib/linkedin-sequence";
import { OFFRES, type EagleyeOffer } from "../lib/offer-match";
import { buildLadder, ladderPitch } from "../lib/ladder";
import type { Prospect } from "../lib/types";

/**
 * ─────────────────────────────────────────────────────────────────────
 * TOUT CE QUI ATTEINT LE PROSPECT PARLE DE LA MÊME OFFRE.
 *
 * ⚠ POURQUOI CE TEST EXISTE : LE DÉFAUT EST REVENU CINQ FOIS, EN COUCHES.
 *
 * L'angle Callflow était écrit en dur à cinq endroits différents, et chacun
 * a été trouvé APRÈS avoir corrigé le précédent :
 *
 *   1. le rôle du script vocal (« proposer un audit de leur accueil
 *      téléphonique ») ;
 *   2. le critère et l'audit annoncés dans l'email ;
 *   3. les mêmes phrases, dupliquées dans le message LinkedIn ;
 *   4. les questions de l'argumentaire, collées dans le brief d'appel ;
 *   5. les `gaps` du deep-dive — « ce que tu dois APPRENDRE », donc des
 *      consignes, sur une fiche routée ailleurs.
 *
 * Corriger une couche laissait les suivantes annuler le travail. Les tests
 * par module ne le voyaient pas : chacun était vert sur son périmètre.
 *
 * ── CE QUE CELUI-CI FAIT DE DIFFÉRENT ──
 *
 * Il compose TOUT ce qu'un prospect peut recevoir sur une même fiche —
 * script, brief, email, objet, LinkedIn, argumentaire — et cherche le
 * vocabulaire des offres qu'on NE lui vend pas. Une sixième couche, ajoutée
 * demain à n'importe lequel de ces textes, sortira ici.
 *
 * ⚠ SA LIMITE, à connaître : la liste des surfaces est explicite. Un rédacteur
 * ajouté dans un nouveau module ne s'y branche pas tout seul — il faut
 * l'ajouter à `surfaces()`. C'est le prix d'un test qui compose vraiment les
 * sorties au lieu de deviner qui écrit quoi.
 * ─────────────────────────────────────────────────────────────────────
 */

function fixture(over: Partial<Prospect> = {}): Prospect {
  return {
    id: "p1",
    name: "Marc",
    company: "Régie Test",
    sector: "artisan",
    city: "Lyon 6e",
    stage: "contact",
    trust: 40,
    likeness: 50,
    auditScore: 0,
    conviction: 5,
    monthlyValue: 0,
    setupValue: 0,
    probability: 20,
    ignoranceTax: 0,
    croyances: { produit: 5, soutien: 5, pourLui: 5 },
    obstacles: [],
    objections: [],
    events: [],
    demoShownBeforePrice: false,
    nextStep: null,
    tags: [],
    attachments: [],
    notes: "",
    deepAudit: { websiteState: "", socialState: "", localCompetition: "", currentProcess: "" },
    problems: [],
    solution: "",
    personalizedOffer: "",
    payments: [],
    contract: { status: "aucun" },
    delivery: "non-demarre",
    email: "marc@test.fr",
    phone: "0478000000",
    createdAt: "2026-08-01T09:00:00.000Z",
    updatedAt: "2026-08-01T09:00:00.000Z",
    ...over,
  } as Prospect;
}

const CAS: { quoi: string; p: Prospect }[] = [
  {
    quoi: "téléphone qui déborde",
    p: fixture({ deepAudit: { websiteState: "ok", socialState: "actif", localCompetition: "", currentProcess: "", missedCallsPerWeek: 9 } }),
  },
  {
    quoi: "invisible en ligne",
    p: fixture({ deepAudit: { websiteState: "aucun", socialState: "aucun", localCompetition: "", currentProcess: "", googleReviews: 2 } }),
  },
  {
    quoi: "du deal à outiller",
    p: fixture({ sector: "autre", monthlyValue: 4000, deepAudit: { websiteState: "ok", socialState: "actif", localCompetition: "", currentProcess: "" } }),
  },
];

/** Tout ce qu'un prospect peut recevoir, composé comme l'application le fait. */
function surfaces(p: Prospect, accountId = "eagleye"): { nom: string; texte: string }[] {
  const dive = deepDive(p, accountId);
  const argu = buildArgumentaire(p, accountId);
  const brief = [
    briefForScript(dive, p),
    "",
    "Questions qui font constater (poser, puis SE TAIRE) :",
    ...argu.questions.map((q) => `- ${q}`),
  ].join("\n");

  return [
    {
      nom: "script vocal + brief",
      texte: buildVoiceScript({
        onBehalfOf: "EAGLEYE CORP",
        agentName: "Alpha",
        mode: "prospection-b2b",
        company: p.company,
        prospectBrief: brief,
        offre: dive.offer,
      }),
    },
    { nom: "objet d'email", texte: emailSubject(p, accountId) },
    { nom: "corps d'email", texte: emailBody(p, { accountId }) },
    { nom: "message LinkedIn", texte: messageText(p, undefined, accountId) },
    { nom: "argumentaire — questions", texte: argu.questions.join("\n") },
    { nom: "argumentaire — norme du marché", texte: argu.marketStandard.join("\n") },
    { nom: "argumentaire — objections", texte: argu.objections.map((o) => `${o.means} ${o.answer}`).join("\n") },
  ];
}

test("les trois fiches routent vers trois offres différentes", () => {
  const offres = new Set(CAS.map(({ p }) => deepDive(p).offer));
  assert.equal(offres.size, 3, `routage attendu sur 3 offres, obtenu : ${[...offres].join(", ")}`);
});

test("⚠ aucune surface ne parle d'une offre qu'on ne vend pas à CE prospect", () => {
  const fautes: string[] = [];

  for (const { quoi, p } of CAS) {
    const offre = deepDive(p).offer;
    const autres = (Object.keys(OFFRES) as EagleyeOffer[]).filter((x) => x !== offre);

    for (const { nom, texte } of surfaces(p)) {
      for (const a of autres) {
        for (const champ of ["label", "benefice", "question", "perte", "consequence"] as const) {
          if (texte.includes(OFFRES[a][champ])) {
            fautes.push(`${quoi} (${offre}) · ${nom} → contient ${a}.${champ}`);
          }
        }
      }
    }
  }

  assert.deepEqual(
    fautes,
    [],
    "des textes destinés au prospect mélangent deux offres :\n  " + fautes.join("\n  ")
  );
});

test("⚠ hors Callflow, aucune surface ne ramène le vocabulaire du téléphone", () => {
  /**
   * C'est la forme qu'a prise le défaut à chaque couche : pas le libellé d'une
   * autre offre, mais son VOCABULAIRE — « appels manqués », « quand ça sonne »,
   * « décrocher ». Le test précédent ne l'attrape pas, celui-ci si.
   *
   * On ne cherche que dans les textes destinés au prospect : le mot
   * « téléphone » reste légitime ailleurs (un trou de contact direct, un
   * canal de rappel).
   */
  const VOCABULAIRE_TELEPHONE = /appels? manqué|quand (?:ça|le téléphone) sonne|décroch|accueil téléphonique|standard téléphonique/i;
  const fautes: string[] = [];

  for (const { quoi, p } of CAS) {
    const offre = deepDive(p).offer;
    if (offre === "callflow") continue;
    for (const { nom, texte } of surfaces(p)) {
      const m = texte.match(VOCABULAIRE_TELEPHONE);
      if (m) fautes.push(`${quoi} (${offre}) · ${nom} → « ${m[0]} »`);
    }
  }

  assert.deepEqual(fautes, [], "vocabulaire téléphone hors Callflow :\n  " + fautes.join("\n  "));
});

test("la surface Callflow, elle, PARLE bien du téléphone", () => {
  /**
   * Garde symétrique : à force de retirer le téléphone partout, on finit par
   * le retirer là où il est le sujet. Une offre d'accueil téléphonique qui
   * n'en parlerait plus ne vendrait plus rien.
   */
  const cf = CAS.find(({ p }) => deepDive(p).offer === "callflow")!;
  const tout = surfaces(cf.p)
    .map((s) => s.texte)
    .join("\n");
  assert.match(tout, /téléphone|appels/i, "Callflow doit continuer de parler de son sujet");
});

test("un compte mono-offre ne laisse passer aucune autre offre, sur aucune surface", () => {
  /**
   * ScintIA ne vend QUE Callflow. Même sur une fiche dont les signaux crient
   * « visibilité », rien de ce qui part en son nom ne doit proposer autre
   * chose — c'est une règle commerciale négociée, pas un réglage d'affichage.
   */
  const invisible = CAS[1].p;
  for (const { nom, texte } of surfaces(invisible, "scintia")) {
    for (const champ of ["label", "benefice", "question"] as const) {
      assert.ok(
        !texte.includes(OFFRES["visibilite-growth"][champ]),
        `${nom} : une offre hors périmètre ScintIA a fuité (${champ})`
      );
      assert.ok(
        !texte.includes(OFFRES["alpha-sales-os"][champ]),
        `${nom} : une offre hors périmètre ScintIA a fuité (${champ})`
      );
    }
  }
});

test("⚠ l'escalier n'emmène ni montant ni arbitrage interne dans le prompt", () => {
  /**
   * ⚠ C'EST LE TEST DE PRIX CI-DESSOUS QUI A TROUVÉ CELUI-LÀ, et il n'aurait
   * été visible sur aucun module pris isolément.
   *
   * `ladderPitch` recopiait les marches telles quelles dans le brief d'appel.
   * Sur un deal estimé à 48 k, le prompt d'un premier appel de prospection
   * contenait :
   *
   *   « 1. Gros chantier (> 40 000 €) — plateforme Nuwacom — volume du deal
   *      estimé 48 000 € — trop lourd pour nous »
   *
   * Notre seuil de routage, notre estimation de SON budget, et un jugement
   * interne — pendant que la règle dure du même script dit « tu ne donnes
   * aucun prix ». Un modèle à qui on demande « combien ça coûte ? » avait le
   * chiffre trois lignes plus haut.
   *
   * Ce qui décrit la situation du prospect reste (c'est son chiffre, il le
   * connaît). Ce qui décrit notre arbitrage part.
   */
  const gros = fixture({
    setupValue: 48000,
    deepAudit: { websiteState: "aucun", socialState: "aucun", localCompetition: "", currentProcess: "", missedCallsPerWeek: 12 },
  });
  const pitch = ladderPitch(buildLadder(gros, { automationWanted: true }));

  assert.ok(pitch.includes("Gros chantier"), "la marche doit rester visible pour l'agent");
  assert.doesNotMatch(pitch, /48\s*000|40\s*000/, "aucun montant ne doit entrer dans le prompt");
  assert.doesNotMatch(pitch, /trop lourd pour nous/i, "ni notre jugement sur la taille du deal");
  // Et ce qui est à LUI reste : sans ça, on aurait vidé le brief de sa valeur.
  assert.match(pitch, /12 appels manqués/, "les faits du prospect doivent rester");
});

test("aucune surface ne prononce de prix — la règle vaut sur les trois offres", () => {
  /**
   * « Jamais de prix avant la démo » est une règle dure de la maison. Elle
   * n'avait jamais été vérifiée sur l'ENSEMBLE des textes d'un coup : chaque
   * module la respectait dans son coin, et c'est exactement comme ça que les
   * cinq couches d'angle Callflow ont tenu si longtemps.
   *
   * L'argumentaire est exclu à dessein : son bloc 5 EST le prix, et il est
   * destiné à l'opérateur, pas envoyé tel quel.
   */
  for (const { quoi, p } of CAS) {
    for (const { nom, texte } of surfaces(p)) {
      if (nom.startsWith("argumentaire")) continue;
      assert.doesNotMatch(
        texte,
        /\d[\d\s   ]*(?:€|euros)\s*(?:HT)?\s*(?:\/|par )?\s*(?:mois|an)?/i,
        `${quoi} · ${nom} : un montant est prononcé avant la démo`
      );
    }
  }
});
