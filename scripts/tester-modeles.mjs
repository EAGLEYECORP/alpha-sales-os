#!/usr/bin/env node
/**
 * ─────────────────────────────────────────────────────────────────────
 * QUEL MODÈLE RÉPOND, ET EN COMBIEN DE TEMPS — mesuré, pas supposé.
 *
 * ⚠ POURQUOI CE SCRIPT EXISTE. Le 26/08/2026, NVIDIA a retiré
 * `meta/llama-3.3-70b-instruct`. L'agent vocal a dit sa phrase d'ouverture
 * puis s'est tu (410 Gone), et toute l'IA de l'app web était morte avec —
 * c'était son défaut aussi.
 *
 * Le remplaçant ne se choisit pas sur une liste : il se choisit sur DEUX
 * chiffres, et ils ne se devinent pas depuis un autre réseau.
 *
 *   · répond-il ?      (un modèle du catalogue peut être retiré demain)
 *   · en combien de temps ? (au téléphone, 2 s de silence tuent l'échange ;
 *     le 70B avait été abandonné pour ~14 s de file d'attente AVANT de mourir)
 *
 * Usage — depuis une machine qui a la clé :
 *
 *   NVIDIA_API_KEY=nvapi-… node scripts/tester-modeles.mjs
 *   NVIDIA_API_KEY=nvapi-… node scripts/tester-modeles.mjs autre/modele-a-tester
 *
 * ⚠ La clé se passe en variable d'environnement, jamais en argument : un
 * argument de ligne de commande finit dans l'historique du shell et dans la
 * liste des processus.
 * ─────────────────────────────────────────────────────────────────────
 */

const BASE = (process.env.NVIDIA_BASE_URL || "https://integrate.api.nvidia.com/v1").replace(/\/+$/, "");
const KEY = (process.env.NVIDIA_API_KEY || "").trim();

/**
 * Les candidats. Tenus à l'identique de `lib/modeles.ts` — ce script tourne
 * en Node pur (aucune compilation, aucune dépendance), il ne peut pas importer
 * un module TypeScript. La liste est donc recopiée, et c'est le seul endroit
 * du dépôt où je l'accepte : le script doit pouvoir être lancé sur une machine
 * qui n'a rien installé.
 */
const CANDIDATS = [
  ["nvidia/llama-3.3-nemotron-super-49b-v1", "Nemotron Super 49B — successeur direct du 70B mort"],
  ["qwen/qwen2.5-72b-instruct", "Qwen 2.5 72B — bon français, extraction structurée"],
  ["meta/llama-4-maverick-17b-128e-instruct", "Llama 4 Maverick — MoE, gros cerveau / petite latence"],
  ["meta/llama-4-scout-17b-16e-instruct", "Llama 4 Scout — plus léger, pour la voix"],
  ["mistralai/mistral-large-2-instruct", "Mistral Large 2 — registre français"],
  ["openai/gpt-oss-20b", "GPT-OSS 20B — le défaut actuel, prouvé sur la voix"],
  ["meta/llama-3.3-70b-instruct", "(témoin) le modèle MORT — doit répondre 410"],
];

/**
 * Le prompt de test est court MAIS il demande une phrase complète en français.
 * Un « dis bonjour » ne mesure rien : c'est le premier jeton qui est rapide,
 * pas la génération. On veut le temps jusqu'à une réponse UTILISABLE.
 */
const MESSAGES = [
  { role: "system", content: "Tu réponds en français, en une seule phrase, sans préambule." },
  { role: "user", content: "Un restaurateur dit « je n'ai pas le temps ». Que réponds-tu ?" },
];

async function essayer(id) {
  const t0 = Date.now();
  try {
    const res = await fetch(`${BASE}/chat/completions`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${KEY}` },
      body: JSON.stringify({ model: id, messages: MESSAGES, temperature: 0.3, max_tokens: 120, stream: false }),
      signal: AbortSignal.timeout(60_000),
    });
    const ms = Date.now() - t0;
    if (!res.ok) {
      const corps = await res.text().catch(() => "");
      // Le détail du 410 porte la date de fin de vie : on la garde, c'est
      // exactement l'information qui manquait le jour de la panne.
      const detail = corps.replace(/\s+/g, " ").slice(0, 160);
      return { id, ok: false, ms, statut: res.status, detail };
    }
    const data = await res.json();
    const texte = data?.choices?.[0]?.message?.content?.trim() ?? "";
    return { id, ok: Boolean(texte), ms, texte };
  } catch (e) {
    return { id, ok: false, ms: Date.now() - t0, detail: e instanceof Error ? e.message : String(e) };
  }
}

async function main() {
  if (!KEY) {
    console.error("NVIDIA_API_KEY absente. Lance :  NVIDIA_API_KEY=nvapi-… node scripts/tester-modeles.mjs");
    process.exit(1);
  }
  const extras = process.argv.slice(2).map((id) => [id, "(demandé en argument)"]);
  const liste = [...CANDIDATS, ...extras];

  console.log(`Base : ${BASE}\n`);
  const resultats = [];
  // En SÉRIE, volontairement : le palier gratuit est à 40 requêtes/minute, et
  // surtout une mesure de latence faite en parallèle mesure la concurrence,
  // pas le modèle.
  for (const [id, note] of liste) {
    process.stdout.write(`… ${id}`);
    const r = await essayer(id);
    resultats.push({ ...r, note });
    const s = (r.ms / 1000).toFixed(1);
    if (r.ok) console.log(`\r✓ ${id.padEnd(46)} ${s.padStart(5)} s`);
    else console.log(`\r✗ ${id.padEnd(46)} ${s.padStart(5)} s  ${r.statut ?? ""} ${r.detail ?? ""}`);
  }

  const vivants = resultats.filter((r) => r.ok).sort((a, b) => a.ms - b.ms);
  console.log("\n────────────────────────────────────────────────────────");
  if (vivants.length === 0) {
    console.log("AUCUN modèle n'a répondu. Vérifie la clé (elle commence par nvapi-) avant de conclure.");
    return;
  }
  const rapide = vivants[0];
  // « Gros » se lit dans le NOM : c'est imparfait et c'est dit. On ne prétend
  // pas mesurer la qualité — un test de latence ne la mesure pas.
  const gros = vivants.find((r) => /49b|70b|72b|large|maverick/i.test(r.id)) ?? rapide;

  console.log(`VOIX  → ${rapide.id}`);
  console.log(`        le plus rapide qui répond (${(rapide.ms / 1000).toFixed(1)} s). Au téléphone, c'est le seul critère.`);
  console.log(`        voice/.env :  VOICE_MODEL=${rapide.id}`);
  console.log(`\nAPP   → ${gros.id}`);
  console.log(`        le plus gros qui répond (${(gros.ms / 1000).toFixed(1)} s). L'opérateur attend devant son écran : la latence ne coûte rien.`);
  console.log(`        .env.local :  NVIDIA_MODEL=${gros.id}`);
  console.log(
    `\n⚠ Ce script mesure QUI RÉPOND et EN COMBIEN DE TEMPS. Il ne mesure PAS la qualité :\n` +
      `  relis les phrases ci-dessus avant de trancher — c'est le seul jugement qui compte ici.\n`
  );
  for (const r of vivants) console.log(`  ${r.id}\n    « ${(r.texte ?? "").replace(/\s+/g, " ").slice(0, 150)} »`);
}

main();
