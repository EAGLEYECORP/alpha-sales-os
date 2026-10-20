import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

/**
 * Le générateur de bande-son des vidéos (`scripts/video/bande-son.mjs`).
 *
 * ⚠ Ce test L'EXÉCUTE, il ne le lit pas : une garde sur le texte source serait
 * satisfaite par un commentaire bien écrit (voir CLAUDE.md, « une route peut
 * enfin s'exécuter dans un test »).
 */

const SCRIPT = join(process.cwd(), "scripts/video/bande-son.mjs");
const dossier = mkdtempSync(join(tmpdir(), "bande-son-"));

function generer(partition: unknown, nom: string) {
  const chemin = join(dossier, `${nom}.json`);
  writeFileSync(chemin, JSON.stringify(partition));
  const sortie = join(dossier, `${nom}.wav`);
  const r = spawnSync(process.execPath, [SCRIPT, chemin, sortie], { encoding: "utf8" });
  return { r, sortie };
}

const COURTE = {
  duree: 1,
  accords: [[0, [130.81, 196]]],
  evenements: [
    { t: 0.2, type: "tic", hz: 523.25 },
    { t: 0.6, type: "pop" },
  ],
};

test("produit un WAV 48 kHz stéréo 16 bits, à la durée exacte de la partition", () => {
  const { r, sortie } = generer(COURTE, "courte");
  assert.equal(r.status, 0, r.stderr);
  const wav = readFileSync(sortie);
  assert.equal(wav.toString("ascii", 0, 4), "RIFF");
  assert.equal(wav.toString("ascii", 8, 12), "WAVE");
  assert.equal(wav.readUInt16LE(22), 2, "stéréo");
  assert.equal(wav.readUInt32LE(24), 48000, "48 kHz");
  assert.equal(wav.readUInt16LE(34), 16, "16 bits");
  // Une seconde = 48 000 trames de 4 octets : une durée fausse désynchronise
  // le son de l'image sans qu'aucun lecteur ne s'en plaigne.
  assert.equal(wav.readUInt32LE(40), 48000 * 4);
});

test("⚠ deux rendus de la même partition donnent le MÊME fichier", () => {
  // Aucun Math.random : sinon on ne compare plus deux versions d'un montage,
  // on compare deux tirages.
  const a = readFileSync(generer(COURTE, "a").sortie);
  const b = readFileSync(generer(COURTE, "b").sortie);
  assert.ok(a.equals(b), "la bande-son doit être déterministe");
});

test("un son qui n'existe pas fait échouer, il n'est pas ignoré en silence", () => {
  const { r } = generer({ ...COURTE, evenements: [{ t: 0.1, type: "explosion" }] }, "inconnu");
  assert.equal(r.status, 2);
  assert.match(r.stderr, /événement inconnu/);
});

test("la partition de la vidéo « deux formes » est jouable", () => {
  const partition = JSON.parse(readFileSync(join(process.cwd(), "scripts/video/partitions/deux-formes.json"), "utf8"));
  // Chaque événement tombe DANS la vidéo : un son calé après la fin serait
  // coupé par le montage, et personne ne remarquerait qu'il manque.
  for (const e of partition.evenements) {
    assert.ok(e.t >= 0 && e.t < partition.duree, `événement ${e.type} à ${e.t} s hors de la vidéo`);
  }
});
