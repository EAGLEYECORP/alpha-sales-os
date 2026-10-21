import { test } from "node:test";
import assert from "node:assert/strict";
import { NextRequest } from "next/server";
import { habillageEnvoi } from "../lib/expediteur";
import { habillageOperateur } from "../lib/expediteur-serveur";
import { verifieMentions } from "../lib/conformite";
import { plainText } from "../lib/email-html";
import { construireMailCold } from "../lib/mail-autopilote";
import { prospect } from "./fixtures";

/**
 * ─────────────────────────────────────────────────────────────────────
 * PERSONNE D'AUTRE QUE NOUS N'ENVOIE SOUS NOTRE NOM.
 *
 * Mesuré le 21/10/2026 : un store neuf porte `accountId: "eagleye"` et
 * `agencyName: "EAGLEYE CORP"`. `habillageEnvoi` prenait ce que le navigateur
 * annonçait — un inscrit qui n'avait saisi que son prénom envoyait, depuis SA
 * boîte, un email signé de notre raison sociale, notre aigle en tête, avec
 * `usine: false`. Et l'autopilote d'une installation « chez vous » signait
 * « EAGLEYE CORP » en dur.
 * ─────────────────────────────────────────────────────────────────────
 */

const BASE = "https://alpha.test";

/** Exactement ce qu'un store neuf envoie, une fois le prénom saisi. */
const STORE_NEUF = { accountId: "eagleye", closerName: "Julie Martin", agencyName: "EAGLEYE CORP", base: BASE };

test("⚠⚠ hors compte maître, le réglage d'usine « EAGLEYE CORP » ne signe pas", () => {
  const h = habillageEnvoi({ ...STORE_NEUF, maitre: false });
  assert.equal(h.marqueRefusee, "portefeuille");
  assert.equal(h.marque, "", "notre raison sociale ne doit pas être retenue comme marque");
  assert.equal(h.logoUrl, undefined, "notre aigle ne part pas sur l'email d'un inscrit");
  assert.doesNotMatch(h.addressLine, /eagleye/i, "ni notre raison sociale au pied");
});

test("toute marque du portefeuille est refusée, quelle que soit la casse", () => {
  for (const nom of ["eagleye corp", "  EAGLEYE CORP ", "Nuwacom", "NUWACOM"]) {
    assert.equal(habillageEnvoi({ maitre: false, agencyName: nom }).marqueRefusee, "portefeuille", nom);
  }
});

test("hors compte maître, une société absente est nommée — jamais remplacée par celle du compte annoncé", () => {
  const h = habillageEnvoi({ maitre: false, accountId: "eagleye", closerName: "Julie Martin", agencyName: "  " });
  assert.equal(h.marqueRefusee, "absente");
  assert.equal(h.marque, "");
});

test("hors compte maître, SA société signe — sans notre logo, même si le navigateur annonce notre compte", () => {
  const h = habillageEnvoi({ ...STORE_NEUF, agencyName: "Dupont Conseil SAS", maitre: false });
  assert.equal(h.marqueRefusee, null);
  assert.equal(h.marque, "Dupont Conseil SAS");
  assert.equal(h.addressLine, "Dupont Conseil SAS");
  assert.equal(h.logoUrl, undefined, "c'est le serveur qui dit maître, pas `accountId`");
  assert.equal(h.closerName, "Julie Martin");
});

test("le compte maître est inchangé : notre marque et notre aigle", () => {
  const h = habillageEnvoi({ maitre: true, accountId: "eagleye", base: BASE });
  assert.equal(h.marque, "EAGLEYE CORP");
  assert.ok(h.logoUrl);
  assert.equal(h.marqueRefusee, null);
});

/** L'environnement d'une installation : posé, puis rendu tel quel. */
function avecEnv(env: Record<string, string | undefined>, f: () => void | Promise<void>) {
  const avant: Record<string, string | undefined> = {};
  for (const k of Object.keys(env)) {
    avant[k] = process.env[k];
    if (env[k] === undefined) delete process.env[k];
    else process.env[k] = env[k];
  }
  const rendre = () => {
    for (const [k, v] of Object.entries(avant)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  };
  try {
    const r = f();
    if (r instanceof Promise) return r.finally(rendre);
    rendre();
  } catch (e) {
    rendre();
    throw e;
  }
}

test("⚠⚠ l'autopilote d'une installation « chez vous » ne signe plus « EAGLEYE CORP »", () => {
  avecEnv({ ALPHA_INSTALLATION: "client", ALPHA_SOCIETE: undefined }, () => {
    const h = habillageOperateur(BASE);
    assert.equal(h.logoUrl, undefined);
    assert.doesNotMatch(`${h.marque} ${h.addressLine} ${h.closerName}`, /eagleye/i);
    // Sans ALPHA_SOCIETE, chaque envoi est refusé par les mentions : l'autopilote se tait.
    const { subject, body } = construireMailCold(prospect({ email: "contact@exemple.invalid" }));
    const text = plainText({ subject, body, closerName: h.closerName, addressLine: h.addressLine, logoUrl: h.logoUrl });
    assert.ok(verifieMentions(text, h.closerName, h.marque, "premier").length > 0, "rien ne doit partir sans société");
  });

  avecEnv({ ALPHA_INSTALLATION: "client", ALPHA_SOCIETE: "Dupont Conseil SAS" }, () => {
    const h = habillageOperateur(BASE);
    assert.equal(h.marque, "Dupont Conseil SAS");
    assert.equal(h.logoUrl, undefined);
  });

  avecEnv({ ALPHA_INSTALLATION: undefined }, () => {
    assert.equal(habillageOperateur(BASE).marque, "EAGLEYE CORP", "sur notre cloud, l'autopilote est le nôtre");
  });
});

/**
 * ⚠ SUR LA VRAIE ROUTE, PAS SUR SA SOURCE. Une installation client sans comptes
 * rend `maitre: false` (`droitInstallationClient`) : c'est la façon la plus
 * directe d'obtenir un expéditeur non maître depuis un test.
 */
test("⚠⚠ /api/send refuse un message d'un non-maître signé du réglage d'usine — 422, rien ne part", async () => {
  const { POST } = await import("../app/api/send/route");
  const envoyer = (agencyName: string) =>
    POST(
      new NextRequest("http://local/api/send", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          channel: "email",
          // Pas un domaine réservé (il serait refusé en 409 comme fiche de démo,
          // AVANT le contrôle testé) : un sous-domaine du nôtre, jamais un tiers.
          // Rien ne part de toute façon — aucun SMTP n'existe dans les tests.
          to: "destinataire@test.eagleyecorp.fr",
          subject: "Bonjour",
          body: "Bonjour, un mot rapide. Répondez STOP pour ne plus recevoir de message.",
          accountId: "eagleye",
          closerName: "Julie Martin",
          agencyName,
        }),
      })
    );

  await avecEnv({ ALPHA_INSTALLATION: "client", SITE_PASSWORD: "serrure-de-test" }, async () => {
    const usurpe = await envoyer("EAGLEYE CORP");
    assert.equal(usurpe.status, 422);
    const j = (await usurpe.json()) as { error: string; quoiFaire: string };
    assert.match(j.error, /pas la tienne/);
    assert.match(j.quoiFaire, /Réglages/);

    const vide = await envoyer("");
    assert.equal(vide.status, 422);
    assert.match(((await vide.json()) as { error: string }).error, /non renseignée/);

    // Sa société passe CE contrôle (la suite — SMTP, quota — n'est pas l'objet ici).
    const sienne = await envoyer("Dupont Conseil SAS");
    const corps = (await sienne.json()) as { error?: string };
    assert.doesNotMatch(corps.error ?? "", /pas la tienne|non renseignée/);
  });
});

test("⚠ l'aperçu d'un non-maître ne montre plus notre aigle ni notre raison sociale", async () => {
  const { POST } = await import("../app/api/email/preview/route");
  await avecEnv({ ALPHA_INSTALLATION: "client", SITE_PASSWORD: "serrure-de-test" }, async () => {
    const res = await POST(
      new NextRequest("http://local/api/email/preview", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...STORE_NEUF, subject: "Bonjour", body: "Un mot rapide." }),
      })
    );
    const { html, text } = (await res.json()) as { html: string; text: string };
    assert.doesNotMatch(html, /email-eagle\.png/, "un aperçu qui montre notre logo ment sur ce qui partira");
    assert.doesNotMatch(text, /EAGLEYE CORP/);
  });
});
