import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { DEUX_FORMES, FRONTIERE_PAYANT, PRIX_PUBLICS } from "../lib/public-catalogue";
import { OFFRE_CHEZ_VOUS, offreParId, PACK_SETUP_HT, PRIX_SIEGE_HT, SOCLE_PLATEFORME_HT } from "../lib/offres-publiques";
import { BRIQUES_CONNUES } from "../lib/entitlements";
import { CAPACITES } from "../lib/capacites-cle";

/**
 * ─────────────────────────────────────────────────────────────────────
 * DEUX FORMES D'ALPHA — décidé par Zakaria le 20/10/2026.
 * En ligne : gratuit, ce qui consomme s'ouvre avec les comptes du client.
 * Chez vous : tout Alpha sur le serveur du client, au prix de la grille.
 *
 * Ce fichier garde les trois façons dont la décision mentirait sans bruit :
 * une forme payante qui n'ouvre pas tout, un prix recopié qui dérive, et une
 * phrase publique qui promet une clé que le produit ne sait pas servir.
 * ─────────────────────────────────────────────────────────────────────
 */

const src = (p: string) => readFileSync(join(process.cwd(), p), "utf8");

test("la forme « chez vous » existe et ouvre TOUTES les briques", () => {
  const o = offreParId(OFFRE_CHEZ_VOUS);
  assert.ok(o, `l'offre ${OFFRE_CHEZ_VOUS} doit exister : c'est la seule issue payante qui ouvre tout`);
  const manquantes = BRIQUES_CONNUES.filter((b) => !o!.capacites.includes(b));
  assert.deepEqual(manquantes, [], "« tout Alpha chez vous » qui n'ouvrirait pas tout serait une promesse fausse");
});

test("son prix est celui de la grille complète, jamais recopié", () => {
  const o = offreParId(OFFRE_CHEZ_VOUS)!;
  assert.equal(o.prixHT, PACK_SETUP_HT, "l'installation affichée doit être celle de la grille");
  // La vitrine publique recopie la grille (elle ne peut pas l'importer) : la
  // copie est sûre parce qu'elle est vérifiée ici.
  assert.equal(PRIX_PUBLICS.packSetupHT, PACK_SETUP_HT);
  assert.equal(PRIX_PUBLICS.packSocleHT, SOCLE_PLATEFORME_HT);
  assert.equal(PRIX_PUBLICS.packSiegeHT, PRIX_SIEGE_HT);
  // L'écran de refus affiche ces montants : il doit les IMPORTER.
  const page = src("app/(app)/offre-brique/page.tsx");
  assert.match(page, /PACK_SETUP_HT/);
  assert.match(page, /SOCLE_PLATEFORME_HT/);
  assert.match(page, /PRIX_SIEGE_HT/);
  assert.doesNotMatch(page, /10[\s ]?000\s*€/, "un montant écrit en dur sur l'écran de refus dériverait au premier ajustement");
});

test("⚠ la phrase publique ne promet une clé QUE pour ce que le produit sait servir", () => {
  // Les clés servies aujourd'hui : `CAPACITES` de lib/capacites-cle.ts.
  assert.deepEqual([...CAPACITES].sort(), ["email", "ia"], "une capacité a été ajoutée : relire FRONTIERE_PAYANT et DEUX_FORMES");
  for (const texte of [FRONTIERE_PAYANT, DEUX_FORMES.enLigne.promesse]) {
    assert.match(texte, /\bIA\b/, "la clé IA existe et doit être dite");
    assert.match(texte, /emails?/, "la clé email existe et doit être dite");
    // La téléphonie n'a pas de clé par locataire : la promettre « avec vos
    // comptes » ferait cliquer un client vers une porte que le serveur refuse.
    assert.doesNotMatch(
      texte,
      /(téléphonie|appels?)[^.]*(vos propres comptes|votre propre clé)|(vos propres comptes|votre propre clé)[^.]*(téléphonie|appels?)/i,
      "aucune clé de téléphonie par locataire n'existe : ne pas la promettre"
    );
  }
  assert.doesNotMatch(FRONTIERE_PAYANT, /aucun chemin d'identifiants/i, "faux depuis le BYOK");
});

test("⚠ « chez vous » ne promet pas que les données ne sortent jamais", () => {
  // Une clé d'IA branchée envoie du texte au fournisseur du modèle. La phrase
  // juste dit où tournent l'application et sa base, et à qui sont les comptes.
  for (const texte of Object.values(DEUX_FORMES.chezVous)) {
    assert.doesNotMatch(texte, /ne (sortent|quittent) jamais|jamais de chez vous/i);
  }
});

test("la vitrine présente les deux formes, la gratuite d'abord", () => {
  const v = src("app/vitrine/page.tsx");
  const iEnLigne = v.indexOf("DEUX_FORMES.enLigne.nom");
  const iChezVous = v.indexOf("DEUX_FORMES.chezVous.nom");
  assert.ok(iEnLigne > 0, "la forme en ligne doit être affichée");
  assert.ok(iChezVous > 0, "la forme chez vous doit être affichée");
  assert.ok(iEnLigne < iChezVous, "la porte gratuite vient avant la payante");
});

test("l'écran de refus offre l'issue « chez toi » à côté du prix", () => {
  const page = src("app/(app)/offre-brique/page.tsx");
  assert.match(page, /offreParId\(OFFRE_CHEZ_VOUS\)/);
  assert.match(page, /DEUX_FORMES\.chezVous/);
});
