import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import type { Portee } from "./api-keys";

/**
 * ─────────────────────────────────────────────────────────────────────
 * LE SERVEUR D'AUTORISATION OAUTH 2.1 DU SERVEUR MCP — fait main.
 *
 * Décidé le 29/09/2026. Attio se branche sur Claude en un clic parce que son
 * MCP parle OAuth ; le nôtre exigeait un Bearer statique, que claude.ai et
 * Cowork n'acceptent qu'en bêta, pour peu d'organisations (vérifié dans la doc
 * officielle des connecteurs, et sur le compte de Zakaria : pas de « Request
 * headers »). Alpha n'était donc branchable nulle part — une brique à 0 de
 * valeur tant que personne ne peut s'y connecter.
 *
 * ── POURQUOI PAS LE SERVEUR OAUTH DE SUPABASE ──
 *
 * Il serait la voie naturelle (on l'utilise déjà pour les comptes), mais
 * `supabase/auth#2820` (ouvert) le fait répondre 400 à un client public, à
 * `offline_access` et au paramètre `resource` : les trois choses qu'envoie un
 * client MCP. On ne bâtit pas la porte d'entrée sur un bug ouvert chez un tiers.
 * La CONNEXION reste celle de Supabase ; seul le protocole OAuth est ici.
 *
 * ── CE QUE CE MODULE GARANTIT, ET POURQUOI C'EST SÛR ──
 *
 *  · Un jeton OAuth ne donne QUE les portées du « cerveau » — lecture +
 *    proposition (`PORTEES_OAUTH`). Jamais `prospects.write`, jamais un envoi :
 *    l'invariant « le MCP ne peut rien casser » survit au changement d'auth.
 *  · Seul un compte MAÎTRE (OWNER_EMAILS) peut autoriser, et c'est REVÉRIFIÉ à
 *    chaque appel : retirer une adresse de OWNER_EMAILS coupe l'accès au
 *    prochain appel, sans attendre l'expiration. Les routes /api/v1 lisent le
 *    pipe de l'OPÉRATEUR ; un client non maître n'a encore rien à y lire.
 *  · Les redirections sont limitées à CLAUDE (claude.ai / claude.com, et le
 *    retour local de Claude Code). Un client enregistré par un inconnu ne peut
 *    pas faire atterrir un code d'autorisation chez lui.
 *  · PKCE S256 OBLIGATOIRE. `plain` est refusé.
 *
 * ── SANS BASE DE DONNÉES, ET CE QUE ÇA COÛTE (écrit plutôt que tu) ──
 *
 * Tout est SIGNÉ (HMAC-SHA256), rien n'est stocké : identifiant de client,
 * code, jetons. Aucune migration, aucune table — ça marche dès le déploiement.
 * Le prix :
 *  · Un code d'autorisation n'est pas révocable côté serveur : il vit 60 s,
 *    il est lié au vérificateur PKCE (inutile sans lui), et un cache mémoire
 *    refuse sa réutilisation sur la même instance. OAuth 2.1 veut un usage
 *    UNIQUE strict : entre deux instances serverless, ce n'est pas garanti.
 *  · Un refresh token n'est pas révocable individuellement. Les coupe-circuits
 *    sont : retirer l'email de OWNER_EMAILS (effet immédiat), ou faire tourner
 *    `OAUTH_SECRET` (tous les jetons meurent d'un coup).
 * ─────────────────────────────────────────────────────────────────────
 */

/** Ce qu'un jeton OAuth autorise : le « cerveau », lecture + proposition. */
export const PORTEES_OAUTH: readonly Portee[] = ["etat.read", "campagne.read", "propositions.read", "propositions.write"];

/** Le seul scope annoncé. Il ne se découpe pas : les portées sont fixées ici. */
export const SCOPE_OAUTH = "alpha";

// Préfixes distincts par type de jeton : un code ne passe pas pour un jeton
// d'accès, un refresh ne passe pas pour un identifiant de client. Le préfixe
// est SIGNÉ avec le contenu, donc il ne se change pas après coup.
export const PREFIXE_ACCES = "amo_";
const PREFIXE_REFRESH = "amr_";
const PREFIXE_CODE = "amk_";
const PREFIXE_CLIENT = "amc_";

export const DUREE_CODE_S = 60;
export const DUREE_ACCES_S = 3600;
export const DUREE_REFRESH_S = 30 * 86400;

// ─────────────────────────────── secret ───────────────────────────────

/**
 * Le secret de signature. `OAUTH_SECRET` s'il est posé (≥ 32 caractères) ;
 * sinon DÉRIVÉ de `SUPABASE_JWT_SECRET` avec une étiquette propre à cet usage.
 *
 * La dérivation évite qu'une variable de plus soit une condition pour que ça
 * marche — une correction qui exige une action humaine est une ligne de
 * checklist de plus. L'étiquette sépare les domaines : un jeton Supabase ne
 * vérifie jamais comme un jeton OAuth Alpha, et inversement.
 * `null` = ni l'un ni l'autre : OAuth reste FERMÉ.
 */
export function secretOAuth(env: Record<string, string | undefined> = process.env): string | null {
  const direct = env.OAUTH_SECRET?.trim();
  if (direct && direct.length >= 32) return direct;
  const base = env.SUPABASE_JWT_SECRET?.trim();
  if (!base) return null;
  return createHmac("sha256", base).update("alpha-mcp-oauth-v1").digest("base64url");
}

// ─────────────────────────────── signature ───────────────────────────────

const b64u = (s: string) => Buffer.from(s, "utf8").toString("base64url");
const mac = (secret: string, donnee: string) => createHmac("sha256", secret).update(donnee).digest("base64url");

function egalConstant(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

function signer(prefixe: string, contenu: object, secret: string): string {
  const corps = b64u(JSON.stringify(contenu));
  return `${prefixe}${corps}.${mac(secret, prefixe + corps)}`;
}

function lireSigne<T>(prefixe: string, jeton: string, secret: string): T | null {
  if (typeof jeton !== "string" || !jeton.startsWith(prefixe) || jeton.length > 4096) return null;
  const reste = jeton.slice(prefixe.length);
  const point = reste.lastIndexOf(".");
  if (point <= 0) return null;
  const corps = reste.slice(0, point);
  const sig = reste.slice(point + 1);
  if (!egalConstant(sig, mac(secret, prefixe + corps))) return null;
  try {
    const v: unknown = JSON.parse(Buffer.from(corps, "base64url").toString("utf8"));
    return v && typeof v === "object" ? (v as T) : null;
  } catch {
    return null;
  }
}

const sec = (d: Date) => Math.floor(d.getTime() / 1000);

// ─────────────────────────────── redirections ───────────────────────────────

/**
 * Une adresse de retour est-elle celle de CLAUDE ?
 *
 * Liste FERMÉE, par décision : les applications hébergées (claude.ai, Desktop,
 * mobile, Cowork) reviennent sur `/api/mcp/auth_callback` ; Claude Code revient
 * sur une boucle locale, port variable (RFC 8252). Tout le reste est refusé —
 * y compris d'autres clients MCP légitimes : les ouvrir se DÉCIDE, ça ne se
 * fait pas par omission.
 */
export function redirectAutorise(uri: string): boolean {
  let u: URL;
  try {
    u = new URL(uri);
  } catch {
    return false;
  }
  if (u.hash || u.search || u.username || u.password) return false;
  if (u.protocol === "https:" && (u.host === "claude.ai" || u.host === "claude.com")) {
    return u.pathname === "/api/mcp/auth_callback";
  }
  if (u.protocol === "http:" && (u.hostname === "localhost" || u.hostname === "127.0.0.1")) {
    return u.pathname === "/callback";
  }
  return false;
}

/**
 * La demande vise-t-elle une adresse ENREGISTRÉE ? Égalité stricte, sauf pour
 * la boucle locale de Claude Code : son port change à chaque session (RFC 8252
 * §7.3), donc on compare tout SAUF le port.
 */
function memeRetour(enregistre: string, demande: string): boolean {
  if (enregistre === demande) return true;
  if (!estBoucleLocale(enregistre) || !estBoucleLocale(demande) || !redirectAutorise(demande)) return false;
  const a = new URL(enregistre);
  const b = new URL(demande);
  return a.protocol === b.protocol && a.hostname === b.hostname && a.pathname === b.pathname;
}

/** Une adresse de retour locale — le consentement doit l'afficher en alerte. */
export function estBoucleLocale(uri: string): boolean {
  try {
    const h = new URL(uri).hostname;
    return h === "localhost" || h === "127.0.0.1";
  } catch {
    return false;
  }
}

// ─────────────────────────────── métadonnées ───────────────────────────────

/** RFC 9728 — ce que lit Claude pour trouver le serveur d'autorisation. */
export function metadonneesRessource(origine: string) {
  return {
    // DOIT être exactement l'URL que l'utilisateur saisit dans Claude.
    resource: `${origine}/api/mcp`,
    authorization_servers: [origine],
    scopes_supported: [SCOPE_OAUTH],
    bearer_methods_supported: ["header"],
    resource_name: "Alpha Sales OS",
  };
}

/** RFC 8414 — le serveur d'autorisation lui-même. */
export function metadonneesServeur(origine: string) {
  return {
    issuer: origine,
    authorization_endpoint: `${origine}/oauth/authorize`,
    token_endpoint: `${origine}/api/oauth/token`,
    registration_endpoint: `${origine}/api/oauth/register`,
    response_types_supported: ["code"],
    grant_types_supported: ["authorization_code", "refresh_token"],
    code_challenge_methods_supported: ["S256"],
    // Client PUBLIC (DCR) : pas de secret, c'est PKCE qui protège l'échange.
    token_endpoint_auth_methods_supported: ["none"],
    scopes_supported: [SCOPE_OAUTH],
    // `offline_access` n'est volontairement PAS annoncé : le refresh est donné
    // d'office, et l'annoncer ferait ajouter un scope qu'on ignore.
  };
}

/** L'en-tête du 401 : sans lui, Claude ne démarre jamais la connexion. */
export function defiBearer(origine: string, jetonFourni: boolean): string {
  const base = `Bearer resource_metadata="${origine}/.well-known/oauth-protected-resource"`;
  return jetonFourni ? `${base}, error="invalid_token"` : base;
}

// ─────────────────────────────── erreurs ───────────────────────────────

export type ErreurOAuth =
  | "invalid_request"
  | "invalid_client"
  | "invalid_grant"
  | "unsupported_grant_type"
  | "unsupported_response_type"
  | "invalid_redirect_uri"
  | "invalid_client_metadata"
  | "access_denied";

export type Resultat<T> = { ok: true; valeur: T } | { ok: false; erreur: ErreurOAuth; description: string };

const echec = (erreur: ErreurOAuth, description: string) => ({ ok: false as const, erreur, description });

// ─────────────────────────────── enregistrement (DCR) ───────────────────────────────

interface ClientSigne {
  typ: "client";
  r: string[];
  n: string;
  iat: number;
}

export interface ReponseEnregistrement {
  client_id: string;
  client_id_issued_at: number;
  client_name: string;
  redirect_uris: string[];
  token_endpoint_auth_method: "none";
  grant_types: string[];
  response_types: string[];
}

/**
 * RFC 7591. L'identifiant rendu CONTIENT les adresses de retour, signées :
 * on n'a rien à stocker, et personne ne peut les modifier après coup.
 */
export function enregistrerClient(corps: unknown, secret: string, maintenant: Date): Resultat<ReponseEnregistrement> {
  if (!corps || typeof corps !== "object") return echec("invalid_client_metadata", "Corps JSON attendu.");
  const c = corps as Record<string, unknown>;

  const uris = c.redirect_uris;
  if (!Array.isArray(uris) || uris.length === 0 || uris.length > 5 || !uris.every((u) => typeof u === "string")) {
    return echec("invalid_redirect_uri", "redirect_uris : 1 à 5 adresses attendues.");
  }
  const refusees = (uris as string[]).filter((u) => !redirectAutorise(u));
  if (refusees.length > 0) {
    return echec(
      "invalid_redirect_uri",
      `Adresse(s) de retour refusée(s) : ${refusees.join(", ")}. Seuls les retours de Claude sont acceptés.`,
    );
  }

  const methode = c.token_endpoint_auth_method;
  if (methode !== undefined && methode !== "none") {
    return echec("invalid_client_metadata", "Seuls les clients publics (token_endpoint_auth_method=none, PKCE) sont acceptés.");
  }
  const types = c.grant_types;
  if (types !== undefined) {
    const permis = ["authorization_code", "refresh_token"];
    if (!Array.isArray(types) || !types.every((t) => typeof t === "string" && permis.includes(t))) {
      return echec("invalid_client_metadata", "grant_types : authorization_code et refresh_token seulement.");
    }
  }

  const nomBrut = typeof c.client_name === "string" ? c.client_name.trim() : "";
  const nom = (nomBrut || "Client MCP").slice(0, 80);
  const iat = sec(maintenant);
  const signe: ClientSigne = { typ: "client", r: uris as string[], n: nom, iat };

  return {
    ok: true,
    valeur: {
      client_id: signer(PREFIXE_CLIENT, signe, secret),
      client_id_issued_at: iat,
      client_name: nom,
      redirect_uris: uris as string[],
      token_endpoint_auth_method: "none",
      grant_types: ["authorization_code", "refresh_token"],
      response_types: ["code"],
    },
  };
}

function lireClient(clientId: string, secret: string): ClientSigne | null {
  const c = lireSigne<ClientSigne>(PREFIXE_CLIENT, clientId, secret);
  if (!c || c.typ !== "client" || !Array.isArray(c.r) || typeof c.n !== "string") return null;
  // Revérifié ici aussi : si la liste fermée se resserre, un ancien client ne
  // garde pas un retour qu'on n'accepte plus.
  if (!c.r.every((u) => typeof u === "string" && redirectAutorise(u))) return null;
  return c;
}

// ─────────────────────────────── demande d'autorisation ───────────────────────────────

export interface DemandeValide {
  client_id: string;
  client_name: string;
  redirect_uri: string;
  code_challenge: string;
  state: string | null;
  resource: string | null;
}

/**
 * Valide `/oauth/authorize`.
 *
 * ⚠ Deux sortes d'échec, et la différence est de sécurité : tant que le client
 * et l'adresse de retour ne sont pas VÉRIFIÉS, on n'y redirige RIEN — l'erreur
 * s'affiche sur notre page (`redirigeable: false`). Rediriger une erreur vers
 * une adresse non vérifiée ferait de nous une redirection ouverte.
 */
export function validerDemande(
  p: Record<string, string | undefined>,
  secret: string,
): { ok: true; demande: DemandeValide } | { ok: false; erreur: ErreurOAuth; description: string; redirigeable: false } | { ok: false; erreur: ErreurOAuth; description: string; redirigeable: true; redirect_uri: string; state: string | null } {
  const client = p.client_id ? lireClient(p.client_id, secret) : null;
  if (!client) return { ok: false, erreur: "invalid_client", description: "Client inconnu ou altéré.", redirigeable: false };

  let redirect = p.redirect_uri;
  if (!redirect && client.r.length === 1) redirect = client.r[0];
  if (!redirect || !client.r.some((r) => memeRetour(r, redirect as string))) {
    return { ok: false, erreur: "invalid_request", description: "Adresse de retour non enregistrée pour ce client.", redirigeable: false };
  }

  const state = typeof p.state === "string" && p.state.length > 0 ? p.state.slice(0, 512) : null;
  const renvoyer = (erreur: ErreurOAuth, description: string) =>
    ({ ok: false as const, erreur, description, redirigeable: true as const, redirect_uri: redirect as string, state });

  if (p.response_type !== "code") return renvoyer("unsupported_response_type", "response_type=code attendu.");
  if (p.code_challenge_method !== "S256") return renvoyer("invalid_request", "PKCE S256 obligatoire (plain refusé).");
  const cc = p.code_challenge ?? "";
  if (!/^[A-Za-z0-9_-]{43,128}$/.test(cc)) return renvoyer("invalid_request", "code_challenge absent ou mal formé.");

  let resource: string | null = null;
  if (p.resource) {
    try {
      const r = new URL(p.resource);
      if (r.protocol !== "https:" && r.protocol !== "http:") throw new Error("protocole");
      resource = r.toString();
    } catch {
      return renvoyer("invalid_request", "Paramètre resource invalide.");
    }
  }

  return {
    ok: true,
    demande: { client_id: p.client_id as string, client_name: client.n, redirect_uri: redirect, code_challenge: cc, state, resource },
  };
}

/** L'URL de retour, code ou erreur, `state` toujours recopié. */
export function urlDeRetour(redirect: string, params: Record<string, string | null>): string {
  const u = new URL(redirect);
  for (const [k, v] of Object.entries(params)) if (v !== null) u.searchParams.set(k, v);
  return u.toString();
}

// ─────────────────────────────── code d'autorisation ───────────────────────────────

interface CodeSigne {
  typ: "code";
  cid: string;
  r: string;
  cc: string;
  e: string;
  exp: number;
  res: string | null;
  nonce: string;
}

export function emettreCode(d: DemandeValide, email: string, secret: string, maintenant: Date): string {
  const code: CodeSigne = {
    typ: "code",
    cid: d.client_id,
    r: d.redirect_uri,
    cc: d.code_challenge,
    e: email.trim().toLowerCase(),
    exp: sec(maintenant) + DUREE_CODE_S,
    res: d.resource,
    nonce: randomBytes(12).toString("base64url"),
  };
  return signer(PREFIXE_CODE, code, secret);
}

/**
 * Refus de réutilisation d'un code, par instance. Borné en taille : un cache
 * qui grossit sans fin est une fuite mémoire qu'on offre au premier curieux.
 */
export class CodesUtilises {
  private vus = new Map<string, number>();
  constructor(private readonly max = 5000) {}
  /** `true` si le code vient d'être consommé ; `false` s'il l'avait déjà été. */
  consommer(nonce: string, expiration: number, maintenantS: number): boolean {
    for (const [k, exp] of this.vus) if (exp < maintenantS) this.vus.delete(k);
    if (this.vus.has(nonce)) return false;
    if (this.vus.size >= this.max) {
      const plusVieux = this.vus.keys().next().value;
      if (plusVieux !== undefined) this.vus.delete(plusVieux);
    }
    this.vus.set(nonce, expiration);
    return true;
  }
}

// ─────────────────────────────── jetons ───────────────────────────────

interface AccesSigne {
  typ: "acces";
  e: string;
  cid: string;
  exp: number;
  aud: string | null;
}

interface RefreshSigne {
  typ: "refresh";
  e: string;
  cid: string;
  exp: number;
  aud: string | null;
  nonce: string;
}

export interface ReponseJetons {
  access_token: string;
  token_type: "Bearer";
  expires_in: number;
  refresh_token: string;
  scope: string;
}

function emettreJetons(email: string, cid: string, aud: string | null, secret: string, maintenant: Date): ReponseJetons {
  const t = sec(maintenant);
  return {
    access_token: signer(PREFIXE_ACCES, { typ: "acces", e: email, cid, exp: t + DUREE_ACCES_S, aud } satisfies AccesSigne, secret),
    token_type: "Bearer",
    expires_in: DUREE_ACCES_S,
    // Rotation : chaque refresh rend un NOUVEAU refresh (exigé pour un client
    // public). L'ancien n'est pas révoqué — voir l'en-tête du module.
    refresh_token: signer(
      PREFIXE_REFRESH,
      { typ: "refresh", e: email, cid, exp: t + DUREE_REFRESH_S, aud, nonce: randomBytes(12).toString("base64url") } satisfies RefreshSigne,
      secret,
    ),
    scope: SCOPE_OAUTH,
  };
}

const s256 = (verifier: string) => createHash("sha256").update(verifier).digest("base64url");

/**
 * `/token`. `estMaitre` est INJECTÉ : c'est la règle du compte, elle ne se
 * recopie pas ici.
 */
export function echangerJeton(
  f: Record<string, string | undefined>,
  deps: { secret: string; maintenant: Date; estMaitre: (email: string) => boolean; codes: CodesUtilises },
): Resultat<ReponseJetons> {
  const { secret, maintenant, estMaitre, codes } = deps;

  if (f.grant_type === "authorization_code") {
    const code = f.code ? lireSigne<CodeSigne>(PREFIXE_CODE, f.code, secret) : null;
    if (!code || code.typ !== "code") return echec("invalid_grant", "Code inconnu ou altéré.");
    if (code.exp < sec(maintenant)) return echec("invalid_grant", "Code expiré.");
    if (!f.client_id || !egalConstant(f.client_id, code.cid)) return echec("invalid_grant", "Ce code n'a pas été émis pour ce client.");
    if (!lireClient(code.cid, secret)) return echec("invalid_client", "Client inconnu ou altéré.");
    if (f.redirect_uri !== code.r) return echec("invalid_grant", "redirect_uri différente de celle de la demande.");
    const verifier = f.code_verifier ?? "";
    if (!/^[A-Za-z0-9._~-]{43,128}$/.test(verifier)) return echec("invalid_grant", "code_verifier absent ou mal formé.");
    if (!egalConstant(s256(verifier), code.cc)) return echec("invalid_grant", "code_verifier ne correspond pas (PKCE).");
    if (!estMaitre(code.e)) return echec("invalid_grant", "Ce compte n'a plus le droit d'autoriser.");
    // En DERNIER : un échange raté ne doit pas brûler le code.
    if (!codes.consommer(code.nonce, code.exp, sec(maintenant))) return echec("invalid_grant", "Code déjà utilisé.");
    return { ok: true, valeur: emettreJetons(code.e, code.cid, code.res, secret, maintenant) };
  }

  if (f.grant_type === "refresh_token") {
    const r = f.refresh_token ? lireSigne<RefreshSigne>(PREFIXE_REFRESH, f.refresh_token, secret) : null;
    if (!r || r.typ !== "refresh") return echec("invalid_grant", "Refresh token inconnu ou altéré.");
    if (r.exp < sec(maintenant)) return echec("invalid_grant", "Refresh token expiré.");
    if (f.client_id && !egalConstant(f.client_id, r.cid)) return echec("invalid_grant", "Ce refresh token n'appartient pas à ce client.");
    if (!lireClient(r.cid, secret)) return echec("invalid_grant", "Client inconnu ou altéré.");
    if (!estMaitre(r.e)) return echec("invalid_grant", "Ce compte n'a plus le droit d'accéder.");
    return { ok: true, valeur: emettreJetons(r.e, r.cid, r.aud, secret, maintenant) };
  }

  return echec("unsupported_grant_type", "grant_type : authorization_code ou refresh_token.");
}

/** Côté ressource : le jeton d'accès est-il valable, et pour qui ? */
export function verifierJetonAcces(
  jeton: string,
  deps: { secret: string; maintenant: Date; estMaitre: (email: string) => boolean },
): { ok: true; email: string; clientId: string } | { ok: false; raison: string } {
  const a = lireSigne<AccesSigne>(PREFIXE_ACCES, jeton, deps.secret);
  if (!a || a.typ !== "acces" || typeof a.e !== "string") return { ok: false, raison: "Jeton inconnu ou altéré." };
  if (a.exp < sec(deps.maintenant)) return { ok: false, raison: "Jeton expiré." };
  if (!deps.estMaitre(a.e)) return { ok: false, raison: "Ce compte n'a plus accès." };
  return { ok: true, email: a.e, clientId: a.cid };
}
