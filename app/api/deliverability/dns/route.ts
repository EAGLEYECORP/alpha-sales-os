import { NextRequest, NextResponse } from "next/server";
import { Resolver } from "node:dns/promises";
import {
  buildDnsReport,
  DKIM_SELECTORS,
  DOMAIN_RE,
  type Lookup,
} from "@/lib/deliverability-dns";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * ─────────────────────────────────────────────────────────────────────
 * Contrôle de délivrabilité — la LECTURE DNS.
 *
 * Les règles de décision vivent dans lib/deliverability-dns.ts, où elles
 * sont testées. Ce fichier ne fait qu'interroger le résolveur et passer
 * les faits.
 *
 * On ne lit QUE des enregistrements DNS publics : aucune requête sortante
 * vers un hôte arbitraire, donc aucune surface SSRF.
 * ─────────────────────────────────────────────────────────────────────
 */

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

function domainFromEnv(): string | null {
  const raw = process.env.SMTP_FROM || process.env.SMTP_USER || "";
  const addr = raw.match(/<([^>]+)>/)?.[1] ?? raw;
  const d = addr.split("@")[1]?.trim().toLowerCase();
  return d && DOMAIN_RE.test(d) ? d : null;
}

/** Un sélecteur existe s'il répond en TXT (clé publique) ou en CNAME (délégation). */
async function probeSelector(domain: string, selector: string): Promise<boolean> {
  const name = `${selector}._domainkey.${domain}`;
  const [asTxt, asCname] = await Promise.all([
    resolver.resolveTxt(name).catch(() => null),
    resolver.resolveCname(name).catch(() => null),
  ]);
  if (asCname?.length) return true;
  return Boolean(asTxt?.some((chunks) => /v=DKIM1|p=/i.test(chunks.join(""))));
}

/** Sélecteurs DKIM réellement publiés, parmi ceux qu'on sait sonder. */
async function findDkim(domain: string) {
  const found = await Promise.all(
    DKIM_SELECTORS.map(async (s) => ((await probeSelector(domain, s.selector)) ? s : null))
  );
  return found.filter((s): s is (typeof DKIM_SELECTORS)[number] => s !== null);
}

export async function GET(request: NextRequest) {
  const asked = request.nextUrl.searchParams.get("domain")?.trim().toLowerCase();
  const domain = asked && DOMAIN_RE.test(asked) ? asked : domainFromEnv();

  if (!domain) {
    /**
     * ⚠ PAS CONFIGURÉ N'EST PAS UNE ERREUR — et le code HTTP doit le dire.
     *
     * Cette route rendait un 400. Or 400 signifie « le client a envoyé une
     * requête malformée » : ici la requête est parfaite, c'est le SERVEUR qui
     * n'a pas encore de domaine d'envoi. Constaté au navigateur : deux écrans
     * (/pilote et /settings) affichaient une erreur rouge à chaque
     * chargement, et n'importe quelle supervision aurait compté des erreurs
     * client qui n'en sont pas.
     *
     * On rend donc 200 avec un état explicite. L'écran peut alors dire
     * « pas encore configuré » — une ÉTAPE À FAIRE — au lieu de
     * « vérification impossible », qui ressemble à une panne.
     */
    return NextResponse.json({
      configure: false,
      domain: null,
      quoiFaire:
        "Aucun domaine d'envoi. Renseigne SMTP_FROM dans l'environnement, " +
        "ou passe ?domain=exemple.fr pour vérifier un domaine ponctuellement.",
    });
  }

  const [root, dmarc, mx, dkim] = await Promise.all([
    txt(domain),
    txt(`_dmarc.${domain}`),
    lookup(() => resolver.resolveMx(domain)),
    findDkim(domain),
  ]);

  return NextResponse.json(buildDnsReport({ domain, root, dmarc, mx, dkim }));
}
