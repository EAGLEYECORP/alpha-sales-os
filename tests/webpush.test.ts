import { test } from "node:test";
import assert from "node:assert/strict";
import {
  encryptPayload,
  b64urlToBytes,
  bytesToB64url,
  vapidToken,
  pushHeaders,
  generateVapidKeys,
} from "../lib/webpush";

/**
 * Le vecteur d'exemple de la RFC 8291 §5, in extenso.
 *
 * C'est la SEULE preuve honnête disponible ici : cet environnement ne peut
 * joindre aucun service de push (Google, Mozilla, Apple). Dire « le
 * chiffrement marche » sans ce vecteur serait une affirmation sans support.
 * Avec lui, on sait que le corps produit est correct octet pour octet — reste
 * à vérifier le transport côté Zakaria.
 */
const RFC8291 = {
  plaintext: "When I grow up, I want to be a watermelon",
  auth: "BTBZMqHH6r4Tts7J_aSIgg",
  p256dh: "BCVxsr7N_eNgVRqvHtD0zTZsEc6-VV-JvLexhqUzORcxaOzi6-AYWXvTBHm4bjyPjs7Vd8pZGH6SRpkNtoIAiw4",
  asPrivate: "yfWPiYE-n46HLnH0KqZOF1fJJU3MYrct3AELtAQ-oRw",
  asPublic: "BP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A8",
  salt: "DGv6ra1nlYgDCS1FRnbzlw",
  expected:
    "DGv6ra1nlYgDCS1FRnbzlwAAEABBBP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A_yl95bQpu6cVPTpK4Mqgkf1CXztLVBSt2Ks3oZwbuwXPXLWyouBWLVWGNWQexSgSxsj_Qulcy4a-fN",
};

test("RFC 8291 — le corps chiffré est conforme au vecteur d'exemple, octet pour octet", async () => {
  const body = await encryptPayload(
    RFC8291.plaintext,
    { p256dh: RFC8291.p256dh, auth: RFC8291.auth },
    {
      salt: b64urlToBytes(RFC8291.salt),
      serverPrivateD: RFC8291.asPrivate,
      serverPublic: b64urlToBytes(RFC8291.asPublic),
    }
  );
  assert.equal(bytesToB64url(body), RFC8291.expected);
});

test("RFC 8291 — l'en-tête porte sel, taille d'enregistrement et clé éphémère", async () => {
  const body = await encryptPayload("x", { p256dh: RFC8291.p256dh, auth: RFC8291.auth });
  assert.equal(body.length > 16 + 4 + 1 + 65, true);
  // rs = 4096 sur 4 octets gros-boutistes.
  assert.deepEqual([...body.slice(16, 20)], [0, 0, 0x10, 0x00]);
  // Longueur de la clé publique, puis la clé non compressée (préfixe 0x04).
  assert.equal(body[20], 65);
  assert.equal(body[21], 0x04);
});

test("RFC 8291 — deux envois identiques produisent des corps différents", async () => {
  // Sel et paire éphémère régénérés à chaque message : sans ça, un observateur
  // du réseau verrait que le même rappel repart à l'identique.
  const a = await encryptPayload("même texte", { p256dh: RFC8291.p256dh, auth: RFC8291.auth });
  const b = await encryptPayload("même texte", { p256dh: RFC8291.p256dh, auth: RFC8291.auth });
  assert.notEqual(bytesToB64url(a), bytesToB64url(b));
});

test("clés — une clé publique mal formée est refusée, pas devinée", async () => {
  await assert.rejects(
    () => encryptPayload("x", { p256dh: bytesToB64url(new Uint8Array(64)), auth: RFC8291.auth }),
    /65 octets/
  );
});

test("VAPID — le jeton est un JWT ES256 dont l'audience est l'ORIGINE", async () => {
  const { publicKey, privateKey } = await generateVapidKeys();
  const jwt = await vapidToken(
    "https://fcm.googleapis.com/fcm/send/abc123?token=xyz",
    "mailto:contact@eagleyecorp.fr",
    publicKey,
    privateKey
  );
  const [h, p, s] = jwt.split(".");
  assert.deepEqual(JSON.parse(new TextDecoder().decode(b64urlToBytes(h))), { typ: "JWT", alg: "ES256" });

  const claims = JSON.parse(new TextDecoder().decode(b64urlToBytes(p)));
  // L'erreur classique : mettre l'endpoint entier. Le service répond 401 sans
  // dire laquelle des deux erreurs on a commise.
  assert.equal(claims.aud, "https://fcm.googleapis.com");
  assert.equal(claims.sub, "mailto:contact@eagleyecorp.fr");
  assert.ok(claims.exp > Math.floor(Date.now() / 1000));

  // ES256 → signature P1363 de 64 octets.
  assert.equal(b64urlToBytes(s).length, 64);
});

test("VAPID — le jeton expire dans les 24 h, sinon certains services le refusent", async () => {
  const { publicKey, privateKey } = await generateVapidKeys();
  const now = Date.UTC(2026, 7, 22, 12, 0, 0);
  const jwt = await vapidToken("https://updates.push.services.mozilla.com/wpush/v2/abc", "mailto:a@b.fr", publicKey, privateKey, now);
  const claims = JSON.parse(new TextDecoder().decode(b64urlToBytes(jwt.split(".")[1])));
  const heures = (claims.exp - now / 1000) / 3600;
  assert.ok(heures > 0 && heures <= 24, `expiration à ${heures} h`);
});

test("en-têtes — encodage, TTL et urgence sont explicites", async () => {
  const { publicKey, privateKey } = await generateVapidKeys();
  const h = await pushHeaders("https://fcm.googleapis.com/fcm/send/x", "mailto:a@b.fr", publicKey, privateKey, {
    ttlSec: 900,
    urgency: "high",
  });
  assert.equal(h["content-encoding"], "aes128gcm");
  assert.equal(h.ttl, "900");
  assert.equal(h.urgency, "high");
  assert.match(h.authorization, /^vapid t=[\w-]+\.[\w-]+\.[\w-]+, k=[\w-]+$/);
});

test("base64url — aller-retour sans perte, y compris sans remplissage", () => {
  for (const n of [1, 15, 16, 32, 65]) {
    const bytes = crypto.getRandomValues(new Uint8Array(n));
    assert.deepEqual([...b64urlToBytes(bytesToB64url(bytes))], [...bytes]);
  }
  // Pas de « + », « / » ni « = » : ces caractères cassent une URL et un en-tête.
  assert.doesNotMatch(bytesToB64url(new Uint8Array([251, 255, 254])), /[+/=]/);
});
