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

test("⚠ le script sortant dit la raison d'appel DE SON OFFRE, et d'aucune autre", () => {
  for (const id of IDS) {
    const script = buildVoiceScript({ ...base, mode: "prospection-b2b", offre: id });

    assert.ok(
      script.includes(OFFRES[id].raisonAppel),
      `${id} : la raison d'appel de l'offre doit être dans le script`
    );
    assert.ok(script.includes(OFFRES[id].question), `${id} : la question d'ouverture doit y être`);
    assert.ok(script.includes(OFFRES[id].label), `${id} : l'offre représentée doit être nommée`);

    // Et surtout : aucune trace des DEUX autres. C'est cette assertion-là qui
    // aurait attrapé le défaut d'origine.
    for (const autre of IDS.filter((x) => x !== id)) {
      assert.ok(
        !script.includes(OFFRES[autre].raisonAppel),
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
    assert.ok(!script.includes(OFFRES[id].raisonAppel), `sans offre, ${id} ne doit pas être pitchée`);
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
    for (const champ of ["raisonAppel", "question"] as const) {
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
  const r = resoudreOffre("callflow", "eagleye");
  assert.equal(r.offre, "callflow");
});

test("⚠ resoudreOffre — une offre hors périmètre du compte est REFUSÉE", () => {
  /**
   * ScintIA ne vend QUE Callflow : c'est une règle commerciale négociée
   * (CLAUDE.md), pas une préférence d'affichage. Un appel passé en son nom ne
   * peut pas proposer Alpha Sales OS, même si l'appelant le demande — une
   * erreur d'appelant ne doit pas devenir une promesse au téléphone.
   */
  const r = resoudreOffre("alpha-sales-os", "scintia");
  assert.equal(r.offre, null, "hors périmètre → aucune offre, pas un repli");
  assert.match(r.pourquoi, /ScintIA/, "et on dit à l'opérateur pourquoi");
});

test("resoudreOffre — un compte mono-offre n'a rien à trancher", () => {
  const mono = ACCOUNTS.filter((a) => a.offers.length === 1);
  assert.ok(mono.length > 0, "le portefeuille doit encore contenir un compte mono-offre");
  for (const a of mono) {
    assert.equal(resoudreOffre(undefined, a.id).offre, a.offers[0], `${a.id} : déduit sans ambiguïté`);
  }
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
