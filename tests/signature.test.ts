import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { CLOSER_USINE, signataire, identiteDUsine } from "../lib/signature";
import { verifieMentions } from "../lib/conformite";
import { emailBody } from "../lib/mail-compose";
import { draftContentFor } from "../lib/gmail-draft";
import { prospect } from "./fixtures";

const RACINE = process.cwd();

const sansCommentaires = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "").replace(/\{\/\*[\s\S]*?\*\/\}/g, "");

function fichiers(dirs: string[]): string[] {
  const out: string[] = [];
  const visite = (d: string) => {
    for (const f of readdirSync(d)) {
      if (f === "node_modules" || f.startsWith(".")) continue;
      const p = join(d, f);
      if (statSync(p).isDirectory()) visite(p);
      else if (/\.tsx?$/.test(p)) out.push(p);
    }
  };
  for (const d of dirs) visite(join(RACINE, d));
  return out;
}

/**
 * ─────────────────────────────────────────────────────────────────────
 * AUCUN PRÉNOM HUMAIN EN DUR DANS UN CHEMIN D'ENVOI.
 *
 * Le produit est WHITE-LABEL. `lib/mail-compose.ts` et `lib/gmail-draft.ts`
 * repliaient sur « Zakaria » — le prénom du propriétaire de l'outil — quand le
 * nom du closer était vide. Un revendeur qui vidait le champ signait ses
 * emails du prénom de quelqu'un d'autre.
 *
 * Le garde balaie le code de production. Les tests, eux, ont le droit de
 * passer un nom explicite : c'est même comme ça qu'on vérifie le rendu.
 * ─────────────────────────────────────────────────────────────────────
 */
test("aucun prénom du propriétaire en repli dans le code de production", () => {
  const fautes: string[] = [];
  for (const f of fichiers(["lib", "components", "app"])) {
    const code = sansCommentaires(readFileSync(f, "utf8"));
    // Un repli : `?? "Prénom"`, `|| "Prénom"`, `closerName = "Prénom"`.
    const replis = [...code.matchAll(/(?:\|\||\?\?|closerName\s*[:=])\s*"(Zakaria|Tazi|Zakaria Tazi)"/g)];
    for (const m of replis) fautes.push(`${relative(RACINE, f)} → ${m[0].trim()}`);
  }
  assert.deepEqual(fautes, [], `Prénom humain en dur dans un chemin d'envoi :\n${fautes.join("\n")}`);
});

/**
 * Une seule définition du nom d'usine. Deux copies dérivent, et le jour où
 * elles dérivent le détecteur cesse d'attraper le placeholder en silence.
 */
test("le nom d'usine n'est écrit qu'une fois, dans lib/signature", () => {
  const porteurs: string[] = [];
  for (const f of fichiers(["lib", "components", "app"])) {
    if (f.endsWith(join("lib", "signature.ts"))) continue;
    const code = sansCommentaires(readFileSync(f, "utf8"));
    if (code.includes(`"${CLOSER_USINE}"`)) porteurs.push(relative(RACINE, f));
  }
  assert.deepEqual(
    porteurs,
    [],
    `« ${CLOSER_USINE} » est recopié en dur — il doit venir de CLOSER_USINE :\n${porteurs.join("\n")}`
  );
});

test("signataire — l'ordre de repli n'invente jamais un humain", () => {
  // 1. Le nom saisi gagne.
  assert.deepEqual(signataire("Marc Perrin", "ACME"), { nom: "Marc Perrin", usine: false });
  assert.deepEqual(signataire("  Marc Perrin  ", "ACME"), { nom: "Marc Perrin", usine: false });

  // 2. Champ vide → la SOCIÉTÉ. Une raison sociale est une identité légale,
  //    et elle appartient bien à celui qui envoie.
  assert.deepEqual(signataire("", "ACME"), { nom: "ACME", usine: false });
  assert.deepEqual(signataire(undefined, "ACME"), { nom: "ACME", usine: false });

  // 3. Rien du tout → le nom d'usine, mais SIGNALÉ. On ne le masque pas :
  //    masquer le trou le rend indétectable.
  assert.deepEqual(signataire("", ""), { nom: CLOSER_USINE, usine: true });
  assert.deepEqual(signataire(undefined, undefined), { nom: CLOSER_USINE, usine: true });

  // 4. Le nom d'usine EXPLICITEMENT présent reste signalé, même avec une
  //    société renseignée : c'est le cas réel d'un store neuf.
  assert.deepEqual(signataire(CLOSER_USINE, "EAGLEYE CORP"), { nom: CLOSER_USINE, usine: true });
  assert.equal(identiteDUsine(CLOSER_USINE, "EAGLEYE CORP"), true);
  assert.equal(identiteDUsine("Marc Perrin", "EAGLEYE CORP"), false);
});

/**
 * Le contrôle de conformité passait au vert sur le nom d'usine, parce qu'il
 * ne vérifiait qu'une PRÉSENCE de chaîne. La mention exigée est l'identité de
 * l'expéditeur : un placeholder n'identifie personne.
 */
test("verifieMentions refuse le nom d'usine comme identité d'expéditeur", () => {
  const corps = emailBody(prospect({ company: "Test SARL" }), {
    closerName: CLOSER_USINE,
    agencyName: "EAGLEYE CORP",
  });
  const manques = verifieMentions(corps, CLOSER_USINE, "EAGLEYE CORP");
  assert.ok(
    manques.some((m) => /non renseigné/.test(m)),
    `Le nom d'usine passe encore le contrôle de conformité. Manques relevés : ${JSON.stringify(manques)}`
  );

  // Et un vrai nom passe toujours : le garde ne doit pas bloquer l'usage normal.
  const vrai = emailBody(prospect({ company: "Test SARL" }), {
    closerName: "Marc Perrin",
    agencyName: "EAGLEYE CORP",
  });
  assert.deepEqual(verifieMentions(vrai, "Marc Perrin", "EAGLEYE CORP"), []);
});

/**
 * Les deux chemins d'écriture doivent signer du MÊME nom. S'ils divergent,
 * le brouillon HTML et l'email collé à la main ne viennent plus de la même
 * personne — et c'est invisible tant qu'on ne les compare pas côte à côte.
 */
test("texte brut et brouillon HTML signent du même nom", () => {
  const p = prospect({ company: "Test SARL", email: "contact@test.fr" });

  const brut = emailBody(p, { closerName: "", agencyName: "ACME" });
  const draft = draftContentFor(p, { closerName: "", agencyName: "ACME" });
  assert.ok(brut.includes("ACME"), "le texte brut ne retombe pas sur la société");
  assert.ok(draft.text.includes("ACME"), "le brouillon HTML ne retombe pas sur la société");
  assert.ok(!/Zakaria/.test(brut), "le texte brut signe encore d'un prénom en dur");
  assert.ok(!/Zakaria/.test(draft.text), "le brouillon HTML signe encore d'un prénom en dur");
});
