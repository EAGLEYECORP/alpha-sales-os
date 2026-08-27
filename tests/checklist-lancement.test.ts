import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { OFFRES } from "../lib/offres-publiques";

/**
 * ─────────────────────────────────────────────────────────────────────
 * LA CHECKLIST DE LANCEMENT DOIT DIRE LA VÉRITÉ.
 *
 * C'est le document qu'on ouvre pour mettre en ligne. Un pas faux ici ne
 * coûte pas une relecture : il coûte un déploiement dans lequel les clients
 * ne peuvent pas entrer, ou pire, dans lequel ils entrent trop.
 *
 * ⚠ CE QU'ELLE AFFIRMAIT ENCORE, ET QUI ÉTAIT FAUX :
 *  · « SITE_PASSWORD posé → l'app entière passe derrière » — il ne garde plus
 *    que les surfaces d'administration ;
 *  · « les tables Supabase : aucune n'existe, le SQL est dans les documents
 *    cités » — les migrations existent, et `schema.sql` ne fait RIEN sur une
 *    base déjà créée tout en annonçant « Success » ;
 *  · « brancher le webhook Stripe sur entitlements.bricks (écrit à la main) »
 *    — c'est fait, et laisser la case cochable fait refaire le travail ;
 *  · « 676 tests » — il y en a 1 080.
 *
 * Un document de lancement se périme plus vite que le code. On l'attache.
 * ─────────────────────────────────────────────────────────────────────
 */

const doc = readFileSync(join(process.cwd(), "docs/CHECKLIST-LANCEMENT.md"), "utf8");

test("les migrations citées EXISTENT vraiment sur le disque", () => {
  /**
   * Une checklist qui envoie vers un fichier absent fait perdre la confiance
   * dans tout le reste du document. On vérifie chaque chemin cité.
   */
  const cites = [...doc.matchAll(/supabase\/migrations\/[\w.-]+\.sql/g)].map((m) => m[0]);
  assert.ok(cites.length >= 2, "les deux migrations doivent être citées");
  for (const f of [...new Set(cites)]) {
    assert.ok(existsSync(join(process.cwd(), f)), `${f} est cité mais n'existe pas`);
  }
});

test("⚠ le piège de schema.sql est expliqué, pas seulement contourné", () => {
  /**
   * `create table if not exists` sur une base existante ne fait rien, ET le
   * SQL Editor annonce « Success ». Sans l'explication, on relance schema.sql,
   * on voit « Success », et on croit la base à jour.
   */
  assert.match(doc, /create table if not exists/);
  assert.match(doc, /Success/);
  assert.match(doc, /002-entitlements\.sql/);
  // ⚠ Le texte est coupé par un retour à la ligne du markdown : « …un\n
  // client paie… ». Un motif écrit d'un seul tenant échoue sur une phrase
  // pourtant présente. On tolère l'espacement, comme partout ailleurs ici.
  assert.match(doc, /un\s+client paie et l'application le refuse/i);
});

test("SITE_PASSWORD n'est plus décrit comme un mur sur toute l'app", () => {
  assert.doesNotMatch(
    doc,
    /l'app entière passe derrière/,
    "cette phrase est fausse depuis que le mur ne garde que l'administration"
  );
  assert.match(doc, /ADMIN_PREFIXES/, "il faut nommer ce qui reste muré");
  assert.match(doc, /REQUIRE_AUTH/, "et les variables qui lèvent le mur");
  assert.match(doc, /SUPABASE_JWT_SECRET/);
  assert.match(doc, /sans erreur\s*\n?\s*visible/i, "le symptôme d'un mur qui ne se lève pas doit être dit");
});

test("les DEUX variables de propriétaire sont exigées ENSEMBLE", () => {
  // Poser l'une sans l'autre est le piège documenté ; une checklist qui n'en
  // nomme qu'une le fabrique.
  const bloc = doc.slice(doc.indexOf("BLOC 2"), doc.indexOf("BLOC 3"));
  assert.match(bloc, /OWNER_EMAILS/);
  assert.match(bloc, /NEXT_PUBLIC_OWNER_EMAILS/);
  assert.match(bloc, /la même valeur|MÊME VALEUR/i);
});

test("la checklist réclame les QUATRE prix Stripe, et dit lequel est unique", () => {
  const payables = OFFRES.filter((o) => o.cadence !== "devis" && o.priceEnv);
  for (const o of payables) {
    const nom = o.priceEnv!.replace("STRIPE_PRICE_", "");
    assert.ok(
      doc.includes(o.priceEnv!) || doc.includes(`_${nom}`),
      `${o.priceEnv} (offre « ${o.nom} ») absent de la checklist`
    );
  }
  assert.match(doc, /paiement \*\*UNIQUE\*\*/, "l'essai récurrent prélèverait 290 € par mois");
});

test("ce qui est FAIT est marqué fait — sinon on refait le travail", () => {
  /**
   * Le raccord Stripe → droits existe depuis le 27/08. Laisser la case
   * ouverte fait rebrancher ce qui est branché, et masque ce qui reste
   * vraiment à faire : le prouver contre un vrai compte Stripe.
   */
  const bloc = doc.slice(doc.indexOf("BLOC 5"), doc.indexOf("## Les limites"));
  assert.match(bloc, /- \[x\]/, "au moins une case doit être cochée");
  assert.match(bloc, /~~Brancher le webhook Stripe sur `entitlements\.bricks`~~/);
  assert.match(bloc, /Reste à\s*\n?\s*le prouver/i, "…et ce qui reste doit être dit");
});

test("le compte de tests annoncé n'est pas resté en arrière", () => {
  /**
   * Trois documents annonçaient encore 168, 676 et « 33 000 lignes ». Un
   * chiffre périmé est une petite chose, mais il apprend au lecteur que le
   * document n'est pas tenu — et il arrête alors de le croire sur le reste.
   */
  const annonces = [...doc.matchAll(/(\d[\d\s ]{2,})\s*tests/g)].map((m) =>
    Number(m[1].replace(/[\s ]/g, ""))
  );
  assert.ok(annonces.length > 0, "la checklist doit annoncer un nombre de tests");
  for (const n of annonces) {
    assert.ok(n >= 1000, `la checklist annonce ${n} tests — le compte réel est bien plus haut`);
  }
});

test("« zéro vente » reste écrit tant que c'est vrai", () => {
  /**
   * C'est la phrase la plus utile du document, et la première qu'on aurait
   * envie d'enlever. Elle protège contre la preuve sociale inventée : tant
   * qu'aucun euro n'est rentré, tout le reste est une hypothèse.
   */
  assert.match(doc, /\*\*Zéro vente à ce jour\.\*\*/);
  assert.match(doc, /aucun euro/i);
});


// ══════════ docs/LANCEMENT.md — le « comment » opérationnel ══════════

const lancement = readFileSync(join(process.cwd(), "docs/LANCEMENT.md"), "utf8");

test("le gabarit local ne se prétend plus COMPLET", () => {
  /**
   * Il s'annonçait « le gabarit complet » avec 18 variables sur 63 — sans la
   * voix, sans Stripe, sans les comptes clients, sans la sécurité de
   * production. Un gabarit qui se dit complet dispense de chercher ailleurs :
   * c'est ce qui le rend dangereux, pas ce qu'il omet.
   */
  assert.doesNotMatch(lancement, /le gabarit complet/, "cette promesse était fausse");
  assert.match(lancement, /n'est PAS complet/i, "il doit dire ce qu'il n'est pas");
  assert.match(lancement, /\.env\.example/, "…et pointer vers la référence");
});

test("le bloc production nomme les quatre variables qui décident de qui entre", () => {
  const bloc = lancement.slice(lancement.indexOf("**Côté Vercel**"), lancement.indexOf("## 3."));
  for (const v of ["OWNER_EMAILS", "NEXT_PUBLIC_OWNER_EMAILS", "REQUIRE_AUTH", "SUPABASE_JWT_SECRET"]) {
    assert.ok(bloc.includes(v), `${v} absente du bloc production`);
  }
  assert.match(bloc, /sans message d'erreur|sans erreur/i, "le symptôme silencieux doit être dit");
});

test("⚠ le dépannage n'enseigne plus une commande qui se tue elle-même", () => {
  /**
   * `pgrep -f next-server` / `pkill -f next-server` : le motif correspond à la
   * ligne de commande du SHELL qui l'exécute, qui meurt donc avec sa cible.
   * Ça m'a coûté deux builds aujourd'hui, dont un perdu en cours de route —
   * et le symptôme (« la commande s'est arrêtée toute seule ») ne pointe vers
   * rien. Les crochets cassent l'auto-correspondance.
   */
  /**
   * ⚠ ET C'EST LA QUATRIÈME FOIS AUJOURD'HUI QUE CE PIÈGE SE PRÉSENTE.
   *
   * Premier jet : « le bloc ne doit pas contenir `pkill -f next-server` ».
   * Il échoue — parce que la phrase qui AVERTIT contre cette commande la
   * cite forcément. Interdire la chaîne obligerait à supprimer
   * l'avertissement pour faire taire le test, soit exactement l'inverse du
   * but. (Déjà vu dans vitrine-fuite, linkedin, et le test de `.env.example`.)
   *
   * On ne juge donc pas la PRÉSENCE mais la PRESCRIPTION : la commande
   * recommandée doit être la forme sûre, et toute occurrence de la forme
   * dangereuse doit être précédée d'un « Pas ».
   */
  const bloc = lancement.slice(lancement.indexOf("## 5. Dépannage"), lancement.indexOf("## 6."));
  assert.match(bloc, /next-serve\[r\]/, "la forme sûre utilise des crochets");
  assert.match(bloc, /se tue en même temps|auto-correspondance/i, "et la raison doit être écrite");

  for (const m of bloc.matchAll(/p(?:kill|grep) -f next-server/g)) {
    const avant = bloc.slice(Math.max(0, m.index! - 60), m.index!);
    assert.match(
      avant,
      /\*\*Pas\*\*|jamais|ne pas/i,
      "la forme dangereuse ne peut apparaître que comme contre-exemple explicite"
    );
  }
});

test("la checklist GO-LIVE exige les migrations", () => {
  const bloc = lancement.slice(lancement.indexOf("## 4. Checklist GO-LIVE"), lancement.indexOf("## 5."));
  assert.match(bloc, /migrations Supabase/i);
  assert.match(bloc, /002/, "la migration des droits doit être nommée");
  assert.match(bloc, /se fait refuser|refuse/i, "et sa conséquence si elle manque");
});
