import type { Meeting, Prospect } from "./types";

/**
 * ─────────────────────────────────────────────────────────────────────
 * Salle des Preuves — la valeur de l'OS, démontrée par ses propres
 * données. Doctrine : ZÉRO chiffre inventé. Tout ce qui est affiché ou
 * exporté ici sort du CRM (« le CRM fait foi ») ; les agrégats sont
 * anonymisés (aucun nom de client dans la carte publique).
 *
 * Pourquoi c'est le levier n°1 de valorisation : un outil qui PROUVE
 * en euros ce qu'il rapporte se vend tout seul — à tes prospects
 * (crédibilité), à ta waitlist (démo par la preuve), et à toi
 * (pilotage). La roue : usage → données → preuve → clients → usage.
 * ─────────────────────────────────────────────────────────────────────
 */

export interface ProofStats {
  /** € réellement encaissés (paiements « payé ») sur les clients apportés. */
  encaisse: number;
  /** € facturés en attente / en retard. */
  enAttente: number;
  /** Commission générée pour l'opérateur (commissionPct du CA encaissé). */
  commission: number;
  /** Taxe d'Ignorance mensuelle que les clients SIGNÉS ne perdent plus. */
  taxeRendueMensuelle: number;
  signes: number;
  perdus: number;
  /** signés / (signés + perdus), en %. Null si aucune issue tranchée. */
  closingRate: number | null;
  /** Durée médiane premier contact → signature, en jours. Null si inconnu. */
  cycleJours: number | null;
  /** Touches sortantes consignées, par canal. */
  touches: { email: number; whatsapp: number; linkedin: number; appel: number; visite: number };
  touchesTotal: number;
  rdvTenus: number;
  temoignages: { company: string; text: string; at?: string }[];
}

const DAY = 86_400_000;

export function proofStats(prospects: Prospect[], meetings: Meeting[], commissionPct: number): ProofStats {
  let encaisse = 0;
  let enAttente = 0;
  let taxeRendue = 0;
  let signes = 0;
  let perdus = 0;
  const cycles: number[] = [];
  const touches = { email: 0, whatsapp: 0, linkedin: 0, appel: 0, visite: 0 };
  const temoignages: ProofStats["temoignages"] = [];

  for (const p of prospects) {
    for (const pay of p.payments) {
      if (pay.status === "paye") encaisse += pay.amount;
      else enAttente += pay.amount;
    }
    if (p.stage === "signe") {
      signes++;
      if (p.ignoranceTax > 0) taxeRendue += p.ignoranceTax;
      const first = p.events.length
        ? Math.min(...p.events.map((e) => new Date(e.date).getTime()))
        : NaN;
      const signedAt = p.contract.signedAt ? new Date(p.contract.signedAt).getTime() : NaN;
      if (Number.isFinite(first) && Number.isFinite(signedAt) && signedAt > first) {
        cycles.push(Math.round((signedAt - first) / DAY));
      }
    }
    if (p.stage === "perdu") perdus++;
    for (const e of p.events) {
      // On ne compte que les canaux de contact réels (pas notes/stage/offre).
      if (e.kind in touches) touches[e.kind as keyof typeof touches]++;
    }
    if (p.testimonial?.trim()) {
      temoignages.push({ company: p.company, text: p.testimonial.trim(), at: p.testimonialAt });
    }
  }

  cycles.sort((a, b) => a - b);
  const cycleJours = cycles.length ? cycles[Math.floor(cycles.length / 2)] : null;
  const decided = signes + perdus;

  return {
    encaisse,
    enAttente,
    commission: Math.round((encaisse * commissionPct) / 100),
    taxeRendueMensuelle: taxeRendue,
    signes,
    perdus,
    closingRate: decided ? Math.round((signes / decided) * 100) : null,
    cycleJours,
    touches,
    touchesTotal: Object.values(touches).reduce((a, b) => a + b, 0),
    rdvTenus: meetings.filter((m) => m.done).length,
    temoignages,
  };
}

const eur = (n: number) => n.toLocaleString("fr-FR") + " €";
const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/**
 * Carte de preuve publique — document HTML autonome, anonymisé (aucun
 * nom de client), prêt à capturer pour LinkedIn/X ou à imprimer.
 * DA encre & or. Chaque chiffre vient de proofStats → du CRM.
 */
export function renderProofCard(s: ProofStats, operatorName = "EAGLEYE CORP"): string {
  /**
   * ⚠ LA CARTE SE CONTREDISAIT ELLE-MÊME À ZÉRO VENTE.
   *
   * Elle affichait « Clients signés : 0 » sous la phrase « la même machine que
   * nous installons chez NOS CLIENTS », le tout titré « Des chiffres, pas des
   * promesses » — et elle s'exporte en PDF pour un prospect.
   *
   * Les chiffres, eux, étaient honnêtes : `proofStats` rend des zéros et un
   * `closingRate: null`, exactement comme la doctrine l'exige. C'est la PROSE
   * autour qui affirmait une clientèle que les chiffres démentaient trois
   * lignes plus bas.
   *
   * Aligner des zéros sous « des chiffres, pas des promesses » ne prouve rien
   * et se retourne contre nous. On DIT l'absence — c'est la même règle que
   * partout ailleurs : zéro donnée → on nomme l'angle mort.
   */
  const vide = s.signes === 0 && s.encaisse === 0 && s.touchesTotal === 0;
  const date = new Date().toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
  const stat = (label: string, value: string, sub = "", accent = "#E8C98A") => `
    <div style="background:#15110D;border:1px solid rgba(243,238,228,.12);border-radius:16px;padding:22px;">
      <div style="font-family:'JetBrains Mono',monospace;font-size:10px;letter-spacing:.18em;text-transform:uppercase;color:#8E877B;">${esc(label)}</div>
      <div style="font-family:'Bricolage Grotesque',sans-serif;font-weight:800;font-size:2.1rem;color:${accent};margin-top:6px;">${esc(value)}</div>
      ${sub ? `<div style="font-size:.82rem;color:#8E877B;margin-top:2px;">${esc(sub)}</div>` : ""}
    </div>`;

  return `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>Preuves — ${esc(operatorName)}</title>
<link href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:wght@700;800&family=Inter+Tight:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet" />
<style>
  body{margin:0;background:#0A0807;color:#F3EEE4;font-family:'Inter Tight',system-ui,sans-serif;line-height:1.55}
  .print{position:fixed;top:14px;right:14px;font-size:12px;background:#E8C98A;color:#1B1408;border:none;border-radius:100px;padding:9px 18px;cursor:pointer;font-weight:700}
  @media print{.print{display:none}}
</style>
</head>
<body>
<button class="print" onclick="window.print()">Imprimer / PDF</button>
<div style="max-width:820px;margin:0 auto;padding:48px 24px 60px;">
  <div style="display:flex;align-items:center;gap:12px;">
    <span style="font-size:26px;">🦅</span>
    <div>
      <div style="font-family:'Bricolage Grotesque',sans-serif;font-weight:800;font-size:18px;letter-spacing:.04em;">${esc(operatorName)}</div>
      <div style="font-family:'JetBrains Mono',monospace;font-size:9.5px;letter-spacing:.22em;text-transform:uppercase;color:#E8C98A;">Preuves de terrain · ${esc(date)}</div>
    </div>
  </div>

  <h1 style="font-family:'Bricolage Grotesque',sans-serif;font-weight:800;font-size:clamp(1.6rem,4vw,2.3rem);letter-spacing:-.01em;margin:26px 0 6px;">
    Des chiffres, pas des promesses.
  </h1>
  <p style="color:#8E877B;max-width:560px;margin:0 0 26px;">
    Extraits en direct de notre CRM — agrégés, anonymisés, datés. Ces chiffres
    sont produits par la machine elle-même : le produit tourne d'abord ici.
  </p>

  ${vide ? `
  <div style="border:1px solid #3A342C;border-radius:12px;padding:18px 20px;margin-bottom:26px;">
    <p style="margin:0;color:#F3EEE4;font-weight:600;">Aucune vente à ce jour.</p>
    <p style="margin:8px 0 0;color:#8E877B;">
      Cette page n'a donc rien à prouver pour l'instant, et elle le dit plutôt que
      d'aligner des zéros. Les compteurs ci-dessous sont réels : ils se rempliront
      d'eux-mêmes, ou ils resteront à zéro. C'est le contrat.
    </p>
  </div>` : ""}

  <div style="display:grid;gap:14px;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));">
    ${stat("CA encaissé — clients apportés", eur(s.encaisse))}
    ${stat("Taxe d'Ignorance rendue", eur(s.taxeRendueMensuelle) + " /mois", "ce qui n'est plus perdu", "#86C06A")}
    ${stat("Clients signés", String(s.signes), s.closingRate !== null ? `taux de closing ${s.closingRate} %` : "")}
    ${stat("Touches réelles consignées", s.touchesTotal.toLocaleString("fr-FR"), `${s.rdvTenus} RDV tenus${s.cycleJours !== null ? ` · cycle médian ${s.cycleJours} j` : ""}`)}
  </div>

  ${s.temoignages.length ? `
  <div style="margin-top:26px;border-left:3px solid #E8C98A;padding:6px 0 6px 18px;">
    <p style="font-style:italic;color:#F3EEE4;margin:0;">« ${esc(s.temoignages[0].text)} »</p>
    <p style="font-family:'JetBrains Mono',monospace;font-size:10px;letter-spacing:.14em;text-transform:uppercase;color:#8E877B;margin:8px 0 0;">— Client accompagné (avec accord)</p>
  </div>` : ""}

  <p style="margin-top:30px;font-family:'JetBrains Mono',monospace;font-size:10px;letter-spacing:.12em;text-transform:uppercase;color:#8E877B;">
    Chiffres issus du CRM à date · aucun chiffre projeté · Généré avec Alpha Sales OS®
  </p>
</div>
</body>
</html>`;
}
