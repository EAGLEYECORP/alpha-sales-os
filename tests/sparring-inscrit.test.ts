import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { NextRequest } from "next/server";
import { moteurLocalSparring, promptSparring, type SparringRequest } from "../lib/sparring";
import { REGLES_DE_METHODE } from "../lib/business-rules";
import { commeInscrit, promptsEnvoyes } from "./capture-prompt";
import { sansCommentaires } from "./citations-alpha";

/**
 * ─────────────────────────────────────────────────────────────────────
 * LE SPARRING D'UN INSCRIT S'ENTRAÎNE SUR SON OFFRE, PAS SUR LA NÔTRE.
 *
 * Mesuré le 22/10/2026 : pour tout compte, le prospect simulé était « un
 * patron de commerce local » à qui l'on proposait « un audit gratuit de 20
 * minutes », avec la douleur et les objections de NOS verticales.
 * ─────────────────────────────────────────────────────────────────────
 */

const NON_MAITRE = { ALPHA_INSTALLATION: "client", SITE_PASSWORD: "serrure-de-test" };
const SANS_MOTEUR = { NVIDIA_API_KEY: undefined, ANTHROPIC_API_KEY: undefined, OLLAMA_BASE_URL: undefined, OLLAMA_MODEL: undefined };

/** Ce qu'un vieux navigateur envoie encore : NOTRE marque, NOTRE ancienne offre. */
const corps = (patch: Partial<SparringRequest> = {}): SparringRequest => ({
  prospect: { company: "Bistrot test", name: "Léa Vasseur", sector: "restaurant", pitch: "", objections: [] },
  history: [{ role: "closer", text: "Bonjour, je vous appelle au sujet de votre organisation." }],
  businessRules: "",
  agencyName: "EAGLEYE CORP",
  offerLine: "Alpha Sales OS — l'OS de vente terrain",
  ...patch,
});

/** Ce qui est à NOUS : marque, offres, premier rendez-vous, marché d'avant, playbook. */
const NOTRE = /eagleye|nuwacom|alpha sales os|alpha voice|audit|commerce local|aux commerces|facebook|note google|preuve locale|Verticale :|Douleur structurelle/i;

test("le maître garde son sparring : son premier rendez-vous, son marché, son playbook", () => {
  const p = promptSparring(corps(), true);
  assert.match(p, /patron de commerce local/);
  assert.match(p, /audit gratuit de 20 minutes/);
  assert.match(p, /Verticale : .*Douleur structurelle/, "le playbook terrain du maître reste branché");
});

test("⚠⚠ /api/sparring : ce qu'un inscrit envoie au modèle ne porte ni notre marque, ni notre offre, ni notre marché", async () => {
  const { POST } = await import("../app/api/sparring/route");
  const envoye = await promptsEnvoyes(() =>
    commeInscrit({ ...NON_MAITRE, ...SANS_MOTEUR, NVIDIA_API_KEY: "nvapi-cle-de-test" }, async () => {
      const res = await POST(
        new NextRequest("http://local/api/sparring", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(corps()),
        })
      );
      assert.equal(res.status, 200);
    })
  );
  assert.equal(envoye.length, 1, "le modèle doit avoir été appelé une fois");
  const prompt = envoye[0];
  assert.doesNotMatch(prompt, NOTRE);
  assert.doesNotMatch(prompt, /escalier|15\s*%/i, "ni notre économie");
  assert.match(prompt, /rendez-vous daté/);
  assert.ok(prompt.includes(REGLES_DE_METHODE.split("\n").at(-1)!), "la méthode d'un inscrit, pas notre doctrine");
});

test("SON identité passe telle quelle — c'est la nôtre seule qui s'efface", () => {
  const p = promptSparring(corps({ agencyName: "Dupont Conseil SAS", offerLine: "un logiciel de paie" }), false);
  assert.match(p, /de Dupont Conseil SAS, qui propose un logiciel de paie,/);
  const vide = promptSparring(corps({ agencyName: "", offerLine: "" }), false);
  assert.match(vide, /Un commercial d'une entreprise essaie/, "rien de deviné quand rien n'est dit");
});

test("⚠ le moteur local d'un inscrit ne corrige pas vers notre audit ni vers une preuve qu'il n'a pas", () => {
  const tours = [
    "Ok.",
    "Ça coûte 200 € par mois, c'est rien du tout pour une entreprise comme la vôtre, vraiment.",
    "Est-ce que je peux vous poser une question sur la façon dont vous gérez ça aujourd'hui ?",
    "Je vous propose vingt minutes mardi à 15h ou jeudi à 10h, qu'est-ce qui vous arrange le mieux ?",
  ];
  const vus: string[] = [];
  for (let i = 1; i <= tours.length; i++) {
    const history = tours.slice(0, i).map((text) => ({ role: "closer" as const, text }));
    const r = moteurLocalSparring(corps({ history }), false);
    vus.push(r.prospect, r.coach);
  }
  for (const t of vus) assert.doesNotMatch(t, NOTRE, `« ${t} »`);
  const prix = moteurLocalSparring(corps({ history: [{ role: "closer", text: tours[1] }] }), false);
  assert.match(prix.coach, /^⛔/, "le prix trop tôt reste sanctionné");

  // Contre-test : le maître garde son moteur, audit compris.
  const maitre = moteurLocalSparring(corps({ history: [{ role: "closer", text: tours[1] }] }), true);
  assert.match(maitre.coach, /créneau d'audit/);
});

test("un inscrit qui propose deux créneaux datés sans prix GAGNE ; sans créneau il perd", () => {
  const bon = "Je vous propose vingt minutes mardi à 15h ou jeudi à 10h, qu'est-ce qui vous arrange ?";
  const gagne = moteurLocalSparring(corps({ history: Array.from({ length: 4 }, () => ({ role: "closer" as const, text: bon })) }), false);
  assert.equal(gagne.status, "gagne");
  const mou = "Je voulais juste vous présenter rapidement ce que fait notre entreprise depuis longtemps.";
  const perdu = moteurLocalSparring(corps({ history: Array.from({ length: 4 }, () => ({ role: "closer" as const, text: mou })) }), false);
  assert.equal(perdu.status, "perdu");
});

test("⚠ sans moteur, la route sert à un inscrit le moteur local SANS notre audit", async () => {
  const { POST } = await import("../app/api/sparring/route");
  const r = await commeInscrit({ ...NON_MAITRE, ...SANS_MOTEUR }, async () =>
    (await (
      await POST(
        new NextRequest("http://local/api/sparring", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(corps()),
        })
      )
    ).json()) as { prospect: string; coach: string; engine: string }
  );
  assert.equal(r.engine, "local");
  assert.doesNotMatch(`${r.prospect} ${r.coach}`, NOTRE);
});

test("l'écran annonce l'objectif sur le verdict PROUVÉ du serveur, jamais sur l'optimiste", () => {
  const src = sansCommentaires(readFileSync(join(process.cwd(), "components/training/sparring.tsx"), "utf8"));
  assert.match(src, /const maitre = useMaitreProuve\(\);/);
  assert.doesNotMatch(src, /useDroits\(/);
  assert.match(src, /maitre \? <>décrocher l&apos;audit<\/> : <>décrocher un rendez-vous daté<\/>/);
});
