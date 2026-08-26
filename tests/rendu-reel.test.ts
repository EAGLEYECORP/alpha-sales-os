import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { memeOrigine, peutLireSessions, REFUS_LECTURE } from "../lib/voice-session-acces";

/**
 * ─────────────────────────────────────────────────────────────────────
 * CE QUE LE NAVIGATEUR A TROUVÉ, ET QUE LES TESTS AVAIENT MANQUÉ.
 *
 * 943 tests passaient au vert pendant que la Salle de contrôle affichait
 * « non autorisé » sur tous les appels en production. Aucun test ne pouvait
 * le voir : ils vérifiaient des modules purs, jamais une requête réelle
 * partant d'une page réelle vers une route réelle.
 *
 * Les deux défauts trouvés en pilotant Chromium sur les 36 écrans :
 *
 *  1. `/api/voice/session` exigeait le secret de l'AGENT pour la LECTURE.
 *     Le navigateur de l'opérateur ne l'a pas — et ne doit pas l'avoir.
 *  2. `/api/deliverability/dns` rendait 400 pour « pas encore configuré ».
 *     Une configuration absente n'est pas une requête malformée.
 * ─────────────────────────────────────────────────────────────────────
 */

/** Fabrique un jeu d'en-têtes lisible comme ceux d'une vraie requête. */
const entetes = (h: Record<string, string>) => ({
  get: (n: string) => h[n.toLowerCase()] ?? null,
});

// ─────────── 1. LIRE ET ÉCRIRE N'ONT PAS LA MÊME PORTE ───────────

test("le navigateur de l'opérateur peut LIRE les sessions sans le secret de l'agent", () => {
  /**
   * LE BUG. Le secret est celui de l'agent Python ; le mettre dans le bundle
   * client l'exposerait à quiconque ouvre les devtools. Sans cette règle,
   * l'écran de supervision est mort dès que le secret est configuré —
   * c'est-à-dire en production.
   */
  const navigateur = entetes({ "sec-fetch-site": "same-origin", host: "alpha.eagleyecorp.fr" });
  assert.equal(peutLireSessions(navigateur, false), true);
});

test("le secret de l'agent ouvre la lecture aussi — outils et scripts", () => {
  assert.equal(peutLireSessions(entetes({}), true), true);
});

test("un site TIERS ne lit rien, même en prétendant venir de chez nous", () => {
  // `Sec-Fetch-Site` est posé par le navigateur : un site tiers ne peut pas
  // le forger. Un `Sec-Fetch-Site` présent mais différent est un refus NET —
  // on ne doit pas retomber sur `Origin`, qu'un tiers contrôle.
  const tiers = entetes({
    "sec-fetch-site": "cross-site",
    origin: "https://alpha.eagleyecorp.fr",
    host: "alpha.eagleyecorp.fr",
  });
  assert.equal(memeOrigine(tiers), false, "un Origin falsifié ne doit pas rattraper un Sec-Fetch-Site cross-site");
  assert.equal(peutLireSessions(tiers, false), false);
});

test("curl sans en-tête ne lit rien non plus", () => {
  // Aucun navigateur = aucun Sec-Fetch-Site et aucun Origin. Refus par défaut.
  assert.equal(peutLireSessions(entetes({ host: "alpha.eagleyecorp.fr" }), false), false);
});

test("le repli par Origin exige que l'hôte corresponde vraiment", () => {
  const bon = entetes({ origin: "https://alpha.eagleyecorp.fr", host: "alpha.eagleyecorp.fr" });
  const mauvais = entetes({ origin: "https://pirate.example", host: "alpha.eagleyecorp.fr" });
  assert.equal(memeOrigine(bon), true);
  assert.equal(memeOrigine(mauvais), false);
  // Un Origin illisible ne doit pas faire tomber la route.
  assert.equal(memeOrigine(entetes({ origin: "pas-une-url", host: "x" })), false);
});

test("le refus DIT quoi faire au lieu de se contenter de refuser", () => {
  assert.match(REFUS_LECTURE, /x-voice-secret/);
  assert.match(REFUS_LECTURE, /application elle-même/);
});

test("la route lit bien la règle partagée, et l'ÉCRITURE reste au secret seul", () => {
  const src = readFileSync(join(process.cwd(), "app/api/voice/session/route.ts"), "utf8");
  assert.ok(src.includes("peutLireSessions(req.headers, authorized(req))"), "le GET doit passer par la règle partagée");

  // Le POST, lui, ne doit PAS s'être ouvert au passage : c'est l'agent qui
  // écrit les transcriptions, et une écriture de même origine suffirait à
  // n'importe quel onglet ouvert pour fabriquer de fausses sessions.
  const post = src.slice(src.indexOf("export async function POST"));
  const gardePost = post.slice(0, 400);
  assert.match(gardePost, /authorized\(req\)/, "le POST doit rester réservé au secret de l'agent");
  assert.doesNotMatch(gardePost, /peutLireSessions/, "l'écriture ne doit jamais s'ouvrir à la même origine");
});

// ─────────── 2. « PAS CONFIGURÉ » N'EST PAS UNE ERREUR ───────────

test("l'absence de domaine d'envoi ne rend plus un 400", () => {
  /**
   * 400 = requête malformée du CLIENT. Ici la requête est parfaite, c'est le
   * serveur qui n'a pas de domaine. Deux écrans affichaient une erreur rouge
   * à chaque chargement, et une supervision aurait compté des erreurs client
   * qui n'en sont pas.
   */
  const src = readFileSync(join(process.cwd(), "app/api/deliverability/dns/route.ts"), "utf8");
  const bloc = src.slice(src.indexOf("if (!domain)"), src.indexOf("const [root, dmarc"));
  assert.doesNotMatch(bloc, /status:\s*400/, "« pas configuré » ne doit pas être un 400");
  assert.match(bloc, /configure:\s*false/, "l'état doit être explicite dans la réponse");
  assert.match(bloc, /quoiFaire/, "et la réponse doit dire l'étape à faire");
});

test("les deux écrans distinguent « pas configuré » de « en panne »", () => {
  const reglages = readFileSync(join(process.cwd(), "components/settings/deliverability.tsx"), "utf8");
  assert.match(
    reglages,
    /json\?\.configure === false/,
    "l'écran de réglages doit reconnaître l'état non configuré"
  );

  const pilote = readFileSync(join(process.cwd(), "app/(app)/pilote/page.tsx"), "utf8");
  assert.match(
    pilote,
    /configure === false \? null : j/,
    "le pilote ne doit pas afficher un rapport vide comme s'il en était un"
  );
});
