/**
 * ─────────────────────────────────────────────────────────────────────
 * Délivrabilité — les RÈGLES, séparées de la lecture DNS.
 *
 * Ce module ne parle à personne : on lui donne ce que le résolveur a
 * répondu, il rend le verdict. C'est ce qui le rend testable, et il doit
 * l'être : chacune de ces règles décide si des emails arrivent ou pas, et
 * une règle fausse ne se voit pas — elle se paie en silence, en messages
 * classés que personne ne lira jamais.
 *
 * La lecture DNS elle-même vit dans app/api/deliverability/dns/route.ts.
 * ─────────────────────────────────────────────────────────────────────
 */

export type Level = "ok" | "attention" | "manquant" | "inconnu";

export interface Check {
  id: string;
  label: string;
  level: Level;
  value: string;
  why: string;
  fix?: string;
}

export type Verdict = "bloquant" | "non concluant" | "à durcir" | "bon";

export interface DnsReport {
  domain: string;
  checkedAt: string;
  verdict: Verdict;
  manquants: number;
  attention: number;
  inconnus: number;
  sharedMailbox?: boolean;
  checks: Check[];
}

/** Domaine strict : pas de schéma, pas de chemin, pas d'IP littérale. */
export const DOMAIN_RE = /^(?!-)[A-Za-z0-9-]{1,63}(?<!-)(\.(?!-)[A-Za-z0-9-]{1,63}(?<!-))+$/;

/**
 * Boîtes grand public partagées. Leurs SPF, DKIM et DMARC appartiennent au
 * fournisseur, pas à l'expéditeur : les lire et annoncer « tout est bon »
 * serait un contresens — on ne peut RIEN y publier, et l'ancienneté d'un
 * compte personnel ne transfère aucune réputation à de la prospection.
 */
export const SHARED_MAILBOX = new Set([
  "gmail.com", "googlemail.com", "outlook.com", "outlook.fr", "hotmail.com", "hotmail.fr",
  "live.com", "live.fr", "msn.com", "yahoo.com", "yahoo.fr", "ymail.com", "aol.com",
  "icloud.com", "me.com", "mac.com", "proton.me", "protonmail.com", "gmx.com", "gmx.fr",
  "free.fr", "orange.fr", "wanadoo.fr", "sfr.fr", "laposte.net", "bbox.fr", "numericable.fr",
]);

/**
 * Sélecteurs DKIM des fournisseurs courants. Le sélecteur n'est pas
 * déductible du domaine — mais il n'est pas arbitraire non plus : chaque
 * fournisseur utilise les siens. Les sonder transforme « non vérifiable à
 * distance » en réponse réelle dans l'immense majorité des cas.
 */
export const DKIM_SELECTORS: { selector: string; provider: string }[] = [
  { selector: "selector1", provider: "Microsoft 365" },
  { selector: "selector2", provider: "Microsoft 365" },
  { selector: "google", provider: "Google Workspace" },
  { selector: "ovhcloud", provider: "OVHcloud" },
  { selector: "ovh", provider: "OVHcloud" },
  { selector: "default", provider: "générique" },
  { selector: "dkim", provider: "générique" },
  { selector: "mail", provider: "générique" },
  { selector: "k1", provider: "Mailchimp / Mandrill" },
  { selector: "s1", provider: "SendGrid / Amazon SES" },
  { selector: "s2", provider: "SendGrid / Amazon SES" },
  { selector: "smtp", provider: "générique" },
];

/**
 * Une interrogation DNS peut échouer pour deux raisons très différentes :
 * l'enregistrement n'existe pas (une information), ou la résolution n'a
 * pas abouti (une absence d'information). Les confondre ferait dire à
 * l'app « publie un SPF » à quelqu'un qui en a déjà un.
 */
export type Lookup<T> = { ok: true; records: T[] } | { ok: false; reason: string };

export interface DnsFacts {
  domain: string;
  /** TXT de la racine du domaine. */
  root: Lookup<string>;
  /** TXT de _dmarc.<domaine>. */
  dmarc: Lookup<string>;
  /** Serveurs de réception. */
  mx: Lookup<{ exchange: string }>;
  /** Sélecteurs DKIM trouvés parmi ceux qu'on sait sonder. */
  dkim: { selector: string; provider: string }[];
  now?: Date;
}

/** Contrôle non concluant — on le dit, plutôt que de conclure à tort. */
const unknown = (id: string, label: string, reason: string): Check => ({
  id,
  label,
  level: "inconnu",
  value: `résolution DNS impossible (${reason})`,
  why: "Sans réponse du résolveur, on ne peut rien conclure — ni que l'enregistrement existe, ni qu'il manque.",
  fix: "Vérifie la connexion réseau de la machine, puis relance la vérification.",
});

/** Verdict d'une boîte grand public — connu d'avance, et bloquant. */
export function sharedMailboxReport(domain: string, now = new Date()): DnsReport {
  return {
    domain,
    checkedAt: now.toISOString(),
    verdict: "bloquant",
    manquants: 1,
    attention: 0,
    inconnus: 0,
    sharedMailbox: true,
    checks: [
      {
        id: "domaine-partage",
        label: "Domaine d'envoi",
        level: "manquant",
        value: `${domain} — boîte grand public, partagée par des millions de comptes`,
        why: `Les SPF, DKIM et DMARC de ${domain} appartiennent au fournisseur : tu ne peux rien y publier, et rien ne t'y identifie. L'ancienneté de ton compte personnel ne transfère aucune réputation à de la prospection : la réputation se construit par schéma d'envoi, et une boîte qui n'a jamais fait de sortant se fait filtrer dès qu'elle s'y met. S'ajoutent un plafond dur (~100 emails/jour en SMTP sur un compte gratuit) et le fait que la prospection non sollicitée depuis une adresse grand public est contraire aux conditions d'usage de ces services.`,
        fix: "Envoie depuis TON domaine (ex. contact@eagleye.fr) : là, SPF, DKIM et DMARC t'appartiennent, la marque est cohérente, et la réputation se construit chez toi. Le fournisseur (OVH, Google Workspace…) reste le transporteur — c'est le domaine du From qui compte.",
      },
    ],
  };
}

export function buildDnsReport(facts: DnsFacts): DnsReport {
  const { domain, root, dmarc: dmarcLookup, mx: mxLookup, dkim } = facts;
  const now = facts.now ?? new Date();

  if (SHARED_MAILBOX.has(domain)) return sharedMailboxReport(domain, now);

  const spf = root.ok ? root.records.find((t) => t.toLowerCase().startsWith("v=spf1")) : undefined;
  // TOUS les enregistrements DMARC, pas le premier : en trouver plusieurs
  // n'est pas un détail cosmétique.
  const dmarcAll = dmarcLookup.ok
    ? dmarcLookup.records.filter((t) => t.toLowerCase().startsWith("v=dmarc1"))
    : [];

  const checks: Check[] = [];

  // ── SPF ──
  if (!root.ok) {
    checks.push(unknown("spf", "SPF", root.reason));
  } else if (!spf) {
    checks.push({
      id: "spf",
      label: "SPF",
      level: "manquant",
      value: "aucun enregistrement v=spf1",
      why: "Sans SPF, les serveurs destinataires ne savent pas si tu es autorisé à envoyer pour ce domaine.",
      fix: `Publie un TXT sur ${domain} : "v=spf1 include:<ton-fournisseur> ~all"`,
    });
  } else {
    const permissive = /\+all/.test(spf);
    checks.push({
      id: "spf",
      label: "SPF",
      level: permissive ? "attention" : "ok",
      value: spf,
      why: permissive
        ? "« +all » autorise le monde entier à envoyer en ton nom : c'est pire que pas de SPF."
        : "Le domaine déclare qui a le droit d'envoyer pour lui.",
      fix: permissive ? "Remplace +all par ~all (softfail) ou -all (strict)." : undefined,
    });
  }

  // ── DMARC ──
  if (!dmarcLookup.ok) {
    checks.push(unknown("dmarc", "DMARC", dmarcLookup.reason));
  } else if (dmarcAll.length > 1) {
    // Piège vicieux : plusieurs enregistrements valides valent ZÉRO. La
    // RFC 7489 §6.6.3 impose au destinataire d'arrêter la découverte de
    // politique dès qu'il en trouve plus d'un — il refuse de deviner.
    // Le domaine paraît protégé ; il ne l'est pas. Un contrôle qui lit le
    // premier enregistrement et s'arrête laisse passer exactement ça.
    checks.push({
      id: "dmarc",
      label: "DMARC",
      level: "manquant",
      value: `${dmarcAll.length} enregistrements DMARC concurrents sur _dmarc.${domain}`,
      why: "Plusieurs enregistrements DMARC équivalent à AUCUN. La norme (RFC 7489 §6.6.3) impose au serveur destinataire d'arrêter la découverte de politique dès qu'il en trouve plus d'un : il refuse de deviner lequel appliquer. Le domaine paraît configuré — il ne l'est pas.",
      fix: `Supprime tous les TXT de _dmarc.${domain} sauf UN. Les rapports peuvent aller à plusieurs adresses dans le même enregistrement : "v=DMARC1; p=none; rua=mailto:a@${domain},mailto:b@${domain}"`,
    });
  } else if (dmarcAll.length === 0) {
    checks.push({
      id: "dmarc",
      label: "DMARC",
      level: "manquant",
      value: `aucun enregistrement sur _dmarc.${domain}`,
      why: "Depuis 2024, Gmail et Yahoo exigent DMARC des expéditeurs en volume. Sans lui, le placement en boîte de réception s'effondre — sans aucun signal visible de ton côté.",
      fix: `Publie un TXT sur _dmarc.${domain} : "v=DMARC1; p=none; rua=mailto:postmaster@${domain}" — commence en p=none pour observer, puis durcis.`,
    });
  } else {
    const record = dmarcAll[0];
    const policy = record.match(/p\s*=\s*(none|quarantine|reject)/i)?.[1]?.toLowerCase() ?? "none";
    checks.push({
      id: "dmarc",
      label: "DMARC",
      level: policy === "none" ? "attention" : "ok",
      value: record,
      why:
        policy === "none"
          ? "p=none observe mais ne protège pas : n'importe qui peut usurper ton domaine."
          : `Politique « ${policy} » : les usurpations sont ${policy === "reject" ? "rejetées" : "mises en quarantaine"}.`,
      fix: policy === "none" ? "Après quelques semaines de rapports, passe en p=quarantine." : undefined,
    });
  }

  // ── DKIM ──
  if (dkim.length > 0) {
    const providers = [...new Set(dkim.map((d) => d.provider))].join(", ");
    checks.push({
      id: "dkim",
      label: "DKIM",
      level: "ok",
      value: `${dkim.map((d) => d.selector).join(", ")} publié${dkim.length > 1 ? "s" : ""} (${providers})`,
      why: "DKIM signe cryptographiquement chaque message : le destinataire vérifie que le contenu n'a pas été altéré et qu'il vient bien du domaine annoncé.",
    });
  } else {
    checks.push({
      id: "dkim",
      label: "DKIM",
      level: "attention",
      value: "aucun sélecteur connu trouvé — la signature peut exister sous un sélecteur inhabituel",
      why: "DKIM signe cryptographiquement chaque message. Aucun des sélecteurs des fournisseurs courants (Microsoft, Google, OVH, SendGrid…) ne répond sur ce domaine : soit DKIM n'est pas activé, soit ton fournisseur utilise un sélecteur maison.",
      fix: "Active la signature DKIM chez ton fournisseur, puis envoie-toi un email et lis l'en-tête « DKIM-Signature » : le champ s= donne ton sélecteur exact.",
    });
  }

  // ── MX ── (n'affecte pas l'envoi, mais un domaine sans MX ne reçoit rien)
  if (!mxLookup.ok) {
    checks.push(unknown("mx", "MX (réception)", mxLookup.reason));
  } else {
    const mx = mxLookup.records;
    checks.push({
      id: "mx",
      label: "MX (réception)",
      level: mx.length ? "ok" : "manquant",
      value: mx.length ? mx.map((m) => m.exchange).slice(0, 3).join(", ") : "aucun",
      why: mx.length
        ? "Le domaine peut recevoir les réponses — indispensable, la réponse est l'objectif."
        : "Sans MX, les réponses de tes prospects n'arrivent nulle part.",
    });
  }

  const manquants = checks.filter((c) => c.level === "manquant").length;
  const attention = checks.filter((c) => c.level === "attention").length;
  const inconnus = checks.filter((c) => c.level === "inconnu").length;

  return {
    domain,
    checkedAt: now.toISOString(),
    verdict:
      manquants > 0 ? "bloquant" : inconnus > 0 ? "non concluant" : attention > 1 ? "à durcir" : "bon",
    manquants,
    attention,
    inconnus,
    checks,
  };
}
