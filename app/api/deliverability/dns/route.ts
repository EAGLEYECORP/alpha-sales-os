import { NextRequest, NextResponse } from "next/server";
import { Resolver } from "node:dns/promises";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * ─────────────────────────────────────────────────────────────────────
 * Contrôle de délivrabilité — l'angle mort le plus coûteux.
 *
 * On peut avoir le plus beau message du monde : sans SPF, DKIM et
 * DMARC publiés sur le domaine d'envoi, il finit en spam. Depuis 2024,
 * Gmail et Yahoo exigent DMARC des expéditeurs en volume — un domaine
 * sans DMARC voit son taux de placement s'effondrer sans aucun signal
 * visible côté expéditeur.
 *
 * Ce contrôle ne lit QUE des enregistrements DNS publics : aucune
 * requête sortante vers un hôte arbitraire, donc aucune surface SSRF.
 * ─────────────────────────────────────────────────────────────────────
 */

type Level = "ok" | "attention" | "manquant" | "inconnu";

interface Check {
  id: string;
  label: string;
  level: Level;
  value: string;
  why: string;
  fix?: string;
}

/** Domaine strict : pas de schéma, pas de chemin, pas d'IP littérale. */
const DOMAIN_RE = /^(?!-)[A-Za-z0-9-]{1,63}(?<!-)(\.(?!-)[A-Za-z0-9-]{1,63}(?<!-))+$/;

function domainFromEnv(): string | null {
  const raw = process.env.SMTP_FROM || process.env.SMTP_USER || "";
  const addr = raw.match(/<([^>]+)>/)?.[1] ?? raw;
  const d = addr.split("@")[1]?.trim().toLowerCase();
  return d && DOMAIN_RE.test(d) ? d : null;
}

/**
 * Une interrogation DNS peut échouer pour deux raisons très différentes :
 * l'enregistrement n'existe pas (NODATA / NXDOMAIN — une information), ou la
 * résolution n'a pas abouti (réseau coupé, résolveur injoignable, timeout —
 * une absence d'information). Les confondre ferait dire à l'app « publie un
 * SPF » à quelqu'un qui en a déjà un. On distingue donc explicitement.
 */
type Lookup<T> = { ok: true; records: T[] } | { ok: false; reason: string };

const resolver = new Resolver({ timeout: 3000, tries: 2 });

/** Codes signifiant « la réponse est arrivée, et il n'y a rien ». */
const ABSENT = new Set(["ENODATA", "ENOTFOUND", "ENXDOMAIN"]);

async function lookup<T>(run: () => Promise<T[]>): Promise<Lookup<T>> {
  try {
    return { ok: true, records: await run() };
  } catch (e) {
    const code = (e as NodeJS.ErrnoException)?.code ?? "";
    return ABSENT.has(code) ? { ok: true, records: [] } : { ok: false, reason: code || "échec" };
  }
}

const txt = (name: string): Promise<Lookup<string>> =>
  lookup(async () => (await resolver.resolveTxt(name)).map((chunks) => chunks.join("")));

/** Contrôle non concluant — on le dit, plutôt que de conclure à tort. */
const unknown = (id: string, label: string, reason: string): Check => ({
  id,
  label,
  level: "inconnu",
  value: `résolution DNS impossible (${reason})`,
  why: "Sans réponse du résolveur, on ne peut rien conclure — ni que l'enregistrement existe, ni qu'il manque.",
  fix: "Vérifie la connexion réseau de la machine, puis relance la vérification.",
});

export async function GET(request: NextRequest) {
  const asked = request.nextUrl.searchParams.get("domain")?.trim().toLowerCase();
  const domain = asked && DOMAIN_RE.test(asked) ? asked : domainFromEnv();

  if (!domain) {
    return NextResponse.json(
      { error: "Aucun domaine d'envoi : renseigne SMTP_FROM (ou passe ?domain=)." },
      { status: 400 }
    );
  }

  const [spfLookup, dmarcLookup, mxLookup] = await Promise.all([
    txt(domain),
    txt(`_dmarc.${domain}`),
    lookup(() => resolver.resolveMx(domain)),
  ]);

  const spf = spfLookup.ok ? spfLookup.records.find((t) => t.toLowerCase().startsWith("v=spf1")) : undefined;
  const dmarc = dmarcLookup.ok ? dmarcLookup.records.find((t) => t.toLowerCase().startsWith("v=dmarc1")) : undefined;

  const checks: Check[] = [];

  // ── SPF ──
  if (!spfLookup.ok) {
    checks.push(unknown("spf", "SPF", spfLookup.reason));
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

  // ── DMARC ── (le plus souvent oublié, et le plus coûteux)
  if (!dmarcLookup.ok) {
    checks.push(unknown("dmarc", "DMARC", dmarcLookup.reason));
  } else if (!dmarc) {
    checks.push({
      id: "dmarc",
      label: "DMARC",
      level: "manquant",
      value: "aucun enregistrement sur _dmarc." + domain,
      why: "Depuis 2024, Gmail et Yahoo exigent DMARC des expéditeurs en volume. Sans lui, le placement en boîte de réception s'effondre — sans aucun signal visible de ton côté.",
      fix: `Publie un TXT sur _dmarc.${domain} : "v=DMARC1; p=none; rua=mailto:postmaster@${domain}" — commence en p=none pour observer, puis durcis.`,
    });
  } else {
    const policy = dmarc.match(/p\s*=\s*(none|quarantine|reject)/i)?.[1]?.toLowerCase() ?? "none";
    checks.push({
      id: "dmarc",
      label: "DMARC",
      level: policy === "none" ? "attention" : "ok",
      value: dmarc,
      why:
        policy === "none"
          ? "p=none observe mais ne protège pas : n'importe qui peut usurper ton domaine."
          : `Politique « ${policy} » : les usurpations sont ${policy === "reject" ? "rejetées" : "mises en quarantaine"}.`,
      fix: policy === "none" ? "Après quelques semaines de rapports, passe en p=quarantine." : undefined,
    });
  }

  // ── DKIM ── (la sélecteur dépend du fournisseur : on ne peut que rappeler)
  checks.push({
    id: "dkim",
    label: "DKIM",
    level: "attention",
    value: "non vérifiable à distance (le sélecteur dépend du fournisseur)",
    why: "DKIM signe cryptographiquement chaque message. Il se vérifie dans la console de ton fournisseur d'envoi, ou en s'envoyant un email à soi-même et en lisant les en-têtes.",
    fix: "Active la signature DKIM chez ton fournisseur SMTP, puis vérifie l'en-tête « DKIM-Signature » d'un email reçu.",
  });

  // ── MX ── (n'affecte pas l'envoi, mais un domaine sans MX ne reçoit pas les réponses)
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

  return NextResponse.json({
    domain,
    checkedAt: new Date().toISOString(),
    verdict:
      manquants > 0 ? "bloquant" : inconnus > 0 ? "non concluant" : attention > 1 ? "à durcir" : "bon",
    manquants,
    attention,
    inconnus,
    checks,
  });
}
