import { test } from "node:test";
import assert from "node:assert/strict";
import { NextRequest } from "next/server";
import {
  IDENTITE_NEUTRE,
  REPLI_SCRIPT_INSCRIT,
  identiteServie,
  pourInscrit,
  reglagesSansNotreIdentite,
} from "../lib/identite-inscrit";
import { buildIdentity } from "../lib/identity";
import { useAlpha } from "../lib/store";
import { prospect } from "./fixtures";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { sansCommentaires } from "./citations-alpha";

/**
 * ─────────────────────────────────────────────────────────────────────
 * CE QU'UN INSCRIT ENVOIE AU MODÈLE NE PARLE PAS EN NOTRE NOM.
 *
 * Mesuré le 22/10/2026 : un navigateur d'inscrit ouvert avant le 21/10 garde
 * « EAGLEYE CORP » et notre offre dans ses réglages ; `/api/ai` lui servait en
 * plus « OFFRE À REPRÉSENTER : Alpha Voice », notre ICP et notre playbook.
 * ─────────────────────────────────────────────────────────────────────
 */

/** Ce qu'un store neuf portait avant le 21/10/2026 — persisté, donc relu. */
const REGLAGES_USINE_AVANT = {
  agencyName: "EAGLEYE CORP",
  offer: {
    city: "Lyon",
    whatYouSell: "Alpha Sales OS — l'OS de vente terrain",
    valueProp: "On outille les forces de vente avec l'automatisation IA : zéro lead perdu, la machine tourne 24/7.",
  },
};

const NOTRE = /eagleye|nuwacom|alpha sales os|alpha voice|démo mobile|visibilit/i;

test("les anciens réglages d'usine sont reconnus et EFFACÉS, jamais remplacés par une devinette", () => {
  const patch = reglagesSansNotreIdentite(REGLAGES_USINE_AVANT);
  assert.deepEqual(patch, { agencyName: "", offer: { city: "", whatYouSell: "", valueProp: "" } });
});

test("les réglages d'un inscrit qui a dit qui il est ne sont pas touchés", () => {
  assert.equal(
    reglagesSansNotreIdentite({ agencyName: "Dupont Conseil SAS", offer: { city: "Lyon", whatYouSell: "logiciel de paie", valueProp: "" } }),
    null,
    "« Lyon » seul peut être SA ville : on ne l'efface qu'avec notre marque"
  );
  // Sa société, mais notre ancienne offre : seule l'offre part.
  assert.deepEqual(
    reglagesSansNotreIdentite({ agencyName: "Dupont Conseil SAS", offer: { ...REGLAGES_USINE_AVANT.offer } }),
    { offer: { city: "Lyon", whatYouSell: "", valueProp: "" } }
  );
});

test("⚠ la purge du store efface notre identité d'un ancien navigateur, une fois", () => {
  useAlpha.setState((s) => ({ settings: { ...s.settings, ...REGLAGES_USINE_AVANT } }));
  assert.equal(useAlpha.getState().purgerIdentiteUsine(), true);
  const s = useAlpha.getState().settings;
  assert.equal(s.agencyName, "");
  assert.equal(s.offer?.whatYouSell, "");
  assert.equal(useAlpha.getState().purgerIdentiteUsine(), false, "rien à refaire au passage suivant");
});

test("⚠⚠ hors maître, une identité qui nous nomme est remplacée côté SERVEUR ; le maître garde la sienne", () => {
  const ancienne = buildIdentity(REGLAGES_USINE_AVANT);
  assert.match(ancienne, /EAGLEYE CORP/, "sinon le test ne prouve rien");
  assert.equal(identiteServie(ancienne, false), IDENTITE_NEUTRE);
  assert.equal(identiteServie(ancienne, true), ancienne);

  const sienne = buildIdentity({ agencyName: "Dupont Conseil SAS", offer: { whatYouSell: "logiciel de paie" } });
  assert.equal(identiteServie(sienne, false), sienne, "SON identité passe telle quelle");
  // Notre ancienne offre sous SA raison sociale : neutralisée aussi.
  const melee = buildIdentity({ agencyName: "Dupont Conseil SAS", offer: { whatYouSell: REGLAGES_USINE_AVANT.offer.whatYouSell } });
  assert.equal(identiteServie(melee, false), IDENTITE_NEUTRE);
});

test("« démo mobile » est notre démonstration : un prompt d'inscrit dit « démonstration »", () => {
  assert.equal(pourInscrit("la démo mobile avant le prix", false), "la démonstration avant le prix");
  assert.equal(pourInscrit("la démo mobile avant le prix", true), "la démo mobile avant le prix");
});

/** L'environnement d'une installation client sans comptes : `maitre: false`, prouvé par le serveur. */
async function commeInscrit<T>(env: Record<string, string | undefined>, f: () => Promise<T>): Promise<T> {
  const avant: Record<string, string | undefined> = {};
  for (const [k, v] of Object.entries(env)) {
    avant[k] = process.env[k];
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
  try {
    return await f();
  } finally {
    for (const [k, v] of Object.entries(avant)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  }
}

const NON_MAITRE = { ALPHA_INSTALLATION: "client", SITE_PASSWORD: "serrure-de-test" };

function requeteScript(identity: string) {
  return new NextRequest("http://local/api/ai", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      task: "script",
      prospect: prospect({ id: "r1", company: "Bistrot test", sector: "restaurant" }),
      businessRules: "",
      identity,
      accountId: "eagleye",
    }),
  });
}

/**
 * ⚠⚠ SUR LA VRAIE ROUTE, ET SUR LE PROMPT RÉELLEMENT ENVOYÉ. La branche NVIDIA
 * de la cascade passe par le `fetch` global : on l'intercepte, on lit les
 * messages qui partiraient au modèle, on rend une réponse factice. Aucun
 * réseau, aucune vraie clé.
 */
test("⚠⚠ /api/ai : ce qu'un inscrit envoie au modèle ne porte ni notre marque, ni notre offre, ni notre ICP", async () => {
  const { POST } = await import("../app/api/ai/route");
  const envoye: string[] = [];
  const fetchReel = globalThis.fetch;
  globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
    if (String(url).includes("/chat/completions")) {
      const corps = JSON.parse(String(init?.body ?? "{}")) as { messages: { content: string }[] };
      envoye.push(corps.messages.map((m) => m.content).join("\n\n"));
      return new Response(JSON.stringify({ choices: [{ message: { content: "ok" } }] }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }
    return fetchReel(url, init);
  }) as typeof fetch;
  try {
    await commeInscrit({ ...NON_MAITRE, NVIDIA_API_KEY: "nvapi-cle-de-test" }, async () => {
      const res = await POST(requeteScript(buildIdentity(REGLAGES_USINE_AVANT)));
      assert.equal(res.status, 200);
    });
  } finally {
    globalThis.fetch = fetchReel;
  }
  assert.equal(envoye.length, 1, "le modèle doit avoir été appelé une fois");
  const prompt = envoye[0];
  assert.match(prompt, /OFFRE À REPRÉSENTER : celle de l'opérateur/);
  assert.ok(prompt.includes(IDENTITE_NEUTRE), "l'identité d'usine doit être remplacée");
  assert.doesNotMatch(prompt, NOTRE, `un morceau de NOTRE produit part au modèle d'un inscrit`);
  assert.doesNotMatch(prompt, /Nuwacom|15\s*%|escalier/i, "ni notre économie");
  // Garde STRUCTUREL : la mutation qui remettait notre playbook passait le motif
  // ci-dessus (la verticale « restauration » n'en porte aucun mot). On vise
  // ses titres, que `playbookPrompt` écrit toujours.
  assert.doesNotMatch(prompt, /Méthode terrain de l'agence|## Verticale :/, "notre playbook (nos verticales, nos phrases) ne part pas");
});

test("⚠ /api/ai sans moteur : un inscrit reçoit le renvoi vers SON script, le maître garde le repli maison", async () => {
  const { POST } = await import("../app/api/ai/route");
  const sansMoteur = { NVIDIA_API_KEY: undefined, ANTHROPIC_API_KEY: undefined, OLLAMA_BASE_URL: undefined, OLLAMA_MODEL: undefined };
  const inscrit = await commeInscrit({ ...NON_MAITRE, ...sansMoteur }, async () =>
    (await (await POST(requeteScript(""))).json()) as { text: string; engine: string }
  );
  assert.equal(inscrit.engine, "template");
  assert.equal(inscrit.text, REPLI_SCRIPT_INSCRIT);

  const maitre = await commeInscrit({ ALPHA_INSTALLATION: undefined, ...sansMoteur }, async () =>
    (await (await POST(requeteScript(""))).json()) as { text: string }
  );
  assert.match(maitre.text, /# Script terrain/, "le maître garde son repli (sinon le test ne prouve rien)");
});

/** Intercepte l'appel au modèle (branche NVIDIA, `fetch` global) et rend ce qui serait parti. */
async function promptsEnvoyes(f: () => Promise<unknown>): Promise<string[]> {
  const envoye: string[] = [];
  const fetchReel = globalThis.fetch;
  globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
    if (String(url).includes("/chat/completions")) {
      const corps = JSON.parse(String(init?.body ?? "{}")) as { messages: { content: string }[] };
      envoye.push(corps.messages.map((m) => m.content).join("\n\n"));
      return new Response(JSON.stringify({ choices: [{ message: { content: "ok" } }] }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }
    return fetchReel(url, init);
  }) as typeof fetch;
  try {
    await f();
  } finally {
    globalThis.fetch = fetchReel;
  }
  return envoye;
}

test("⚠⚠ /api/agent : AGENT ALPHA d'un inscrit ne parle pas en notre nom ni avec nos phrases d'appel", async () => {
  const { POST } = await import("../app/api/agent/route");
  const envoye = await promptsEnvoyes(() =>
    commeInscrit({ ...NON_MAITRE, NVIDIA_API_KEY: "nvapi-cle-de-test", OLLAMA_BASE_URL: undefined, OLLAMA_MODEL: undefined }, async () => {
      const res = await POST(
        new NextRequest("http://local/api/agent", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            messages: [{ role: "user", content: "Prépare ma journée." }],
            context: "{}",
            businessRules: "",
            identity: buildIdentity(REGLAGES_USINE_AVANT),
          }),
        })
      );
      assert.equal(res.status, 200);
    })
  );
  assert.equal(envoye.length, 1, "le modèle doit avoir été appelé une fois");
  const prompt = envoye[0];
  assert.ok(prompt.includes(IDENTITE_NEUTRE));
  // La carte de l'OS nomme ses modules (« Alpha Voice » est un écran du produit
  // qu'il utilise) : c'est légitime. Notre marque, notre économie, notre
  // démonstration et nos phrases d'appel ne le sont pas.
  assert.doesNotMatch(prompt, /eagleye|nuwacom|15\s*%|démo mobile|Méthode terrain de l'agence/i);
});

test("la purge d'identité est montée dans la coquille et n'agit que sur un « non maître » PROUVÉ", () => {
  const coquille = sansCommentaires(readFileSync(join(process.cwd(), "components/shell/app-shell.tsx"), "utf8"));
  assert.match(coquille, /<IdentiteInscrit \/>/);
  const composant = sansCommentaires(readFileSync(join(process.cwd(), "components/shell/identite-inscrit.tsx"), "utf8"));
  assert.match(composant, /chargerDroits\(\)/, "la réponse du serveur, jamais la valeur optimiste de useDroits");
  assert.doesNotMatch(composant, /useDroits\(/);
  assert.match(composant, /d\.session && !d\.maitre\) purger\(\)/);
});
