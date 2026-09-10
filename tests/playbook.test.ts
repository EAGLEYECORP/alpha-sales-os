import { test } from "node:test";
import assert from "node:assert/strict";
import { VERTICALS, verticalById, verticalForProspect, verticalForSector, estimateLeak, playbookPrompt } from "../lib/playbook";
import type { Prospect } from "../lib/types";

const fiche = (notes: string, sector: Prospect["sector"] = "autre") => ({ sector, notes });

test("verticales — l'ICP élargi a ses scripts, pas juste sa doctrine", () => {
  // Sans verticale, un plateau de 40 positions tombe sur « autres métiers » et
  // s'entend dire « vous ratez des appels » — le pire argument possible pour lui.
  assert.ok(verticalById("centre-appels"), "les centres d'appels doivent avoir leur script");
  assert.ok(verticalById("equipe-terrain"), "les équipes commerciales terrain doivent avoir leur script");
});

test("routage — l'organisation passe AVANT le métier", () => {
  // Le cas qui cassait : « couvreur » et « rénovation » rattachaient une équipe
  // de 12 poseurs à la verticale de l'artisan seul.
  const equipe = verticalForProspect(fiche("Métier : couverture et rénovation énergétique. 12 commerciaux en porte-à-porte."));
  assert.equal(equipe?.id, "equipe-terrain");

  // L'artisan seul, lui, doit rester sur sa verticale.
  const artisan = verticalForProspect(fiche("Métier : couvreur. Le gérant répond lui-même entre deux chantiers."));
  assert.equal(artisan?.id, "artisan-batiment");

  const plateau = verticalForProspect(fiche("Métier : centre d'appels, 60 positions, relation client."));
  assert.equal(plateau?.id, "centre-appels");
});

test("routage — sans mot-clé, on retombe sur le secteur de la fiche", () => {
  assert.equal(verticalForProspect(fiche("", "restaurant"))?.id, verticalForSector("restaurant")?.id);
  assert.equal(verticalForProspect(fiche("rien de parlant", "autre"))?.id, "generique");
});

test("équipe terrain — l'argument des appels manqués est explicitement interdit", () => {
  const v = verticalById("equipe-terrain")!;
  // Une organisation qui a des commerciaux ne rate pas ses appels : elle perd
  // ce que ses gens n'ont pas noté. Confondre les deux, c'est se disqualifier.
  assert.ok(v.forbidden.some((f) => /ratez des appels/i.test(f.regle)));
  assert.ok(v.objections.some((o) => /CRM/i.test(o.q)), "l'objection « on a déjà un CRM » est la première qui vient");
  // Le disqualifiant est dit franchement, pas contourné.
  assert.ok(v.objections.some((o) => /trop peu nombreux/i.test(o.q)));
});

test("centre d'appels — la divulgation IA est servie comme argument, pas cachée", () => {
  const v = verticalById("centre-appels")!;
  const texte = [...v.opener.map((o) => `${o.line} ${o.note ?? ""}`), ...v.objections.map((o) => o.a)].join(" ").toLowerCase();
  assert.match(texte, /annonce qu'il est une ia|se déclare/, "l'agent annonce qu'il est une IA — art. 50, et ça désamorce");
  assert.ok(v.forbidden.some((f) => /remplace vos équipes/i.test(f.regle)), "promettre le remplacement des équipes fait fermer la porte");
});

test("verticales — chacune reste dicible et chiffrable", () => {
  for (const v of VERTICALS) {
    assert.ok(v.opener.length >= 4, `${v.id} : ouverture incomplète`);
    assert.ok(v.diagnostic.length >= 1, `${v.id} : aucune question de diagnostic`);
    assert.ok(v.objections.length >= 3, `${v.id} : trop peu d'objections travaillées`);
    assert.ok(v.mirror.length > 40, `${v.id} : le miroir doit être une phrase, pas un slogan`);

    const leak = estimateLeak(v);
    if (leak) {
      assert.ok(leak.monthly > 0, `${v.id} : la fuite doit être chiffrable`);
      assert.ok(leak.basis.includes("×"), `${v.id} : le calcul doit être montrable, jamais un chiffre nu`);
    } else {
      /**
       * Une verticale sans fuite chiffrable reste dicible : elle doit
       * simplement remplacer le montant par l'interdiction d'en avancer un.
       * Sans cette branche, le prompt pourrait se taire complètement et l'IA
       * inventerait le chiffre manquant — c'est le comportement par défaut
       * d'un modèle à qui on ne dit rien.
       */
      const prompt = playbookPrompt(undefined, v.id);
      assert.match(
        prompt,
        /NE JAMAIS avancer de montant/,
        `${v.id} : sans chiffrage, le prompt doit INTERDIRE le montant, pas l'omettre`
      );
      assert.doesNotMatch(prompt, /Ordre de grandeur de la fuite/, `${v.id} : aucun ordre de grandeur ne doit être annoncé`);
    }
  }
});

test("prompt — aucun nom de compte en dur : l'OS est white-label", () => {
  const prompt = playbookPrompt(undefined, "centre-appels");
  assert.doesNotMatch(prompt, /EAGLEYE/i, "le prompt ne doit pas imposer le nom du compte maître");
  assert.match(prompt, /Verticale : Centres d'appels/);
  assert.match(prompt, /estimation à valider/, "la fuite ne doit jamais être présentée comme un fait");
});
