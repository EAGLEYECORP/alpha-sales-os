/**
 * ─────────────────────────────────────────────────────────────────────
 * L'IDENTIFIANT DU MODÈLE — une seule saisie, parce qu'un modèle MEURT.
 *
 * ⚠ TROUVÉ EN PRODUCTION, PAS EN TEST. Le 28 août 2026, l'agent vocal a dit
 * sa phrase d'ouverture (elle est prononcée par le CODE, art. 50) puis n'a
 * plus rien pu répondre :
 *
 *   APIStatusError: 410 Gone — "The model 'meta/llama-3.3-70b-instruct' has
 *   reached its end of life on 2026-08-26T09:00:00Z and is no longer
 *   available."
 *
 * Ce n'est pas une panne : c'est une DATE D'EXPIRATION que le fournisseur
 * avait annoncée et que rien, chez nous, ne portait. Le même identifiant
 * était écrit à quatre endroits :
 *
 *   · `voice/.env` ................. VOICE_MODEL, posé à la main
 *   · `lib/nvidia.ts` .............. le défaut de l'app web
 *   · `lib/nvidia.ts` (NVIDIA_MODELS) le premier de la liste « conseillés »
 *   · `.env.example` ............... NVIDIA_MODEL
 *
 * Conséquence mesurée : l'agent vocal tombait, ET toute l'IA de l'app web
 * tombait avec — /api/ai, /api/agent, /api/debrief — depuis deux jours, sans
 * que rien ne le signale autrement que par une erreur générique.
 *
 * ── CE QUE CE MODULE FAIT ──
 *
 * Il porte l'identifiant UNE fois, et il porte surtout ce que l'expérience a
 * appris : quels modèles sont morts, et depuis quand. Un identifiant de modèle
 * est un actif DATÉ ; le traiter comme une constante immuable, c'est
 * programmer une panne à une date qu'on n'a pas notée.
 *
 * ⚠ Ce module ne peut pas deviner l'avenir : il ne sait que ce qu'on y écrit
 * après coup. Sa valeur n'est pas de prédire, c'est de faire que la prochaine
 * panne se répare en UN endroit et que l'erreur DISE ce qui s'est passé.
 * ─────────────────────────────────────────────────────────────────────
 */

/**
 * Le modèle par défaut sur NVIDIA NIM.
 *
 * `openai/gpt-oss-20b` — c'est celui que l'agent vocal utilise déjà, et le
 * seul dont on ait la preuve opérationnelle qu'il répond (CLAUDE.md : « défaut
 * — sans latence ; le 70B fait la file d'attente ~14 s, ne pas y revenir »).
 *
 * ⚠ NVIDIA NIM exige un id NAMESPACÉ `vendor/model`. « gpt-oss-20b » seul rend
 * 404. C'est le piège n°1, et il coûte une demi-heure à chaque fois.
 */
export const MODELE_NIM_DEFAUT = "openai/gpt-oss-20b";

/** Le défaut quand la base_url est celle d'OpenAI (pas de namespace). */
export const MODELE_OPENAI_DEFAUT = "gpt-4o-mini";

/**
 * Le défaut côté Anthropic.
 *
 * ⚠ **Il était recopié à QUATRE endroits** — `lib/ai-engine.ts` (deux fois),
 * `/api/agent`, `/api/sparring` — chacun avec son propre `?? "…"`. C'est
 * exactement ce que ce fichier existe pour empêcher : le défaut NIM avait
 * déjà survécu à la mort du modèle qu'il nommait, et toute l'IA de l'app
 * rendait 410 sans qu'aucun test ne puisse le voir. Un modèle tiers meurt à
 * une date que le dépôt ne connaît pas ; ce qu'on maîtrise, c'est de n'avoir
 * qu'UN endroit à corriger ce jour-là.
 */
export const MODELE_ANTHROPIC_DEFAUT = "claude-opus-4-8";

export interface ModeleMort {
  id: string;
  /** Date de fin de vie annoncée par le fournisseur (ISO). */
  finDeVie: string;
  /** Par quoi le remplacer. */
  remplacePar: string;
}

/**
 * Les modèles dont on SAIT qu'ils sont morts.
 *
 * ⚠ Cette liste n'est pas décorative et elle n'est pas exhaustive : elle ne
 * contient que ce qu'on a appris en se cognant. Son rôle est de transformer
 * une erreur 410 opaque en phrase utilisable, et d'empêcher qu'un identifiant
 * mort revienne comme défaut dans un fichier — `tests/modeles.test.ts` refuse
 * qu'un id d'ici serve de valeur par défaut où que ce soit.
 */
export const MODELES_MORTS: ModeleMort[] = [
  {
    id: "meta/llama-3.3-70b-instruct",
    finDeVie: "2026-08-26T09:00:00Z",
    remplacePar: MODELE_NIM_DEFAUT,
  },
];

export const estModeleMort = (id: string): ModeleMort | undefined =>
  MODELES_MORTS.find((m) => m.id === id.trim());

/**
 * ─────────────────────────────────────────────────────────────────────
 * LES REMPLAÇANTS DU 70B — et pourquoi la réponse n'est pas la même partout.
 *
 * `openai/gpt-oss-20b` est le défaut parce qu'il RÉPOND, prouvé sur l'agent
 * vocal. Ce n'est pas le meilleur : sur les consignes longues du playbook, un
 * petit modèle décroche. Le bon arbitrage dépend de la surface :
 *
 *   · VOIX  — la latence est le critère n°1. Le 70B avait été abandonné pour
 *     ça (~14 s de file d'attente), avant même de mourir. Au téléphone, deux
 *     secondes de silence tuent la conversation ; une réponse un peu moins
 *     fine ne la tue pas.
 *   · APP   — la latence ne coûte rien (l'opérateur attend devant son écran).
 *     C'est là qu'il faut la grosse cervelle : scripts, argumentaires, audits.
 *
 * ⚠⚠ JE N'AI VÉRIFIÉ AUCUN DE CES IDENTIFIANTS. Le proxy du bac à bureau bloque
 * NVIDIA : je ne peux ni interroger le catalogue, ni mesurer une latence. Ce
 * sont des CANDIDATS, pas des résultats. `scripts/tester-modeles.mjs` les
 * essaie tous depuis une machine qui a la clé, et rend la vérité mesurée —
 * lequel répond, en combien de temps. C'est cette sortie-là qui décide, pas
 * cette liste.
 * ─────────────────────────────────────────────────────────────────────
 */
export interface ModeleCandidat {
  id: string;
  label: string;
  /** Pour quelle surface il est pensé. */
  pour: "app" | "voix" | "les deux";
  /** Ce qu'on en attend, et ce qu'on ignore. */
  note: string;
}

export const MODELES_CANDIDATS: ModeleCandidat[] = [
  {
    id: "nvidia/llama-3.3-nemotron-super-49b-v1",
    label: "Nemotron Super 49B",
    pour: "app",
    note:
      "Construit PAR NVIDIA sur la base Llama 3.3 — c'est le successeur le plus direct du modèle mort, " +
      "et il est réglé pour suivre les instructions à la lettre. Premier à essayer pour l'app.",
  },
  {
    id: "qwen/qwen2.5-72b-instruct",
    label: "Qwen 2.5 72B",
    pour: "app",
    note: "72B, très bon français et excellent en extraction structurée (débrief, deep-dive JSON).",
  },
  {
    id: "meta/llama-4-maverick-17b-128e-instruct",
    label: "Llama 4 Maverick",
    pour: "les deux",
    note:
      "Architecture MoE : 17B actifs sur 128 experts. Sur le papier, la qualité d'un gros pour la vitesse " +
      "d'un petit — donc le seul candidat sérieux pour faire la voix ET l'app avec le même modèle.",
  },
  {
    id: "meta/llama-4-scout-17b-16e-instruct",
    label: "Llama 4 Scout",
    pour: "voix",
    note: "Plus léger que Maverick. À essayer si Maverick traîne au téléphone.",
  },
  {
    id: "mistralai/mistral-large-2-instruct",
    label: "Mistral Large 2",
    pour: "app",
    note: "Modèle français : le registre et les tournures sonnent plus juste dans un email de prospection.",
  },
  {
    id: MODELE_NIM_DEFAUT,
    label: "GPT-OSS 20B",
    pour: "voix",
    note: "Le défaut actuel. Vif, prouvé en production sur la voix. Le repli si rien d'autre ne répond.",
  },
];

/**
 * Le message à afficher quand un appel échoue sur un modèle configuré.
 *
 * ⚠ Le 410 de NVIDIA porte déjà la bonne explication dans son corps. Ce qui
 * manquait, c'est de la RELIER au réglage qu'il faut changer : l'opérateur
 * lisait « end of life » sans savoir que la réponse tenait dans une ligne de
 * son `.env`.
 */
export function expliquerModele(id: string, statut: number): string | null {
  const mort = estModeleMort(id);
  if (mort) {
    const quand = new Date(mort.finDeVie).toLocaleDateString("fr-FR");
    return (
      `Le modèle « ${mort.id} » est arrivé en fin de vie le ${quand} chez le fournisseur : il ne répondra plus. ` +
      `Remplace-le par « ${mort.remplacePar} » — dans NVIDIA_MODEL (app) et VOICE_MODEL (voice/.env).`
    );
  }
  if (statut === 404 && !id.includes("/")) {
    return (
      `« ${id} » n'a pas de namespace. NVIDIA NIM attend un identifiant complet du type « vendor/model » ` +
      `(ex. ${MODELE_NIM_DEFAUT}) — sans le préfixe, c'est un 404 systématique.`
    );
  }
  if (statut === 410) {
    return (
      `Le fournisseur répond 410 (Gone) sur « ${id} » : le modèle a été retiré. Change NVIDIA_MODEL, ` +
      `puis ajoute-le à MODELES_MORTS (lib/modeles.ts) pour que le prochain message soit clair.`
    );
  }
  return null;
}
