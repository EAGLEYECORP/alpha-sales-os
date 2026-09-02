import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { buildVoiceScript, auditScript, type CallMode } from "../lib/voice-script";
import { resoudreOffre } from "../lib/voice-offre";
import { OFFRES, type EagleyeOffer } from "../lib/offer-match";
import { ACCOUNTS } from "../lib/accounts";

/**
 * ─────────────────────────────────────────────────────────────────────
 * UN APPEL SORTANT REPRÉSENTE UNE OFFRE — ET LE SCRIPT DOIT ÊTRE CELUI-LÀ.
 *
 * ⚠ CE QUI SE PASSAIT. Le script de prospection annonçait, en dur :
 *
 *     « proposer un audit de leur accueil téléphonique »
 *
 * C'est l'angle Callflow, et il partait sur TOUS les appels sortants. Un
 * prospect routé vers la visibilité ou vers Alpha Sales OS s'entendait donc
 * proposer autre chose que ce qu'on avait décidé de lui vendre.
 *
 * ── LE PIRE N'ÉTAIT PAS LÀ ──
 *
 * Toute la chaîne était juste. `deepDive` calcule l'offre en la contraignant
 * aux offres autorisées du compte. `briefForScript` l'écrit noir sur blanc :
 * « Offre pertinente : … ». Et `CallTask` la laissait tomber en route.
 *
 * Résultat, quand l'autopilote appelait : le RÔLE de l'agent disait Callflow
 * pendant que son DOSSIER disait visibilité. Deux offres contradictoires dans
 * le même prompt, arbitrées par le modèle, en direct, devant le prospect.
 *
 * C'est le même motif que le reste du dépôt : du code juste, une doctrine
 * juste, et aucun fil entre les deux. Ces tests posent le fil.
 * ─────────────────────────────────────────────────────────────────────
 */

const IDS = Object.keys(OFFRES) as EagleyeOffer[];

const base = { agentName: "ALPHA", onBehalfOf: "EAGLEYE CORP", company: "Carrosserie Test" };

test("⚠ le script sortant dit le bénéfice DE SON OFFRE, et d'aucune autre", () => {
  for (const id of IDS) {
    const script = buildVoiceScript({ ...base, mode: "prospection-b2b", offre: id });

    assert.ok(
      script.includes(OFFRES[id].benefice),
      `${id} : le bénéfice de l'offre doit être dans le script`
    );
    assert.ok(script.includes(OFFRES[id].question), `${id} : la question d'ouverture doit y être`);
    assert.ok(script.includes(OFFRES[id].label), `${id} : l'offre représentée doit être nommée`);

    // Et surtout : aucune trace des DEUX autres. C'est cette assertion-là qui
    // aurait attrapé le défaut d'origine.
    for (const autre of IDS.filter((x) => x !== id)) {
      assert.ok(
        !script.includes(OFFRES[autre].benefice),
        `${id} : le script parle aussi de ${autre} — le prospect entendrait deux offres`
      );
      assert.ok(!script.includes(OFFRES[autre].label), `${id} : le libellé de ${autre} n'a rien à y faire`);
    }
  }
});

test("sans offre résolue, l'agent ne présente RIEN — il ne se rabat pas sur Callflow", () => {
  /**
   * Le repli sur Callflow, c'est exactement ce qui existait. Proposer la
   * MAUVAISE offre coûte plus cher que de n'en proposer aucune : le prospect
   * vous classe, et c'est la seule des deux erreurs qui ne se rattrape pas au
   * deuxième appel.
   */
  const script = buildVoiceScript({ ...base, mode: "prospection-b2b", offre: null });
  for (const id of IDS) {
    assert.ok(!script.includes(OFFRES[id].benefice), `sans offre, ${id} ne doit pas être pitchée`);
  }
  assert.match(script, /AUCUNE offre/, "le script doit DIRE qu'il ne présente rien");
  assert.match(script, /qualifie/i, "et ce qu'il fait à la place");
});

test("la divulgation de l'article 50 survit à toutes les offres et à tous les modes", () => {
  /**
   * La première phrase est prononcée par le CODE, avant que le modèle ait la
   * parole. Toucher au corps du script ne doit jamais l'entamer — et c'est
   * précisément le genre de refactor où ça arrive.
   */
  const modes: CallMode[] = ["demo-entrante", "demo-sortante", "rappel-entrant", "prospection-b2b"];
  for (const mode of modes) {
    for (const offre of [...IDS, null]) {
      const v = auditScript(buildVoiceScript({ ...base, mode, offre }));
      assert.ok(v.ok, `mode ${mode} / offre ${offre ?? "aucune"} : ${v.manquantes.join(", ")}`);
    }
  }
});

test("aucune offre ne fait dire un prix au téléphone", () => {
  // Règle dure de la maison : jamais de prix avant la démo. Les textes
  // d'offre sont écrits pour être PRONONCÉS — un chiffre s'y glisse vite.
  for (const id of IDS) {
    for (const champ of ["benefice", "question"] as const) {
      assert.doesNotMatch(
        OFFRES[id][champ],
        /\d+\s*(€|euros?|k€)/i,
        `${id}.${champ} contient un prix — il serait dit à voix haute`
      );
    }
  }
});

// ─────────── La résolution : trois cas, et le refus de deviner ───────────

test("resoudreOffre — l'offre demandée est retenue si le compte la vend", () => {
  const r = resoudreOffre("alpha-voice", "eagleye");
  assert.equal(r.offre, "alpha-voice");
});

test("⚠ resoudreOffre — une offre hors périmètre du compte est REFUSÉE", () => {
  /**
   * Un compte revendeur est borné à SES offres : c'est une règle commerciale,
   * pas une préférence d'affichage. Un appel passé en son nom ne peut pas
   * proposer notre agent vocal, même si l'appelant le demande — une erreur
   * d'appelant ne doit pas devenir une promesse au téléphone.
   */
  const r = resoudreOffre("alpha-voice", "nuwacom");
  assert.equal(r.offre, null, "hors périmètre → aucune offre, pas un repli");
  assert.match(r.pourquoi, /Nuwacom/, "et on dit à l'opérateur pourquoi");
});

test("resoudreOffre — un compte mono-offre n'a rien à trancher", () => {
  /**
   * ⚠ Le portefeuille N'A PLUS de compte mono-offre depuis le départ du
   * revendeur téléphonique. On teste donc la RÈGLE, sur un périmètre d'une
   * seule offre, plutôt que de faire dépendre le test de la composition du
   * portefeuille — qui vient de changer, et changera encore.
   */
  const mono = ACCOUNTS.filter((a) => a.offers.length === 1);
  for (const a of mono) {
    assert.equal(resoudreOffre(undefined, a.id).offre, a.offers[0], `${a.id} : déduit sans ambiguïté`);
  }

  // Et la règle elle-même, indépendamment du portefeuille du jour.
  const nuwacom = ACCOUNTS.find((a) => a.id === "nuwacom")!;
  assert.ok(nuwacom.offers.length > 1, "Nuwacom est multi-offres : il DOIT qu'on tranche");
  assert.equal(resoudreOffre(undefined, "nuwacom").offre, null, "sans consigne, un multi-offres ne devine pas");
});

test("resoudreOffre — un compte multi-offres sans consigne ne devine pas", () => {
  const multi = ACCOUNTS.find((a) => a.offers.length > 1);
  assert.ok(multi, "le portefeuille doit encore contenir un compte multi-offres");
  const r = resoudreOffre(undefined, multi!.id);
  assert.equal(r.offre, null);
  assert.match(r.pourquoi, /plusieurs offres/i);
});

test("resoudreOffre — une valeur inconnue ne devient pas une offre", () => {
  // Le corps de requête vient de l'extérieur : une chaîne arbitraire ne doit
  // pas se retrouver indexée dans le catalogue.
  for (const nawak of ["", "  ", "callflow-bis", "__proto__", "toString", "constructor"]) {
    const r = resoudreOffre(nawak, "eagleye");
    assert.equal(r.offre, null, `« ${nawak} » ne doit pas passer pour une offre`);
  }
});

// ─────────── La contradiction qui ne doit plus pouvoir revenir ───────────

test("⚠ la tâche d'appel TRANSPORTE l'offre — c'est le maillon qui la perdait", () => {
  /**
   * `deepDive` la calculait, `briefForScript` l'écrivait, et `CallTask` ne la
   * gardait pas. Ce test lit la source parce que l'absence d'un champ ne se
   * voit pas en relisant du code qui compile.
   */
  const runner = readFileSync(join(process.cwd(), "lib/campaign-runner.ts"), "utf8");
  assert.match(runner, /offre: EagleyeOffer/, "CallTask doit porter l'offre");
  assert.match(runner, /offre: dive\.offer/, "et la tenir du MÊME deepDive que le brief");

  // Et les deux chemins d'appel doivent la poster.
  for (const f of ["components/controle/runner.tsx", "app/(app)/voice/page.tsx"]) {
    const src = readFileSync(join(process.cwd(), f), "utf8");
    assert.match(src, /offre:/, `${f} doit envoyer l'offre à /api/voice/call`);
  }
});

test("⚠ plus aucun angle d'offre n'est écrit en dur dans le constructeur de script", () => {
  /**
   * La formulation exacte qui a causé le défaut — « un audit de leur accueil
   * téléphonique » — ne doit pas revenir, ni aucune autre accroche figée. La
   * seule source des angles est `OFFRES`.
   */
  const src = readFileSync(join(process.cwd(), "lib/voice-script.ts"), "utf8");
  const code = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  assert.doesNotMatch(code, /audit de leur accueil/i, "l'angle Callflow ne doit plus être en dur");
  assert.match(code, /OFFRES\[cfg\.offre\]/, "l'angle doit venir du catalogue d'offres");
});

/**
 * ─────────────────────────────────────────────────────────────────────
 * SCINTIA A PEUR POUR SON SCRIPT — ET C'EST LÉGITIME.
 *
 * Sur un appel à FROID au nom de Callflow, c'est LEUR marque qui parle, pas la
 * nôtre : nous ne sommes qu'intermédiaires (30 % du setup, 10 % du mensuel).
 * Un agent qui improvise une modalité, lâche un prix ou cite une autre société
 * leur coûte un client qu'ils n'ont jamais vu.
 *
 * Doctrine du 28/08/2026 : Alpha Voice démarche à froid. La contrepartie est
 * une discipline de script VÉRIFIABLE — c'est ce que ces tests gardent.
 * ─────────────────────────────────────────────────────────────────────
 */
test("appel à froid — le script porte un objectif unique et aucun prix", () => {
  const script = buildVoiceScript({
    onBehalfOf: "ScintIA",
    agentName: "ALPHA",
    mode: "prospection-b2b",
    company: "Carrosserie Test",
    offre: "alpha-voice",
  });
  const v = auditScript(script, { mode: "prospection-b2b", offre: "alpha-voice" });
  assert.deepEqual(v.manquantes, [], "le script livré doit passer son propre audit");
  assert.match(script, /OBJECTIF UNIQUE/, "un seul but : le rendez-vous");
  assert.match(script, /aucun prix|jamais de prix/i);
});

test("appel à froid — le NON se raccroche, le OUI seul réveille un humain", () => {
  const script = buildVoiceScript({
    onBehalfOf: "ScintIA",
    agentName: "ALPHA",
    mode: "prospection-b2b",
    offre: "alpha-voice",
  });
  assert.match(script, /Si c'est NON[\s\S]*?tu raccroches/i, "un refus se traite sans mobiliser personne");
  /**
   * ⚠ Le script doit NOMMER l'outil. Sans ça, le modèle « passe la main »
   * en paroles et personne n'est prévenu : `voice/agent.py` écrivait toujours
   * « repondu », donc `handoffToHuman` restait faux même sur un oui.
   */
  assert.match(script, /Si c'est OUI[\s\S]*?rendez_vous_obtenu/i, "le oui doit déclencher l'outil, pas une phrase");
  assert.match(script, /refus_definitif/, "et le refus définitif doit avoir le sien");
});

test("⚠ sur un compte PARTENAIRE, le script interdit de citer une autre société", () => {
  /**
   * ⚠ CETTE GARDE S'ARMAIT SUR L'OFFRE, ET C'ÉTAIT UN ACCIDENT DE L'HISTOIRE.
   *
   * Elle avait été demandée par le revendeur qui portait l'accueil
   * téléphonique, donc elle se déclenchait sur cette OFFRE. Ça a marché tant
   * que l'offre et le partenaire ne faisaient qu'un. L'accord est mort et
   * l'offre est revenue chez nous : laissée en l'état, la garde aurait
   * interdit de citer EAGLEYE sur NOTRE propre appel, et n'aurait rien gardé
   * sur un appel Nuwacom — le seul cas de marque partenaire qui reste.
   *
   * La vraie condition est le COMPTE. Et elle doit être la même des deux
   * côtés : ce que le script ÉCRIT et ce que l'audit EXIGE.
   */
  const partenaire = buildVoiceScript({
    onBehalfOf: "Nuwacom",
    agentName: "ALPHA",
    mode: "prospection-b2b",
    compteId: "nuwacom",
    offre: "visibilite-growth",
  });
  assert.match(partenaire, /tu ne cites aucune autre société/i, "la garde doit être écrite dans le script");
  assert.equal(auditScript(partenaire, { mode: "prospection-b2b", compteId: "nuwacom" }).ok, true);

  // Un script d'où la garde a disparu doit être REFUSÉ, pas juste signalé.
  const ampute = partenaire.replace(/tu ne cites aucune autre société[^\n]*/i, "");
  const v = auditScript(ampute, { mode: "prospection-b2b", compteId: "nuwacom" });
  assert.equal(v.ok, false);
  assert.ok(v.manquantes.some((m) => /autre société/i.test(m)));
});

test("l'exigence de marque partenaire ne s'applique QU'À un compte partenaire", () => {
  /**
   * Sur NOS comptes, c'est notre marque : la contrainte n'a pas lieu d'être,
   * et l'imposer partout finirait par la faire contourner.
   *
   * ⚠ Le cas qui compte depuis la reprise de l'offre vocale : un appel EAGLEYE
   * sur Alpha Voice. Avant, c'est l'offre qui armait la garde — ce script-ci
   * aurait donc été contraint de ne citer personne d'autre, sur notre propre
   * appel, pour notre propre produit.
   */
  const nous = buildVoiceScript({
    onBehalfOf: "EAGLEYE CORP",
    agentName: "ALPHA",
    mode: "prospection-b2b",
    compteId: "eagleye",
    offre: "alpha-voice",
  });
  assert.doesNotMatch(nous, /tu ne cites aucune autre société/i, "pas de garde de marque sur notre propre appel");
  assert.equal(auditScript(nous, { mode: "prospection-b2b", compteId: "eagleye", offre: "alpha-voice" }).ok, true);
});

test("hors appel à froid, l'audit ne réclame que la divulgation", () => {
  /**
   * Une démo entrante n'a pas d'objectif de rendez-vous : y exiger
   * « OBJECTIF UNIQUE » ferait échouer un script parfaitement conforme, et un
   * garde qui refuse le bon usage finit désactivé.
   */
  const demo = buildVoiceScript({
    onBehalfOf: "EAGLEYE CORP",
    agentName: "ALPHA",
    mode: "demo-entrante",
    company: "Carrosserie Test",
  });
  assert.equal(auditScript(demo).ok, true);
  assert.equal(auditScript(demo, { mode: "demo-entrante" }).ok, true);
});

test("les deux points d'audit de /api/voice/call jugent la même chose", () => {
  /**
   * ⚠ La route relit le script AVANT l'appel et l'audite AU MOMENT de
   * l'appel. Si la relecture auditait moins, l'opérateur validerait un texte
   * que la route rejetterait ensuite — ou pire, l'inverse.
   */
  const src = readFileSync(join(process.cwd(), "app/api/voice/call/route.ts"), "utf8");
  const appels = [...src.matchAll(/auditScript\(script([^)]*)\)/g)].map((m) => m[1]!.trim());
  assert.equal(appels.length, 2, "la route doit auditer aux deux endroits");
  assert.equal(appels[0], appels[1], "et avec exactement le même contexte");
  assert.match(appels[0]!, /mode: cfg\.mode/);
  assert.match(appels[0]!, /offre: cfg\.offre/);
});

/**
 * ─────────────────────────────────────────────────────────────────────
 * LE SCRIPT ET L'AGENT PYTHON DOIVENT NOMMER LES MÊMES OUTILS.
 *
 * ⚠ C'EST LA COUTURE QUI A CASSÉ AUJOURD'HUI, ET ELLE EST INVISIBLE.
 *
 * La doctrine du 28/08/2026 fait que SEUL un intérêt qualifié réveille un
 * humain. Toute la chaîne TypeScript a été câblée pour ça — mais
 * `voice/agent.py` écrivait `outcome = "repondu"` en dur et ne pouvait donc
 * JAMAIS émettre `interesse`. Résultat : le prospect disait oui, et personne
 * n'était prévenu.
 *
 * Deux langages, un seul contrat. Un test qui vérifie que les deux côtés
 * nomment le même outil est le seul endroit où cette couture se voit.
 * ─────────────────────────────────────────────────────────────────────
 */
test("⚠ les outils nommés dans le script existent vraiment dans l'agent Python", () => {
  const py = readFileSync(join(process.cwd(), "voice/agent.py"), "utf8");
  const script = buildVoiceScript({
    onBehalfOf: "ScintIA",
    agentName: "ALPHA",
    mode: "prospection-b2b",
    offre: "alpha-voice",
  });

  for (const outil of ["rendez_vous_obtenu", "refus_definitif"]) {
    assert.match(script, new RegExp(outil), `le script doit nommer ${outil}`);
    assert.match(
      py,
      new RegExp(`async def ${outil}\\(`),
      `voice/agent.py doit définir ${outil} — sinon le modèle appelle un outil qui n'existe pas`
    );
    assert.match(py, new RegExp(`@function_tool\\(\\)[\\s\\S]{0,300}${outil}`), `${outil} doit être exposé au modèle`);
  }

  // Et le résultat déclaré doit primer sur le provisoire, sinon l'outil écrit
  // dans le vide.
  assert.match(
    py,
    /agent\.resultat_declare or resultat\["outcome"\]/,
    "la clôture doit préférer le résultat DÉCLARÉ au provisoire « repondu »"
  );
});
