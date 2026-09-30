import { test } from "node:test";
import assert from "node:assert/strict";
import { construireMailCold, eligibleColdMail, TAG_DEJA_ECRIT } from "@/lib/mail-autopilote";
import { prospectDefaults } from "@/lib/seed";
import { habillageEnvoi } from "@/lib/expediteur";
import { renderEmail, plainText } from "@/lib/email-html";
import { verifieMentions } from "@/lib/conformite";
import { verifieDivulgation } from "@/lib/signature-ia";
import { VERTICALS } from "@/lib/playbook";
import type { Prospect } from "@/lib/types";

const promoteur = (over: Partial<Prospect> = {}): Prospect => ({
  ...prospectDefaults,
  id: "p1",
  company: "Confiance Groupe Immobilier",
  name: "Pierre Dumas",
  sector: "maitrise-ouvrage",
  city: "Lyon",
  email: "p.dumas@groupeconfiance.fr",
  stage: "prospect",
  createdAt: "2026-09-22T00:00:00.000Z",
  updatedAt: "2026-09-22T00:00:00.000Z",
  ...over,
});

// Rend l'email EXACTEMENT comme le ferait le serveur (habillage maître).
function rendreTexte(p: Prospect): { text: string; closer: string; marque: string } {
  // Rendu à l'identique du tick : compte maître, signataire résolu par défaut
  // (la société — pas de nom humain en dur).
  const hab = habillageEnvoi({ accountId: "eagleye", base: "https://alpha.test" });
  const { subject, body } = construireMailCold(p);
  const text = plainText({ subject, body, closerName: hab.closerName, addressLine: hab.addressLine, logoUrl: hab.logoUrl });
  return { text, closer: hab.closerName, marque: hab.marque };
}

test("le mail autonome PASSE les mentions obligatoires (expéditeur + STOP)", () => {
  const { text, closer, marque } = rendreTexte(promoteur());
  assert.deepEqual(verifieMentions(text, closer, marque, "premier"), []);
});

test("⚠⚠ le mail autonome PORTE la divulgation IA (art. 50) — sinon il ne part pas", () => {
  const { text } = rendreTexte(promoteur());
  // Mode autonome : la divulgation est OBLIGATOIRE, et le rendu doit la contenir.
  assert.deepEqual(verifieDivulgation(text, "email", "autonome"), []);
});

test("⚠ le mail ne dit JAMAIS la phrase que la verticale maîtrise d'ouvrage interdit", () => {
  const { text } = rendreTexte(promoteur());
  const vertical = VERTICALS.find((v) => v.id === "maitrise-ouvrage");
  assert.ok(vertical, "verticale maitrise-ouvrage introuvable");
  for (const interdit of vertical!.forbidden) {
    if (interdit.motif) {
      assert.doesNotMatch(text, interdit.motif, `le mail déclenche un interdit : ${interdit.regle ?? interdit.motif}`);
    }
  }
  // Filet explicite : jamais l'angle « appels manqués » (faux sur cette verticale).
  assert.doesNotMatch(text, /appels?\s+(?:manqu|non pris|ratés)|ratez des appels/i);
});

test("⚠ aucun prix par écrit (jamais avant la démo)", () => {
  const { text } = rendreTexte(promoteur());
  assert.doesNotMatch(text, /€|\beuros?\b/i);
  // Pas de gros nombre qui ressemble à un tarif ; les seuls chiffres sont des heures.
  assert.doesNotMatch(text, /\b\d{3,}\b/);
});

test("éligibilité — un vrai promoteur au bon stade passe", () => {
  assert.equal(eligibleColdMail(promoteur()).ok, true);
});

test("éligibilité — les inéligibles sont ÉCARTÉS avec une raison", () => {
  assert.equal(eligibleColdMail(promoteur({ email: "" })).ok, false);
  assert.equal(eligibleColdMail(promoteur({ email: "pasunemail" })).ok, false);
  // Fiche de démo (domaine réservé RFC 2606) — rebond dur évité.
  assert.equal(eligibleColdMail(promoteur({ email: "jean@example.com" })).ok, false);
  // A explicitement refusé.
  assert.equal(eligibleColdMail(promoteur({ tags: ["ne-pas-appeler"] })).ok, false);
  // Stade avancé : pas un premier contact à froid.
  assert.equal(eligibleColdMail(promoteur({ stage: "offre" })).ok, false);
});

test("⚠⚠ une fiche DÉJÀ écrite hors Alpha n'est plus un premier contact (tag ou événement email)", () => {
  // La dédup de la route ne voit que les envois tracés par Alpha : un premier
  // mail parti de Gmail n'y laisse rien. Sans cette garde, le même promoteur
  // recevait un DEUXIÈME premier mail à la bascule vers l'autopilote serveur.
  assert.equal(eligibleColdMail(promoteur({ tags: [TAG_DEJA_ECRIT] })).ok, false);
  assert.equal(
    eligibleColdMail(
      promoteur({ events: [{ id: "e1", date: "2026-09-30T06:01:00.000Z", kind: "email", summary: "1er mail (Gmail)" }] }),
    ).ok,
    false,
  );
  // Contre-test : un autre événement (un appel) ne bloque pas le premier mail.
  assert.equal(
    eligibleColdMail(promoteur({ events: [{ id: "e2", date: "2026-09-30T06:01:00.000Z", kind: "appel", summary: "pas de réponse" }] })).ok,
    true,
  );
});

test("le mail propose le PILOTE borné, et plus aucun créneau figé", () => {
  const { text } = rendreTexte(promoteur());
  assert.match(text, /tester 30 jours sur un seul de vos programmes/);
  assert.doesNotMatch(text, /mardi 15h|jeudi 10h/i);
  // Aucune affirmation sur SA société qu'on n'a pas constatée.
  assert.doesNotMatch(text, /forcément/i);
});
