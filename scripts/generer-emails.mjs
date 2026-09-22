#!/usr/bin/env node
/**
 * ─────────────────────────────────────────────────────────────────────
 * GÉNÉRATEUR D'EMAILS À FROID — « 500 prêts à envoyer », en une commande.
 *
 * Tu lui donnes un CSV de leads (l'export du hub Explorium, ou n'importe quelle
 * liste), il te sort un email PERSONNALISÉ, conforme et prêt à envoyer PAR LEAD.
 * Tu envoies un batch par jour depuis contact@eagleyecorp.fr, à ta main.
 *
 * Sortie : un fichier .eml par lead (double-clic → brouillon pré-rempli dans ton
 * client mail, tu cliques Envoyer) + un index lisible pour relire d'un coup.
 *
 * ── USAGE ──
 *   node scripts/generer-emails.mjs <leads.csv> [dossier_sortie]
 *   ex : node scripts/generer-emails.mjs ~/Downloads/eagleye_moa_email_batch2.csv emails-jour1
 *
 * Colonnes attendues (celles de l'export Explorium ; adapte si besoin) :
 *   prospect_first_name, business_name, contact_professional_email,
 *   contact_professional_email_status, business_business_description
 *
 * ── CE QU'IL FAIT DE PLUS, ET POURQUOI ──
 *  · Il ÉCARTE ce qui n'a pas d'email valide (un rebond dur grille le domaine).
 *  · Il MARQUE `_A-VERIFIER_` un lead dont l'email est `catch_all` (risque de
 *    rebond) OU dont la description ne parle pas de promotion immobilière —
 *    parce que le pitch « acquéreurs au bureau de vente » ne colle qu'à un
 *    promoteur, pas à une agence. Tu vois le drapeau AVANT d'envoyer.
 *  · Le texte, la conformité (mention STOP), l'angle (aucun prix, RDV en
 *    question fermée) : identiques à l'autopilote (`lib/mail-autopilote.ts`).
 *    Un promoteur reçoit le même message, qu'il parte d'ici ou du serveur.
 *
 * Zéro dépendance : Node natif. Aucun envoi — il PRÉPARE, tu ENVOIES.
 * ─────────────────────────────────────────────────────────────────────
 */

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const EXPEDITEUR = "Zakaria Tazi";
const SOCIETE = "EAGLEYE CORP";
const FROM = "contact@eagleyecorp.fr";

/** Parseur CSV minimal mais correct : gère les guillemets et les virgules dedans. */
function parseCSV(texte) {
  const lignes = [];
  let champ = "";
  let ligne = [];
  let dansGuillemets = false;
  const t = texte.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (dansGuillemets) {
      if (c === '"') {
        if (t[i + 1] === '"') { champ += '"'; i++; }
        else dansGuillemets = false;
      } else champ += c;
    } else if (c === '"') dansGuillemets = true;
    else if (c === ",") { ligne.push(champ); champ = ""; }
    else if (c === "\n") { ligne.push(champ); lignes.push(ligne); ligne = []; champ = ""; }
    else champ += c;
  }
  if (champ.length || ligne.length) { ligne.push(champ); lignes.push(ligne); }
  return lignes.filter((l) => l.some((x) => x.trim() !== ""));
}

const estEmail = (e) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test((e || "").trim());

/**
 * Le gabarit — MIROIR de `construireMailCold` (`lib/mail-autopilote.ts`).
 * Angle maîtrise d'ouvrage (acquéreurs refroidis), zéro prix, RDV en question
 * fermée à deux créneaux, mention STOP. Jamais « vous ratez des appels ».
 */
function construireEmail({ prenom, societe }) {
  const p = (prenom || "").trim() || "bonjour";
  const s = (societe || "").trim() || "votre structure";
  const subject = "Vos acquéreurs déjà passés au bureau de vente";
  const body = [
    `Bonjour ${p},`,
    "",
    "Sur un programme neuf, il passe plus de contacts acquéreurs au bureau de " +
      "vente que vos équipes ne peuvent en rappeler un par un. Les tièdes — ceux " +
      "qui ont visité, hésité, puis plus de nouvelles — sont ceux qui coûtent le " +
      "plus cher à laisser refroidir.",
    "",
    `${s} en a forcément une réserve. On a construit un outil qui reprend ce fil ` +
      "tout seul : il relance, qualifie, et ne vous rend que les acquéreurs " +
      "redevenus chauds — pour que vos équipes ne passent leur temps que sur ceux " +
      "qui signent.",
    "",
    "15 minutes pour vous le montrer sur un de vos programmes en cours — plutôt " +
      "mardi 15h ou jeudi 10h ?",
    "",
    "Bien à vous,",
    EXPEDITEUR,
    `${SOCIETE} — Lyon`,
    FROM,
    "",
    "Répondez STOP pour ne plus recevoir de message de ma part.",
  ].join("\n");
  return { subject, body };
}

/** Un lead ressemble-t-il à un VRAI promoteur ? (heuristique sur la description) */
function ressembleAPromoteur(desc) {
  const d = (desc || "").toLowerCase();
  return /promotion immobili|promoteur|montage d.?op[ée]ration|programme.? neuf/.test(d);
}

/** Encode une valeur d'en-tête MIME si elle sort de l'ASCII (accents). */
function enteteMime(v) {
  return /[^\x00-\x7F]/.test(v) ? `=?UTF-8?B?${Buffer.from(v, "utf8").toString("base64")}?=` : v;
}

function versEml({ to, subject, body }) {
  return [
    `From: ${enteteMime(SOCIETE)} <${FROM}>`,
    `To: ${to}`,
    `Subject: ${enteteMime(subject)}`,
    "MIME-Version: 1.0",
    'Content-Type: text/plain; charset="UTF-8"',
    "Content-Transfer-Encoding: 8bit",
    "",
    body,
  ].join("\r\n");
}

function main() {
  const [, , csvPath, dossier = "emails-a-envoyer"] = process.argv;
  if (!csvPath) {
    console.error("Usage : node scripts/generer-emails.mjs <leads.csv> [dossier_sortie]");
    process.exit(1);
  }
  const lignes = parseCSV(readFileSync(csvPath, "utf8"));
  if (lignes.length < 2) { console.error("CSV vide ou sans lignes."); process.exit(1); }

  const entetes = lignes[0].map((h) => h.trim());
  const idx = (nom) => entetes.indexOf(nom);
  const iEmail = idx("contact_professional_email");
  const iStatut = idx("contact_professional_email_status");
  const iPrenom = idx("prospect_first_name");
  const iSociete = idx("business_name");
  const iDesc = idx("business_business_description");
  if (iEmail === -1) {
    console.error("Colonne 'contact_professional_email' introuvable. Colonnes vues :", entetes.join(", "));
    process.exit(1);
  }

  mkdirSync(dossier, { recursive: true });
  const index = [];
  let prets = 0, ecartes = 0, aVerifier = 0;

  for (let n = 1; n < lignes.length; n++) {
    const r = lignes[n];
    const email = (r[iEmail] || "").trim();
    if (!estEmail(email)) { ecartes++; continue; }
    const prenom = iPrenom > -1 ? r[iPrenom] : "";
    const societe = iSociete > -1 ? r[iSociete] : "";
    const statut = iStatut > -1 ? (r[iStatut] || "").trim() : "";
    const desc = iDesc > -1 ? r[iDesc] : "";

    const flags = [];
    if (statut && statut !== "valid") flags.push(statut); // ex. catch_all → rebond possible
    if (!ressembleAPromoteur(desc)) flags.push("pas-promoteur?"); // agence/design → mauvais pitch
    if (flags.length) aVerifier++;

    const { subject, body } = construireEmail({ prenom, societe });
    const prefixe = flags.length ? "_A-VERIFIER_" : "";
    const nomFichier = `${prefixe}${String(n).padStart(3, "0")}-${email.replace(/[^a-z0-9]+/gi, "_")}.eml`;
    writeFileSync(join(dossier, nomFichier), versEml({ to: email, subject, body }));
    index.push(`${flags.length ? "⚠ " : "  "}${email}\t${societe}\t${flags.join(",") || "OK"}`);
    prets++;
  }

  writeFileSync(join(dossier, "_INDEX.txt"), [
    `EMAILS GÉNÉRÉS : ${prets}  (dont ${aVerifier} à vérifier)  ·  écartés (email invalide) : ${ecartes}`,
    `Envoie depuis ${FROM}. Les fichiers _A-VERIFIER_ : email catch-all (rebond possible) ou pas un promoteur — relis avant.`,
    "",
    "email\tsociété\tstatut",
    ...index,
  ].join("\n"));

  console.log(`✓ ${prets} emails prêts dans ./${dossier}/  (${aVerifier} à vérifier, ${ecartes} écartés)`);
  console.log(`  Relis ./${dossier}/_INDEX.txt — puis double-clique un .eml pour envoyer.`);
}

main();
