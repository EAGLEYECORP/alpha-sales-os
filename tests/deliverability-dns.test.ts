import test from "node:test";
import assert from "node:assert/strict";
import { buildDnsReport, type DnsFacts } from "../lib/deliverability-dns";

/**
 * Ces règles décident si des emails arrivent. Une règle fausse ne se voit
 * pas : elle se paie en silence, en messages classés que personne ne lira.
 * D'où des tests sur chaque verdict, y compris ceux qui ressemblent à un
 * succès et n'en sont pas.
 */

const facts = (over: Partial<DnsFacts> = {}): DnsFacts => ({
  domain: "exemple.fr",
  root: { ok: true, records: ["v=spf1 include:mx.ovh.com ~all"] },
  dmarc: { ok: true, records: ["v=DMARC1; p=quarantine; rua=mailto:p@exemple.fr"] },
  mx: { ok: true, records: [{ exchange: "mx0.mail.ovh.net" }] },
  dkim: [{ selector: "selector1", provider: "Microsoft 365" }],
  now: new Date("2026-08-02T12:00:00Z"),
  ...over,
});

const check = (r: ReturnType<typeof buildDnsReport>, id: string) => r.checks.find((c) => c.id === id)!;

test("dns — un domaine complet est déclaré bon", () => {
  const r = buildDnsReport(facts());
  assert.equal(r.verdict, "bon");
  assert.equal(r.manquants, 0);
});

test("dns — PLUSIEURS enregistrements DMARC valent zéro, pas « configuré »", () => {
  // RFC 7489 §6.6.3 : si l'ensemble contient plusieurs enregistrements, la
  // découverte de politique s'arrête et DMARC n'est pas appliqué. C'est le
  // piège : chaque enregistrement est valide pris isolément, et lire le
  // premier ferait conclure à tort que le domaine est protégé.
  const r = buildDnsReport(
    facts({
      dmarc: {
        ok: true,
        records: ["v=DMARC1; p=reject; rua=mailto:a@exemple.fr", "v=DMARC1; p=none; rua=mailto:b@exemple.fr"],
      },
    })
  );
  const dmarc = check(r, "dmarc");
  assert.equal(dmarc.level, "manquant", "deux enregistrements = aucune politique");
  assert.equal(r.verdict, "bloquant");
  assert.match(dmarc.value, /2 enregistrements/);
  assert.match(dmarc.fix!, /sauf UN/);
});

test("dns — un seul DMARC strict passe, un p=none demande à être durci", () => {
  const strict = check(buildDnsReport(facts()), "dmarc");
  assert.equal(strict.level, "ok");

  const observe = buildDnsReport(facts({ dmarc: { ok: true, records: ["v=DMARC1; p=none"] } }));
  assert.equal(check(observe, "dmarc").level, "attention");
});

test("dns — DMARC absent est bloquant", () => {
  const r = buildDnsReport(facts({ dmarc: { ok: true, records: [] } }));
  assert.equal(check(r, "dmarc").level, "manquant");
  assert.equal(r.verdict, "bloquant");
});

test("dns — les TXT qui ne sont pas du DMARC ne comptent pas comme des doublons", () => {
  // La racine _dmarc peut porter d'autres TXT (vérification de propriété…).
  const r = buildDnsReport(
    facts({ dmarc: { ok: true, records: ["google-site-verification=xyz", "v=DMARC1; p=reject"] } })
  );
  assert.equal(check(r, "dmarc").level, "ok");
});

test("dns — DKIM trouvé nomme le sélecteur et le fournisseur", () => {
  const r = buildDnsReport(
    facts({
      dkim: [
        { selector: "selector1", provider: "Microsoft 365" },
        { selector: "selector2", provider: "Microsoft 365" },
      ],
    })
  );
  const dkim = check(r, "dkim");
  assert.equal(dkim.level, "ok");
  assert.match(dkim.value, /selector1, selector2/);
  assert.match(dkim.value, /Microsoft 365/);
  assert.doesNotMatch(dkim.value, /Microsoft 365, Microsoft 365/, "le fournisseur ne se répète pas");
});

test("dns — DKIM introuvable reste « attention », jamais « manquant »", () => {
  // On ne sonde qu'une liste de sélecteurs connus : ne rien trouver ne
  // prouve pas l'absence. Conclure « manquant » serait affirmer plus que
  // ce qu'on sait.
  const r = buildDnsReport(facts({ dkim: [] }));
  assert.equal(check(r, "dkim").level, "attention");
  assert.match(check(r, "dkim").value, /sélecteur inhabituel/);
});

test("dns — SPF en +all est pire que pas de SPF, et c'est dit", () => {
  const r = buildDnsReport(facts({ root: { ok: true, records: ["v=spf1 +all"] } }));
  const spf = check(r, "spf");
  assert.equal(spf.level, "attention");
  assert.match(spf.why, /pire que pas de SPF/);
});

test("dns — une résolution en échec n'est pas une absence d'enregistrement", () => {
  const r = buildDnsReport(facts({ root: { ok: false, reason: "ETIMEOUT" } }));
  assert.equal(check(r, "spf").level, "inconnu");
  assert.equal(r.verdict, "non concluant", "on ne conclut pas sur ce qu'on n'a pas pu lire");
});

test("dns — une boîte grand public est bloquante sans même lire le DNS", () => {
  const r = buildDnsReport(facts({ domain: "gmail.com" }));
  assert.equal(r.sharedMailbox, true);
  assert.equal(r.verdict, "bloquant");
  assert.equal(r.checks.length, 1, "inutile d'égrener des enregistrements qui ne sont pas les tiens");
  assert.match(r.checks[0].why, /appartiennent au fournisseur/);
});

test("dns — sans MX, les réponses n'arrivent nulle part", () => {
  const r = buildDnsReport(facts({ mx: { ok: true, records: [] } }));
  assert.equal(check(r, "mx").level, "manquant");
});

test("dns — le cas réel scintia.ai : SPF et DKIM bons, DMARC annulé par ses doublons", () => {
  const r = buildDnsReport(
    facts({
      domain: "scintia.ai",
      root: { ok: true, records: ["v=spf1 include:spf.protection.outlook.com -all"] },
      dmarc: {
        ok: true,
        records: [
          "v=DMARC1; p=none; rua=mailto:a@scintia.ai",
          "v=DMARC1; p=none; rua=mailto:b@scintia.ai",
          "v=DMARC1; p=none",
        ],
      },
      dkim: [
        { selector: "selector1", provider: "Microsoft 365" },
        { selector: "selector2", provider: "Microsoft 365" },
      ],
      mx: { ok: true, records: [{ exchange: "scintia-ai.mail.protection.outlook.com" }] },
    })
  );
  assert.equal(check(r, "spf").level, "ok");
  assert.equal(check(r, "dkim").level, "ok");
  assert.equal(check(r, "dmarc").level, "manquant");
  assert.equal(r.verdict, "bloquant");
});
