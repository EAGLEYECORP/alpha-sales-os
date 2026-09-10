import { test } from "node:test";
import assert from "node:assert/strict";
import { VERTICALS } from "../lib/playbook";
import { buildVoiceScript } from "../lib/voice-script";
import { OFFRES, type EagleyeOffer } from "../lib/offer-match";

/**
 * ─────────────────────────────────────────────────────────────────────
 * UN INTERDIT QUI NE RENCONTRE JAMAIS LE SCRIPT N'INTERDIT RIEN.
 *
 * ══ LA CONTRADICTION QUI A VÉCU DANS LE DÉPÔT ══
 *
 * La verticale `maitrise-ouvrage` interdit, en toutes lettres :
 *
 *     « Vous ratez des appels » : faux ici, et ça prouve qu'on n'a pas
 *     compris le métier.
 *
 * Et `OFFRES["alpha-voice"].perte` demandait, mot pour mot :
 *
 *     « Sur une semaine normale, combien d'appels vous n'arrivez pas à
 *     prendre ? »
 *
 * `buildVoiceScript` injecte les DEUX dans le même prompt — l'angle métier
 * vient de la verticale, l'accroche vient du catalogue d'offres. L'interdit et
 * sa violation se retrouvaient donc à trois lignes d'écart, et l'agent
 * prononçait devant un directeur de programmes exactement la phrase dont son
 * propre playbook dit qu'elle prouve qu'on n'a pas compris son métier.
 *
 * Rien n'a bronché. Ce n'est pas un oubli de relecture : un interdit écrit en
 * français dans un tableau de chaînes n'avait, structurellement, aucun moyen
 * de rencontrer le script.
 *
 * ══ CE QUI REND CE TEST DIFFÉRENT D'UN SCAN DE TEXTE ══
 *
 * ⚠ Il ne cherche PAS la citation littérale. Chercher « vous ratez des
 * appels » n'aurait rien attrapé — la violation réelle était une
 * REFORMULATION. Un garde qui n'attrape que la recopie exacte laisse passer
 * la seule chose qui arrive vraiment : quelqu'un de bonne foi qui redit
 * l'idée autrement.
 *
 * Le motif vit donc DANS l'interdit (`InterditFroid.motif`), à côté de la
 * règle qu'il applique. Une seule entrée, deux lecteurs : l'humain lit
 * `regle`, ce test exécute `motif`.
 * ─────────────────────────────────────────────────────────────────────
 */

const OFFRES_IDS = Object.keys(OFFRES) as EagleyeOffer[];

const scriptPour = (verticalId: string, offre: EagleyeOffer) =>
  buildVoiceScript({
    onBehalfOf: "EAGLEYE CORP",
    agentName: "Alpha",
    verticalId,
    compteId: "eagleye",
    mode: "prospection-b2b",
    offre,
  });

/**
 * ⚠ La divulgation légale est RETIRÉE avant l'analyse.
 *
 * L'article 50 impose « intelligence artificielle » en première phrase, et un
 * futur interdit pourrait viser ce vocabulaire dans l'argumentaire. Auditer le
 * script entier ferait alors refuser un appel conforme — et c'est l'obligation
 * légale qu'on serait tenté d'assouplir, parce que c'est elle qui « bloque ».
 * Même séparation que `auditBenefice` : on juge ce qu'on choisit de dire,
 * jamais ce que la loi impose.
 */
const sansDivulgation = (script: string) => {
  const i = script.indexOf("## Ton rôle");
  return i > 0 ? script.slice(i) : script;
};

/**
 * ⚠ L'ANGLE MÉTIER EST RETIRÉ LUI AUSSI, ET CE N'EST PAS UN ASSOUPLISSEMENT
 * POUR FAIRE PASSER LE TEST — c'est la première chose qu'il a attrapée, et
 * elle valait la peine d'être regardée.
 *
 * La ligne « Angle métier : … » est le `structuralPain` de la verticale,
 * injecté tel quel. Celui de la maîtrise d'ouvrage dit :
 *
 *     « Ce ne sont PAS des appels manqués, ce sont des acquéreurs déjà chauds
 *       qu'on laisse refroidir. »
 *
 * C'est la NÉGATION de l'interdit — la phrase qui explique pourquoi il
 * existe. Un motif ne distingue pas « ce ne sont pas des appels manqués » de
 * « vous ratez des appels », et tenter de le faire en français produirait une
 * regex qu'on assouplirait jusqu'à l'inutilité.
 *
 * La raison de fond est plus simple : une verticale ne peut pas se violer
 * elle-même, c'est ELLE qui pose la règle. Ce test croise deux sources — ce
 * que la verticale INTERDIT contre ce que le catalogue d'offres et la trame
 * FONT DIRE. C'est ce croisement qui manquait.
 *
 * ⚠ Le prix de cette exclusion, dit franchement : une contradiction écrite
 * DANS un `structuralPain` ne serait pas attrapée. Elle relève d'une
 * relecture humaine, pas d'un croisement de sources — il n'y a rien à croiser
 * quand l'auteur de la règle et l'auteur de la phrase sont le même champ.
 */
const sansAngleMetier = (script: string) =>
  script
    .split("\n")
    .filter((l) => !l.startsWith("Angle métier :"))
    .join("\n");

test("⚠ AUCUN SCRIPT NE PRONONCE UN INTERDIT DE SA PROPRE VERTICALE", () => {
  const fautes: string[] = [];

  for (const v of VERTICALS) {
    const interdits = v.forbidden.filter((f) => f.motif);
    if (interdits.length === 0) continue;

    /**
     * Toutes les offres, pas seulement celle que la verticale préfère : le
     * routeur (`matchOffer`) décide sur les signaux de la FICHE, pas sur le
     * champ `offre` du playbook. Une fiche de maîtrise d'ouvrage peut donc
     * partir en Alpha Voice — c'est précisément ce qui est arrivé — et
     * l'interdit vaut sur ce script-là aussi.
     */
    for (const offre of OFFRES_IDS) {
      const o = OFFRES[offre];
      /**
       * ⚠ LE SCRIPT NE SUFFIT PAS, ET LA MUTATION L'A PROUVÉ.
       *
       * La première version de ce test n'auditait que `buildVoiceScript`. Or
       * l'accroche à froid n'utilise que `benefice`, `question` et
       * `miseEnPlace` : `perte` et `consequence` n'y apparaissent JAMAIS —
       * et c'est précisément dans `perte` que la violation avait vécu.
       *
       * Mesuré : remettre l'ancienne phrase dans `OFFRES["alpha-voice"].perte`
       * laissait ce test VERT. Un garde qui rate le champ pour lequel il a été
       * écrit est pire que pas de garde, parce qu'il rassure.
       *
       * Ces deux champs partent bien vers le prospect, par un autre chemin :
       * `deepDive` les pose dans les `gaps` (« ce qu'il faut lui faire
       * constater : … »), le brief descend dans le script, et
       * `buildArgumentaire` les affiche à l'écran de préparation d'appel. On
       * audite donc les CINQ textes que l'offre fait dire, en plus du script
       * assemblé.
       */
      const textes: [string, string][] = [
        ["script", sansAngleMetier(sansDivulgation(scriptPour(v.id, offre)))],
        ["pitch", o.pitch],
        ["benefice", o.benefice],
        ["question", o.question],
        ["perte", o.perte],
        ["consequence", o.consequence],
      ];
      for (const [ou, texte] of textes) {
        for (const f of interdits) {
          const m = texte.match(f.motif!);
          if (m) fautes.push(`${v.id} + ${offre}.${ou} → « ${m[0]} » (interdit : ${f.regle.slice(0, 60)}…)`);
        }
      }
    }
  }

  assert.deepEqual(
    fautes,
    [],
    "un script assemblé contient un interdit de sa propre verticale :\n  " + fautes.join("\n  ")
  );
});

test("⚠ le garde MORD — le motif attrape la reformulation, pas seulement la citation", () => {
  /**
   * ⚠ LE PIÈGE DE TEST DE CE DÉPÔT, RENCONTRÉ CINQ FOIS : asserter la
   * PRÉSENCE du bon résultat au lieu de la CONDITION qui doit le produire.
   *
   * Le test précédent passe aussi si tous les motifs sont des regex qui ne
   * matchent jamais. On vérifie donc ici que le motif de la maîtrise
   * d'ouvrage attrape RÉELLEMENT la phrase qui avait vécu dans le catalogue —
   * et qu'il laisse passer ce qui est légitime.
   */
  const moa = VERTICALS.find((v) => v.id === "maitrise-ouvrage");
  assert.ok(moa, "la verticale maîtrise d'ouvrage doit exister");

  const interditAppels = moa!.forbidden.find((f) => /ratez des appels/i.test(f.regle));
  assert.ok(interditAppels?.motif, "l'interdit « vous ratez des appels » doit porter un motif exécutable");

  // La formulation EXACTE qui vivait dans OFFRES["alpha-voice"].perte.
  assert.match(
    "Sur une semaine normale, combien d'appels vous n'arrivez pas à prendre ?",
    interditAppels!.motif!,
    "le motif doit attraper la phrase qui a réellement vécu dans le catalogue"
  );
  // Et la citation littérale de la règle, évidemment.
  assert.match("Vous ratez des appels tous les jours", interditAppels!.motif!);
  assert.match("chaque appel manqué est un client perdu", interditAppels!.motif!);

  /**
   * ⚠ ET CE QU'IL NE DOIT PAS ATTRAPER. Un motif trop large refuse des
   * scripts corrects, et un garde qu'il faut faire taire est un garde qu'on
   * finit par retirer. Le texte MOA actuel parle d'appels — il ne prétend
   * simplement pas que le prospect les rate.
   */
  for (const legitime of [
    OFFRES["alpha-voice"].perte,
    OFFRES["alpha-voice"].benefice,
    OFFRES["alpha-voice"].question,
    "Quand l'équipe est en visite, votre bureau de vente continue de sonner.",
  ]) {
    assert.doesNotMatch(
      legitime,
      interditAppels!.motif!,
      `faux positif : « ${legitime} » nomme un moment, il n'affirme pas qu'il rate des appels`
    );
  }
});

test("⚠ chaque interdit dit POURQUOI, et il en reste d'exécutables", () => {
  /**
   * Deux choses distinctes, et les deux comptent.
   *
   * · Une règle sans raison se fait contourner à la première relecture :
   *   personne ne sait plus pourquoi elle était là, donc on la retire.
   * · Un `motif` absent est LÉGITIME — « citer son permis à froid » est un
   *   jugement de situation, pas une chaîne, et en fabriquer un approximatif
   *   pour faire du chiffre produirait des faux positifs jusqu'à ce que le
   *   garde entier soit désarmé. Mais si le total tombait à zéro, le test
   *   précédent deviendrait décoratif sans que rien ne le signale.
   */
  let executables = 0;
  for (const v of VERTICALS) {
    for (const f of v.forbidden) {
      assert.ok(f.regle.trim().length > 25, `${v.id} : un interdit sans raison écrite — « ${f.regle} »`);
      if (f.motif) executables++;
    }
  }
  assert.ok(executables >= 4, `seulement ${executables} interdit(s) exécutable(s) : le garde ne garde plus grand-chose`);
});

test("⚠ le registre des offres est celui de la MAÎTRISE D'OUVRAGE, pas de l'artisan", () => {
  /**
   * ⚠ CE TEST GARDE UNE DÉCISION COMMERCIALE, PAS UNE RÈGLE TECHNIQUE — et il
   * doit tomber le jour où un deuxième marché entre.
   *
   * Les champs d'`OFFRES` sont GLOBAUX : ils se prononcent sur tous les
   * comptes, Nuwacom compris, dont l'ICP est l'assurance. Aujourd'hui le pipe
   * est entièrement maîtrise d'ouvrage et c'est cohérent. Ce n'est pas une
   * solution, c'est une dette assumée : le bon design est un registre par
   * verticale, et il n'existe pas.
   *
   * Le test fige donc l'état voulu MAINTENANT. S'il tombe, la bonne réaction
   * n'est pas de le réparer — c'est de se demander si le moment du registre
   * par verticale n'est pas arrivé.
   */
  const vocabulaireMoa = /acquéreur|réservation|programme|bureau de vente|visite/i;
  for (const id of OFFRES_IDS) {
    const o = OFFRES[id];
    assert.match(
      `${o.benefice} ${o.question} ${o.perte}`,
      vocabulaireMoa,
      `${id} parle encore un autre métier que celui qu'on prospecte`
    );
  }

  // Et le vocabulaire du marché d'ORIGINE a bien disparu des trois offres.
  for (const id of OFFRES_IDS) {
    const o = OFFRES[id];
    assert.doesNotMatch(
      `${o.benefice} ${o.question} ${o.perte} ${o.consequence}`,
      /votre métier et vos clients|couverts|chantier|devis/i,
      `${id} garde une tournure écrite pour le marché d'avant`
    );
  }
});
