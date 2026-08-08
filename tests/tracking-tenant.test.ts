import { test } from "node:test";
import assert from "node:assert/strict";
import {
  createTrackedText,
  countRecentSends,
  contactedEmails,
  getStats,
} from "../lib/tracking";
import { tenantFromInbound } from "../lib/tenant";

// Pas de SUPABASE_SERVICE_ROLE_KEY en test → chemin mémoire (mono-instance).
// On sème deux locataires avec des id uniques et on prouve qu'aucune requête
// scopée ne franchit la frontière du compte.

const A = "11111111-1111-4111-8111-111111111111";
const B = "22222222-2222-4222-8222-222222222222";
const HOUR = 3600_000;

test("tracking — le rate-limit compte par locataire, pas globalement", async () => {
  await createTrackedText("ping A", "https://x.test", { channel: "email", email: "a1@x.fr", userId: A });
  await createTrackedText("ping A2", "https://x.test", { channel: "email", email: "a2@x.fr", userId: A });
  await createTrackedText("ping B", "https://x.test", { channel: "email", email: "b1@x.fr", userId: B });

  assert.equal(await countRecentSends("email", HOUR, A), 2, "A ne compte que ses 2 envois");
  assert.equal(await countRecentSends("email", HOUR, B), 1, "B ne compte que le sien");
});

test("tracking — la dédup « déjà contacté » ne fuit pas entre comptes", async () => {
  await createTrackedText("hi", "https://x.test", { channel: "email", email: "shared@x.fr", userId: A });

  const forA = await contactedEmails(["shared@x.fr"], HOUR, A);
  const forB = await contactedEmails(["shared@x.fr"], HOUR, B);

  assert.ok(forA.has("shared@x.fr"), "A a bien déjà contacté cette adresse");
  assert.ok(!forB.has("shared@x.fr"), "B, lui, peut encore la contacter — pas de blocage croisé");
});

test("tracking — les stats sont cloisonnées par locataire", async () => {
  const tA = "33333333-3333-4333-8333-333333333333";
  const tB = "44444444-4444-4444-8444-444444444444";
  await createTrackedText("s1", "https://x.test", { channel: "email", email: "s1@x.fr", userId: tA });
  await createTrackedText("s2", "https://x.test", { channel: "email", email: "s2@x.fr", userId: tA });
  await createTrackedText("s3", "https://x.test", { channel: "email", email: "s3@x.fr", userId: tB });

  const statsA = await getStats({}, tA);
  const statsB = await getStats({}, tB);
  assert.equal(statsA.messages, 2, "A ne voit que ses 2 messages");
  assert.equal(statsB.messages, 1, "B ne voit que le sien");
  assert.ok(statsA.records.every((r) => r.userId === tA), "aucun enregistrement d'un autre compte");
});

test("tenant — attribution d'un webhook entrant : forme UUID exigée", () => {
  assert.equal(tenantFromInbound(A), A, "un UUID valide passe");
  assert.equal(tenantFromInbound("pas-un-uuid"), null);
  assert.equal(tenantFromInbound(""), null);
  assert.equal(tenantFromInbound(undefined), null);
  assert.equal(tenantFromInbound(12345), null, "un non-string est rejeté");
});
