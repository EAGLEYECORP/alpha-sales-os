// ─────────────────────────────────────────────────────────────────────
// Hormozi doctrine — frameworks, libraries, rule-based fallback engine.
// $100M Offers / Acquisition.com native. French field vocabulary.
// ─────────────────────────────────────────────────────────────────────
import type {
  BlameLayer,
  Croyances,
  Objection,
  ObjectionType,
  Prospect,
  Stage,
} from "./types";
// ⚠ Pas d'import de `lib/bricks` : ce module est atteint par `lib/store`, donc
// par TOUTES les pages client, et la grille tarifaire y partait en entier
// (chemin mesuré : app/(app)/*/page → lib/store → lib/hormozi → lib/bricks).
// Seul le LIBELLÉ est nécessaire ici : il vient de la vue publique, qui ne
// porte aucun montant par brique.
import { CAPACITES } from "./public-catalogue";
import { guessSegmentForProspect } from "./segments";

export const STAGES: {
  id: Stage;
  label: string;
  probability: number;
  hint: string;
}[] = [
  { id: "prospect", label: "Prospect", probability: 5, hint: "Repéré, pas encore contacté" },
  { id: "contact", label: "Contact", probability: 15, hint: "Premier échange fait — next step daté obligatoire" },
  { id: "audit", label: "Audit", probability: 30, hint: "Diagnostic terrain : Taxe d'Ignorance chiffrée" },
  { id: "demo", label: "Démo mobile", probability: 50, hint: "Émotion d'abord — la démo AVANT le prix" },
  { id: "offre", label: "Offre", probability: 65, hint: "Prix annoncé — la décision EST le produit" },
  { id: "redzone", label: "Red Zone", probability: 78, hint: "Objections post-offre — 3 Croyances à 10" },
  { id: "signe", label: "Signé", probability: 100, hint: "Conviction 10/10 validée" },
  { id: "perdu", label: "Perdu", probability: 0, hint: "Raison documentée, nurture 90 jours" },
];

export const stageById = (id: Stage) => STAGES.find((s) => s.id === id)!;

export const BLAME_LAYERS: Record<BlameLayer, { label: string; description: string; peel: string }> = {
  circonstances: {
    label: "Circonstances",
    description: "« C'est pas le moment, la saison, la conjoncture… »",
    peel: "Chiffrer la Taxe d'Ignorance : chaque mois d'attente a un coût précis. La circonstance parfaite n'existe pas — le coût de l'inaction, si.",
  },
  autres: {
    label: "Les Autres",
    description: "« Mon associé, ma femme, mon comptable doit valider… »",
    peel: "Identifier le vrai décideur, proposer une démo mobile à deux. Jamais laisser partir sans un rendez-vous daté avec le tiers.",
  },
  soi: {
    label: "Soi",
    description: "« Je suis nul en informatique, j'ai déjà raté un site… »",
    peel: "Croyance n°3 : ça marche POUR LUI. Preuve sociale même secteur, même ville. On fait tout — il n'a rien à apprendre.",
  },
};

export const OBSTACLE_LIBRARY: { label: string; blameLayer: BlameLayer }[] = [
  { label: "« Pas le moment, c'est la haute saison »", blameLayer: "circonstances" },
  { label: "« La conjoncture est mauvaise »", blameLayer: "circonstances" },
  { label: "« Je dois en parler à mon associé »", blameLayer: "autres" },
  { label: "« Mon neveu s'occupe déjà du site »", blameLayer: "autres" },
  { label: "« Je suis nul avec la technologie »", blameLayer: "soi" },
  { label: "« J'ai déjà payé pour un site qui n'a rien donné »", blameLayer: "soi" },
  { label: "« Les clients viennent par bouche-à-oreille »", blameLayer: "circonstances" },
];

export const OBJECTION_LIBRARY: {
  label: string;
  type: ObjectionType;
  croyance: 1 | 2 | 3;
  counter: string;
}[] = [
  {
    label: "« C'est trop cher »",
    type: "argent",
    croyance: 3,
    counter:
      "Ce n'est pas un prix, c'est un différentiel. Taxe d'Ignorance : tu perds X €/mois sans rien faire. L'offre coûte moins que l'inaction. Montre le calcul sur SON téléphone.",
  },
  {
    label: "« Je vais réfléchir »",
    type: "temps",
    croyance: 3,
    counter:
      "Réfléchir à quoi exactement ? Isoler la vraie croyance cassée (produit / soutien / pour lui). Une décision différée est une décision — elle coûte la Taxe d'Ignorance chaque mois.",
  },
  {
    label: "« Et si ça ne marche pas pour mon commerce ? »",
    type: "confiance",
    croyance: 3,
    counter:
      "Preuve même secteur + même ville. Garantie de résultat conditionnelle. Le risque est chez nous, pas chez lui.",
  },
  {
    label: "« Je dois valider avec le siège / la banque »",
    type: "autorite",
    croyance: 2,
    counter:
      "OK — on prépare ensemble le dossier de validation, et on fixe MAINTENANT la date de la réponse. Jamais de sortie sans next step daté.",
  },
  {
    label: "« Un concurrent me propose moins cher »",
    type: "concurrent",
    croyance: 1,
    counter:
      "Comparer la valeur, pas le prix : ce qui tourne sans vous, la maintenance, les résultats mesurés. Moins cher = moins de résultat = plus cher au final. Sortir la fiche intel concurrent.",
  },
];

export const CROYANCES_META: { key: keyof Croyances; num: 1 | 2 | 3; label: string; description: string }[] = [
  { key: "produit", num: 1, label: "Le produit fonctionne", description: "Ce qu'on installe produit des résultats mesurables, point." },
  { key: "soutien", num: 2, label: "Tu le soutiens", description: "Il croit que TOI tu seras là. Support, proximité, réactivité." },
  { key: "pourLui", num: 3, label: "Ça marche POUR LUI", description: "Pas en général — pour SON équipe, SON plateau, SON métier." },
];

// ── Value & forecast math ────────────────────────────────────────────

export const annualValue = (p: Prospect) => p.monthlyValue * 12 + p.setupValue;

export const weightedValue = (p: Prospect) =>
  p.stage === "perdu" ? 0 : (annualValue(p) * p.probability) / 100;

export const ignoranceTaxTotal = (p: Prospect) => {
  const created = new Date(p.createdAt).getTime();
  const months = Math.max(1, Math.round((Date.now() - created) / (30 * 864e5)));
  return p.ignoranceTax * months;
};

export const croyancesReady = (c: Croyances) =>
  c.produit >= 10 && c.soutien >= 10 && c.pourLui >= 10;

/** Doctrine gate for "Signé". Returns list of violations (empty = clear to sign). */
export function signingBlockers(p: Prospect): string[] {
  const blockers: string[] = [];
  if (p.conviction < 10) blockers.push(`Conviction ${p.conviction}/10 — il faut 10/10. La conviction se transfère, elle ne se négocie pas.`);
  if (!p.demoShownBeforePrice) blockers.push("Démo mobile jamais montrée avant le prix. Émotion d'abord, logique ensuite.");
  if (!croyancesReady(p.croyances)) blockers.push("Les 3 Croyances ne sont pas toutes à 10 (produit / soutien / pour lui).");
  const open = p.objections.filter((o) => o.status !== "traitee");
  if (open.length) blockers.push(`${open.length} objection(s) Red Zone encore ouverte(s).`);
  return blockers;
}

/** Rule-based "next best action" — deterministic, no API needed. */
export function nextBestAction(p: Prospect): { action: string; why: string; urgency: "haute" | "moyenne" | "basse" } {
  if (p.stage === "perdu")
    return { action: "Basculer en séquence nurture 90 jours", why: "Un perdu documenté est un futur signé. On reste présent sans vendre.", urgency: "basse" };
  if (p.stage === "signe")
    return { action: "Onboarding + demande de recommandation datée", why: "Le meilleur moment pour un referral : la semaine de la signature.", urgency: "moyenne" };
  if (!p.nextStep)
    return { action: "Fixer un next step DATÉ maintenant", why: "Doctrine : aucun contact ne se termine sans prochaine étape datée.", urgency: "haute" };
  if (new Date(p.nextStep.date) < new Date())
    return { action: `Next step en retard : « ${p.nextStep.action} » — relancer aujourd'hui`, why: "Un next step dépassé, c'est de la confiance qui s'évapore.", urgency: "haute" };
  if (p.stage === "redzone") {
    const open = p.objections.filter((o) => o.status !== "traitee");
    if (open.length) {
      const target = open[0];
      const c = CROYANCES_META.find((m) => m.num === target.croyance)!;
      return { action: `Traiter « ${target.label} » — recadrer sur la croyance ${c.num} (${c.label})`, why: "En Red Zone, chaque objection pointe une croyance cassée. On répare la croyance, pas l'argument.", urgency: "haute" };
    }
    return { action: "Demander la signature — les 3 croyances sont réparées", why: "Plus d'objection ouverte : la décision est mûre. La décision EST le produit.", urgency: "haute" };
  }
  if (p.stage === "offre" && !p.demoShownBeforePrice)
    return { action: "⚠ Prix annoncé sans démo mobile — reprogrammer une démo émotionnelle", why: "Violation doctrine : émotion d'abord. Réparer avec une démo sur SON téléphone.", urgency: "haute" };
  if (p.stage === "demo")
    return { action: "Démo mobile sur SON téléphone, avec SES couleurs et SON menu", why: "L'émotion vient de se voir déjà propriétaire. Le prix n'existe pas encore.", urgency: "haute" };
  if (p.stage === "audit" && p.auditScore < 60)
    return { action: `Compléter l'audit (${p.auditScore}/100) et chiffrer la Taxe d'Ignorance`, why: "Sans chiffre, la circonstance gagne. Avec un chiffre, l'inaction devient chère.", urgency: "moyenne" };
  if (p.stage === "contact") {
    const unresolved = p.obstacles.filter((o) => !o.resolved);
    if (unresolved.length)
      return { action: `Éplucher l'Oignon du Blâme : « ${unresolved[0].label} »`, why: `Couche « ${BLAME_LAYERS[unresolved[0].blameLayer].label} » — ${BLAME_LAYERS[unresolved[0].blameLayer].peel}`, urgency: "moyenne" };
    return { action: "Proposer l'audit terrain gratuit (20 min sur place)", why: "L'audit crée la dette de réciprocité et chiffre la Taxe d'Ignorance.", urgency: "moyenne" };
  }
  if (p.stage === "prospect")
    return { action: "Premier contact : passer au commerce à l'heure creuse", why: "Lyon = terrain. Le face-à-face bat le cold email chez les commerçants.", urgency: "moyenne" };
  return { action: "Avancer vers la démo mobile", why: "Tout converge vers le moment émotionnel : la démo avant le prix.", urgency: "moyenne" };
}

// ── Fallback AI engine (no API key needed) ───────────────────────────

const SECTOR_HOOKS: Record<string, { pain: string; dream: string; proof: string }> = {
  restaurant: {
    pain: "des tables vides en semaine et des no-shows qui coûtent cher",
    dream: "un service complet qui se remplit tout seul, réservations 24/7 même pendant le coup de feu",
    proof: "les restos lyonnais qu'on équipe prennent leurs réservations la nuit, pendant que le patron dort",
  },
  pub: {
    pain: "des soirées creuses en début de semaine",
    dream: "des événements annoncés automatiquement et une communauté d'habitués qui revient",
    proof: "nos pubs clients remplissent leurs mardis soir avec l'agenda IA + relances WhatsApp",
  },
  ambulance: {
    pain: "un standard saturé et des demandes de transport perdues",
    dream: "une prise de demande 24/7 qui trie l'urgent du programmé",
    proof: "nos clients ambulanciers ne ratent plus une demande de nuit — l'IA qualifie et route",
  },
  artisan: {
    pain: "des devis qui traînent et des appels manqués sur les chantiers",
    dream: "des demandes de devis qualifiées qui arrivent toutes seules pendant que tu es sur chantier",
    proof: "nos artisans reçoivent des demandes pré-qualifiées : budget, délai, photos — tout est prêt",
  },
  autre: {
    pain: "des clients qui passent chez le concurrent faute de réponse rapide",
    dream: "une présence en ligne qui travaille 24/7",
    proof: "nos clients lyonnais mesurent chaque euro généré par leur site",
  },
};

export function fallbackScript(p: Prospect, rules: string): string {
  const hook = SECTOR_HOOKS[p.sector] ?? SECTOR_HOOKS.autre;
  const tax = p.ignoranceTax > 0 ? `${p.ignoranceTax.toLocaleString("fr-FR")} €/mois` : "à chiffrer sur place";
  return [
    `# Script terrain — ${p.company} (${p.name})`,
    ``,
    `## 1. Ouverture (10 s — zéro pitch)`,
    `« Bonjour ${p.name.split(" ")[0]}, je travaille avec des ${p.sector}s du coin sur ${hook.pain}. J'ai 2 minutes et un truc à vous montrer sur mon téléphone — pas à vous vendre, à vous montrer. »`,
    ``,
    `## 2. Démo mobile AVANT tout prix (émotion d'abord)`,
    `Sortir le téléphone. Maquette avec LEUR nom, LEURS couleurs. « Voilà à quoi ressemblerait ${p.company} en ligne. » Se taire. Laisser regarder.`,
    ``,
    `## 3. Taxe d'Ignorance (logique ensuite)`,
    `« Aujourd'hui, chaque mois sans ça vous coûte environ ${tax}. Ce n'est pas moi qui le dis, c'est votre propre flux de clients. »`,
    ``,
    `## 4. Oignon du Blâme — anticiper les couches`,
    ...p.obstacles.filter((o) => !o.resolved).map((o) => `- ${o.label} → couche « ${BLAME_LAYERS[o.blameLayer].label} » : ${BLAME_LAYERS[o.blameLayer].peel}`),
    p.obstacles.filter((o) => !o.resolved).length === 0 ? `- Aucun obstacle ouvert — dérouler.` : ``,
    ``,
    `## 5. Les 3 Croyances à installer`,
    `1. **Le produit fonctionne** — ${hook.proof}.`,
    `2. **Tu le soutiens** — « Je suis à Lyon, je passe. Vous m'appelez, je réponds. »`,
    `3. **Ça marche POUR LUI** — preuve même secteur, même quartier si possible.`,
    ``,
    `## 6. Clôture — next step DATÉ`,
    `« Je vous propose un audit gratuit de 20 minutes ${nextWeekday()} — je viens, je chiffre ce que vous perdez, vous décidez avec les vrais chiffres. ${nextWeekday()} 10h ou plutôt 15h ? »`,
    ``,
    rules ? `---\n*Règles business appliquées : ${rules.slice(0, 200)}*` : ``,
  ].join("\n");
}

export function fallbackObjectionAnswer(objectionLabel: string, p: Prospect): string {
  const known = OBJECTION_LIBRARY.find((o) => objectionLabel.toLowerCase().includes(o.label.slice(2, 12).toLowerCase()));
  const base = known
    ? known.counter
    : "Isoler la croyance cassée : le produit ? le soutien ? ou « pour lui » ? Recadrer sur la preuve, jamais sur l'argument.";
  return [
    `**Objection :** ${objectionLabel}`,
    ``,
    `**Recadrage (croyance ${known?.croyance ?? 3}) :** ${base}`,
    ``,
    `**Phrase terrain :** « Je comprends. Question directe : si ${known?.type === "argent" ? "le budget n'était pas un sujet" : "cette contrainte disparaissait"}, on démarre quand ? » — la réponse révèle la vraie couche de l'oignon.`,
    ``,
    `**Rappel doctrine :** ne jamais traiter une objection qu'on peut prévenir. Taxe d'Ignorance de ${p.company} : ${p.ignoranceTax.toLocaleString("fr-FR")} €/mois.`,
  ].join("\n");
}

/**
 * Les briques à recommander, déduites du SEGMENT du prospect.
 *
 * Avant, ce texte était figé sur « site vitrine premium + overlay IA » : le
 * produit d'origine. Recommander ça à un plateau de 40 positions ou à une
 * équipe de porte-à-porte, c'est se disqualifier en une ligne. Repli neutre
 * si le segment n'est pas identifiable — on ne devine pas.
 */
function recommendedBricks(p: Prospect): string {
  const seg = guessSegmentForProspect({ sector: p.sector, company: p.company, notes: p.notes, problems: p.problems });
  if (!seg) return "Alpha Sales OS — briques à arrêter au cadrage";
  const labels = seg.entryBricks.map((id) => CAPACITES.find((c) => c.id === id)?.label ?? id);
  return labels.length ? labels.join(" + ") : "Alpha Sales OS";
}

export function fallbackAuditNotes(p: Prospect): string {
  const hook = SECTOR_HOOKS[p.sector] ?? SECTOR_HOOKS.autre;
  return [
    `# Audit — ${p.company} (${p.city})`,
    ``,
    `## Situation`,
    `Secteur ${p.sector} · Confiance ${p.trust}/100 · Étape ${stageById(p.stage).label}`,
    `Douleur type secteur : ${hook.pain}.`,
    ``,
    `## Taxe d'Ignorance (hypothèse à valider sur place)`,
    `- Clients perdus faute de présence en ligne / réponse rapide : ~${Math.max(4, Math.round(p.ignoranceTax / 80))} clients/mois`,
    `- Manque à gagner estimé : **${p.ignoranceTax.toLocaleString("fr-FR")} €/mois**, soit ${(p.ignoranceTax * 12).toLocaleString("fr-FR")} €/an`,
    ``,
    `## Ce qu'on vérifie sur place (20 min)`,
    `1. Fiche Google : avis, photos, horaires — score actuel`,
    `2. Flux entrants : combien d'appels/demandes ratés par semaine ?`,
    `3. Concurrence directe dans un rayon de 500 m : qui capte la demande ?`,
    `4. Process actuel : qui répond, quand, comment ?`,
    ``,
    `## Recommandation`,
    // Le segment, pas le secteur : une équipe de 12 poseurs en porte-à-porte et
    // un bouchon lyonnais n'ont ni la même douleur ni la même brique d'entrée.
    // Et surtout : PAS de nom de compte en dur — l'OS est white-label, celui qui
    // recommande n'est pas toujours EAGLEYE.
    `${recommendedBricks(p)} (${hook.dream}). Setup ${p.setupValue.toLocaleString("fr-FR")} € + ${p.monthlyValue.toLocaleString("fr-FR")} €/mois.`,
    `ROI attendu : la Taxe d'Ignorance seule couvre ${p.monthlyValue > 0 ? Math.round(p.ignoranceTax / p.monthlyValue) : "—"}× l'abonnement.`,
  ].join("\n");
}

export function fallbackSummary(p: Prospect): string {
  const nba = nextBestAction(p);
  const openObs = p.obstacles.filter((o) => !o.resolved).length;
  const openObj = p.objections.filter((o) => o.status !== "traitee").length;
  return [
    `**${p.company}** — ${stageById(p.stage).label}, probabilité ${p.probability} %.`,
    `Pipe pondéré : ${Math.round(weightedValue(p)).toLocaleString("fr-FR")} € · Taxe d'Ignorance : ${p.ignoranceTax.toLocaleString("fr-FR")} €/mois.`,
    `Croyances : produit ${p.croyances.produit}/10 · soutien ${p.croyances.soutien}/10 · pour lui ${p.croyances.pourLui}/10.`,
    openObs ? `${openObs} obstacle(s) pré-offre ouverts.` : `Aucun obstacle ouvert.`,
    openObj ? `⚠ ${openObj} objection(s) Red Zone ouvertes.` : ``,
    ``,
    `**Prochaine action :** ${nba.action} — ${nba.why}`,
  ].filter(Boolean).join("\n");
}

function nextWeekday(): string {
  const d = new Date();
  do d.setDate(d.getDate() + 1);
  while (d.getDay() === 0 || d.getDay() === 6);
  return d.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });
}
