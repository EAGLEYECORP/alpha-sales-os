import { NextRequest, NextResponse } from "next/server";
import type { Prospect } from "@/lib/types";
import { runAI } from "@/lib/ai-engine";
import { playbookPrompt } from "@/lib/playbook";
import { prescripteurPrompt } from "@/lib/prescripteurs";
import {
  fallbackAuditNotes,
  fallbackObjectionAnswer,
  fallbackScript,
  fallbackSummary,
  nextBestAction,
  stageById,
} from "@/lib/hormozi";

export const runtime = "nodejs";
export const maxDuration = 60;

type AiTask = "script" | "audit" | "objection" | "summary" | "next-action" | "reply" | "briefing" | "prescripteur";

interface AiRequest {
  task: AiTask;
  /** Requis pour toutes les tâches sauf `briefing` (qui porte sur la tournée). */
  prospect?: Prospect;
  businessRules: string;
  /** Identité + offre du compte (white-label). */
  identity?: string;
  /** Extraits du Cerveau (RAG) récupérés côté client. */
  brainContext?: string;
  objection?: string;
  /** inbound message to answer (task = reply) */
  inboundMessage?: string;
  /** résumé de la tournée du jour (task = briefing) */
  tourSummary?: string;
  /** verticale du playbook terrain à injecter (défaut : déduite du secteur) */
  verticalId?: string;
  /** archétype de prescripteur (task = prescripteur) — leur économie n'est pas celle d'un prospect */
  archetypeId?: string;
  /** question libre sur l'approche d'un prescripteur */
  question?: string;
}

const SYSTEM = `Tu es le copilote de vente de l'agence (son identité et son offre te sont données en tête).
Doctrine Hormozi non négociable :
- La décision EST le produit. Émotion d'abord (démo mobile avant le prix), logique ensuite.
- OBSTACLES (pré-offre) ≠ OBJECTIONS (post-offre / Red Zone). Ne jamais confondre.
- Oignon du Blâme : Circonstances → Les Autres → Soi. On épluche couche par couche.
- Toujours chiffrer la Taxe d'Ignorance (€/mois perdus à ne rien faire).
- 3 Croyances à 10/10 avant signature : le produit fonctionne, tu le soutiens, ça marche POUR LUI.
- Chaque contact se termine par un next step DATÉ. Conviction 10/10 requise.
Réponds en français, format Markdown, concret et terrain — zéro corporate.`;

function buildPrompt(req: AiRequest): string {
  // Un prescripteur n'a PAS le problème qu'on résout : il connaît des gens
  // qui l'ont. L'argumentaire prospect ne s'applique pas, et le servir
  // quand même fait perdre l'interlocuteur en une phrase.
  if (req.task === "prescripteur") {
    return [
      `## Règles business de l'agence`,
      req.businessRules,
      ``,
      `## Question`,
      req.question ?? "Comment aborder ce prescripteur ?",
      ``,
      `## Tâche`,
      `Réponds en partant de SON économie à lui : ce qu'il gagne, ce qu'il risque, ce que ça lui coûte en temps. Donne une phrase exacte à prononcer, la demande concrète et petite à formuler, et le piège à éviter avec cet archétype précis. Jamais de projection chiffrée sans fourchette ni hypothèses.`,
    ].join("\n");
  }

  // Le briefing porte sur la tournée entière, pas sur une fiche.
  if (req.task === "briefing") {
    return [
      `## Tournée du jour (RDV terrain, dans l'ordre horaire)`,
      req.tourSummary ?? "(aucune étape)",
      ``,
      `## Règles business de l'agence`,
      req.businessRules,
      ``,
      `## Tâche`,
      `Tu es le directeur commercial qui briefe son closer avant la tournée. Donne un BRIEFING tactique en 4 puces courtes (commence chaque ligne par « • »), langage terrain :`,
      `1. l'ordre / le rythme de la tournée,`,
      `2. LE closing prioritaire du jour et pourquoi (valeur × chaleur),`,
      `3. l'angle qui marche aujourd'hui (Taxe d'Ignorance chiffrée, démo mobile avant prix),`,
      `4. le piège doctrine à éviter (croyance cassée, objection bloquante, prix sans démo).`,
    ].join("\n");
  }

  const p = req.prospect!;
  const ctx = [
    `## Prospect`,
    `- ${p.name}, ${p.company} (${p.sector}) — ${p.city}`,
    `- Étape : ${stageById(p.stage).label} · Probabilité ${p.probability} % · Confiance ${p.trust}/100`,
    `- Valeur : ${p.setupValue} € setup + ${p.monthlyValue} €/mois · Taxe d'Ignorance : ${p.ignoranceTax} €/mois`,
    `- Croyances : produit ${p.croyances.produit}/10, soutien ${p.croyances.soutien}/10, pour lui ${p.croyances.pourLui}/10`,
    `- Démo mobile avant prix : ${p.demoShownBeforePrice ? "OUI ✓" : "NON ⚠"}`,
    `- Affinité (il nous apprécie) : ${p.likeness}/100`,
    `- Obstacles ouverts : ${p.obstacles.filter((o) => !o.resolved).map((o) => o.label).join(" ; ") || "aucun"}`,
    `- Objections ouvertes : ${p.objections.filter((o) => o.status !== "traitee").map((o) => o.label).join(" ; ") || "aucune"}`,
    `- Problèmes audités : ${p.problems.length ? p.problems.join(" ; ") : "audit non documenté"}`,
    `- Solution conçue : ${p.solution || "—"}`,
    `- Offre personnalisée : ${p.personalizedOffer || "—"}`,
    `- Contrat : ${p.contract.status} · Livraison : ${p.delivery}`,
    `- Derniers contacts : ${p.events.slice(0, 3).map((e) => `[${e.kind}] ${e.summary}`).join(" | ") || "aucun"}`,
    `- Notes : ${p.notes || "—"}`,
    ``,
    `## Règles business de l'agence`,
    req.businessRules,
  ].join("\n");

  switch (req.task) {
    case "script":
      return `${ctx}\n\n## Tâche\nGénère un script de vente terrain complet pour le prochain contact : ouverture, démo mobile (avant tout prix), Taxe d'Ignorance, anticipation des couches de l'Oignon du Blâme, installation des 3 Croyances, clôture avec next step daté.`;
    case "audit":
      return `${ctx}\n\n## Tâche\nRédige des notes d'audit pré-remplies : situation, Taxe d'Ignorance chiffrée avec hypothèses, points à vérifier sur place, recommandation.`;
    case "objection":
      return `${ctx}\n\n## Tâche\nObjection Red Zone à traiter : « ${req.objection} ». Identifie la croyance cassée (1, 2 ou 3), donne le recadrage et une phrase terrain exacte à prononcer.`;
    case "summary":
      return `${ctx}\n\n## Tâche\nRésumé intelligent en 5 lignes max : où on en est, quel est le vrai blocage, quelle est la prochaine action et pourquoi.`;
    case "next-action":
      return `${ctx}\n\n## Tâche\nRecommande LA prochaine meilleure action (une seule), avec le pourquoi doctrine et le timing exact.`;
    case "reply":
      return `${ctx}\n\n## Message entrant du prospect\n« ${req.inboundMessage ?? ""} »\n\n## Tâche\nRédige LA réponse à envoyer (email ou WhatsApp selon le ton). Objectif unique : verrouiller un next step DATÉ (audit ou démo mobile). Court, chaleureux, zéro pitch produit, jamais de prix par écrit avant la démo. Termine par une question fermée à deux créneaux.`;
  }
}

function fallback(req: AiRequest): string {
  switch (req.task) {
    case "prescripteur": {
      // Sans IA, on rend la doctrine elle-même : elle est écrite, précise,
      // et elle vaut mieux qu'une paraphrase générique.
      return prescripteurPrompt(req.archetypeId);
    }
    case "briefing":
      // Le client affiche déjà son brief déterministe (lib/closer) ; ce repli
      // serveur rappelle juste la doctrine de tournée.
      return [
        "• Suis l'ordre horaire — chaque RDV se termine par un next step DATÉ.",
        "• Garde ton énergie pour le closing à plus forte valeur pondérée × chaleur.",
        "• L'angle : la Taxe d'Ignorance chiffrée, démo mobile AVANT tout prix.",
        "• Piège : ne traite jamais une objection sans avoir isolé la croyance cassée.",
      ].join("\n");
    case "script":
      return fallbackScript(req.prospect!, req.businessRules);
    case "audit":
      return fallbackAuditNotes(req.prospect!);
    case "objection":
      return fallbackObjectionAnswer(req.objection ?? "Objection inconnue", req.prospect!);
    case "summary":
      return fallbackSummary(req.prospect!);
    case "next-action": {
      const nba = nextBestAction(req.prospect!);
      return `**Action recommandée (${nba.urgency}) :** ${nba.action}\n\n**Pourquoi :** ${nba.why}`;
    }
    case "reply": {
      const p = req.prospect!;
      const first = (p.name || "").split(" ")[0] || "bonjour";
      return [
        `**Brouillon de réponse (moteur templates) :**`,
        ``,
        `Bonjour ${first},`,
        ``,
        `Merci pour votre retour ! Le plus simple : je passe vous montrer 2 minutes, sur mon téléphone, à quoi ressemblerait ${p.company} en ligne — sans engagement et sans blabla.`,
        ``,
        `Plutôt mardi 15h ou jeudi 10h ?`,
        ``,
        `—`,
        ``,
        `*Doctrine : jamais de prix par écrit avant la démo mobile. L'objectif de cette réponse est UN créneau daté, rien d'autre.*`,
      ].join("\n");
    }
  }
}

export async function POST(request: NextRequest) {
  let body: AiRequest;
  try {
    body = (await request.json()) as AiRequest;
  } catch {
    return NextResponse.json({ error: "JSON invalide" }, { status: 400 });
  }
  const noProspectNeeded = body?.task === "briefing" || body?.task === "prescripteur";
  if (!body?.task || (!noProspectNeeded && !body?.prospect)) {
    return NextResponse.json({ error: "task et prospect requis" }, { status: 400 });
  }
  if (body.task === "briefing" && typeof body.tourSummary !== "string") {
    return NextResponse.json({ error: "tourSummary requis pour le briefing" }, { status: 400 });
  }

  // Le playbook terrain entre dans le système : c'est lui qui fait la
  // différence entre un conseil générique et la méthode maison.
  const idBlock = body.identity ? `${body.identity}\n\n` : "";
  const brainBlock = body.brainContext ? `\n\n## Cerveau — notes de l'opérateur (appuie-toi dessus)\n${body.brainContext}` : "";
  const system =
    (body.task === "prescripteur"
      ? `${idBlock}${SYSTEM}\n\n${prescripteurPrompt(body.archetypeId)}`
      : `${idBlock}${SYSTEM}\n\n${playbookPrompt(body.prospect?.sector, body.verticalId)}`) + brainBlock;

  try {
    const { text, engine } = await runAI(
      [
        { role: "system", content: system },
        { role: "user", content: buildPrompt(body) },
      ],
      { temperature: 0.3, maxTokens: 2000 }
    );
    return NextResponse.json({ text, engine });
  } catch (e) {
    // Aucun moteur n'a répondu → moteur de templates. L'app marche sans IA.
    console.error("Cascade IA indisponible, repli templates:", e);
    return NextResponse.json({ text: fallback(body), engine: "template" });
  }
}
