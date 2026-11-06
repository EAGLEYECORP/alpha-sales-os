import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { corpsEnvoiPilote } from "../lib/pilote-executeur";
import { prospectDefaults } from "../lib/seed";
import type { Prospect } from "../lib/types";

/**
 * Le pilote serveur (maître) met sa propre boîte en copie cachée de chaque
 * envoi : un envoi SMTP ne laisse rien dans « Envoyés », et un pilote dont on
 * ne voit pas les messages passe pour un pilote qui n'envoie rien (06/11/2026).
 */
const RACINE = process.cwd().endsWith(".test-build") ? join(process.cwd(), "..") : process.cwd();

test("⚠ le tick serveur demande la copie cachée sur CHAQUE envoi", () => {
  const src = readFileSync(join(RACINE, "app/api/campaign/pilote-tick/route.ts"), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
  assert.match(src, /corpsEnvoiPilote\(p, mail, identite, suite, true\)/);
});

test("le corps porte la copie quand on la demande, et seulement alors", () => {
  const p = { ...prospectDefaults, id: "x", email: "contact@exemple.example" } as Prospect;
  const id = { accountId: "eagleye", closerName: "", agencyName: "" };
  assert.equal(corpsEnvoiPilote(p, { subject: "s", body: "b" }, id, undefined, true).copieExpediteur, true);
  assert.equal("copieExpediteur" in corpsEnvoiPilote(p, { subject: "s", body: "b" }, id), false);
});
