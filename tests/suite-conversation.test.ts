import { test } from "node:test";
import assert from "node:assert/strict";
import { createServer, type Server } from "node:net";
import { NextRequest } from "next/server";
import { decisionRecontact, CONTACTS_MAX_30J, RELANCE_GAPS_H } from "../lib/relance-mail";
import { issueEnvoi, type Envoi } from "../lib/autopilote-inscrit";
import { DIVULGATION_ECRITE } from "../lib/signature-ia";

/**
 * ─────────────────────────────────────────────────────────────────────
 * UNE SUITE DE CONVERSATION N'EST PAS UN RECONTACT — 29/10/2026.
 *
 * Le pilote automatique d'un inscrit cassait au moment où le prospect disait
 * oui : `/api/send` refusait la proposition de créneaux (409, « déjà contacté
 * dans les 14 derniers jours »), et chaque relance avec. Le rendu ne l'avait
 * pas vu, `/api/send` y était simulé. D'où le dernier bloc : la VRAIE route,
 * derrière un faux serveur SMTP local (aucune dépendance, rien ne sort).
 * ─────────────────────────────────────────────────────────────────────
 */

const H = 3_600_000;
const T = Date.parse("2026-11-03T10:00:00.000Z");
const il = (heures: number) => new Date(T - heures * H).toISOString();

test("un premier message dans la fenêtre de recontact est refusé — et `force` le laisse passer", () => {
  const base = { historique: { count: 0, dernierISO: null }, maintenant: T };
  const r = decisionRecontact({ ...base, force: false, dejaContacte: true });
  assert.equal(r.ok, false);
  assert.equal(!r.ok && r.alreadyContacted, true);
  assert.equal(decisionRecontact({ ...base, force: true, dejaContacte: true }).ok, true);
  assert.equal(decisionRecontact({ ...base, force: false, dejaContacte: false }).ok, true);
});

test("⚠⚠ une RÉPONSE passe la fenêtre de recontact — seulement si on lui a déjà écrit", () => {
  const ok = decisionRecontact({ suite: "reponse", force: false, dejaContacte: true, historique: { count: 1, dernierISO: il(48) }, maintenant: T });
  assert.equal(ok.ok, true, "il a dit oui deux jours après notre message : lui répondre n'est pas le recontacter");
  const deguise = decisionRecontact({ suite: "reponse", force: false, dejaContacte: false, historique: { count: 0, dernierISO: null }, maintenant: T });
  assert.equal(deguise.ok, false, "sans message antérieur, « réponse » est un premier message déguisé");
  assert.equal(!deguise.ok && deguise.alreadyContacted, false);
});

test("⚠⚠ une RELANCE est bornée par le serveur : espacement, plafond légal — et `force` n'y change rien", () => {
  const relance = (count: number, heures: number | null, force = false) =>
    decisionRecontact({ suite: "relance", force, dejaContacte: true, historique: { count, dernierISO: heures === null ? null : il(heures) }, maintenant: T });
  assert.equal(relance(1, RELANCE_GAPS_H[0] + 1).ok, true, "après l'espacement, la relance part malgré la fenêtre de 14 j");
  assert.equal(relance(1, RELANCE_GAPS_H[0] - 1).ok, false, "trop tôt");
  assert.equal(relance(1, 1, true).ok, false, "force ne passe pas outre l'espacement d'une relance");
  assert.equal(relance(CONTACTS_MAX_30J, 500).ok, false, "plafond du décret 2022-1313");
  assert.equal(relance(CONTACTS_MAX_30J, 500, true).ok, false, "ni outre le plafond");
  assert.equal(relance(0, null).ok, false, "base muette ⇒ historique vide ⇒ refus");
});

test("⚠⚠ un envoi raté : le passager se rejoue, une réponse définitive remonte à l'humain", () => {
  const rate = (status: number, extra: Partial<Extract<Envoi, { ok: false }>> = {}): Envoi => ({ ok: false, status, erreur: "x", ...extra });
  for (const status of [0, 402, 429, 500, 502, 503]) {
    for (const nature of ["premier", "reponse", "relance"] as const) {
      assert.equal(issueEnvoi(rate(status), nature), "reessayer", `${status} ${nature} est passager`);
    }
  }
  assert.equal(issueEnvoi(rate(422), "reponse"), "humain", "il attend une réponse : ça ne s'avale pas");
  assert.equal(issueEnvoi(rate(409), "reponse"), "humain");
  assert.equal(issueEnvoi(rate(409, { dejaContacte: true }), "premier"), "deja-ecrit");
  assert.equal(issueEnvoi(rate(422), "premier"), "abandon");
  assert.equal(issueEnvoi(rate(409), "relance"), "abandon");
  assert.equal(issueEnvoi({ ok: true }, "reponse"), "fait");
});

// ══════════ LA VRAIE ROUTE ══════════

/** Un serveur SMTP minimal : il accepte tout et retient les destinataires. Rien ne sort de la machine. */
function fauxSmtp(): Promise<{ serveur: Server; port: number; recus: string[][] }> {
  const recus: string[][] = [];
  const serveur = createServer((sock) => {
    let tampon = "";
    let enDonnees = false;
    let rcpt: string[] = [];
    let authLogin = 0;
    sock.write("220 faux-smtp\r\n");
    sock.on("data", (d) => {
      tampon += d.toString("utf8");
      for (;;) {
        if (enDonnees) {
          const fin = tampon.indexOf("\r\n.\r\n");
          if (fin < 0) return;
          tampon = tampon.slice(fin + 5);
          enDonnees = false;
          recus.push(rcpt);
          rcpt = [];
          sock.write("250 accepte\r\n");
          continue;
        }
        const nl = tampon.indexOf("\r\n");
        if (nl < 0) return;
        const ligne = tampon.slice(0, nl);
        tampon = tampon.slice(nl + 2);
        const cmd = ligne.toUpperCase();
        if (authLogin) {
          authLogin = authLogin === 1 ? 2 : 0;
          sock.write(authLogin ? "334 UGFzc3dvcmQ6\r\n" : "235 ok\r\n");
        } else if (cmd.startsWith("EHLO")) sock.write("250-faux-smtp\r\n250 AUTH PLAIN LOGIN\r\n");
        else if (cmd.startsWith("HELO")) sock.write("250 faux-smtp\r\n");
        else if (cmd.startsWith("AUTH LOGIN")) {
          authLogin = 1;
          sock.write("334 VXNlcm5hbWU6\r\n");
        } else if (cmd.startsWith("AUTH")) sock.write("235 ok\r\n");
        else if (cmd.startsWith("MAIL")) sock.write("250 ok\r\n");
        else if (cmd.startsWith("RCPT")) {
          rcpt.push((ligne.match(/<([^>]+)>/)?.[1] ?? "").toLowerCase());
          sock.write("250 ok\r\n");
        } else if (cmd.startsWith("DATA")) {
          enDonnees = true;
          sock.write("354 go\r\n");
        } else if (cmd.startsWith("QUIT")) {
          sock.end("221 bye\r\n");
          return;
        } else sock.write("250 ok\r\n");
      }
    });
    sock.on("error", () => {});
  });
  return new Promise((ok) =>
    serveur.listen(0, "127.0.0.1", () => {
      const a = serveur.address();
      ok({ serveur, port: typeof a === "object" && a ? a.port : 0, recus });
    })
  );
}

async function avecEnv<R>(env: Record<string, string | undefined>, f: () => Promise<R>): Promise<R> {
  const avant: Record<string, string | undefined> = {};
  for (const [k, v] of Object.entries(env)) {
    avant[k] = process.env[k];
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
  try {
    return await f();
  } finally {
    for (const [k, v] of Object.entries(avant)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  }
}

test("⚠⚠ SUR LA VRAIE ROUTE : premier message, il répond, ALPHA répond — sans 409", async () => {
  const { serveur, port, recus } = await fauxSmtp();
  const { POST } = await import("../app/api/send/route");
  // Pas un domaine réservé (refusé comme fiche de démo AVANT ce qui est testé) :
  // un sous-domaine du nôtre. Rien ne part — le SMTP est sur 127.0.0.1.
  const prospect = "julie@suite.test.eagleyecorp.fr";
  const inconnu = "personne@suite.test.eagleyecorp.fr";
  const envoyer = async (to: string, suite?: string, copieExpediteur?: boolean) => {
    const res = await POST(
      new NextRequest("http://local/api/send", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          channel: "email",
          modeProduction: "autonome",
          to,
          subject: "Votre accueil client",
          body: `Bonjour, merci pour votre retour. Je vous propose un échange court cette semaine.\n\n${DIVULGATION_ECRITE}`,
          closerName: "Julie Martin",
          agencyName: "Dupont Conseil SAS",
          ...(suite ? { suite } : {}),
          ...(copieExpediteur ? { copieExpediteur } : {}),
        }),
      })
    );
    return { status: res.status, corps: (await res.json()) as { ok?: boolean; error?: string; alreadyContacted?: boolean; suiteRefusee?: boolean } };
  };
  try {
    await avecEnv(
      {
        SMTP_HOST: "127.0.0.1",
        SMTP_PORT: String(port),
        SMTP_USER: "expediteur",
        SMTP_PASS: "mot-de-passe-de-test",
        SMTP_FROM: "Julie Martin <expediteur@suite.test.eagleyecorp.fr>",
        ALPHA_INSTALLATION: undefined,
        CONTACT_COOLDOWN_DAYS: "14",
      },
      async () => {
        const premier = await envoyer(prospect);
        assert.equal(premier.status, 200, `le premier message part : ${premier.corps.error ?? ""}`);

        const encore = await envoyer(prospect);
        assert.equal(encore.status, 409, "un second PREMIER message reste refusé — la fenêtre garde son rôle");
        assert.equal(encore.corps.alreadyContacted, true);

        const reponse = await envoyer(prospect, "reponse");
        assert.equal(reponse.status, 200, `la réponse aux trois créneaux part : ${reponse.corps.error ?? ""}`);

        const relance = await envoyer(prospect, "relance");
        assert.equal(relance.status, 409, "une relance une heure après reste refusée par le serveur");
        assert.equal(relance.corps.suiteRefusee, true);
        assert.match(relance.corps.error ?? "", /Trop tôt/);

        const deguise = await envoyer(inconnu, "reponse");
        assert.equal(deguise.status, 409, "« réponse » à quelqu'un à qui on n'a jamais écrit : refusé");
        assert.match(deguise.corps.error ?? "", /pas une réponse/);

        const bidon = await envoyer(prospect, "n-importe-quoi");
        assert.equal(bidon.status, 409, "une valeur inconnue est lue comme un premier message");
        assert.equal(bidon.corps.alreadyContacted, true);

        // La confirmation du rendez-vous part AUSSI dans la boîte de l'inscrit
        // (copie cachée) : l'invitation arrive dans SON agenda, pas seulement
        // dans celui du prospect.
        const confirmation = await envoyer(prospect, "reponse", true);
        assert.equal(confirmation.status, 200, confirmation.corps.error ?? "");

        assert.deepEqual(
          recus,
          [[prospect], [prospect], [prospect, "expediteur@suite.test.eagleyecorp.fr"]],
          "trois messages sont partis : le premier, la réponse, et la confirmation copiée à l'expéditeur — à LUI seul"
        );
      }
    );
  } finally {
    serveur.close();
  }
});
