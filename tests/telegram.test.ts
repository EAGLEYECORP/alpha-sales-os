import { test } from "node:test";
import assert from "node:assert/strict";
import {
  analyserCommande,
  estProprietaire,
  etatTelegram,
  interpreterIntention,
  PROMPT_COMPREHENSION,
  reponsePour,
  texteAide,
  VERBES_CONNUS,
} from "@/lib/telegram";

test("analyse — verbe + args, et le @bot est retiré", () => {
  assert.deepEqual(analyserCommande("/note rappeler PROMOVAL"), { verbe: "note", args: "rappeler PROMOVAL" });
  assert.deepEqual(analyserCommande("/statut"), { verbe: "statut", args: "" });
  assert.deepEqual(analyserCommande("/statut@alpha_bot"), { verbe: "statut", args: "" });
  assert.deepEqual(analyserCommande("  /Ping  "), { verbe: "ping", args: "" });
  // Un texte sans slash n'est pas une commande.
  assert.deepEqual(analyserCommande("bonjour"), { verbe: "", args: "bonjour" });
});

test("propriétaire — strict, et fail-closed sans id déclaré", () => {
  assert.equal(estProprietaire("12345", "12345"), true);
  assert.equal(estProprietaire("12345", "99999"), false);
  // ⚠ Le cœur : ownerId absent ⇒ PERSONNE n'est autorisé.
  assert.equal(estProprietaire("12345", undefined), false);
  assert.equal(estProprietaire("12345", ""), false);
  assert.equal(estProprietaire("12345", "   "), false);
});

test("réponse — note vide refusée, note pleine déléguée à la persistance", () => {
  assert.equal(reponsePour(analyserCommande("/note")).texte?.includes("vide"), true);
  // Note pleine : texte null = signal « persiste puis confirme » (effet côté route).
  assert.equal(reponsePour(analyserCommande("/note faire X")).texte, null);
  // Statut : texte null = la route complète avec l'état réel.
  assert.equal(reponsePour(analyserCommande("/statut")).texte, null);
  assert.equal(reponsePour(analyserCommande("/ping")).texte, "Alpha en ligne ✅");
  // Inconnu ⇒ aide.
  assert.equal(reponsePour(analyserCommande("/nimportequoi")).texte, texteAide());
});

test("aide — chaque verbe connu y est cité (la liste ne dérive pas du code)", () => {
  const aide = texteAide();
  for (const v of VERBES_CONNUS) {
    assert.equal(aide.includes(`/${v}`), true, `verbe absent de l'aide : ${v}`);
  }
});

test("compréhension — normalise une sortie valide et retombe SÛR sur du bruit", () => {
  // Question valide.
  assert.deepEqual(interpreterIntention({ type: "question", reponse: "Voici." }), {
    type: "question",
    reponse: "Voici.",
  });
  // Note avec résumé → rangeable.
  assert.deepEqual(interpreterIntention({ type: "note", reponse: "ok", resume: "rappeler PROMOVAL" }), {
    type: "note",
    reponse: "ok",
    resume: "rappeler PROMOVAL",
  });
  // Note SANS résumé → dégradée en question (rien à ranger).
  assert.equal(interpreterIntention({ type: "note", reponse: "ok" }).type, "question");
  // Action reste une action (mais la route ne l'exécute pas — c'est ailleurs).
  assert.equal(interpreterIntention({ type: "action", reponse: "Compris, ça se lance depuis l'app." }).type, "action");
  // Bruit → repli neutre, jamais un crash.
  for (const mauvais of [null, undefined, 42, "texte", {}, { type: "autre", reponse: "x" }, { type: "question" }]) {
    const r = interpreterIntention(mauvais);
    assert.equal(r.type, "question");
    assert.ok(r.reponse.length > 0);
  }
});

test("compréhension — le prompt INTERDIT d'inventer et de prétendre avoir agi", () => {
  assert.match(PROMPT_COMPREHENSION, /jamais de chiffre invent/i);
  assert.match(PROMPT_COMPREHENSION, /NE pr[ée]tends JAMAIS l'avoir fait/i);
  // Le JSON strict est décrit (type/reponse), sinon la route ne peut rien parser.
  assert.match(PROMPT_COMPREHENSION, /"type"/);
  assert.match(PROMPT_COMPREHENSION, /"reponse"/);
});

test("état — ne rapporte que la PRÉSENCE, jamais la valeur", () => {
  const e = etatTelegram({
    TELEGRAM_BOT_TOKEN: "123:abc",
    TELEGRAM_WEBHOOK_SECRET: "s",
    TELEGRAM_OWNER_CHAT_ID: "42",
    SUPABASE_SERVICE_ROLE_KEY: "k",
    NEXT_PUBLIC_SUPABASE_URL: "https://x.supabase.co",
  });
  assert.deepEqual(e, {
    botConfigure: true,
    secretConfigure: true,
    proprietaireDeclare: true,
    notesPersistables: true,
  });
  const vide = etatTelegram({});
  assert.equal(vide.botConfigure, false);
  assert.equal(vide.notesPersistables, false);
  // Une chaîne d'espaces ne compte pas comme configurée.
  assert.equal(etatTelegram({ TELEGRAM_BOT_TOKEN: "   " }).botConfigure, false);
});
