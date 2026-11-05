import type { Prospect } from "./types";

/**
 * ─────────────────────────────────────────────────────────────────────
 * L'EMAIL QU'UNE ENTREPRISE PUBLIE ELLE-MÊME SUR SON SITE (05/11/2026).
 *
 * Mesuré en production le 05/11 : 33 agences immobilières du Rhône trouvées
 * au registre, 18 passées à Dropcontact → ZÉRO email (6 téléphones, 12
 * introuvables). Le pilote n'écrit que par email : il tournait sans pouvoir
 * écrire à personne. Une petite agence n'a presque jamais d'email nominatif
 * connu des bases ; elle AFFICHE en revanche un `contact@` sur sa page
 * contact. Décision de Zakaria : « go site ».
 *
 * ⚠⚠ CE QU'ON PREND, ET CE QU'ON REFUSE — chaque règle a un motif :
 *  · SEULEMENT une adresse du DOMAINE DU SITE (ou d'un domaine parent). Une
 *    page « mentions légales » cite l'hébergeur et l'agence web qui a fait le
 *    site : leurs adresses ne sont pas celles du prospect. Écrire à l'agence
 *    web d'une agence immobilière, c'est écrire à quelqu'un d'autre.
 *  · JAMAIS une boîte de données personnelles (dpo@, rgpd@, privacy@…) : elle
 *    existe pour exercer des droits, pas pour recevoir une offre — y écrire
 *    une prospection est exactement ce qu'un délégué signale.
 *  · JAMAIS une boîte technique ou de service (noreply, postmaster, compta,
 *    recrutement…) : personne n'y lit une proposition commerciale.
 *  · Une adresse webmail (gmail, orange…) n'est jamais du domaine d'un site
 *    d'entreprise : elle est écartée par la règle du domaine, sans liste.
 *  · On n'INVENTE aucune adresse (pas de « contact@<domaine> » deviné) : une
 *    adresse devinée qui rebondit brûle le palier d'envoi de la boîte.
 *  · Les formes masquées (« contact [at] … ») ne sont pas lues : l'entreprise
 *    a choisi de ne pas les rendre copiables, on ne les reconstitue pas.
 * ─────────────────────────────────────────────────────────────────────
 */

export interface PageSite {
  url: string;
  html: string;
}

export interface EmailPublie {
  email: string;
  /** La page où elle a été lue — la preuve, posée sur la fiche. */
  page: string;
}

/** Posé sur toute fiche dont le site a été lu, trouvé ou non : on ne relit pas un site en boucle. */
export const TAG_SITE_LU = "site-lu";
/** Posé quand l'email retenu vient du site de l'entreprise. */
export const TAG_EMAIL_DU_SITE = "email-du-site";
/** Sites lus par passage : chaque site coûte jusqu'à quatre requêtes, le passage doit rester court. */
export const SITES_PAR_PASSAGE = 3;

const BOITES_REFUSEES =
  /^(dpo|rgpd|gdpr|privacy|confidentialite|donnees|donneespersonnelles|donnees-personnelles|cnil|data|noreply|no-reply|ne-pas-repondre|nepasrepondre|donotreply|do-not-reply|postmaster|hostmaster|webmaster|abuse|mailer-daemon|bounce|bounces|compta|comptabilite|facturation|factures|invoice|billing|rh|recrutement|recrutements|jobs|job|emploi|candidature|candidatures|careers|presse|press)$/i;

/** Les boîtes qu'une entreprise destine aux nouvelles demandes, dans l'ordre où on les préfère. */
const PREFEREES = ["contact", "agence", "accueil", "info", "infos", "bonjour", "hello", "direction"];

const EMAIL = /[a-z0-9._%+-]+@[a-z0-9-]+(?:\.[a-z0-9-]+)+/gi;

function decoder(s: string): string {
  return s
    .replace(/&#(\d+);/g, (_, n: string) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, h: string) => String.fromCharCode(parseInt(h, 16)))
    .replace(/&commat;/gi, "@")
    .replace(/&period;/gi, ".")
    .replace(/%40/g, "@");
}

/** L'hôte sans « www. », en minuscules — ou null. */
export function domaineDuSite(url: string): string | null {
  try {
    return new URL(url).hostname.toLowerCase().replace(/^www\./, "") || null;
  } catch {
    return null;
  }
}

/** L'adresse appartient-elle au site ? Même domaine, ou domaine parent de l'hôte (lyon.franchise.fr → @franchise.fr). */
function memeDomaine(domaineEmail: string, hote: string): boolean {
  const d = domaineEmail.toLowerCase();
  return d === hote || hote.endsWith(`.${d}`) || d.endsWith(`.${hote}`);
}

/**
 * L'email publié par l'entreprise sur les pages lues, ou null. Pur.
 * `site` est l'adresse du site telle qu'on la connaît (la première page lue
 * peut avoir été redirigée : on accepte les deux domaines).
 */
export function emailPublie(pages: PageSite[], site: string): EmailPublie | null {
  const hotes = new Set([site, ...pages.map((p) => p.url)].map(domaineDuSite).filter((h): h is string => Boolean(h)));
  const vus: (EmailPublie & { rang: number; ordre: number })[] = [];
  let ordre = 0;
  for (const p of pages) {
    const html = decoder(p.html ?? "");
    for (const m of html.matchAll(EMAIL)) {
      const email = m[0].replace(/\.+$/, "").toLowerCase();
      const [local, domaine] = email.split("@");
      if (!local || !domaine) continue;
      // Une image ou une ressource « x@2x.png » ressemble à une adresse.
      if (/\.(png|jpe?g|gif|webp|svg|css|js)$/i.test(domaine)) continue;
      if (BOITES_REFUSEES.test(local)) continue;
      if (![...hotes].some((h) => memeDomaine(domaine, h))) continue;
      if (vus.some((v) => v.email === email)) continue;
      const pref = PREFEREES.indexOf(local);
      vus.push({ email, page: p.url, rang: pref === -1 ? PREFEREES.length : pref, ordre: ordre++ });
    }
  }
  vus.sort((a, b) => a.rang - b.rang || a.ordre - b.ordre);
  return vus[0] ? { email: vus[0].email, page: vus[0].page } : null;
}

/** L'adresse du site posée sur la fiche par l'enrichissement (« Site : … » dans les notes) — jamais devinée. */
export function siteDeLaFiche(p: Pick<Prospect, "notes">): string | null {
  const m = /(?:^|\n)Site : (\S+)/.exec(p.notes ?? "");
  if (!m) return null;
  const brut = /^https?:\/\//i.test(m[1]) ? m[1] : `https://${m[1]}`;
  return domaineDuSite(brut) ? brut : null;
}

/** Une fiche dont on peut lire le site : pas d'email, un site connu, pas encore lu. */
export function siteALire(p: Prospect): boolean {
  return !p.email?.trim() && Boolean(siteDeLaFiche(p)) && !(p.tags ?? []).includes(TAG_SITE_LU);
}

/** Ce que la fiche reçoit après lecture — on ne remplace jamais un email déjà posé. */
export function patchDepuisSite(p: Prospect, trouve: EmailPublie | null, maintenant: Date): Partial<Prospect> {
  const tags = new Set([...(p.tags ?? []), TAG_SITE_LU]);
  const patch: Partial<Prospect> = { updatedAt: maintenant.toISOString() };
  if (trouve && !p.email?.trim()) {
    tags.add(TAG_EMAIL_DU_SITE);
    patch.email = trouve.email;
  }
  patch.tags = [...tags];
  return patch;
}
