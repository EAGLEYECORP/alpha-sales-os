import test from "node:test";
import assert from "node:assert/strict";
import { createTrackedEmail, getStats } from "../lib/tracking";

/**
 * Le pilote serveur envoie sans session : ses lignes de suivi n'ont pas de
 * propriétaire. Le maître doit les voir (06/11/2026 : 5 envois, 3 ouvertures,
 * et un écran vide) ; un inscrit, jamais.
 */
test("⚠⚠ le maître voit les envois sans propriétaire (son pilote), un inscrit ne les voit pas", async () => {
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  const html = "<p>Bonjour</p>";
  await createTrackedEmail(html, "https://alpha.example.com", { channel: "email", email: "a@exemple.example", subject: "pilote" });
  await createTrackedEmail(html, "https://alpha.example.com", { channel: "email", email: "b@exemple.example", subject: "maitre", userId: "maitre-1" });
  await createTrackedEmail(html, "https://alpha.example.com", { channel: "email", email: "c@exemple.example", subject: "inscrit", userId: "inscrit-1" });

  const sujets = async (u: string, pilote: boolean) => (await getStats({}, u, pilote)).records.map((r) => r.subject).sort();
  assert.deepEqual(await sujets("maitre-1", true), ["maitre", "pilote"]);
  assert.deepEqual(await sujets("maitre-1", false), ["maitre"], "sans le drapeau, rien ne change");
  assert.deepEqual(await sujets("inscrit-1", false), ["inscrit"], "un inscrit ne voit jamais les envois du pilote");
});
