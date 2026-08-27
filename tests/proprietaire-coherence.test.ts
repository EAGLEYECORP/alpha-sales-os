import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { listeEmails, verifierProprietaire } from "../lib/proprietaire-coherence";

/**
 * ─────────────────────────────────────────────────────────────────────
 * LA DIVERGENCE QU'AUCUN TEST NE PEUT ATTRAPER.
 *
 * `OWNER_EMAILS` (serveur, la barrière du middleware) et
 * `NEXT_PUBLIC_OWNER_EMAILS` (navigateur, ce que l'écran affiche) doivent
 * porter la même liste. Ce sont des VALEURS d'environnement, pas du code :
 * un test ne verra jamais leur contenu réel. On teste donc la MACHINE qui
 * les compare, et on la branche là où quelqu'un la lira — la sonde de
 * diagnostic et le panneau opérateur.
 *
 * Une divergence ne plante pas, elle ment :
 *  · public seul  → l'écran promet, le serveur refuse. On croit à une panne.
 *  · serveur seul → les droits existent, l'écran masque les commandes. On ne
 *                   le découvre jamais.
 * ─────────────────────────────────────────────────────────────────────
 */

test("deux listes identiques sont cohérentes, quel que soit l'ordre ou l'espacement", () => {
  const c = verifierProprietaire(" A@X.FR , @y.fr ", "@Y.FR,a@x.fr");
  assert.equal(c.coherent, true, "la comparaison doit normaliser casse, espaces et ordre");
  assert.equal(c.configure, true);
  assert.equal(c.quoiFaire, "", "rien à signaler quand tout concorde");
});

test("⚠ AUCUN propriétaire déclaré : le cas le plus silencieux", () => {
  /**
   * Personne n'est maître — Zakaria compris. Toutes les routes réservées au
   * propriétaire répondent 403, y compris pour lui. Rien ne plante : tout
   * refuse, et rien n'explique pourquoi.
   */
  const c = verifierProprietaire("", "");
  assert.equal(c.configure, false);
  assert.match(c.quoiFaire, /personne n'est maître/i);
  assert.match(c.quoiFaire, /403/, "l'effet concret doit être écrit, pas seulement le symptôme");
  assert.match(c.quoiFaire, /OWNER_EMAILS et NEXT_PUBLIC_OWNER_EMAILS/);
});

test("public sans serveur : l'écran promet ce que le serveur refuse", () => {
  const c = verifierProprietaire("a@x.fr", "a@x.fr,intrus@y.fr");
  assert.equal(c.coherent, false);
  assert.deepEqual(c.navigateurSeul, ["intrus@y.fr"]);
  assert.deepEqual(c.serveurSeul, []);
  assert.match(c.quoiFaire, /ressemble à une panne/i);
});

test("serveur sans public : les droits existent, l'interface les cache", () => {
  const c = verifierProprietaire("a@x.fr,oublie@y.fr", "a@x.fr");
  assert.equal(c.coherent, false);
  assert.deepEqual(c.serveurSeul, ["oublie@y.fr"]);
  assert.match(c.quoiFaire, /plus dur à repérer/i);
});

test("le diagnostic ne recrache AUCUNE adresse", () => {
  /**
   * Le message part dans la sonde. Elle est protégée, mais une adresse email
   * reste une donnée personnelle — et un diagnostic n'a pas besoin de la
   * citer pour être actionnable : celui qui lit a son environnement sous les
   * yeux. J'avais écrit l'inverse en premier jet ; le commentaire promettait
   * « que des nombres » pendant que le code listait les adresses.
   */
  for (const c of [
    verifierProprietaire("a@x.fr", "a@x.fr,secret@perso.fr"),
    verifierProprietaire("a@x.fr,secret@perso.fr", "a@x.fr"),
  ]) {
    assert.doesNotMatch(c.quoiFaire, /@/, "aucune adresse ne doit apparaître dans le message");
    assert.match(c.quoiFaire, /\d+ adresse/, "on annonce un NOMBRE");
  }
});

test("une liste vide ne matche personne", () => {
  // Sans cette garde, une variable mal remplie donnerait le compte maître à
  // tout le monde — c'est la raison d'être du `filter(Boolean)`.
  assert.deepEqual(listeEmails(",, ,"), []);
  assert.deepEqual(listeEmails(undefined), []);
  assert.deepEqual(listeEmails(null), []);
});

// ─────────── Branché là où quelqu'un le lira ───────────

test("la sonde publie l'état, sans publier les adresses", () => {
  const src = readFileSync(join(process.cwd(), "app/api/health/route.ts"), "utf8");
  assert.match(src, /verifierProprietaire\(env\.OWNER_EMAILS, env\.NEXT_PUBLIC_OWNER_EMAILS\)/);
  // On ne renvoie que des booléens, des nombres et le conseil.
  const bloc = src.slice(src.indexOf("proprietaire: (()"), src.indexOf("voice: {"));
  assert.match(bloc, /serveurSeul: c\.serveurSeul\.length/, "on publie le NOMBRE, pas la liste");
  assert.match(bloc, /navigateurSeul: c\.navigateurSeul\.length/);
  assert.doesNotMatch(bloc, /serveurSeul: c\.serveurSeul,/, "la liste d'adresses ne doit pas sortir");
});

test("le panneau opérateur AFFICHE la divergence — un diagnostic que personne ne lit ne sert à rien", () => {
  const src = readFileSync(join(process.cwd(), "components/settings/system-status.tsx"), "utf8");
  assert.match(src, /Compte propriétaire/, "il faut un bloc dédié");
  assert.match(src, /DIVERGENT/, "et la divergence doit se voir, pas se deviner");
  assert.match(src, /proprietaire\?\.coherent === false/, "l'état doit venir de la sonde");
  // Le cas « aucun propriétaire » doit être un AVERTISSEMENT, pas un état neutre.
  assert.match(src, /proprietaire\?\.configure \? "ok" : "warn"/);
});
