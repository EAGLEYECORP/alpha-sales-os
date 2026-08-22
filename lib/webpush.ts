/**
 * ─────────────────────────────────────────────────────────────────────
 * WEB PUSH — notifications qui arrivent APP FERMÉE.
 *
 * Jusqu'ici, les rappels d'ALPHA ne partaient que pendant que l'onglet était
 * ouvert : un `setInterval` dans un composant React. Autant dire qu'ils ne
 * servaient à rien — un commercial en tournée n'a pas le CRM ouvert, et c'est
 * précisément à ce moment-là qu'un « rappelle-le maintenant » a de la valeur.
 *
 * Deux normes, implémentées ici À LA MAIN (le repo n'ajoute pas de dépendance) :
 *
 *  · RFC 8291 — chiffrement du message (`aes128gcm`). Le serveur de push
 *    (Google, Apple, Mozilla) relaie sans jamais pouvoir lire : la charge est
 *    chiffrée pour le navigateur destinataire, avec une clé dérivée d'un ECDH
 *    entre une paire éphémère et la clé publique de l'abonnement.
 *  · RFC 8292 — VAPID. Un JWT ES256 signé qui prouve au service de push que
 *    l'envoi vient bien de NOUS. Sans lui, n'importe qui ayant l'endpoint
 *    pourrait pousser dans les notifications de nos utilisateurs.
 *
 * Tout est vérifiable hors-ligne : `encryptPayload` est testée contre le
 * vecteur d'exemple de la RFC 8291 §5, octet pour octet. C'est la seule façon
 * honnête d'affirmer que ça marche sans pouvoir joindre un service de push
 * depuis cet environnement.
 * ─────────────────────────────────────────────────────────────────────
 */

// ── Encodage ───────────────────────────────────────────────────────────

export function b64urlToBytes(s: string): Uint8Array {
  const pad = s.replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(pad + "=".repeat((4 - (pad.length % 4)) % 4));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export function bytesToB64url(b: Uint8Array): string {
  let s = "";
  for (let i = 0; i < b.length; i++) s += String.fromCharCode(b[i]);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

const concat = (...parts: Uint8Array[]): Uint8Array => {
  const total = parts.reduce((n, p) => n + p.length, 0);
  const out = new Uint8Array(total);
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return out;
};

const utf8 = (s: string): Uint8Array => new TextEncoder().encode(s);

/** Entier 32 bits gros-boutiste — la taille d'enregistrement de l'en-tête. */
function u32(n: number): Uint8Array {
  return new Uint8Array([(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255]);
}

// ── HKDF (les briques de la RFC 8291) ──────────────────────────────────

async function hmac(key: Uint8Array, data: Uint8Array): Promise<Uint8Array> {
  const k = await crypto.subtle.importKey("raw", key as BufferSource, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return new Uint8Array(await crypto.subtle.sign("HMAC", k, data as BufferSource));
}

/** HKDF réduit au cas d'usage : une seule itération suffit (≤ 32 octets). */
async function hkdf(salt: Uint8Array, ikm: Uint8Array, info: Uint8Array, length: number): Promise<Uint8Array> {
  const prk = await hmac(salt, ikm);
  const okm = await hmac(prk, concat(info, new Uint8Array([1])));
  return okm.slice(0, length);
}

// ── Clés ───────────────────────────────────────────────────────────────

/** Une clé publique P-256 non compressée (65 octets) → JWK. */
function publicJwk(raw: Uint8Array): JsonWebKey {
  if (raw.length !== 65 || raw[0] !== 0x04) throw new Error("Clé publique P-256 non compressée attendue (65 octets).");
  return {
    kty: "EC",
    crv: "P-256",
    x: bytesToB64url(raw.slice(1, 33)),
    y: bytesToB64url(raw.slice(33, 65)),
    ext: true,
  };
}

/** Paire de clés serveur (VAPID). À générer UNE fois, puis à conserver. */
export async function generateVapidKeys(): Promise<{ publicKey: string; privateKey: string }> {
  const pair = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"]);
  const pub = new Uint8Array(await crypto.subtle.exportKey("raw", pair.publicKey));
  const jwk = await crypto.subtle.exportKey("jwk", pair.privateKey);
  return { publicKey: bytesToB64url(pub), privateKey: jwk.d as string };
}

// ── RFC 8291 : chiffrement de la charge ────────────────────────────────

export interface PushSubscriptionKeys {
  /** Clé publique du navigateur, base64url (65 octets non compressés). */
  p256dh: string;
  /** Secret d'authentification, base64url (16 octets). */
  auth: string;
}

/** Injection des aléas — uniquement pour rejouer les vecteurs de la RFC. */
export interface EncryptOverrides {
  salt?: Uint8Array;
  /** Clé privée éphémère (scalar d, base64url) + sa publique (65 octets). */
  serverPrivateD?: string;
  serverPublic?: Uint8Array;
}

/**
 * Chiffre une charge utile pour un abonnement donné (`aes128gcm`).
 *
 * Le corps produit porte tout ce qu'il faut au navigateur pour déchiffrer :
 * `salt(16) | rs(4) | idlen(1) | clé publique éphémère(65) | chiffré`.
 */
export async function encryptPayload(
  payload: string,
  keys: PushSubscriptionKeys,
  over: EncryptOverrides = {}
): Promise<Uint8Array> {
  const uaPublic = b64urlToBytes(keys.p256dh);
  const authSecret = b64urlToBytes(keys.auth);
  const salt = over.salt ?? crypto.getRandomValues(new Uint8Array(16));

  // Paire éphémère du serveur, régénérée à CHAQUE message : c'est elle qui
  // rend deux envois identiques indistinguables.
  let asPublic: Uint8Array;
  let asPrivate: CryptoKey;
  if (over.serverPrivateD && over.serverPublic) {
    asPublic = over.serverPublic;
    asPrivate = await crypto.subtle.importKey(
      "jwk",
      { ...publicJwk(asPublic), d: over.serverPrivateD },
      { name: "ECDH", namedCurve: "P-256" },
      false,
      ["deriveBits"]
    );
  } else {
    const pair = await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"]);
    asPublic = new Uint8Array(await crypto.subtle.exportKey("raw", pair.publicKey));
    asPrivate = pair.privateKey;
  }

  const uaKey = await crypto.subtle.importKey("jwk", publicJwk(uaPublic), { name: "ECDH", namedCurve: "P-256" }, false, []);
  const ecdh = new Uint8Array(await crypto.subtle.deriveBits({ name: "ECDH", public: uaKey }, asPrivate, 256));

  // IKM : le secret partagé, lié aux DEUX clés publiques. C'est ce qui
  // empêche de rejouer un message vers un autre abonnement.
  const keyInfo = concat(utf8("WebPush: info"), new Uint8Array([0]), uaPublic, asPublic);
  const ikm = await hkdf(authSecret, ecdh, keyInfo, 32);

  const cek = await hkdf(salt, ikm, concat(utf8("Content-Encoding: aes128gcm"), new Uint8Array([0])), 16);
  const nonce = await hkdf(salt, ikm, concat(utf8("Content-Encoding: nonce"), new Uint8Array([0])), 12);

  // 0x02 = délimiteur de DERNIER enregistrement (on n'en envoie qu'un).
  const plaintext = concat(utf8(payload), new Uint8Array([2]));
  const aes = await crypto.subtle.importKey("raw", cek as BufferSource, { name: "AES-GCM" }, false, ["encrypt"]);
  const cipher = new Uint8Array(
    await crypto.subtle.encrypt({ name: "AES-GCM", iv: nonce as BufferSource, tagLength: 128 }, aes, plaintext as BufferSource)
  );

  return concat(salt, u32(4096), new Uint8Array([asPublic.length]), asPublic, cipher);
}

// ── RFC 8292 : jeton VAPID ─────────────────────────────────────────────

/**
 * Le JWT ES256 qui prouve notre identité au service de push.
 *
 * `aud` doit être l'ORIGINE de l'endpoint, pas l'endpoint entier — une erreur
 * classique, et le service répond 401 sans expliquer laquelle.
 */
export async function vapidToken(
  endpoint: string,
  subject: string,
  publicKeyB64: string,
  privateD: string,
  now = Date.now()
): Promise<string> {
  const aud = new URL(endpoint).origin;
  const header = bytesToB64url(utf8(JSON.stringify({ typ: "JWT", alg: "ES256" })));
  const claims = bytesToB64url(
    utf8(
      JSON.stringify({
        aud,
        // 12 h : au-delà, certains services refusent le jeton.
        exp: Math.floor(now / 1000) + 12 * 3600,
        sub: subject,
      })
    )
  );

  const pub = b64urlToBytes(publicKeyB64);
  const key = await crypto.subtle.importKey(
    "jwk",
    { ...publicJwk(pub), d: privateD, key_ops: ["sign"] },
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"]
  );
  const sig = new Uint8Array(
    await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, key, utf8(`${header}.${claims}`) as BufferSource)
  );
  return `${header}.${claims}.${bytesToB64url(sig)}`;
}

/** Les en-têtes complets d'un envoi. */
export async function pushHeaders(
  endpoint: string,
  subject: string,
  publicKeyB64: string,
  privateD: string,
  opts: { ttlSec?: number; urgency?: "very-low" | "low" | "normal" | "high" } = {}
): Promise<Record<string, string>> {
  const jwt = await vapidToken(endpoint, subject, publicKeyB64, privateD);
  return {
    authorization: `vapid t=${jwt}, k=${publicKeyB64}`,
    "content-encoding": "aes128gcm",
    "content-type": "application/octet-stream",
    // TTL : combien de temps le service garde le message si l'appareil est
    // hors ligne. Un rappel de rappel n'a plus de sens le lendemain.
    ttl: String(opts.ttlSec ?? 3600),
    urgency: opts.urgency ?? "normal",
  };
}

export interface PushSubscription {
  endpoint: string;
  keys: PushSubscriptionKeys;
}

export interface PushResult {
  ok: boolean;
  status: number;
  /** L'abonnement est mort (404/410) : à supprimer côté serveur. */
  gone: boolean;
  error?: string;
}

/**
 * Envoie une notification. Ne jette jamais : un push raté ne doit pas faire
 * échouer le traitement qui l'a déclenché.
 */
export async function sendPush(
  sub: PushSubscription,
  payload: string,
  vapid: { subject: string; publicKey: string; privateKey: string },
  opts: { ttlSec?: number; urgency?: "very-low" | "low" | "normal" | "high" } = {}
): Promise<PushResult> {
  try {
    const body = await encryptPayload(payload, sub.keys);
    const headers = await pushHeaders(sub.endpoint, vapid.subject, vapid.publicKey, vapid.privateKey, opts);
    const res = await fetch(sub.endpoint, {
      method: "POST",
      headers,
      body: body as BodyInit,
      signal: AbortSignal.timeout(10_000),
    });
    return {
      ok: res.ok,
      status: res.status,
      // 404/410 : l'utilisateur a désinstallé, vidé ses données, ou refusé.
      // Garder l'abonnement ferait échouer tous les envois suivants.
      gone: res.status === 404 || res.status === 410,
      error: res.ok ? undefined : `HTTP ${res.status}`,
    };
  } catch (e) {
    return { ok: false, status: 0, gone: false, error: e instanceof Error ? e.message : "échec réseau" };
  }
}
