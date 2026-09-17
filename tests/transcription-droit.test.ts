import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { lireEtatTranscription, phraseTranscription } from "../lib/etat-transcription";
import { BRIQUES_ESSAI, BRIQUES_GRATUITES } from "../lib/entitlements";
import { CHEMIN_PAR_API } from "../lib/api-access";
import { ACCES_PAR_CHEMIN } from "../lib/bricks-access";

/**
 * ─────────────────────────────────────────────────────────────────────
 * UN ÉCRAN GRATUIT QUI APPELLE UNE ROUTE PAYANTE — et qui mentait sur la cause.
 *
 * ══ CE QUI A ÉTÉ MESURÉ ══
 *
 * `/debrief` est gardé par `closer`, brique **GRATUITE**. Il appelle
 * `/api/transcribe`, classée sur `/voice`, donc sur `alpha-voice` — **payante,
 * et exclue de l'essai** (`HORS_ESSAI`). Un compte gratuit ou en essai reçoit
 * donc un 403 `brique_absente`.
 *
 * L'écran lisait `Boolean(d.configured)` sur ce corps, qui n'a pas ce champ :
 * `undefined` → `false` → « la transcription serveur n'est pas branchée ». Et
 * il concluait en conseillant de **brancher un fournisseur** — c'est-à-dire de
 * poser `DEEPGRAM_API_KEY`, une variable de NOTRE environnement serveur à
 * laquelle l'opérateur n'a aucun accès.
 *
 * Une valeur, deux sens. Le dépôt a déjà payé exactement ça avec
 * `statut: "suspendu"` (« compte suspendu, régularise » affiché à quelqu'un
 * qui n'avait jamais eu de compte) et avec `/demarrage` (« undefined
 * enregistrement(s) DNS manquant(s) »).
 *
 * ══ ⚠⚠ ET POURQUOI IL N'Y A PAS DE DÉBIT ICI ══
 *
 * Je venais ajouter à `/api/transcribe` le compteur d'essai, comme pour
 * l'egress et la vidéo. **La mesure a dit non** : la route est gardée par
 * `alpha-voice`, que `BRIQUES_ESSAI` exclut. Un compte en essai ne l'atteint
 * jamais — le middleware refuse avant le handler. Un débit y serait un
 * mécanisme branché à rien, c'est-à-dire le défaut même que ce dépôt traque.
 *
 * Le test ci-dessous fige ce raisonnement : le jour où `alpha-voice` entre
 * dans l'essai, il tombe, et il faudra alors ajouter le débit.
 * ─────────────────────────────────────────────────────────────────────
 */

const lire = (p: string) => readFileSync(join(process.cwd(), p), "utf8");
const sansCommentaires = (s: string) => s.replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, "");

test("⚠⚠ UN 403 NE SE LIT PAS COMME « PAS CONFIGURÉ »", () => {
  /**
   * Le cœur du défaut. Les deux réponses ont un corps JSON, un `.json()` qui
   * réussit, et aucune ne plante. Seul le STATUT les distingue — d'où son
   * passage en argument obligatoire.
   */
  assert.equal(
    lireEtatTranscription(403, { error: "Cette fonctionnalité n'est pas incluse dans ton offre.", code: "brique_absente" }),
    "brique-absente",
  );
  assert.equal(lireEtatTranscription(200, { configured: false }), "non-configuree");
  assert.equal(lireEtatTranscription(200, { configured: true }), "prete");

  // ⚠ Et le cas qui a produit le bug : un corps SANS `configured`.
  // L'ancienne lecture (`Boolean(d.configured)`) le traduisait en « false »,
  // donc en « pas configuré ». Ici il devient « illisible », jamais un
  // diagnostic inventé.
  assert.equal(lireEtatTranscription(200, { error: "autre chose" }), "illisible");
  assert.equal(lireEtatTranscription(200, null), "illisible");
  assert.equal(lireEtatTranscription(500, { configured: true }), "illisible");
});

test("⚠⚠ ON N'ENVOIE PAS UN CLIENT CONFIGURER NOTRE SERVEUR", () => {
  /**
   * La phrase servie à un compte sans la brique ne doit contenir AUCUN conseil
   * de configuration : il n'a pas accès à notre environnement, et le lui
   * demander l'envoie chercher un réglage qui n'existe pas pour lui.
   *
   * Ce qu'elle doit faire à la place : nommer l'achat, et rappeler
   * l'alternative gratuite qu'il a déjà sous la main.
   */
  const refus = phraseTranscription("brique-absente") ?? "";
  assert.ok(!/DEEPGRAM|WHISPER|branche/i.test(refus), `pas de conseil de configuration (vu : « ${refus} »)`);
  assert.match(refus, /navigateur/i, "elle doit rappeler l'alternative gratuite");
  assert.match(refus, /offre|facture|minute/i, "et nommer la raison réelle : ça se paie");

  // À l'inverse, « non configuré » est bien NOTRE problème, et peut le dire.
  const absent = phraseTranscription("non-configuree") ?? "";
  assert.match(absent, /serveur/i);

  // ⚠ « Prête » ne dit RIEN : un bandeau permanent « tout va bien » est un
  // bandeau qu'on cesse de lire.
  assert.equal(phraseTranscription("prete"), null);
});

test("⚠⚠ LES DEUX APPELANTS UTILISENT LE LECTEUR TYPÉ", () => {
  /**
   * Le défaut vivait dans DEUX fichiers : la page (sonde au chargement) et
   * l'enregistreur (envoi réel). Ne corriger que l'un laisserait l'autre
   * annoncer « transcription impossible » sur un refus d'offre.
   */
  for (const f of ["app/(app)/debrief/page.tsx", "components/voice/use-recorder.ts"]) {
    const src = sansCommentaires(lire(f));
    assert.match(src, /lireEtatTranscription\(/, `${f} doit passer par le lecteur typé`);
    assert.ok(
      !/Boolean\(\s*d\.configured\s*\)/.test(src),
      `${f} ne doit plus déduire l'état d'un champ absent`,
    );
  }
  // Et la formulation vient d'un seul endroit.
  const page = sansCommentaires(lire("app/(app)/debrief/page.tsx"));
  assert.ok(
    !/n'est pas branchée|branche la transcription/i.test(page),
    "la page ne recopie plus la phrase : elle l'importe",
  );
});

test("⚠⚠ POURQUOI `/api/transcribe` NE DÉBITE PAS — et quand il faudra le faire", () => {
  /**
   * ⚠ CE TEST EXISTE POUR EMPÊCHER D'AJOUTER DU CODE MORT, pas pour en
   * protéger. Il fige un raisonnement de mesure :
   *
   * `/api/transcribe` → `/voice` → `alpha-voice`, que `BRIQUES_ESSAI` exclut.
   * Un compte en essai prend donc un 403 au middleware, AVANT le handler. Y
   * poser un débit serait brancher un mécanisme à rien — exactement le défaut
   * récurrent de ce dépôt.
   *
   * Le jour où `alpha-voice` entre dans l'essai, cette assertion tombe. Ce
   * n'est pas une régression : c'est le rappel qu'il faut alors ajouter le
   * débit, et qu'il devra être proportionnel à la DURÉE de l'audio (la
   * transcription se facture à la minute), pas forfaitaire par appel.
   */
  assert.equal(CHEMIN_PAR_API["/api/transcribe"], "/voice");
  assert.deepEqual(ACCES_PAR_CHEMIN["/voice"], ["alpha-voice"]);
  assert.ok(
    !BRIQUES_ESSAI.includes("alpha-voice"),
    "si la téléphonie entre dans l'essai, /api/transcribe devient atteignable et DOIT débiter (à la minute)",
  );
  assert.ok(!BRIQUES_GRATUITES.includes("alpha-voice"), "…et elle n'est pas gratuite non plus");

  const src = sansCommentaires(lire("app/api/transcribe/route.ts"));
  assert.ok(
    !/debiterLaRequete/.test(src),
    "aucun débit tant que la route est inatteignable en essai : un mécanisme branché à rien est un mensonge",
  );
});

test("⚠ L'ÉCRAN GRATUIT GARDE SA PORTE VISIBLE — mais elle dit pourquoi", () => {
  /**
   * On ne masque pas le bouton « Dicter (serveur) » à un compte gratuit :
   * c'est la doctrine du rail, déjà appliquée à `/controle` qui affiche le
   * lanceur de campagnes. « Voir la porte fermée vaut mieux que ne pas savoir
   * qu'elle existe » — à condition que la porte dise pourquoi elle est fermée,
   * ce qui n'était pas le cas.
   */
  const page = sansCommentaires(lire("app/(app)/debrief/page.tsx"));
  assert.match(page, /phraseTranscription\(etatASR\)/, "l'écran sert la raison, quelle qu'elle soit");
  assert.match(page, /etatASR !== "prete"/, "…et seulement quand il y a quelque chose à dire");
});
