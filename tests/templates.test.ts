import { test } from "node:test";
import assert from "node:assert/strict";
import { buildTemplates, SECTOR_LABELS, fillTemplate, STAGE_GROUPS, type AngleKey } from "../lib/templates";

const bodies = (opts?: Parameters<typeof buildTemplates>[0]) => buildTemplates(opts).map((t) => t.body).join("\n");

test("scripts — AUCUNE référence client inventée", () => {
  // Ces textes partent tels quels dans un email ou sont lus au téléphone.
  // « une menuiserie de Caluire reçoit 9 demandes de devis par mois » quand ce
  // client n'existe pas, c'est une allégation fausse destinée à provoquer un
  // achat. Zéro vente signée à ce jour : il n'y a AUCUNE référence à citer.
  const all = bodies();
  assert.doesNotMatch(all, /menuiserie de Caluire/i);
  assert.doesNotMatch(all, /bouchon de la Croix-Rousse/i);
  assert.doesNotMatch(all, /pub du Vieux Lyon/i);
  assert.doesNotMatch(all, /société de Villeurbanne/i);
  // Aucun résultat client chiffré tant qu'aucun client n'existe.
  assert.doesNotMatch(all, /reçoit maintenant \d+/i);
  assert.doesNotMatch(all, /remplit ses soirées .* à \d+ ?%/i);
});

test("scripts — une VRAIE référence, quand elle existe, remplace le mécanisme", () => {
  const vrai = "Toitures du Rhône a récupéré 14 devis dormants le premier mois";
  const all = bodies({ proof: vrai });
  assert.ok(all.includes(vrai), "la référence réelle doit apparaître dans les scripts");
  // Et elle remplace partout : pas de cohabitation avec une preuve générique.
  assert.doesNotMatch(all, /un appel manqué ne laisse aucune trace/);
});

test("scripts — le nom de l'agence vient des réglages, jamais en dur", () => {
  const all = bodies();
  assert.doesNotMatch(all, /EAGLEYE/, "un revendeur ne doit pas envoyer un email signé du compte maître");
  assert.ok(bodies({ agency: "ScintIA" }).includes("ScintIA"));
  // Sans réglage, un repli neutre plutôt qu'un nom emprunté.
  assert.ok(all.includes("l'agence"));
});

test("scripts — les deux nouveaux marchés ont leurs propres scripts", () => {
  const ids = new Set(buildTemplates().map((t) => t.sector));
  assert.ok(ids.has("equipe-terrain"), "les équipes commerciales terrain n'avaient aucun script");
  assert.ok(ids.has("centre-appels"), "les centres d'appels n'avaient aucun script");
  // Et chaque industrie est couverte sur tous les moments du pipeline.
  for (const key of Object.keys(SECTOR_LABELS) as AngleKey[]) {
    for (const g of STAGE_GROUPS) {
      assert.ok(
        buildTemplates().some((t) => t.sector === key && t.group === g.id),
        `${key} n'a rien à dire au moment « ${g.label} »`
      );
    }
  }
});

test("scripts — l'équipe terrain ne s'entend jamais dire qu'elle rate des appels", () => {
  const terrain = buildTemplates()
    .filter((t) => t.sector === "equipe-terrain")
    .map((t) => t.body)
    .join("\n");
  assert.doesNotMatch(terrain, /appels? (manqué|raté)/i, "cet argument est celui de l'artisan seul, pas d'une force de vente");
  assert.match(terrain, /relanc/i, "sa perte réelle, c'est le devis non relancé");
});

test("scripts — aucune variable ne reste orpheline après remplissage", () => {
  // Une accolade oubliée dans un email envoyé, c'est l'amateurisme visible.
  for (const t of buildTemplates({ agency: "EAGLEYE CORP" })) {
    const rempli = fillTemplate(t.body, null, "Zakaria");
    const restantes = rempli.match(/\{[a-z_]+\}/g) ?? [];
    for (const v of restantes) {
      // Les variables de prospect restent visibles quand aucun prospect n'est
      // choisi — c'est voulu. Toutes les autres doivent avoir été résolues.
      assert.ok(
        ["{prenom}", "{commerce}", "{taxe}", "{taxe_semaine}", "{fois}", "{jour}", "{heure}"].includes(v),
        `variable non résolue dans « ${t.title} » : ${v}`
      );
    }
  }
});

test("scripts — le RDV de la fiche remplit {jour} et {heure}", () => {
  const confirmation = buildTemplates().find((t) => t.body.includes("{jour}"))!;
  const p = {
    name: "Marc Perrin",
    company: "Toitures du Rhône",
    city: "Lyon",
    ignoranceTax: 0,
    monthlyValue: 0,
    nextStep: { date: "2026-09-15T15:30:00.000Z", action: "Audit sur place" },
  } as unknown as Parameters<typeof fillTemplate>[1];

  const rempli = fillTemplate(confirmation.body, p, "Zakaria");
  assert.match(rempli, /septembre/, "la date du RDV doit remplacer {jour}");
  assert.doesNotMatch(rempli, /\{jour\}|\{heure\}/, "un email de confirmation ne part pas avec des accolades dedans");

  // Sans RDV daté, on laisse la variable VISIBLE plutôt que d'inventer une date.
  const sansRdv = fillTemplate(confirmation.body, null, "Zakaria");
  assert.match(sansRdv, /\{jour\}/);
});
