import { test } from "node:test";
import assert from "node:assert/strict";
import {
  analyserCommande,
  estProprietaire,
  etatTelegram,
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
