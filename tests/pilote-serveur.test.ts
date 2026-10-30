import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { NextRequest } from "next/server";
import { prospectDefaults } from "../lib/seed";
import type { Prospect } from "../lib/types";
import { passagePilote } from "../lib/pilote-executeur";
import { aReecrire, expediteurServeur, mondeServeur, portesServeur, reglagesServeur, type DepsServeur } from "../lib/pilote-serveur";
import { CONFIGURATION_ALPHA_VEND_ALPHA } from "../lib/alpha-vend-alpha";
import { LIMITE_LECTURE } from "../lib/lecture-serveur";
import type { MailSortant } from "../lib/reponses-inscrit";
import { ENTETE_PILOTE_SERVEUR } from "../lib/pilote-serveur-appel";

/**
 * ─────────────────────────────────────────────────────────────────────
 * LE PILOTE SERVEUR — « ALPHA vend ALPHA » onglet fermé, sans n8n (30/10/2026).
 *
 * Les ÉTAPES sont prouvées par `tests/pilote-executeur.test.ts` (une seule
 * définition pour les deux lieux). Ici : les PORTES du serveur (ce qui se
 * réécrit en base, ce qui s'importe, ce qui se croit), et les PORTES D'ENTRÉE
 * (le tick, et les gestionnaires voisins qui reconnaissent le pilote).
 * ─────────────────────────────────────────────────────────────────────
 */

const RACINE = process.cwd().endsWith(".test-build") ? join(process.cwd(), "..") : process.cwd();
const MARDI_10H = new Date("2026-11-03T09:00:00Z");

const fiche = (o: Partial<Prospect>): Prospect =>
  ({
    ...prospectDefaults,
    name: "Camille Démo",
    sector: "autre",
    city: "Lyon",
    stage: "prospect",
    tags: ["registre"],
    createdAt: "2026-10-01T00:00:00.000Z",
    updatedAt: "2026-10-01T00:00:00.000Z",
    ...o,
  }) as Prospect;

function deps(envois: { p: Prospect; mail: MailSortant }[]): DepsServeur {
  let n = 0;
  return {
    maintenant: () => MARDI_10H,
    uid: () => `id-${++n}`,
    reglages: reglagesServeur(true, {}),
    expediteur: { closerName: "" },
    lienSignature: "https://alpha.example.com/compte",
    cleDropcontact: "",
    envoyer: async (p, mail) => {
      envois.push({ p, mail });
      return { ok: true };
    },
    lireReponses: async () => ({ etat: "lu", messages: [] }),
    agenda: async () => ({ etat: "absent" }),
    fetch: async () => {
      throw new Error("réseau non simulé");
    },
  };
}

test("⚠⚠ un passage serveur écrit le premier message, et SEULE la fiche touchée est à réécrire en base", async () => {
  const envois: { p: Prospect; mail: MailSortant }[] = [];
  const m = mondeServeur(
    [fiche({ id: "a", company: "AGENCE A (DÉMO)", email: "a@agence.example.com" }), fiche({ id: "b", company: "AGENCE B (DÉMO)", stage: "perdu" })],
    [],
    null,
  );
  await passagePilote(portesServeur(m, deps(envois)), { boite: true });
  assert.equal(envois.length, 1);
  assert.equal(envois[0].p.id, "a");
  // ALPHA vend ALPHA : le message parle de NOTRE offre, pas de l'escalier.
  assert.match(envois[0].mail.body, new RegExp(CONFIGURATION_ALPHA_VEND_ALPHA.profil.metier.slice(0, 20)));
  const r = aReecrire(m);
  assert.deepEqual(r.prospects.map((p) => p.id), ["a"], "réécrire tout le pipe à chaque passage écraserait les modifications d'à côté");
  assert.ok(m.etat.journal.some((j) => j.type === "ecrit"));
});

test("chaque écriture d'une porte marque la fiche ou le rendez-vous à réécrire — un patch seul aussi", () => {
  const m = mondeServeur([fiche({ id: "a", company: "A (DÉMO)" }), fiche({ id: "b", company: "B (DÉMO)" })], [], {});
  const pp = portesServeur(m, deps([]));
  pp.patchProspect("b", { tags: ["reponse-a-traiter"] });
  pp.upsertMeeting({ id: "r1", prospectId: "b", date: MARDI_10H.toISOString(), durationMin: 20, channel: "visio", done: false } as never);
  const r = aReecrire(m);
  assert.deepEqual(r.prospects.map((p) => p.id), ["b"], "une fiche escaladée non réécrite : le « à toi » serait perdu au passage suivant");
  assert.deepEqual(r.meetings.map((x) => x.id), ["r1"]);
});

test("importer : même entreprise (SIREN) ⇒ pas de doublon ; au-delà de la borne de lecture ⇒ refus dit", () => {
  const m = mondeServeur([fiche({ id: "x", company: "SOCIÉTÉ (DÉMO)", siren: "000000018" })], [], {});
  const pp = portesServeur(m, deps([]));
  const r = pp.importer([fiche({ id: "y", company: "AUTRE NOM (DÉMO)", siren: "000000018" }), fiche({ id: "z", company: "NEUVE (DÉMO)" })]);
  assert.deepEqual(r, { added: 1 });
  assert.ok(m.fichesModifiees.has("z") && !m.fichesModifiees.has("y"));

  const plein = mondeServeur(Array.from({ length: LIMITE_LECTURE }, (_, i) => fiche({ id: `p${i}`, company: `S${i} (DÉMO)` })), [], {});
  const refus = portesServeur(plein, deps([])).importer([fiche({ id: "n", company: "N (DÉMO)" })]);
  assert.ok("refus" in refus, "une fiche au-delà de la borne existerait sans être jamais relue");
});

test("⚠ les réglages saisis sont TRIÉS, jamais crus — et `actif` ne vient jamais d'eux", () => {
  const r = reglagesServeur(false, { actif: true, zone: 69, activites: ["68.31Z", 3], envoisParJour: -4, imapHost: " mail.securemail.pro ", taille: "tpe" });
  assert.equal(r.actif, false);
  assert.equal(r.zone, CONFIGURATION_ALPHA_VEND_ALPHA.autopilote.zone, "un nombre n'est pas une zone");
  assert.deepEqual(r.activites, CONFIGURATION_ALPHA_VEND_ALPHA.autopilote.activites, "une liste qui contient autre chose qu'un code est rejetée");
  assert.equal(r.envoisParJour, CONFIGURATION_ALPHA_VEND_ALPHA.autopilote.envoisParJour);
  assert.equal(r.imapHost, "mail.securemail.pro");
  assert.equal(r.taille, "tpe");
  assert.equal(reglagesServeur(true, "n'importe quoi").zone, CONFIGURATION_ALPHA_VEND_ALPHA.autopilote.zone);
});

test("le nom et le lien de réservation : tapés par le maître, un lien non HTTPS ne part pas", () => {
  assert.deepEqual(expediteurServeur({ closerName: "  Camille  ", bookingUrl: "http://x.example.com" }), { closerName: "Camille" });
  assert.deepEqual(expediteurServeur(null), { closerName: "" });
});

// ══════════ LES PORTES D'ENTRÉE ══════════

function sansEnv(cles: string[], f: () => Promise<void>) {
  const avant = Object.fromEntries(cles.map((k) => [k, process.env[k]]));
  for (const k of cles) delete process.env[k];
  return f().finally(() => {
    for (const [k, v] of Object.entries(avant)) if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  });
}

const ENV = ["CRON_SECRET", "NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_JWT_SECRET", "SITE_PASSWORD", "SMTP_HOST", "ALPHA_INSTALLATION"];

test("⚠⚠ le tick : sans CRON_SECRET la route n'existe pas ; avec, sans base, il ne fait rien", async () => {
  const { POST } = await import("../app/api/campaign/pilote-tick/route");
  await sansEnv(ENV, async () => {
    const r1 = await POST(new NextRequest("https://alpha.example.com/api/campaign/pilote-tick", { method: "POST", headers: { authorization: "Bearer x" } }));
    assert.equal(r1.status, 401);
    process.env.CRON_SECRET = "secret-de-test";
    const r2 = await POST(new NextRequest("https://alpha.example.com/api/campaign/pilote-tick", { method: "POST", headers: { authorization: "Bearer autre" } }));
    assert.equal(r2.status, 401, "un mauvais secret ne passe pas");
    const r3 = await POST(new NextRequest("https://alpha.example.com/api/campaign/pilote-tick", { method: "POST", headers: { authorization: "Bearer secret-de-test" } }));
    assert.equal(r3.status, 412);
  });
});

test("⚠⚠ /api/reponses et /api/agenda reconnaissent le pilote (CRON_SECRET) — et SEULEMENT lui", async () => {
  const { POST: reponses } = await import("../app/api/reponses/route");
  const { POST: agenda } = await import("../app/api/agenda/route");
  const env = process.env as Record<string, string | undefined>;
  const nodeEnv = env.NODE_ENV;
  await sansEnv(ENV, async () => {
    // Production sans serrure : un inconnu n'a ni locataire ni mode solo.
    env.NODE_ENV = "production";
    process.env.CRON_SECRET = "secret-de-test";
    try {
      const corpsR = JSON.stringify({ adresses: ["a@agence.example.com"] });
      const req = (u: string, cle: string | null, body: string) =>
        new NextRequest(u, { method: "POST", headers: { "content-type": "application/json", ...(cle ? { [ENTETE_PILOTE_SERVEUR]: cle } : {}) }, body });
      assert.equal((await reponses(req("https://a.example.com/api/reponses", null, corpsR))).status, 401);
      assert.equal((await reponses(req("https://a.example.com/api/reponses", "faux", corpsR))).status, 401, "un mauvais secret ne donne rien");
      const ok = await reponses(req("https://a.example.com/api/reponses", "secret-de-test", corpsR));
      assert.equal(ok.status, 200, "le pilote passe : la boîte maison manque, et c'est ce qu'il lit");
      assert.match(((await ok.json()) as { raison: string }).raison, /boîte/);

      const corpsA = JSON.stringify({ url: "ftp://x" });
      assert.equal((await agenda(req("https://a.example.com/api/agenda", null, corpsA))).status, 401);
      assert.equal((await agenda(req("https://a.example.com/api/agenda", "secret-de-test", corpsA))).status, 400, "reconnu : il atteint la validation de l'adresse");
    } finally {
      env.NODE_ENV = nodeEnv;
    }
  });
});

test("⚠ le tick passe par les gestionnaires VOISINS (une seule définition des gardes), et ne lit aucun secret en base", () => {
  const src = readFileSync(join(RACINE, "app/api/campaign/pilote-tick/route.ts"), "utf8");
  assert.match(src, /from "@\/app\/api\/send\/route"/);
  assert.match(src, /from "@\/app\/api\/reponses\/route"/);
  assert.match(src, /from "@\/app\/api\/agenda\/route"/);
  assert.match(src, /passagePilote\(pp, \{ boite \}\)/);
  assert.match(src, /process\.env\.DROPCONTACT_API_KEY/);
  assert.match(src, /process\.env\.AGENDA_ICS_URL/);
  // L'ancien autopilote armé sur le même pipe ⇒ refus.
  assert.match(src, /if \(estArme\(/);
  const mig = readFileSync(join(RACINE, "supabase/migrations/019-pilote-serveur.sql"), "utf8").replace(/--.*$/gm, "");
  assert.doesNotMatch(mig, /cle|token|secret|password|ics/i, "aucune colonne de secret dans la table");
  assert.match(mig, /revoke all on table public\.pilote_serveur from anon, authenticated/);
});

test("⚠⚠ MAÎTRE SEUL : les portes du serveur ne connaissent qu'UNE cible et qu'UN profil, les nôtres", () => {
  const src = readFileSync(join(RACINE, "lib/pilote-serveur.ts"), "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  assert.match(src, /inscrit: \(\) => \(\{ profil: cfg\.profil/);
  assert.doesNotMatch(src, /\btenant/i, "aucun locataire n'entre dans le pilote serveur");
  const interrupteur = readFileSync(join(RACINE, "app/api/autopilote/serveur/route.ts"), "utf8");
  assert.equal((interrupteur.match(/if \(!droits\.maitre\) return NextResponse\.json\(\{ error: "réservé au compte maître" \}, \{ status: 403 \}\)/g) ?? []).length, 2);
});
