import { test } from "node:test";
import assert from "node:assert/strict";
import { deciderTypee, type RunnerLLM } from "@/lib/decision-typee";
import { jevDisponible, deciderViaJev } from "@/lib/jev";
import { INTENTIONS, interpreterClassement, type IntentionReponse } from "@/lib/reponse-auto";

// Un moteur factice : le joint ne l'utilise pas (le runner est injecté), mais
// le type l'exige.
const moteurFactice = {} as Parameters<typeof deciderTypee>[0]["moteur"];

/** Un runner qui rend ce qu'on lui dit, sans réseau ni modèle. */
const runnerQuiRend = (data: unknown): RunnerLLM => async () => ({ data });

function sansJev<T>(fn: () => T): T {
  const url = process.env.JEV_URL;
  const key = process.env.JEV_API_KEY;
  delete process.env.JEV_URL;
  delete process.env.JEV_API_KEY;
  try {
    return fn();
  } finally {
    if (url !== undefined) process.env.JEV_URL = url;
    if (key !== undefined) process.env.JEV_API_KEY = key;
  }
}

test("jev — indisponible sans les DEUX variables (fail-closed)", () => {
  sansJev(() => {
    assert.equal(jevDisponible(), false);
    process.env.JEV_URL = "https://x";
    assert.equal(jevDisponible(), false, "url seule ne suffit pas");
    process.env.JEV_API_KEY = "   ";
    assert.equal(jevDisponible(), false, "une clé d'espaces ne compte pas");
    process.env.JEV_API_KEY = "k";
    assert.equal(jevDisponible(), true);
  });
});

test("jev — le client refuse tant que la forme d'API n'est pas renseignée", async () => {
  await assert.rejects(deciderViaJev({ texteEntrant: "x", valeurs: ["a", "b"] as const }), /forme d'API/);
});

test("décideur — sans Jev, il classe via le LLM et rend une valeur VALIDÉE", async () => {
  await sansJev(async () => {
    const r = await deciderTypee<IntentionReponse>(
      {
        texteEntrant: "ok pour mardi 15h",
        promptSysteme: "peu importe, le runner est injecté",
        valeurs: INTENTIONS,
        valider: interpreterClassement,
        moteur: moteurFactice,
      },
      runnerQuiRend({ intention: "veut-rdv" }),
    );
    assert.equal(r.valeur, "veut-rdv");
    assert.equal(r.source, "llm");
    assert.equal(r.confiance, null); // un LLM ne rend pas de confiance calibrée
  });
});

test("décideur — une sortie LLM cassée retombe sur le repli sûr du validateur", async () => {
  await sansJev(async () => {
    const r = await deciderTypee<IntentionReponse>(
      {
        texteEntrant: "…",
        promptSysteme: "x",
        valeurs: INTENTIONS,
        valider: interpreterClassement,
        moteur: moteurFactice,
      },
      runnerQuiRend({ intention: "n'existe pas" }),
    );
    // interpreterClassement rabat l'inconnu sur hors-sujet (escalade) — jamais auto.
    assert.equal(r.valeur, "hors-sujet");
    assert.equal(r.source, "llm");
  });
});

test("décideur — Jev en échec ne casse rien : on retombe sur le LLM", async () => {
  const url = process.env.JEV_URL;
  const key = process.env.JEV_API_KEY;
  process.env.JEV_URL = "https://jev.example";
  process.env.JEV_API_KEY = "k"; // configuré → on TENTE Jev, qui lève → repli LLM
  try {
    const r = await deciderTypee<IntentionReponse>(
      {
        texteEntrant: "c'est combien ?",
        promptSysteme: "x",
        valeurs: INTENTIONS,
        valider: interpreterClassement,
        moteur: moteurFactice,
      },
      runnerQuiRend({ intention: "prix" }),
    );
    assert.equal(r.valeur, "prix");
    assert.equal(r.source, "llm", "Jev a levé → la source doit être le LLM, pas jev");
  } finally {
    if (url === undefined) delete process.env.JEV_URL;
    else process.env.JEV_URL = url;
    if (key === undefined) delete process.env.JEV_API_KEY;
    else process.env.JEV_API_KEY = key;
  }
});
