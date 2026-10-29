/**
 * ─────────────────────────────────────────────────────────────────────
 * BRANCHER SES IDENTIFIANTS SANS RIEN SAVOIR — la moitié PURE.
 *
 * Décidé le 20/10/2026 : « le moins de friction possible ». Mesuré avant
 * d'écrire : brancher une boîte d'envoi demandait QUATRE champs techniques
 * (serveur, port, identifiant, mot de passe) à quelqu'un qui ne sait pas ce
 * qu'est un SMTP ; brancher l'IA demandait de choisir entre deux champs de clé
 * sans dire lequel correspond à quoi. C'est l'écran où un inscrit abandonne :
 * sans identifiants, ni l'IA ni l'envoi ne s'ouvrent, et le produit gratuit
 * ne mène nulle part.
 *
 * Ce qu'on demande désormais : **une clé collée n'importe où** pour l'IA, et
 * **une adresse + un mot de passe** pour l'envoi. Tout le reste se DÉDUIT.
 *
 * ── CE QUE CE MODULE SAIT, ET CE QU'IL NE CROIT JAMAIS SUR PAROLE ──
 *
 * La table des hébergeurs est écrite de mémoire : aucune de ces adresses n'a
 * été jointe depuis ce conteneur (le proxy sortant ne laisse pas passer le
 * SMTP). Elle ne sert donc qu'à PROPOSER. Ce qui fait foi, c'est `verifierBoite`,
 * qui se connecte ET s'authentifie vraiment avant d'accepter quoi que ce soit —
 * une ligne fausse dans la table produit un refus lisible, jamais une boîte
 * enregistrée à tort.
 *
 * ⚠ On n'invente pas ce qu'on ne sait pas : adresse d'un hébergeur inconnu →
 * `preset-inconnu` et on DEMANDE le serveur. Deviner « smtp.<domaine> » et
 * réussir une fois sur deux, c'est fabriquer des échecs inexplicables.
 * ─────────────────────────────────────────────────────────────────────
 */

// ── NETTOYER CE QU'ON NOUS COLLE ───────────────────────────────────────

/**
 * Une clé collée arrive rarement propre : entre guillemets, avec un saut de
 * ligne, précédée de `export ANTHROPIC_API_KEY=` parce qu'elle vient d'un
 * fichier `.env`, ou d'un espace insécable parce qu'elle vient d'un PDF. Le
 * refus d'une clé juste à cause de ça est de la friction pure.
 */
export function nettoyerSecret(brut: string): string {
  let v = (brut ?? "").replace(/[\u200B-\u200D\uFEFF\u00A0]/g, " ").trim();
  // Un bloc `.env` collé en entier : on prend la ligne d'une clé qu'on connaît.
  const ligne = v.match(/(?:^|\n)\s*(?:export\s+)?(?:ANTHROPIC_API_KEY|NVIDIA_API_KEY)\s*=\s*([^\n]+)/);
  if (ligne) v = ligne[1];
  v = v.replace(/^(?:export\s+)?[A-Z][A-Z0-9_]*\s*=\s*/, "");
  v = v.replace(/^["'`]+|["'`]+$/g, "").trim();
  return v.replace(/\s+/g, "");
}

// ── L'IA : UNE CLÉ, COLLÉE N'IMPORTE OÙ ────────────────────────────────

export type FournisseurIA = "anthropic" | "nvidia" | "openai" | "google" | "groq" | "inconnu";

export interface LectureCleIA {
  fournisseur: FournisseurIA;
  nom: string;
  /** Le champ de `/api/credentials` qui la reçoit, ou `null` si ALPHA ne sait pas s'en servir. */
  champ: "ANTHROPIC_API_KEY" | "NVIDIA_API_KEY" | null;
  /** ALPHA sait-il se servir de cette clé ? */
  branchable: boolean;
  message: string;
  /** Où la trouver, quand on ne l'a pas encore. */
  aide: { url: string; libelle: string } | null;
  /** La valeur nettoyée — c'est CELLE-LÀ qu'on envoie. */
  valeur: string;
}

const AIDE_ANTHROPIC = { url: "https://console.anthropic.com/settings/keys", libelle: "Créer une clé Anthropic" };
const AIDE_NVIDIA = { url: "https://build.nvidia.com/", libelle: "Créer une clé NVIDIA (profil → API keys)" };

/**
 * Reconnaît le fournisseur d'une clé à sa forme, SANS appel réseau.
 *
 * ⚠ ALPHA ne sait se servir que d'Anthropic et de NVIDIA NIM (`lib/ai-engine`).
 * Une clé OpenAI est reconnue — pour DIRE qu'on ne la prend pas, tout de
 * suite — plutôt que d'attendre quinze secondes un refus du fournisseur
 * Anthropic sur une clé qui n'est pas la sienne.
 */
export function lireCleIA(brut: string): LectureCleIA | null {
  const valeur = nettoyerSecret(brut);
  if (!valeur) return null;

  if (valeur.startsWith("sk-ant-")) {
    return { fournisseur: "anthropic", nom: "Anthropic (Claude)", champ: "ANTHROPIC_API_KEY", branchable: true, message: "Clé Anthropic reconnue.", aide: null, valeur };
  }
  if (valeur.startsWith("nvapi-")) {
    return { fournisseur: "nvidia", nom: "NVIDIA NIM", champ: "NVIDIA_API_KEY", branchable: true, message: "Clé NVIDIA reconnue.", aide: null, valeur };
  }
  const refus = (fournisseur: FournisseurIA, nom: string): LectureCleIA => ({
    fournisseur,
    nom,
    champ: null,
    branchable: false,
    message: `C'est une clé ${nom} : ALPHA ne sait pas encore s'en servir. Il lui faut une clé Anthropic (sk-ant-…) ou NVIDIA (nvapi-…).`,
    aide: AIDE_ANTHROPIC,
    valeur,
  });
  if (valeur.startsWith("sk-")) return refus("openai", "OpenAI");
  if (valeur.startsWith("AIza")) return refus("google", "Google (Gemini)");
  if (valeur.startsWith("gsk_")) return refus("groq", "Groq");
  return {
    fournisseur: "inconnu",
    nom: "inconnue",
    champ: null,
    branchable: false,
    message: "Je ne reconnais pas cette clé. Elle devrait commencer par sk-ant- (Anthropic) ou nvapi- (NVIDIA).",
    aide: AIDE_ANTHROPIC,
    valeur,
  };
}

// ── LA BOÎTE D'ENVOI : UNE ADRESSE, UN MOT DE PASSE ────────────────────

export type TypeMotDePasse = "application" | "normal" | "cle-smtp";

export interface EssaiSmtp {
  port: number;
  /** TLS d'emblée (465), sinon STARTTLS. */
  secure: boolean;
}

export interface PresetEmail {
  id: string;
  nom: string;
  host: string;
  /** Les connexions à tenter, DANS L'ORDRE. */
  essais: readonly EssaiSmtp[];
  motDePasse: TypeMotDePasse;
  aide: { url: string; libelle: string } | null;
  /** Ce qui rate souvent chez cet hébergeur — dit AVANT l'essai, pas après. */
  avertissement: string | null;
}

const STARTTLS_587: EssaiSmtp = { port: 587, secure: false };
const TLS_465: EssaiSmtp = { port: 465, secure: true };
const ESSAIS_COURANTS: readonly EssaiSmtp[] = [STARTTLS_587, TLS_465];
const ESSAIS_465_D_ABORD: readonly EssaiSmtp[] = [TLS_465, STARTTLS_587];

const preset = (p: Omit<PresetEmail, "essais" | "aide" | "avertissement"> & Partial<Pick<PresetEmail, "essais" | "aide" | "avertissement">>): PresetEmail => ({
  essais: ESSAIS_COURANTS,
  aide: null,
  avertissement: null,
  ...p,
});

export const PRESETS_EMAIL: readonly PresetEmail[] = [
  preset({
    id: "gmail", nom: "Gmail / Google Workspace", host: "smtp.gmail.com", motDePasse: "application",
    aide: { url: "https://myaccount.google.com/apppasswords", libelle: "Créer un mot de passe d'application (30 secondes)" },
    avertissement: "Google refuse ton mot de passe habituel : il faut un mot de passe d'application, qui exige la validation en deux étapes.",
  }),
  preset({
    id: "outlook", nom: "Outlook / Hotmail", host: "smtp-mail.outlook.com", motDePasse: "application",
    aide: { url: "https://account.microsoft.com/security", libelle: "Créer un mot de passe d'application (sécurité du compte)" },
    avertissement: "Un compte Microsoft personnel demande souvent un mot de passe d'application. Un Microsoft 365 d'entreprise bloque fréquemment l'envoi par SMTP : si ça échoue, prends un SMTP dédié.",
  }),
  preset({
    id: "microsoft365", nom: "Microsoft 365", host: "smtp.office365.com", essais: [STARTTLS_587], motDePasse: "normal",
    avertissement: "L'envoi par SMTP est souvent désactivé par l'administrateur de ton Microsoft 365. Si l'essai échoue, demande-le-lui ou prends un SMTP dédié.",
  }),
  preset({
    id: "icloud", nom: "iCloud", host: "smtp.mail.me.com", essais: [STARTTLS_587], motDePasse: "application",
    aide: { url: "https://account.apple.com/account/manage", libelle: "Créer un mot de passe pour app (Connexion et sécurité)" },
  }),
  preset({
    id: "yahoo", nom: "Yahoo", host: "smtp.mail.yahoo.com", essais: ESSAIS_465_D_ABORD, motDePasse: "application",
    aide: { url: "https://login.yahoo.com/account/security", libelle: "Créer un mot de passe d'application" },
  }),
  preset({ id: "orange", nom: "Orange", host: "smtp.orange.fr", essais: ESSAIS_465_D_ABORD, motDePasse: "normal" }),
  preset({
    id: "free", nom: "Free", host: "smtp.free.fr", essais: ESSAIS_465_D_ABORD, motDePasse: "normal",
    avertissement: "Free demande d'activer l'envoi SMTP dans les options de ta messagerie.",
  }),
  preset({ id: "sfr", nom: "SFR", host: "smtp.sfr.fr", essais: ESSAIS_465_D_ABORD, motDePasse: "normal" }),
  preset({ id: "laposte", nom: "La Poste", host: "smtp.laposte.net", essais: ESSAIS_465_D_ABORD, motDePasse: "normal" }),
  preset({ id: "ovh", nom: "OVH", host: "ssl0.ovh.net", essais: ESSAIS_465_D_ABORD, motDePasse: "normal" }),
  preset({ id: "ionos", nom: "IONOS", host: "smtp.ionos.fr", essais: [STARTTLS_587], motDePasse: "normal" }),
  preset({ id: "gandi", nom: "Gandi", host: "mail.gandi.net", essais: ESSAIS_COURANTS, motDePasse: "normal" }),
  preset({ id: "zoho", nom: "Zoho Mail", host: "smtp.zoho.eu", essais: ESSAIS_465_D_ABORD, motDePasse: "normal",
    avertissement: "Zoho a un serveur par région : si l'essai échoue, ton compte est peut-être en .com et non en .eu." }),
  preset({ id: "infomaniak", nom: "Infomaniak", host: "mail.infomaniak.com", essais: [STARTTLS_587], motDePasse: "normal" }),
  preset({
    id: "brevo", nom: "Brevo (SMTP dédié)", host: "smtp-relay.brevo.com", essais: [STARTTLS_587], motDePasse: "cle-smtp",
    aide: { url: "https://app.brevo.com/settings/keys/smtp", libelle: "Copier ta clé SMTP Brevo" },
    avertissement: "L'identifiant est celui de ton compte Brevo, le mot de passe est la CLÉ SMTP — pas celui de ton compte.",
  }),
];

/**
 * ─────────────────────────────────────────────────────────────────────
 * LE SERVEUR DE LECTURE (IMAP) DE CHAQUE HÉBERGEUR, PAR SON SERVEUR D'ENVOI
 * (29/10/2026) — pour lire les réponses des prospects (`lib/imap-lecture.ts`).
 *
 * ⚠⚠ MÊME STATUT QUE LA TABLE SMTP : ÉCRITE DE MÉMOIRE, ELLE NE FAIT JAMAIS
 * FOI. C'est la vraie connexion qui tranche ; une ligne fausse donne un refus
 * lisible, jamais une lecture vide qui passerait pour « personne n'a répondu ».
 * · Un hébergeur absent ⇒ `null` : on DEMANDE le serveur, on ne devine pas
 *   « imap.<domaine> » (même règle que pour l'envoi).
 * · `null` aussi pour un relais d'envoi pur (Brevo) : il n'a pas de boîte.
 * · Microsoft (Outlook, 365) est listé, mais il refuse la lecture par mot de
 *   passe depuis la fin de l'authentification de base : la route le DIT.
 * ─────────────────────────────────────────────────────────────────────
 */
const IMAP_PAR_SMTP: Readonly<Record<string, string | null>> = {
  "smtp.gmail.com": "imap.gmail.com",
  "smtp-mail.outlook.com": "outlook.office365.com",
  "smtp.office365.com": "outlook.office365.com",
  "smtp.mail.me.com": "imap.mail.me.com",
  "smtp.mail.yahoo.com": "imap.mail.yahoo.com",
  "smtp.orange.fr": "imap.orange.fr",
  "smtp.free.fr": "imap.free.fr",
  "smtp.sfr.fr": "imap.sfr.fr",
  "smtp.laposte.net": "imap.laposte.net",
  "ssl0.ovh.net": "ssl0.ovh.net",
  "smtp.ionos.fr": "imap.ionos.fr",
  "mail.gandi.net": "mail.gandi.net",
  "smtp.zoho.eu": "imap.zoho.eu",
  "mail.infomaniak.com": "mail.infomaniak.com",
  "smtp-relay.brevo.com": null,
};

/** Le serveur IMAP d'un serveur SMTP connu, ou `null` (inconnu, ou pas de boîte). */
export function imapPourSmtp(smtpHost: string): string | null {
  return IMAP_PAR_SMTP[smtpHost.trim().toLowerCase()] ?? null;
}

/** Les hébergeurs dont la lecture par mot de passe est fermée (on le dit avant de lire). */
export const LECTURE_FERMEE_PAR_MOT_DE_PASSE: readonly string[] = ["outlook.office365.com"];

/**
 * Un serveur IMAP SAISI par l'inscrit est-il acceptable ? Seulement s'il est
 * du même domaine que son serveur d'envoi : la route lui transmet SON mot de
 * passe, et un champ libre en ferait un moyen d'envoyer ce mot de passe à
 * n'importe quel serveur (le sien d'abord, celui d'un tiers ensuite).
 */
export function imapSaisiAcceptable(imapHost: string, smtpHost: string): boolean {
  const norme = (h: string) => h.trim().toLowerCase();
  const i = norme(imapHost);
  const s = norme(smtpHost);
  if (!/^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(i)) return false;
  const racine = (h: string) => h.split(".").slice(-2).join(".");
  return racine(i) === racine(s);
}

export const presetParId = (id: string | null | undefined): PresetEmail | null =>
  PRESETS_EMAIL.find((p) => p.id === id) ?? null;

/** Domaines d'adresse → hébergeur. Sert quand l'adresse est chez un grand fournisseur. */
const DOMAINES: Record<string, string> = {
  "gmail.com": "gmail", "googlemail.com": "gmail",
  "outlook.com": "outlook", "outlook.fr": "outlook", "hotmail.com": "outlook", "hotmail.fr": "outlook",
  "live.com": "outlook", "live.fr": "outlook", "msn.com": "outlook",
  "icloud.com": "icloud", "me.com": "icloud", "mac.com": "icloud",
  "yahoo.com": "yahoo", "yahoo.fr": "yahoo", "ymail.com": "yahoo",
  "orange.fr": "orange", "wanadoo.fr": "orange",
  "free.fr": "free", "sfr.fr": "sfr", "neuf.fr": "sfr", "laposte.net": "laposte",
  "zoho.com": "zoho", "zoho.eu": "zoho",
};

const ADRESSE = /^[^\s@]+@([a-z0-9-]+(?:\.[a-z0-9-]+)+)$/i;

/** Le domaine d'une adresse, ou `null` si ce n'est pas une adresse. */
export function domaineDe(adresse: string): string | null {
  const m = (adresse ?? "").trim().match(ADRESSE);
  return m ? m[1].toLowerCase() : null;
}

export const adresseValide = (adresse: string): boolean => domaineDe(adresse) !== null;

/** L'hébergeur d'après l'ADRESSE seule — sans réseau. */
export function presetPourAdresse(adresse: string): PresetEmail | null {
  const d = domaineDe(adresse);
  return d ? presetParId(DOMAINES[d]) : null;
}

/**
 * L'hébergeur d'après les enregistrements MX d'un domaine PERSONNEL.
 *
 * `contact@monentreprise.fr` ne dit rien tout seul — c'est le MX qui dit que la
 * boîte est chez Google, chez OVH ou ailleurs. Les motifs visent des
 * SUFFIXES de noms d'hôtes, jamais un « contient » : `mx.ovh.net.evil.test`
 * n'est pas OVH.
 */
const MOTIFS_MX: readonly { id: string; motif: RegExp }[] = [
  { id: "gmail", motif: /(?:^|\.)(?:google\.com|googlemail\.com)$/ },
  { id: "microsoft365", motif: /(?:^|\.)mail\.protection\.outlook\.com$/ },
  { id: "ovh", motif: /(?:^|\.)(?:mail\.ovh\.net|ovh\.net)$/ },
  { id: "ionos", motif: /(?:^|\.)(?:ionos\.fr|ionos\.com|kundenserver\.de|1and1\.com)$/ },
  { id: "gandi", motif: /(?:^|\.)mail\.gandi\.net$/ },
  { id: "zoho", motif: /(?:^|\.)zoho\.(?:eu|com)$/ },
  { id: "infomaniak", motif: /(?:^|\.)infomaniak\.ch$/ },
];

export function presetPourMx(hotes: readonly string[]): PresetEmail | null {
  for (const h of hotes) {
    const nom = h.trim().toLowerCase().replace(/\.$/, "");
    const trouve = MOTIFS_MX.find((m) => m.motif.test(nom));
    if (trouve) return presetParId(trouve.id);
  }
  return null;
}

// ── VÉRIFIER LA BOÎTE : SE CONNECTER VRAIMENT ──────────────────────────

export type ClasseEchecSmtp = "auth" | "connexion" | "preset-inconnu" | "adresse";

export interface ConseilSmtp {
  classe: ClasseEchecSmtp;
  /** Ce que l'inscrit doit FAIRE — jamais le message brut du serveur seul. */
  conseil: string;
  aide: { url: string; libelle: string } | null;
}

/**
 * Range une erreur de transport dans une classe qui dit quoi faire.
 *
 * ⚠ La distinction qui compte : un refus d'AUTHENTIFICATION prouve que le
 * serveur est JOINT (inutile d'essayer un autre port), alors qu'un échec de
 * CONNEXION laisse tout ouvert. Les confondre fait soit abandonner trop tôt
 * (on conclut « port fermé » alors que le mot de passe est faux), soit
 * marteler un serveur qui nous a déjà dit non.
 */
export function classerErreurSmtp(erreur: unknown): "auth" | "connexion" {
  const e = erreur as { code?: string; responseCode?: number; message?: string } | null;
  const code = String(e?.code ?? "");
  const msg = String(e?.message ?? erreur ?? "");
  if (code === "EAUTH" || e?.responseCode === 535 || e?.responseCode === 534 || /invalid login|authentication|username and password not accepted|application-specific password/i.test(msg)) {
    return "auth";
  }
  return "connexion";
}

export function conseilSmtp(classe: ClasseEchecSmtp, p: PresetEmail | null, detail: { host?: string; essais?: readonly EssaiSmtp[] } = {}): ConseilSmtp {
  switch (classe) {
    case "adresse":
      return { classe, conseil: "Cette adresse n'a pas la forme d'une adresse email (prenom@domaine.fr).", aide: null };
    case "preset-inconnu":
      return {
        classe,
        conseil:
          "Je ne reconnais pas l'hébergeur de cette adresse. Renseigne le serveur d'envoi (cherche « SMTP » dans l'aide de ton hébergeur mail), ou prends un SMTP dédié — Brevo en propose un gratuit.",
        aide: presetParId("brevo")?.aide ?? null,
      };
    case "auth":
      if (p?.motDePasse === "application") {
        return { classe, conseil: `${p.nom} refuse ce mot de passe : il faut un mot de passe d'APPLICATION, pas celui avec lequel tu ouvres ta messagerie.`, aide: p.aide };
      }
      if (p?.motDePasse === "cle-smtp") {
        return { classe, conseil: `${p.nom} refuse ces identifiants : le mot de passe est la CLÉ SMTP, et l'identifiant celui de ton compte.`, aide: p.aide };
      }
      return { classe, conseil: `${p?.nom ?? "Le serveur"} refuse l'identifiant ou le mot de passe. Vérifie-les — et que l'envoi par SMTP est activé sur ta boîte.`, aide: p?.aide ?? null };
    case "connexion": {
      const ports = (detail.essais ?? []).map((e) => e.port).join(" puis ");
      return {
        classe,
        conseil: `Je n'arrive pas à joindre ${detail.host ?? "le serveur"}${ports ? ` (ports essayés : ${ports})` : ""}. Vérifie le nom du serveur, ou que ton hébergeur autorise l'envoi SMTP depuis l'extérieur.`,
        aide: null,
      };
    }
  }
}

export interface TransportSmtp {
  verify(): Promise<unknown>;
}

export interface DepsSmtp {
  /** Ouvre un transport vers un serveur — nodemailer en production, un faux en test. */
  creer(o: { host: string; port: number; secure: boolean; user: string; pass: string }): TransportSmtp;
  /** Les hôtes MX d'un domaine. Absent = pas de recherche DNS. */
  resoudreMx?: (domaine: string) => Promise<string[]>;
}

export interface DemandeBoite {
  adresse: string;
  motDePasse: string;
  /** Renseignés à la main seulement quand l'hébergeur n'est pas reconnu. */
  host?: string;
  port?: number;
  /** L'identifiant, quand ce n'est pas l'adresse. */
  identifiant?: string;
}

export interface ReglagesBoite {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  /** L'adresse d'expédition — celle de la boîte. */
  from: string;
  presetId: string | null;
  /** Combien de connexions ont été nécessaires. */
  essais: number;
}

export type ResultatBoite = ({ ok: true } & { reglages: ReglagesBoite }) | ({ ok: false } & ConseilSmtp & { detail: string });

/**
 * Trouve les bons réglages ET le prouve, en une seule opération.
 *
 * Ordre : adresse valide → hébergeur (adresse, puis MX) → connexion et
 * AUTHENTIFICATION réelles, port par port. Rien n'est « accepté » parce que la
 * table le dit : `ok: true` signifie qu'une connexion authentifiée a eu lieu.
 */
export async function verifierBoite(d: DemandeBoite, deps: DepsSmtp): Promise<ResultatBoite> {
  const adresse = (d.adresse ?? "").trim();
  const domaine = domaineDe(adresse);
  if (!domaine) return { ok: false, detail: "adresse invalide", ...conseilSmtp("adresse", null) };

  const user = (d.identifiant ?? "").trim() || adresse;
  const pass = d.motDePasse ?? "";

  let p: PresetEmail | null = null;
  let host = (d.host ?? "").trim();
  let essais: readonly EssaiSmtp[];

  if (host) {
    // Réglage manuel : on respecte le port demandé, sinon on essaie les deux usuels.
    essais = d.port ? [{ port: d.port, secure: d.port === 465 }] : ESSAIS_COURANTS;
  } else {
    p = presetPourAdresse(adresse);
    if (!p && deps.resoudreMx) {
      try {
        p = presetPourMx(await deps.resoudreMx(domaine));
      } catch {
        p = null; // un DNS muet n'est pas une erreur de l'inscrit : on demande le serveur
      }
    }
    if (!p) return { ok: false, detail: "hébergeur non reconnu", ...conseilSmtp("preset-inconnu", null) };
    host = p.host;
    essais = p.essais;
  }

  let dernier = "";
  let tentes = 0;
  for (const e of essais) {
    tentes++;
    try {
      await deps.creer({ host, port: e.port, secure: e.secure, user, pass }).verify();
      return { ok: true, reglages: { host, port: e.port, secure: e.secure, user, from: adresse, presetId: p?.id ?? null, essais: tentes } };
    } catch (err) {
      dernier = err instanceof Error ? err.message : String(err);
      // Le serveur nous a répondu et a dit non : un autre port n'y changera rien.
      if (classerErreurSmtp(err) === "auth") {
        return { ok: false, detail: dernier, ...conseilSmtp("auth", p) };
      }
    }
  }
  return { ok: false, detail: dernier, ...conseilSmtp("connexion", p, { host, essais }) };
}
