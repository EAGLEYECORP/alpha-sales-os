import { stripHtml } from "./site-fetch";
import { nettoyerProfil, type ProfilOperateur } from "./profil-operateur";

/**
 * ─────────────────────────────────────────────────────────────────────
 * L'INSCRIT DONNE SON SITE, ALPHA SE CONFIGURE.
 *
 * Le formulaire « À qui vends-tu ? » posait quatre questions à quelqu'un qui
 * venait d'arriver et n'avait encore rien vu tourner. Or presque tout ce
 * qu'on lui demande est DÉJÀ écrit quelque part, par lui, sur son propre
 * site : le nom de sa société, ce qu'il vend, sa ville, ses clients, son
 * téléphone, son lien de rendez-vous. On le lit au lieu de le redemander.
 *
 * ── CE QUE CE MODULE S'INTERDIT ──
 *
 * ⚠⚠ ON LIT, ON N'INVENTE PAS. Chaque valeur rendue porte sa SOURCE (balise,
 * données structurées, texte, lien) et l'EXTRAIT où elle a été lue. Une case
 * qu'on n'a pas su remplir reste vide et se DIT dans `manques` — un champ
 * rempli au jugé est pire qu'un champ vide : le premier fabrique une
 * démonstration hors sujet dont personne ne saura qu'elle l'est.
 *
 * ⚠⚠ RIEN NE S'APPLIQUE SANS L'INSCRIT. Ce module rend une PROPOSITION ;
 * c'est l'écran qui la montre et l'inscrit qui valide. En particulier le
 * dirigeant lu sur les mentions légales n'est JAMAIS posé comme signataire
 * d'office : celui qui s'inscrit n'est pas forcément lui, et on ne devine
 * jamais l'identité d'un humain (`lib/signature.ts`). Il faut un acte —
 * « c'est moi » — pas une configuration.
 *
 * ⚠ LA CLIENTÈLE EST UNE SUGGESTION AVEC PREUVE, PAS UN VERDICT. Un mot
 * comme « promoteurs » sur une page dit qu'on en parle, pas qu'on leur vend.
 * On compte, on montre la phrase, l'inscrit choisit.
 *
 * Module pur : aucune requête ici. La récupération des pages (garde-fou
 * SSRF compris) vit dans `lib/site-fetch.ts`, l'orchestration dans
 * `app/api/onboarding/site/route.ts`.
 * ─────────────────────────────────────────────────────────────────────
 */

export type Provenance = "donnees-structurees" | "balise" | "titre" | "texte" | "lien" | "registre";

/**
 * Comment une provenance se DIT à l'inscrit. Une seule définition : l'encart
 * « Lire mon site » et l'écran de bienvenue montrent la même source avec les
 * mêmes mots — deux libellés pour la même provenance finiraient par se
 * contredire sous les yeux de la même personne.
 */
export const LIBELLE_PROVENANCE: Record<Provenance, string> = {
  "donnees-structurees": "données du site",
  balise: "description du site",
  titre: "titre de page",
  texte: "texte du site",
  lien: "lien du site",
  registre: "registre national",
};

export interface Trouvaille {
  valeur: string;
  source: Provenance;
  /** La page où la valeur a été lue. */
  page: string;
  /** Le passage d'origine — c'est lui qui permet de contester la valeur. */
  extrait: string;
}

export interface Clientele {
  id: string;
  /** Ce qui part dans `cibleSecteur`. */
  libelle: string;
  /** Le poste à joindre chez cette clientèle, en suggestion. */
  role: string;
  occurrences: number;
  preuve: Trouvaille;
}

/** Ce que le registre national dit du SIREN lu sur le site. */
export interface Registre {
  raisonSociale: string;
  ville: string;
}

export interface LectureSite {
  site: string;
  pagesLues: string[];
  nom: Trouvaille | null;
  activite: Trouvaille | null;
  promesse: Trouvaille | null;
  ville: Trouvaille | null;
  zone: Trouvaille | null;
  clienteles: Clientele[];
  email: Trouvaille | null;
  telephone: Trouvaille | null;
  lienRdv: Trouvaille | null;
  dirigeant: Trouvaille | null;
  siren: Trouvaille | null;
  registre: Registre | null;
  manques: string[];
}

export interface PageLue {
  url: string;
  html: string;
}

// ── Décodage et découpage ───────────────────────────────────────────

const ENTITES: Record<string, string> = {
  eacute: "é", egrave: "è", ecirc: "ê", euml: "ë", agrave: "à", acirc: "â", ccedil: "ç",
  icirc: "î", iuml: "ï", ocirc: "ô", ugrave: "ù", ucirc: "û", Eacute: "É", Egrave: "È",
  Agrave: "À", Ccedil: "Ç", rsquo: "’", lsquo: "‘", laquo: "«", raquo: "»", hellip: "…",
  ndash: "–", mdash: "—", oelig: "œ", nbsp: " ", euro: "€",
};

/**
 * Décode les entités qui portent du TEXTE (accents, apostrophes, chiffres).
 *
 * ⚠ `&lt;`, `&gt;` et `&amp;` sont laissés à `stripHtml`, qui les traite
 * APRÈS avoir retiré les balises : les décoder avant fabriquerait de fausses
 * balises à partir de texte, et `stripHtml` les mangerait avec le contenu.
 */
function decoder(s: string): string {
  return s
    .replace(/&#(\d{1,6});/g, (m, n) => {
      const c = Number(n);
      return c === 60 || c === 62 || c === 38 || c > 0x10ffff ? m : String.fromCodePoint(c);
    })
    .replace(/&#x([0-9a-f]{1,6});/gi, (m, n) => {
      const c = parseInt(n, 16);
      return c === 60 || c === 62 || c === 38 || c > 0x10ffff ? m : String.fromCodePoint(c);
    })
    .replace(/&([a-zA-Z]+);/g, (m, nom) => ENTITES[nom] ?? m);
}

const espaces = (s: string) => s.replace(/\s+/g, " ").trim();
const texteDe = (html: string) => stripHtml(decoder(html));
const sansBalises = (html: string) => espaces(texteDe(html));

/** Les attributs d'une balise, sans dépendre de leur ordre. */
function attributs(balise: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const m of balise.matchAll(/([a-zA-Z_:][-\w:.]*)\s*=\s*(?:"([^"]*)"|'([^']*)')/g)) {
    out[m[1].toLowerCase()] = decoder(m[2] ?? m[3] ?? "");
  }
  return out;
}

function metas(html: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const m of html.matchAll(/<meta\b[^>]*>/gi)) {
    const a = attributs(m[0]);
    const cle = (a.property ?? a.name ?? "").toLowerCase();
    if (cle && a.content && !(cle in out)) out[cle] = espaces(a.content);
  }
  return out;
}

interface Lien {
  href: string;
  texte: string;
}

function liens(html: string): Lien[] {
  const out: Lien[] = [];
  for (const m of html.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi)) {
    const href = attributs(m[1]).href;
    if (href) out.push({ href: href.trim(), texte: sansBalises(m[2]) });
  }
  return out;
}

/** Les objets JSON-LD de la page, à plat (`@graph` et tableaux dépliés). */
function donneesStructurees(html: string): Record<string, unknown>[] {
  const out: Record<string, unknown>[] = [];
  const aplatir = (v: unknown) => {
    if (Array.isArray(v)) v.forEach(aplatir);
    else if (v && typeof v === "object") {
      const o = v as Record<string, unknown>;
      out.push(o);
      if (o["@graph"]) aplatir(o["@graph"]);
    }
  };
  for (const m of html.matchAll(/<script\b[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      aplatir(JSON.parse(m[1].trim()));
    } catch {
      /* JSON-LD invalide : fréquent, et ce n'est pas notre problème */
    }
  }
  return out;
}

const TYPE_ENTREPRISE =
  /Organization|Business|Service|Contractor|Store|Electrician|Plumber|Roofing|HVAC|Locksmith|Agency|Corporation|Restaurant|Hotel|Dentist|Physician|Attorney|Notary|Accounting/i;

function entrepriseStructuree(objets: Record<string, unknown>[]): Record<string, unknown> | null {
  return (
    objets.find((o) => {
      const t = o["@type"];
      const types = Array.isArray(t) ? t.join(" ") : String(t ?? "");
      return TYPE_ENTREPRISE.test(types) && typeof o.name === "string" && o.name.trim().length > 1;
    }) ?? null
  );
}

const chaine = (v: unknown): string => (typeof v === "string" ? espaces(decoder(v)) : "");

/** Un passage d'environ `largeur` caractères autour de `index`. */
function extraitAutour(texte: string, index: number, longueur: number, largeur = 110): string {
  const debut = Math.max(0, index - Math.floor((largeur - longueur) / 2));
  const fin = Math.min(texte.length, debut + largeur);
  return (debut > 0 ? "…" : "") + espaces(texte.slice(debut, fin)) + (fin < texte.length ? "…" : "");
}

function hote(url: string): string {
  try {
    return new URL(url).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return "";
  }
}

function titreCase(s: string): string {
  if (s !== s.toUpperCase()) return s;
  return s.toLowerCase().replace(/(^|[\s'’-])([a-zà-ÿ])/g, (_, sep, c) => sep + c.toUpperCase());
}

// ── Pages à lire ─────────────────────────────────────────────────────

const PAGE_UTILE: [RegExp, number][] = [
  [/contact|nous-joindre|coordonn/i, 0],
  [/mentions|legal|l%C3%A9gal|imprint/i, 1],
  [/qui-sommes|a-propos|%C3%A0-propos|about|notre-entreprise|nous-connaitre|societe|histoire/i, 2],
  [/prestations|services|savoir-faire|metiers|activites|realisations|references/i, 3],
];

/**
 * Les pages internes qui valent la peine d'être lues, dans l'ordre : contact
 * (coordonnées, ville), mentions légales (SIREN, dirigeant), à propos
 * (clientèle, zone), prestations.
 *
 * ⚠ MÊME HÔTE SEULEMENT, et TROIS AU PLUS. On lit le site de l'inscrit, pas
 * le web : un lien vers un réseau social ou un annuaire ne nous apprend rien
 * sur lui et ferait sortir notre serveur vers des tiers.
 */
export function pagesUtiles(base: string, html: string, max = 3): string[] {
  const h = hote(base);
  const candidats: { url: string; rang: number }[] = [];
  for (const l of liens(html)) {
    if (/^(mailto|tel|javascript):|^#/i.test(l.href)) continue;
    let u: URL;
    try {
      u = new URL(l.href, base);
    } catch {
      continue;
    }
    if (hote(u.toString()) !== h || !/^https?:$/.test(u.protocol)) continue;
    if (/\.(pdf|jpe?g|png|webp|gif|svg|zip|docx?)$/i.test(u.pathname)) continue;
    u.hash = "";
    const cle = `${u.pathname} ${l.texte}`;
    const regle = PAGE_UTILE.find(([re]) => re.test(cle));
    if (!regle) continue;
    const url = u.toString();
    if (url.replace(/\/$/, "") === base.replace(/\/$/, "")) continue;
    if (!candidats.some((c) => c.url === url)) candidats.push({ url, rang: regle[1] });
  }
  // Une page par famille d'abord : trois pages « services » ne valent pas
  // une page contact et des mentions légales.
  const parRang = new Map<number, string>();
  for (const c of candidats.sort((a, b) => a.rang - b.rang)) if (!parRang.has(c.rang)) parRang.set(c.rang, c.url);
  return [...parRang.values()].slice(0, max);
}

// ── Les lectures, une par une ────────────────────────────────────────

function lireNom(page: PageLue, ld: Record<string, unknown> | null, m: Record<string, string>): Trouvaille | null {
  const nomLd = ld ? chaine(ld.name) : "";
  if (nomLd) return { valeur: nomLd.slice(0, 60), source: "donnees-structurees", page: page.url, extrait: `"name": "${nomLd}"` };
  const site = m["og:site_name"] ?? m["application-name"];
  if (site) return { valeur: site.slice(0, 60), source: "balise", page: page.url, extrait: `og:site_name = ${site}` };

  const titre = sansBalises(page.html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? "");
  if (!titre) return null;
  const morceaux = titre.split(/\s+[|–—·•:-]\s+|\s*\|\s*/).map((s) => s.trim()).filter((s) => s.length >= 2);
  if (morceaux.length === 0) return null;
  // Le morceau du titre qui ressemble au domaine est la marque ; à défaut le
  // plus court, parce qu'un titre de page est « slogan | Marque » bien plus
  // souvent que l'inverse — et qu'un slogan est rarement court.
  const domaine = hote(page.url).split(".").slice(0, -1).join("").replace(/[^a-z0-9]/g, "");
  const lettres = (s: string) =>
    s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]/g, "");
  const marque =
    morceaux.find((s) => {
      const l = lettres(s);
      return l.length >= 3 && domaine.length >= 3 && (domaine.includes(l) || l.includes(domaine));
    }) ?? (morceaux.length > 1 ? [...morceaux].sort((a, b) => a.length - b.length)[0] : morceaux[0]);
  return { valeur: marque.slice(0, 60), source: "titre", page: page.url, extrait: `<title>${titre}</title>` };
}

const premierePhrase = (s: string) => espaces(s.split(/(?<=[.!?])\s+/)[0] ?? "").slice(0, 140);

function lireActivite(page: PageLue, ld: Record<string, unknown> | null, m: Record<string, string>): Trouvaille | null {
  const desc = m["og:description"] ?? m.description ?? (ld ? chaine(ld.description) : "");
  if (desc && desc.length >= 12) {
    return { valeur: premierePhrase(desc), source: "balise", page: page.url, extrait: desc.slice(0, 200) };
  }
  return null;
}

function lirePromesse(page: PageLue, activite: Trouvaille | null): Trouvaille | null {
  const h1 = sansBalises(page.html.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i)?.[1] ?? "");
  if (h1.length >= 8 && h1.length <= 160 && h1 !== activite?.valeur) {
    return { valeur: h1, source: "titre", page: page.url, extrait: `<h1>${h1}</h1>` };
  }
  return null;
}

const MOTS_DE_LIAISON = /^(sur|en|le|la|les|de|du|des|d'|d’|l'|l’|et)$/i;
const FIN_DE_VILLE = /^(france|cedex|t[ée]l|tel|email|e-mail|mail|fax|siret|siren|rcs)\b/i;

/** « 69230 Saint-Genis-Laval » → « Saint-Genis-Laval » ; s'arrête au premier mot qui n'en est pas. */
function villeApresCodePostal(apres: string): string {
  const mots = apres.split(/\s+/).slice(0, 6);
  const garde: string[] = [];
  for (let i = 0; i < mots.length; i++) {
    const mot = mots[i].replace(/[,.;:)]+$/, "");
    if (!mot || FIN_DE_VILLE.test(mot)) break;
    if (/^[A-ZÀ-Ý]/.test(mot)) garde.push(mot);
    else if (MOTS_DE_LIAISON.test(mot) && garde.length > 0 && i + 1 < mots.length) garde.push(mot);
    else break;
    if (/[,.;:)]$/.test(mots[i])) break;
  }
  while (garde.length && MOTS_DE_LIAISON.test(garde[garde.length - 1])) garde.pop();
  return titreCase(garde.join(" ")).slice(0, 40);
}

function lireVille(pages: PageLue[], textes: string[], ld: Record<string, unknown> | null, pageLd: string): Trouvaille | null {
  const adresse = ld && typeof ld.address === "object" && ld.address ? (ld.address as Record<string, unknown>) : null;
  const localite = adresse ? chaine(adresse.addressLocality) : "";
  if (localite) {
    return { valeur: titreCase(localite), source: "donnees-structurees", page: pageLd, extrait: `"addressLocality": "${localite}"` };
  }
  // Les pages contact et mentions d'abord : c'est là que vit l'adresse du
  // siège. Sur l'accueil, un code postal est souvent celui d'un chantier.
  const ordre = pages.map((p, i) => i).sort((a, b) => Number(/contact|mentions|legal/i.test(pages[b].url)) - Number(/contact|mentions|legal/i.test(pages[a].url)));
  for (const i of ordre) {
    const t = textes[i];
    for (const m of t.matchAll(/\b((?:0[1-9]|[1-8]\d|9[0-5])\d{3})\s+(\S[^\n]{0,60})/g)) {
      const ville = villeApresCodePostal(m[2]);
      if (ville.length >= 2) {
        return { valeur: ville, source: "texte", page: pages[i].url, extrait: extraitAutour(t, m.index ?? 0, m[0].length) };
      }
    }
  }
  return null;
}

const REGIONS = [
  "Auvergne-Rhône-Alpes", "Île-de-France", "Provence-Alpes-Côte d'Azur", "Occitanie", "Nouvelle-Aquitaine",
  "Hauts-de-France", "Grand Est", "Bretagne", "Normandie", "Pays de la Loire", "Centre-Val de Loire",
  "Bourgogne-Franche-Comté", "Corse",
];

/**
 * « tout le Rhône et l'Ain » → « Rhône et l'Ain ».
 *
 * ⚠ La zone part dans une phrase (« … en Rhône et l'Ain ») : un « tout le »
 * en tête ou un « et » orphelin en queue la rendent illisible, et c'est
 * précisément la phrase qui permet à l'inscrit de voir si on l'a compris.
 */
function nettoyerZone(brut: string): string {
  let z = espaces(brut)
    .replace(/^tou(?:t|te|s|tes)\s+/i, "")
    .replace(/^(?:le|la|les)\s+/i, "")
    .replace(/^l['’]/i, "");
  z = z.replace(/(?:\s+(?:et|de|du|des|sur|ses|sa))+$/i, "");
  return z.slice(0, 60);
}

function lireZone(pages: PageLue[], textes: string[]): Trouvaille | null {
  const motifs: RegExp[] = [
    /\b(?:nous intervenons|intervient|intervenons|zone d['’]intervention|secteur d['’]intervention|rayon d['’]action)\b[^.\n]{0,40}?\b(?:à|sur|dans|en)\s+((?:tout(?:e|es)?\s+)?(?:le |la |l['’]|les )?[A-ZÉÎ][\wÀ-ÿ'’-]+(?:[ -](?:et|de|du|des|sur|ses|sa|environs|région|périphérie|(?:l['’])?[A-ZÉÎ][\wÀ-ÿ'’-]+))*)/,
    /\b([A-ZÉ][\wÀ-ÿ-]+ et (?:ses environs|sa région|sa périphérie|sa métropole|son agglomération))\b/,
    new RegExp(`\\b(${REGIONS.map((r) => r.replace(/[-']/g, "[-' ]")).join("|")})\\b`),
  ];
  for (const re of motifs) {
    for (let i = 0; i < pages.length; i++) {
      const m = textes[i].match(re);
      const zone = m?.[1] ? nettoyerZone(m[1]) : "";
      if (m && zone) {
        return {
          valeur: zone,
          source: "texte",
          page: pages[i].url,
          extrait: extraitAutour(textes[i], m.index ?? 0, m[0].length),
        };
      }
    }
  }
  return null;
}

/**
 * Les clientèles qu'on sait reconnaître, et le poste qu'on y joint.
 *
 * ⚠ « entreprises » NU n'y est pas : il apparaît dans « entreprise de
 * menuiserie » sur tous les sites du bâtiment, et rangerait tout le monde en
 * B2B. Il faut une tournure qui désigne un CLIENT (« pour les entreprises »,
 * « clients professionnels », PME, TPE).
 */
const CLIENTELES: { id: string; libelle: string; role: string; motif: RegExp }[] = [
  { id: "particuliers", libelle: "particuliers", role: "", motif: /\bparticuliers?\b/gi },
  { id: "professionnels", libelle: "entreprises et professionnels", role: "dirigeants", motif: /\b(?:(?:pour|aux|des|les) (?:entreprises|professionnels)|clients? professionnels?|PME|TPE|B2B)\b/g },
  { id: "promoteurs", libelle: "promotion immobilière", role: "directeurs de programmes", motif: /\bpromoteurs?(?: immobiliers?)?\b/gi },
  { id: "bailleurs", libelle: "bailleurs sociaux", role: "responsables travaux", motif: /\bbailleurs?(?: sociaux)?\b/gi },
  { id: "syndics", libelle: "syndics et copropriétés", role: "gestionnaires de copropriété", motif: /\b(?:syndics?|copropriétés?)\b/gi },
  { id: "collectivites", libelle: "collectivités et marchés publics", role: "services techniques", motif: /\b(?:collectivités?|marchés? publics?|mairies?)\b/gi },
  { id: "architectes", libelle: "architectes et maîtres d'œuvre", role: "architectes", motif: /\b(?:architectes?|maîtres? d['’](?:œ|oe)uvre)\b/gi },
  { id: "entreprises-generales", libelle: "entreprises générales du bâtiment", role: "conducteurs de travaux", motif: /\bentreprises? générales?\b/gi },
  { id: "industrie", libelle: "industrie", role: "responsables maintenance", motif: /\b(?:industriels|sites industriels|usines?)\b/gi },
  { id: "chr", libelle: "restaurants et hôtels", role: "gérants", motif: /\b(?:restaurants?|restaurateurs?|hôtels?|hôteliers?)\b/gi },
  { id: "commerces", libelle: "commerces de proximité", role: "gérants", motif: /\b(?:commerçants?|commerces? de proximité|boutiques?)\b/gi },
  { id: "sante", libelle: "santé", role: "directeurs d'établissement", motif: /\b(?:cliniques?|établissements? de santé|EHPAD|cabinets? médicaux)\b/gi },
  { id: "immobilier", libelle: "agences immobilières", role: "directeurs d'agence", motif: /\bagences? immobilières?\b/gi },
  { id: "ecommerce", libelle: "e-commerce", role: "fondateurs", motif: /\b(?:e-commerce|e-commerçants?|boutiques? en ligne)\b/gi },
  { id: "startups", libelle: "start-up", role: "fondateurs", motif: /\bstart-?ups?\b/gi },
];

function lireClienteles(pages: PageLue[], textes: string[]): Clientele[] {
  const out: Clientele[] = [];
  for (const c of CLIENTELES) {
    let total = 0;
    let preuve: Trouvaille | null = null;
    for (let i = 0; i < pages.length; i++) {
      const hits = [...textes[i].matchAll(c.motif)];
      total += hits.length;
      if (!preuve && hits[0]) {
        preuve = {
          valeur: c.libelle,
          source: "texte",
          page: pages[i].url,
          extrait: extraitAutour(textes[i], hits[0].index ?? 0, hits[0][0].length),
        };
      }
    }
    if (preuve && total > 0) out.push({ id: c.id, libelle: c.libelle, role: c.role, occurrences: total, preuve });
  }
  return out.sort((a, b) => b.occurrences - a.occurrences).slice(0, 6);
}

const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[a-z]{2,}/g;
const EMAIL_FAUX = /\.(png|jpe?g|gif|webp|svg|css|js)$|example\.|exemple\.|domain\.|sentry|wixpress|votre@|@email\.|xxx/i;

function lireEmail(pages: PageLue[], textes: string[], ld: Record<string, unknown> | null, pageLd: string): Trouvaille | null {
  const h = hote(pages[0]?.url ?? "");
  const vus: Trouvaille[] = [];
  const emailLd = ld ? chaine(ld.email).replace(/^mailto:/i, "") : "";
  if (emailLd) vus.push({ valeur: emailLd.toLowerCase(), source: "donnees-structurees", page: pageLd, extrait: `"email": "${emailLd}"` });
  pages.forEach((p, i) => {
    for (const l of liens(p.html)) {
      const m = l.href.match(/^mailto:([^?]+)/i);
      if (m) vus.push({ valeur: decodeURIComponent(m[1]).toLowerCase().trim(), source: "lien", page: p.url, extrait: l.href.slice(0, 120) });
    }
    for (const m of textes[i].matchAll(EMAIL)) {
      vus.push({ valeur: m[0].toLowerCase(), source: "texte", page: p.url, extrait: extraitAutour(textes[i], m.index ?? 0, m[0].length) });
    }
  });
  const propres = vus.filter((v) => /^[^@\s]+@[^@\s]+\.[a-z]{2,}$/.test(v.valeur) && !EMAIL_FAUX.test(v.valeur));
  // Une adresse sur le domaine du site d'abord : c'est la sienne. Une adresse
  // d'un autre domaine peut être celle de l'agence qui a fait le site.
  return propres.find((v) => v.valeur.endsWith("@" + h) || v.valeur.endsWith("." + h)) ?? propres[0] ?? null;
}

/** « +33 4 … » ou « 04.… » → « 04 xx xx xx xx ». */
function normaliserTelephone(brut: string): string | null {
  let d = brut.replace(/[^\d+]/g, "");
  if (d.startsWith("+33")) d = "0" + d.slice(3);
  else if (d.startsWith("0033")) d = "0" + d.slice(4);
  if (!/^0[1-9]\d{8}$/.test(d)) return null;
  return d.replace(/(\d{2})(?=\d)/g, "$1 ").trim();
}

function lireTelephone(pages: PageLue[], textes: string[], ld: Record<string, unknown> | null, pageLd: string): Trouvaille | null {
  const telLd = ld ? normaliserTelephone(chaine(ld.telephone)) : null;
  if (telLd) return { valeur: telLd, source: "donnees-structurees", page: pageLd, extrait: `"telephone": "${chaine(ld?.telephone)}"` };
  for (const p of pages) {
    for (const l of liens(p.html)) {
      const m = l.href.match(/^tel:(.+)/i);
      const tel = m ? normaliserTelephone(decodeURIComponent(m[1])) : null;
      if (tel) return { valeur: tel, source: "lien", page: p.url, extrait: l.href.slice(0, 60) };
    }
  }
  for (let i = 0; i < pages.length; i++) {
    for (const m of textes[i].matchAll(/(?:\+33\s?|\b0)[1-9](?:[\s.-]?\d{2}){4}\b/g)) {
      const tel = normaliserTelephone(m[0]);
      if (tel) return { valeur: tel, source: "texte", page: pages[i].url, extrait: extraitAutour(textes[i], m.index ?? 0, m[0].length) };
    }
  }
  return null;
}

const RDV = /^https:\/\/(?:[\w-]+\.)*(?:calendly\.com|cal\.com|zcal\.co|tidycal\.com|koalendar\.com|meetings(?:-[\w]+)?\.hubspot\.com|calendar\.app\.google|calendar\.google\.com)\//i;

function lireLienRdv(pages: PageLue[]): Trouvaille | null {
  for (const p of pages) {
    for (const l of liens(p.html)) {
      if (RDV.test(l.href)) return { valeur: l.href.slice(0, 200), source: "lien", page: p.url, extrait: l.texte.slice(0, 80) || l.href.slice(0, 80) };
    }
  }
  return null;
}

const NOM_PERSONNE = "([A-ZÉÈ][a-zà-ÿ'’-]+(?:\\s+[A-ZÉÈ][A-Za-zÀ-ÿ'’-]+){1,2})";

function lireDirigeant(pages: PageLue[], textes: string[]): Trouvaille | null {
  const motifs = [
    new RegExp(`(?:directeur|directrice|responsable)\\s+(?:de\\s+(?:la\\s+)?)?publication\\s*:?\\s*(?:M\\.|Mme|Monsieur|Madame)?\\s*${NOM_PERSONNE}`, "i"),
    new RegExp(`\\b(?:gérant|gérante|président|présidente)\\s*:\\s*(?:M\\.|Mme|Monsieur|Madame)?\\s*${NOM_PERSONNE}`, "i"),
  ];
  for (const re of motifs) {
    for (let i = 0; i < pages.length; i++) {
      const m = textes[i].match(re);
      if (m?.[1]) {
        return { valeur: espaces(m[1]), source: "texte", page: pages[i].url, extrait: extraitAutour(textes[i], m.index ?? 0, m[0].length) };
      }
    }
  }
  return null;
}

/** Clé de Luhn : un SIREN valide la vérifie. Un nombre lu au hasard, presque jamais. */
function sirenValide(s: string): boolean {
  if (!/^\d{9}$/.test(s)) return false;
  let somme = 0;
  for (let i = 0; i < 9; i++) {
    let n = Number(s[8 - i]);
    if (i % 2 === 1) {
      n *= 2;
      if (n > 9) n -= 9;
    }
    somme += n;
  }
  return somme % 10 === 0;
}

function lireSiren(pages: PageLue[], textes: string[]): Trouvaille | null {
  for (let i = 0; i < pages.length; i++) {
    for (const m of textes[i].matchAll(/\b(?:SIREN|SIRET|RCS)\b[^0-9]{0,30}((?:\d[\s.]?){9,14})/g)) {
      const siren = m[1].replace(/\D/g, "").slice(0, 9);
      if (sirenValide(siren)) {
        return { valeur: siren, source: "texte", page: pages[i].url, extrait: extraitAutour(textes[i], m.index ?? 0, m[0].length) };
      }
    }
  }
  return null;
}

// ── L'assemblage ─────────────────────────────────────────────────────

/** Lit les pages d'un site — l'accueil EN PREMIER — et rend ce qu'on y a trouvé. */
export function lireSite(pages: PageLue[]): LectureSite {
  const accueil = pages[0];
  const textes = pages.map((p) => texteDe(p.html));
  const lds = pages.map((p) => entrepriseStructuree(donneesStructurees(p.html)));
  const iLd = lds.findIndex(Boolean);
  const ld = iLd >= 0 ? lds[iLd] : null;
  const pageLd = iLd >= 0 ? pages[iLd].url : accueil?.url ?? "";
  const m = accueil ? metas(accueil.html) : {};

  const nom = accueil ? lireNom(accueil, ld, m) : null;
  const activite = accueil ? lireActivite(accueil, ld, m) : null;
  const promesse = accueil ? lirePromesse(accueil, activite) : null;
  const ville = lireVille(pages, textes, ld, pageLd);
  const zone = lireZone(pages, textes);
  const clienteles = lireClienteles(pages, textes);
  const email = lireEmail(pages, textes, ld, pageLd);
  const telephone = lireTelephone(pages, textes, ld, pageLd);
  const lienRdv = lireLienRdv(pages);
  const dirigeant = lireDirigeant(pages, textes);
  const siren = lireSiren(pages, textes);

  const manques: string[] = [];
  if (!nom) manques.push("Le nom de ta société n'a pas été trouvé sur le site — à saisir.");
  if (!activite) manques.push("Le site n'a pas de description lisible : ce que tu vends reste à écrire en une ligne.");
  if (clienteles.length === 0) {
    manques.push(
      "Aucune clientèle nommée sur le site. Le secteur de tes clients reste à dire — c'est lui qui fabrique la démonstration."
    );
  }
  if (!ville && !zone) manques.push("Ni ville ni zone d'intervention lues — à préciser si tu prospectes localement.");
  if (!lienRdv) manques.push("Aucun lien de prise de rendez-vous sur le site (Calendly, Cal.com…).");

  return {
    site: accueil ? new URL(accueil.url).origin : "",
    pagesLues: pages.map((p) => p.url),
    nom,
    activite,
    promesse,
    ville,
    zone,
    clienteles,
    email,
    telephone,
    lienRdv,
    dirigeant,
    siren,
    registre: null,
    manques,
  };
}

/** Ce que l'écran propose d'appliquer. Rien ici ne s'applique tout seul. */
export interface PropositionConfig {
  /** Nom affiché et signataire de repli — le nom commercial lu, sinon la raison sociale. */
  agencyName: string;
  offer: { city: string; whatYouSell: string; valueProp: string };
  bookingUrl: string;
  profil: ProfilOperateur;
  /** Proposé seulement : ne devient signataire que si l'inscrit dit « c'est moi ». */
  dirigeant: string;
}

/**
 * Une description de site → ce qui suit « Tu vends … » : sans point final,
 * et sans la majuscule de début de phrase (sauf sigle — « BTP », « SaaS »).
 */
function enFinDePhrase(s: string): string {
  const t = s.trim().replace(/[.!…\s]+$/, "");
  return /^[A-ZÀ-Ý][a-zà-ÿ]/.test(t) ? t[0].toLowerCase() + t.slice(1) : t;
}

export function propositionDepuisLecture(l: LectureSite): PropositionConfig {
  const cible = l.clienteles[0];
  const ville = l.ville?.valeur ?? l.registre?.ville ?? "";
  return {
    agencyName: (l.nom?.valeur ?? l.registre?.raisonSociale ?? "").slice(0, 60),
    offer: {
      city: ville,
      whatYouSell: l.activite?.valeur ?? "",
      valueProp: l.promesse?.valeur ?? "",
    },
    bookingUrl: l.lienRdv?.valeur ?? "",
    profil: nettoyerProfil({
      metier: enFinDePhrase(l.activite?.valeur ?? ""),
      cibleSecteur: cible?.libelle ?? "",
      cibleRole: cible?.role ?? "",
      cibleZone: l.zone?.valeur ?? ville,
    }),
    dirigeant: l.dirigeant?.valeur ?? "",
  };
}
