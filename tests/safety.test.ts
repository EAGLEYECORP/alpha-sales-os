import { test } from "node:test";
import assert from "node:assert/strict";

import { renderMarkdown } from "../components/ui/markdown";
import { buildLinkedinQueue, inviteText, messageText } from "../lib/linkedin-sequence";
import { LINKEDIN_INVITE_LIMIT } from "../lib/linkedin";
import { renderEmail, plainText } from "../lib/email-html";
import { CLOSER_USINE } from "../lib/signature";
import { prospect, daysAgo } from "./fixtures";

/* ────────────────────────────────────────────────────────────────────
   Ce qui protège : le rendu des réponses du modèle, les limites dures
   de LinkedIn, et les mentions légales des emails. Une régression ici
   coûte un compte, une réputation d'envoi, ou une mise en demeure.
   ──────────────────────────────────────────────────────────────────── */

const hrefs = (html: string) => [...html.matchAll(/href="([^"]*)"/g)].map((m) => m[1]);

test("markdown — les chemins internes connus deviennent des liens", () => {
  assert.deepEqual(hrefs(renderMarkdown("Va sur /appels puis /pilote.")), ["/appels", "/pilote"]);
  assert.deepEqual(hrefs(renderMarkdown("Ouvre /prospects/p-bouchon.")), ["/prospects/p-bouchon"]);
  assert.deepEqual(hrefs(renderMarkdown("Voir [la session](/appels).")), ["/appels"]);
});

test("markdown — jamais de lien externe, jamais de javascript:", () => {
  // Une sortie de modèle n'est pas une source de confiance : une fiche
  // contient du texte venu de l'extérieur.
  for (const src of [
    "[clic](https://evil.example/x)",
    "[clic](javascript:alert(1))",
    "[clic](//evil.example)",
    "Va sur https://evil.example maintenant",
  ]) {
    assert.deepEqual(hrefs(renderMarkdown(src)), [], `lien créé pour : ${src}`);
  }
});

test("markdown — les routes inconnues ne sont pas liées", () => {
  assert.deepEqual(hrefs(renderMarkdown("Regarde /admin ou /wp-login.php")), []);
});

test("markdown — les fractions et quotas restent du texte", () => {
  const out = renderMarkdown("Tu as fait 25/25 touches, note 4,8/5, plafond 40/jour.");
  assert.deepEqual(hrefs(out), []);
  assert.match(out, /25\/25/);
  assert.match(out, /4,8\/5/);
});

test("markdown — le HTML injecté est échappé, aucune balise créée", () => {
  const out = renderMarkdown("<img src=x onerror=alert(1)> et <script>alert(2)</script>");
  assert.ok(!/<img/i.test(out), "balise img créée");
  assert.ok(!/<script/i.test(out), "balise script créée");
  assert.match(out, /&lt;img/);
});

test("linkedin — l'invitation ne dépasse jamais la limite dure de 300", () => {
  const longue = prospect({
    name: "Jean-Baptiste de la Tour du Pin-Chambly",
    company: "Établissements Trucmuche & Associés de la Région Lyonnaise",
    city: "Lyon 6e — Brotteaux Foch Vitton",
    sector: "artisan",
  });
  assert.ok(inviteText(longue).length <= LINKEDIN_INVITE_LIMIT);
  assert.ok(inviteText(prospect()).length <= LINKEDIN_INVITE_LIMIT);
});

test("linkedin — l'invitation ne contient jamais de lien (une demande de connexion en fuit)", () => {
  assert.ok(!/https?:\/\//.test(inviteText(prospect())));
});

test("linkedin — le message porte le lien de réservation quand il existe", () => {
  const url = "https://cal.com/eagleye/audit";
  assert.ok(messageText(prospect(), url).includes(url));
  assert.ok(!/https?:\/\//.test(messageText(prospect())), "aucun lien si non configuré");
});

test("linkedin — la séquence avance avec les touches consignées", () => {
  const p0 = prospect({ id: "a", city: "Lyon" });
  const p1 = prospect({ id: "b", city: "Lyon", events: [{ id: "1", date: daysAgo(3), kind: "linkedin", summary: "" }] });
  const p2 = prospect({
    id: "c",
    city: "Lyon",
    events: [
      { id: "1", date: daysAgo(9), kind: "linkedin", summary: "" },
      { id: "2", date: daysAgo(6), kind: "linkedin", summary: "" },
    ],
  });
  const q = buildLinkedinQueue([p0, p1, p2], { city: "Lyon" });
  const step = (id: string) => q.find((t) => t.prospect.id === id)!.step;
  assert.equal(step("a"), "invitation");
  assert.equal(step("b"), "message");
  assert.equal(step("c"), "relance");
});

test("linkedin — la cadence bloque une fiche touchée trop récemment", () => {
  // Invitation d'hier : le message est prévu à J+2, donc pas encore mûr.
  const hier = prospect({ id: "x", city: "Lyon", events: [{ id: "1", date: daysAgo(1), kind: "linkedin", summary: "" }] });
  const [t] = buildLinkedinQueue([hier], { city: "Lyon" });
  assert.equal(t.step, "message");
  assert.equal(t.ready, false, "la cadence doit protéger le compte");
  assert.ok(t.waitDays >= 1);
});

test("email — les mentions RGPD et le STOP sont toujours présents", () => {
  const opts = { subject: "Test", body: "Bonjour,\n\nUn mot.", addressLine: "ScintIA — Lyon, France" };
  const html = renderEmail(opts);
  for (const attendu of ["STOP", "RGPD", "sources publiques", "ScintIA — Lyon, France"]) {
    assert.ok(html.includes(attendu), `mention absente du HTML : ${attendu}`);
  }
  const txt = plainText(opts);
  assert.ok(txt.includes("STOP"), "l'alternative texte doit porter le STOP");
  assert.ok(txt.includes("RGPD"));
});

/**
 * ─────────────────────────────────────────────────────────────────────
 * ⚠ CE TEST EXIGEAIT « EAGLEYE CORP » DANS CHAQUE EMAIL. IL GRAVAIT LE BUG.
 *
 * Le produit est white-label : le pied doit porter l'expéditeur, pas nous.
 * L'ancienne version faisait passer au vert un email ScintIA signé de notre
 * raison sociale — c'est-à-dire une identité d'expéditeur fausse dans un
 * message commercial. L'invariant n'est pas « notre marque est là », c'est
 * « SEUL l'expéditeur est là ».
 *
 * La mention de plateforme (« Envoyé avec Alpha Sales OS® ») est d'une autre
 * nature : elle nomme l'éditeur de l'outil, elle est vraie partout, elle reste.
 * ─────────────────────────────────────────────────────────────────────
 */
test("⚠ email — le pied porte l'EXPÉDITEUR, jamais notre marque à sa place", () => {
  const opts = {
    subject: "Test",
    body: "Bonjour,\n\nUn mot.",
    closerName: "Camille",
    addressLine: "ScintIA — Lyon, France",
  };
  const html = renderEmail(opts);
  const txt = plainText(opts);

  assert.ok(html.includes("ScintIA — Lyon, France"), "l'adresse légale de l'expéditeur doit être au pied");
  assert.ok(html.includes("Camille"), "la signature doit être celle de l'expéditeur");

  /**
   * On retire d'abord la mention de plateforme, puis on cherche notre marque
   * dans ce qui reste. Sans ce retrait, le test confondrait « éditeur de
   * l'outil » (légitime) et « expéditeur » (usurpé) — et il passerait au vert
   * sur le bug qu'il doit attraper.
   */
  const sansPlateforme = (s: string) =>
    s.replace(/Envoy[ée] avec[\s\S]{0,200}?(Alpha Sales OS)[\s\S]{0,80}/gi, "");

  for (const [nom, s] of [["HTML", sansPlateforme(html)], ["texte", sansPlateforme(txt)]] as const) {
    assert.ok(
      !/EAGLEYE|Eagleye/.test(s),
      `notre marque apparaît dans le ${nom} d'un email envoyé au nom d'un autre compte`
    );
  }
});

/**
 * Le pendant : sans identité fournie, on ne SUBSTITUE PAS la nôtre. Le
 * libellé d'usine reste visible pour que le trou se voie — `/api/send` le
 * refuse avant l'envoi (`verifieMentions`), il ne part donc jamais en vrai.
 */
test("⚠ email — une identité manquante ne devient pas « EAGLEYE » en douce", () => {
  const html = renderEmail({ subject: "T", body: "B" });
  assert.ok(!/EAGLEYE CORP/.test(html), "le repli ne doit pas inventer notre raison sociale");
  assert.ok(html.includes(CLOSER_USINE), "le libellé d'usine doit rester VISIBLE, pas masqué");
});

test("email — le contenu du prospect est échappé (pas d'injection HTML)", () => {
  const html = renderEmail({ subject: "<script>alert(1)</script>", body: "<img src=x onerror=alert(2)>" });
  assert.ok(!/<script>alert/i.test(html));
  assert.ok(!/<img src=x onerror/i.test(html));
  assert.ok(html.includes("&lt;script&gt;"));
});

test("email — le bouton n'apparaît que si l'appel à l'action est complet", () => {
  const sans = renderEmail({ subject: "S", body: "B" });
  const avec = renderEmail({ subject: "S", body: "B", ctaLabel: "Réserver", ctaUrl: "https://cal.com/x" });
  assert.ok(!sans.includes("cal.com"));
  assert.ok(avec.includes("https://cal.com/x"));
});
