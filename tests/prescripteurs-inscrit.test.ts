import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { NextRequest } from "next/server";
import {
  PARTNER_ARCHETYPES,
  PRESCRIPTEUR_UNIVERSEL,
  prescripteurPrompt,
  type PartnerArchetype,
} from "../lib/prescripteurs";
import { commeInscrit, promptsEnvoyes } from "./capture-prompt";
import { sansCommentaires } from "./citations-alpha";

/**
 * ─────────────────────────────────────────────────────────────────────
 * UN INSCRIT N'APPROCHE PAS SES PRESCRIPTEURS AVEC NOS PHRASES.
 *
 * Mesuré le 22/10/2026 : `/prescripteurs` est gratuit (brique `crm`) et
 * servait à tout compte, « mot pour mot », des ouvertures sur l'accueil
 * téléphonique et les restaurants lyonnais, et un potentiel chiffré sur notre
 * setup (1 500 / 2 000 € + 200 €/mois). Le prompt IA les récitait aussi.
 * ─────────────────────────────────────────────────────────────────────
 */

const NON_MAITRE = { ALPHA_INSTALLATION: "client", SITE_PASSWORD: "serrure-de-test" };
const SANS_MOTEUR = { NVIDIA_API_KEY: undefined, ANTHROPIC_API_KEY: undefined, OLLAMA_BASE_URL: undefined, OLLAMA_MODEL: undefined };

/** Toutes les chaînes d'un archétype HORS de l'inventaire universel — c'est-à-dire notre offre. */
function phrasesANous(a: PartnerArchetype): string[] {
  const universel = new Set<string>(PRESCRIPTEUR_UNIVERSEL);
  const out: string[] = [];
  const cueillir = (v: unknown) => {
    if (typeof v === "string") out.push(v);
    else if (Array.isArray(v)) v.forEach(cueillir);
    else if (v && typeof v === "object") Object.values(v).forEach(cueillir);
  };
  for (const [k, v] of Object.entries(a)) if (k !== "id" && !universel.has(k)) cueillir(v);
  return out.filter((t) => t.length > 12);
}

test("l'inventaire universel ne porte rien de notre offre", () => {
  for (const a of PARTNER_ARCHETYPES) {
    for (const k of PRESCRIPTEUR_UNIVERSEL) {
      assert.doesNotMatch(String(a[k]), /appel|accueil|téléphon|lyon|restaurant|setup|audit|eagleye|alpha/i, `${a.id}.${k}`);
    }
  }
});

test("⚠⚠ le prompt d'un inscrit ne porte AUCUNE phrase d'archétype hors de l'inventaire universel", () => {
  for (const a of PARTNER_ARCHETYPES) {
    const p = prescripteurPrompt(a.id, false);
    for (const t of phrasesANous(a)) assert.ok(!p.includes(t), `${a.id} : « ${t.slice(0, 70)}… »`);
    assert.ok(p.includes(a.fear), "sa peur décrit le prescripteur, elle reste");
    assert.ok(p.includes(a.label));
    assert.doesNotMatch(p, /appels manqués|accueil|lyon|restaurant|setup/i);
    assert.match(p, /n'est PAS un prospect/);
  }
  // Contre-test : le maître garde son archétype complet.
  const a = PARTNER_ARCHETYPES[0];
  assert.ok(prescripteurPrompt(a.id, true).includes(a.opener));
});

test("⚠⚠ /api/ai : la tâche prescripteur d'un inscrit part sans nos ouvertures — avec et sans moteur", async () => {
  const { POST } = await import("../app/api/ai/route");
  const a = PARTNER_ARCHETYPES.find((x) => x.id === "vendeur-caisse")!;
  const requete = () =>
    new NextRequest("http://local/api/ai", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ task: "prescripteur", archetypeId: a.id, businessRules: "", question: "Comment l'aborder ?" }),
    });
  const envoye = await promptsEnvoyes(() =>
    commeInscrit({ ...NON_MAITRE, ...SANS_MOTEUR, NVIDIA_API_KEY: "nvapi-cle-de-test" }, async () => {
      assert.equal((await POST(requete())).status, 200);
    })
  );
  assert.equal(envoye.length, 1);
  for (const t of phrasesANous(a)) assert.ok(!envoye[0].includes(t), `« ${t.slice(0, 70)}… »`);

  const repli = await commeInscrit({ ...NON_MAITRE, ...SANS_MOTEUR }, async () =>
    (await (await POST(requete())).json()) as { text: string }
  );
  assert.equal(repli.text, prescripteurPrompt(a.id, false), "le repli sans moteur est la doctrine de l'inscrit");
});

test("l'écran sert à un inscrit la peur et la règle, jamais nos phrases ni notre potentiel chiffré", () => {
  const src = sansCommentaires(readFileSync(join(process.cwd(), "app/(app)/prescripteurs/page.tsx"), "utf8"));
  assert.match(src, /const maitre = useMaitreProuve\(\);/);
  const debut = src.indexOf("{isOpen && !maitre && (");
  const fin = src.indexOf("{isOpen && maitre && (");
  assert.ok(debut > 0 && fin > debut, "deux branches distinctes");
  const inscrit = src.slice(debut, fin);
  assert.match(inscrit, /\{a\.fear\}/);
  assert.doesNotMatch(inscrit, /a\.(opener|ask|objections|deal|motivations|diagnostic|who)\b|pot\./);
  assert.match(src, /\{maitre && <span className="block truncate text-\[11px\] text-paper-faint">\{a\.who\}<\/span>\}/);
  assert.match(src, /city: maitre \? "Lyon" : \(settings\.profil\?\.cibleZone \?\? ""\)/);
});
