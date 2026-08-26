import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { leconsPourAppels, requeteVerticale } from "../lib/lecons-terrain";
import { leconDeDebrief, leconDObjection } from "../lib/apprentissage";
import { verticalById } from "../lib/playbook";
import { prospect } from "./fixtures";
import type { KnowledgeNote } from "../lib/knowledge";

/**
 * Le troisième maillon du flux : ce qu'on a appris doit RESSORTIR là où on
 * appelle. Deux garde-fous protégés ici — le filtrage par source (un livre
 * ne s'affiche pas à trente secondes d'un appel réel) et le retour vide quand
 * il n'y a rien à dire.
 */

const HORODATE = { createdAt: "2026-08-01T09:00:00.000Z", updatedAt: "2026-08-01T09:00:00.000Z" };

function note(over: Partial<KnowledgeNote> = {}): KnowledgeNote {
  return {
    id: "n1",
    title: "Terrain — Garage Dupont (garage)",
    body: "Contexte : Garage Dupont — garage.\n\n**Ce qui a marché** : lui faire compter ses appels manqués du samedi.",
    tags: ["terrain", "garage"],
    source: "terrain",
    ...HORODATE,
    ...over,
  } as KnowledgeNote;
}

const GARAGE = verticalById("garage-carrosserie");

test("aucune note : tableau vide, pas un message déguisé en contenu", () => {
  assert.deepEqual(leconsPourAppels([], GARAGE, []), []);
});

test("une leçon de terrain remonte sur sa verticale", () => {
  const l = leconsPourAppels([note()], GARAGE, []);
  assert.equal(l.length, 1);
  assert.match(l[0].extrait, /appels manqués du samedi/);
  assert.equal(l[0].origine, "Garage Dupont", "l'origine se lit dans l'en-tête d'ancrage");
  assert.ok(!/Contexte\s*:/.test(l[0].extrait), "l'en-tête ne s'affiche pas dans l'extrait");
});

test("une note de RÉFÉRENCE ne s'affiche JAMAIS dans la session d'appels", () => {
  // La doctrine : un livre porte « SOURCE EXTERNE — non vérifiée chez nous ».
  // L'afficher ici le mettrait au même rang qu'un fait constaté.
  const livre = note({
    id: "ref1",
    source: "reference",
    title: "Cashvertising — garage",
    body: "Contexte : garage.\n\nLes 8 désirs biologiques appliqués au garage automobile.",
  });
  assert.deepEqual(leconsPourAppels([livre], GARAGE, []), []);
  // Mélangée à une vraie leçon, seule la vraie sort.
  const mixte = leconsPourAppels([livre, note()], GARAGE, []);
  assert.equal(mixte.length, 1);
  assert.equal(mixte[0].id, "n1");
});

test("les notes de doctrine et les notes écrites à la main ne s'affichent pas non plus", () => {
  for (const source of ["playbook", "manuel"] as const) {
    assert.deepEqual(
      leconsPourAppels([note({ id: `x-${source}`, source })], GARAGE, []),
      [],
      `source ${source} ne doit pas remonter`
    );
  }
});

test("une leçon d'un AUTRE métier ne remonte pas sur cette verticale", () => {
  const restau = note({
    id: "n2",
    title: "Terrain — Le Bouchon (restaurant)",
    body: "Contexte : Le Bouchon — restaurant.\n\n**Ce qui a marché** : parler du service du midi et des couverts perdus.",
    tags: ["terrain", "restaurant"],
  });
  const ids = leconsPourAppels([note(), restau], GARAGE, []).map((l) => l.id);
  assert.ok(ids.includes("n1"));
  assert.ok(!ids.includes("n2"), "le restaurant n'a rien à faire dans une file d'appels garage");
});

test("les leçons vraiment produites par le flux sont retrouvables — bout en bout", () => {
  // Pas une note fabriquée pour le test : celles que le débrief et
  // l'objection écrivent réellement.
  const p = prospect({ company: "Garage Dupont", sector: "autre", city: "Lyon 7e", notes: "carrosserie et garage automobile" });
  const debrief = leconDeDebrief({
    prospect: p,
    resume: "Il croule sous les appels le samedi matin.",
    cequiAMarche: "Lui faire compter ses appels manqués du samedi.",
  })!;
  const objection = leconDObjection({
    prospect: p,
    objection: "J'ai déjà une secrétaire",
    reponse: "Combien d'appels passent quand elle est au téléphone ?",
    aDebloque: true,
  })!;
  assert.ok(debrief, "le débrief doit produire une leçon");
  assert.ok(objection, "l'objection doit produire une leçon");

  const notes = [debrief, objection].map((l) => ({ ...l, ...HORODATE })) as KnowledgeNote[];
  const servies = leconsPourAppels(notes, GARAGE, [p]);
  assert.equal(servies.length, 2, "les deux doivent ressortir sur la file garage");
  for (const s of servies) assert.ok(s.extrait.length > 0, "un extrait vide n'apprend rien");
});

test("un débrief sans fait n'écrit rien, donc rien ne remonte", () => {
  assert.equal(leconDeDebrief({ prospect: prospect(), resume: "   " }), null);
});

test("la requête part de la verticale, pas des noms d'entreprises", () => {
  const q = requeteVerticale(GARAGE, [prospect({ company: "Garage Dupont" })]);
  assert.ok(q.startsWith(GARAGE!.label), "le métier vient en tête");
  assert.ok(q.includes("Garage Dupont"), "les cibles restent en second rang");
  assert.equal(requeteVerticale(null, []), "", "sans verticale ni cible, pas de requête");
});

test("la session d'appels lit vraiment le Cerveau — le maillon qu'on protège", () => {
  // Test dérivé : avant, la page /appels n'importait AUCUN module de mémoire.
  // Ce qui avait débloqué un garagiste mardi était invisible mercredi.
  const src = readFileSync(join(process.cwd(), "app/(app)/appels/page.tsx"), "utf8");
  assert.ok(src.includes("LeconsVerticale"), "la file d'appels doit servir les leçons de terrain");
  const panel = readFileSync(join(process.cwd(), "components/appels/lecons-verticale.tsx"), "utf8");
  assert.ok(
    panel.includes("notesForAccount"),
    "les leçons doivent être filtrées par compte — une leçon ScintIA n'a rien à faire dans un appel EAGLEYE"
  );
});

test("un tag de métier écarte sèchement — les mots communs ne le rattrapent pas", () => {
  /**
   * Le défaut trouvé par le test de bout en bout : tous nos playbooks parlent
   * d'appels manqués, du midi et du week-end. BM25 seul faisait donc remonter
   * une leçon de garage sur une file restauration.
   */
  const resto = note({
    id: "n-resto",
    title: "Terrain — Le Bouchon",
    // Volontairement BOURRÉE du vocabulaire garage : sans le tag, BM25 la
    // classerait en tête. C'est ça qu'on met à l'épreuve, pas un score nul.
    body:
      "Contexte : Le Bouchon — restaurant.\n\nGarage & carrosserie : les métiers où l'atelier tourne et le téléphone sonne en même temps. Garage, carrosserie, atelier, téléphone.",
    tags: ["terrain", "restaurant", "restauration"],
  });
  assert.deepEqual(
    leconsPourAppels([resto], GARAGE, []),
    [],
    "une leçon tagguée restauration n'a rien à faire dans une file garage"
  );
  assert.equal(
    leconsPourAppels([resto], verticalById("restauration"), []).length,
    1,
    "…et elle doit bien ressortir sur SA verticale"
  );
});

test("une leçon SANS tag de métier reste éligible — on ne perd pas l'historique", () => {
  // Les leçons écrites avant que l'ancrage ne pose le tag de verticale.
  const ancienne = note({ id: "n-vieille", tags: ["terrain", "garage"] });
  assert.equal(leconsPourAppels([ancienne], GARAGE, []).length, 1);
});
