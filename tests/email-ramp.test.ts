import test from "node:test";
import assert from "node:assert/strict";
import { prospect, daysAgo } from "./fixtures";
import type { TimelineEvent } from "../lib/types";
import {
  emailRamp,
  firstEmailDate,
  mailboxesNeeded,
  RAMP_CEILING,
  RAMP_START,
  RAMP_STEP,
} from "../lib/email-ramp";
import { buildDailyPlan } from "../lib/daily-plan";
import { rampDepuisPremierEnvoi } from "../lib/email-ramp";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Le plafond d'envoi est le seul chiffre de l'app qui, s'il est trop
 * haut, détruit un actif qu'on ne récupère pas : la réputation du
 * domaine. Il doit être conservateur par construction, et jamais
 * dépendre d'une déclaration de l'opérateur.
 */

const email = (daysBack: number, id = `e${daysBack}`): TimelineEvent => ({
  id,
  date: daysAgo(daysBack),
  kind: "email",
  summary: "envoi",
});

test("ramp — sans historique d'envoi, on démarre au palier bas", () => {
  const r = emailRamp([prospect()]);
  assert.equal(r.today, RAMP_START);
  assert.equal(r.fresh, true);
  assert.equal(r.ceiling, false);
});

test("ramp — le palier suit les semaines réellement écoulées", () => {
  const at = (days: number) => emailRamp([prospect({ events: [email(days)] })]).today;
  assert.equal(at(0), RAMP_START); // premier jour
  assert.equal(at(6), RAMP_START); // toujours la semaine 1
  assert.equal(at(7), RAMP_START + RAMP_STEP); // semaine 2
  assert.equal(at(21), RAMP_START + 3 * RAMP_STEP); // semaine 4
});

test("ramp — le plafond de croisière ne se dépasse jamais", () => {
  // Une boîte vieille de deux ans reste plafonnée : l'ancienneté ne
  // multiplie pas ce qu'une seule boîte peut porter.
  const r = emailRamp([prospect({ events: [email(730)] })]);
  assert.equal(r.today, RAMP_CEILING);
  assert.equal(r.ceiling, true);
  assert.equal(r.next, RAMP_CEILING);
  assert.equal(r.daysToNext, 0);
  assert.match(r.why, /plusieurs boîtes/);
});

test("ramp — c'est le PREMIER envoi qui compte, pas le dernier", () => {
  // Le piège : lire l'envoi le plus récent ferait retomber au palier bas
  // quelqu'un qui envoie depuis des mois.
  const p = prospect({ events: [email(0, "a"), email(60, "b"), email(30, "c")] });
  assert.equal(firstEmailDate([p])!.slice(0, 10), daysAgo(60).slice(0, 10));
  assert.equal(emailRamp([p]).today, RAMP_CEILING);
});

test("ramp — les autres canaux ne comptent pas comme montée en charge", () => {
  const p = prospect({
    events: [
      { id: "a", date: daysAgo(90), kind: "appel", summary: "x" },
      { id: "b", date: daysAgo(90), kind: "linkedin", summary: "x" },
    ],
  });
  assert.equal(emailRamp([p]).fresh, true, "seuls les emails chauffent une boîte d'envoi");
});

test("ramp — le plan du jour applique le palier, pas le plafond théorique", () => {
  const fresh = buildDailyPlan([prospect({ email: "a@b.fr" })]);
  const chan = fresh.channels.find((c) => c.id === "email")!;
  assert.equal(chan.capacity, RAMP_START, "une boîte sans historique ne doit pas se voir proposer 40 envois");
  assert.match(chan.why, /Aucun envoi consigné/);
});

test("volume — atteindre un objectif haut demande plusieurs boîtes, et on le dit", () => {
  assert.equal(mailboxesNeeded(40), 1);
  assert.equal(mailboxesNeeded(120), 3);
  assert.equal(mailboxesNeeded(150), 4);
});

/**
 * ─────────────────────────────────────────────────────────────────────
 * LA MONTÉE EN CHARGE EST-ELLE UNE CONTRAINTE, OU UNE HABITUDE ?
 *
 * ⚠ ELLE ÉTAIT UNE HABITUDE, ET C'EST LE DÉFAUT LE PLUS FRÉQUENT DU DÉPÔT.
 *
 * Le barème était enfermé dans `emailRamp`, qui prend des `Prospect[]` — donc
 * inatteignable depuis le serveur, qui n'a pas le CRM du navigateur. Résultat
 * mesuré : `/outbox` coupait sa file au palier du jour, et les TROIS autres
 * appelants de `/api/send` — revue de campagne, newsletter, recette — ne
 * connaissaient que le plafond horaire de 40. Le palier du jour tenait par la
 * mémoire de celui qui envoie.
 *
 * C'est devenu structurant le 10/09/2026, quand le transactionnel et la
 * prospection ont commencé à partager une seule boîte : une campagne qui
 * grille l'adresse fait tomber les mails d'inscription avec elle.
 * ─────────────────────────────────────────────────────────────────────
 */

const sansCommentaires = (x: string) =>
  x.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
const routeSend = () =>
  sansCommentaires(readFileSync(join(process.cwd(), "app/api/send/route.ts"), "utf8"));

test("⚠ UN SEUL BARÈME — l'écran et le serveur ne peuvent pas diverger", () => {
  /**
   * Deux barèmes finiraient par se contredire, et c'est celui qu'on ne relit
   * pas — le serveur — qui garderait l'ancien. On vérifie donc que la vue
   * « fiches » n'est qu'un appel à la fonction commune, sur les valeurs qui
   * comptent : le départ, un palier intermédiaire, le plafond.
   */
  for (const semaines of [0, 1, 3, 20]) {
    const first = semaines === 0 ? null : daysAgo(semaines * 7);
    const parFiches = first
      ? emailRamp([prospect({ events: [email(semaines * 7)] })])
      : emailRamp([prospect({ events: [] })]);
    const parDate = rampDepuisPremierEnvoi(first);
    assert.equal(parDate.today, parFiches.today, `semaine ${semaines} : les deux vues doivent donner le même palier`);
  }
});

test("⚠ TOUS LES CHEMINS DE PANNE MÈNENT AU PALIER LE PLUS BAS", () => {
  /**
   * ⚠ C'est l'inverse du réflexe « en cas de doute, ne pas bloquer », et c'est
   * délibéré. Base injoignable, table vide, service role absent : `firstSendAt`
   * rend `null` dans les trois cas, donc le barème retombe à son plancher.
   *
   * Rendre « maintenant » sur une panne ouvrirait le plafond au maximum au
   * moment précis où l'on ne sait plus rien — et la réputation d'un domaine ne
   * se répare pas en redéployant.
   */
  assert.equal(rampDepuisPremierEnvoi(null).today, RAMP_START);
  assert.equal(rampDepuisPremierEnvoi(null).fresh, true);

  // Et la lecture serveur ne remonte JAMAIS une date en cas d'erreur.
  const src = sansCommentaires(readFileSync(join(process.cwd(), "lib/tracking.ts"), "utf8"));
  const i = src.indexOf("export async function firstSendAt");
  assert.ok(i > 0, "la lecture serveur du premier envoi doit exister");
  const corps = src.slice(i, i + 1400);
  assert.match(corps, /if \(error\) return null;/, "une erreur rend null, donc le plancher — jamais une date");
});

test("⚠ LA ROUTE D'ENVOI APPLIQUE LE PALIER — sur 24 h glissantes", () => {
  /**
   * ⚠ Mutation vérifiée : retirer le `if (envoyes24h >= ramp.today)` fait
   * tomber ce test et lui seul.
   *
   * ══ POURQUOI 24 H ET PAS « AUJOURD'HUI » ══
   *
   * L'écran raisonne en jour calendaire (il masque les fiches déjà écrites
   * dans la journée). Le serveur compte sur 24 h GLISSANTES, et ce n'est pas
   * une divergence par négligence : c'est ce que mesure un fournisseur de
   * messagerie. Un jour calendaire autorise cinq envois à 23h59 et cinq à
   * 00h01 — dix messages en deux minutes depuis une boîte neuve, exactement le
   * schéma que les filtres cherchent.
   */
  const src = routeSend();
  assert.match(src, /firstSendAt\("email", tenantId\)/, "la route doit lire depuis quand la boîte envoie");
  assert.match(src, /rampDepuisPremierEnvoi\(premierEnvoi\)/, "…et passer par le barème commun");
  assert.match(src, /countRecentSends\("email", 86_400_000, tenantId\)/, "le compteur porte sur 24 h glissantes");
  assert.match(src, /if \(envoyes24h >= ramp\.today\)/, "et le dépassement doit REFUSER");

  // La garde précède l'envoi réel : refuser après avoir envoyé ne refuse rien.
  const iGarde = src.indexOf("if (envoyes24h >= ramp.today)");
  const iEnvoi = src.search(/sendMail|transport\.send/);
  assert.ok(iEnvoi > 0 && iGarde < iEnvoi, "le palier se vérifie AVANT de remettre le message au serveur SMTP");
});

test("⚠ `force` NE PASSE PAS OUTRE le palier du jour", () => {
  /**
   * `force` arbitre des JUGEMENTS — le score anti-spam, la fenêtre de
   * recontact. Deux endroits où un humain peut légitimement décider qu'il en
   * sait plus que l'heuristique.
   *
   * La réputation d'un domaine n'est pas un jugement : elle ne se répare pas
   * en redéployant, et un opérateur pressé un mardi matin ne peut pas décider
   * seul de la dépenser. Même statut que le plafond horaire, qui ne s'est
   * jamais laissé forcer non plus.
   */
  const src = routeSend();
  const i = src.indexOf("if (envoyes24h >= ramp.today)");
  assert.ok(i > 0);
  // La CONDITION elle-même ne doit mentionner aucun contournement.
  const condition = src.slice(src.lastIndexOf("const premierEnvoi", i), i + 60);
  assert.doesNotMatch(condition, /body\.force|!force/, "le palier ne se force pas");

  // Contre-épreuve : `force` existe bien ailleurs, sinon ce test ne garde rien.
  assert.match(src, /!body\.force/, "force doit continuer d'arbitrer ce qui EST un jugement");
});

test("le refus DIT quoi faire, et quand ça se débloque", () => {
  /**
   * Un 429 sec se lit comme une panne, et la première réaction est de
   * réessayer — donc d'insister exactement quand il ne faut pas. Le message
   * porte le compte, le palier, et le fait qu'il monte tout seul.
   */
  const src = routeSend();
  const i = src.indexOf("if (envoyes24h >= ramp.today)");
  const bloc = src.slice(i, i + 900);
  assert.match(bloc, /Palier du jour atteint/, "le refus se nomme");
  assert.match(bloc, /\$\{envoyes24h\}\/\$\{ramp\.today\}/, "avec le compte réel");
  assert.match(bloc, /ramp\.why/, "et la raison du palier courant");
  assert.match(bloc, /il monte tout seul/, "…et le fait que ça se débloque sans rien faire");
  assert.match(bloc, /status: 429/, "429, comme le plafond horaire");
});
