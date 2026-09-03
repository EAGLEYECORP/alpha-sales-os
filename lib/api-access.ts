/**
 * ─────────────────────────────────────────────────────────────────────
 * QUELLE API SERT QUELLE FONCTIONNALITÉ.
 *
 * Une page bloquée dont l'API répond ne protège RIEN : le client qui n'a pas
 * acheté le Cerveau ne verra pas `/cerveau`, mais `fetch("/api/brain")` lui
 * rendra la donnée. C'est le trou classique du contrôle d'accès « par écran ».
 *
 * Plutôt que de recopier la carte des briques une deuxième fois — deux cartes
 * finissent toujours par diverger — on traduit chaque route API vers le
 * CHEMIN MÉTIER qu'elle sert, et on réutilise la carte unique de
 * `lib/bricks-access.ts`.
 *
 * ⚠ Une API absente de cette table retombe sur son propre chemin, donc sur
 * « non classé », donc REFUSÉE. C'est voulu : une route ajoutée sans être
 * classée doit échouer bruyamment en développement, pas s'ouvrir en silence
 * en production. Un test liste les routes non classées.
 * ─────────────────────────────────────────────────────────────────────
 */

/** Préfixe de route API → chemin métier gouverné par la même brique. */
export const CHEMIN_PAR_API: Record<string, string> = {
  // ── Communs : tout compte authentifié, quelle que soit son offre ──
  "/api/gate": "/login",
  "/api/billing": "/compte",
  "/api/health": "/",
  // Le catalogue sert le chiffrage et l'offre : accessible à tout compte,
  // sinon un client ne peut pas voir ce qu'il pourrait acheter en plus.
  "/api/catalogue": "/compte",
  // Les textes de prompt s'éditent depuis /prompts. La route est en plus
  // réservée au compte maître (la doctrine récite les taux du portefeuille) :
  // la porte de l'écran ne suffit pas, et c'est voulu.
  "/api/prompts": "/prompts",
  "/api/compte": "/compte",
  // File de propositions : c'est du pilotage du pipe, donc du CRM.
  "/api/propositions": "/pipeline",

  // ── CRM & Pipeline ──
  "/api/crm": "/pipeline",
  "/api/import": "/pipeline",
  "/api/pipeline": "/pipeline",
  /**
   * ⚠ `/api/digest` ÉTAIT RATTACHÉE À `/aujourdhui`, DONC AU CRM GRATUIT.
   *
   * Elle ENVOIE : un SMS via `TEXTBELT_KEY` et un email via `SMTP_*` — nos
   * crédits, notre serveur. Le bouton « M'envoyer le récap » de /aujourdhui
   * était donc, pour un compte gratuit, un bouton qui dépense chez nous.
   * Elle suit l'envoi, comme tout ce qui sort de la machine.
   */
  "/api/digest": "/campaigns",
  "/api/calendar": "/meetings",
  "/api/notion": "/pipeline",

  // ── Alpha Voice ──
  "/api/voice": "/voice",
  "/api/voice-costs": "/voice",
  "/api/transcribe": "/voice",
  "/api/campaign": "/voice",

  // ── Campagnes & outreach ──
  "/api/send": "/campaigns",
  "/api/compose": "/outbox",
  "/api/email": "/campaigns",
  "/api/gmail": "/outbox",
  "/api/social": "/social",
  "/api/video": "/social",
  "/api/deliverability": "/campaigns",

  // ── Le Cerveau ──
  "/api/brain": "/cerveau",
  // La synchro pousse le pipe de l'opérateur : même porte que le pipeline.
  "/api/sync": "/pipeline",
  "/api/knowledge": "/cerveau",
  // Le catalogue de références (livres, vidéos) alimente le Cerveau : même porte.
  "/api/references": "/cerveau",

  // ── Audits ──
  "/api/audit": "/audits",
  "/api/icp": "/audits",

  // ── Tracking ──
  "/api/track": "/activity",
  "/api/webhooks": "/activity",

  // ── Closer OS & débrief ──
  "/api/debrief": "/debrief",
  /**
   * ⚠ Même défaut : le sparring appelle un LLM (NVIDIA ou Anthropic, NOTRE
   * clé) et `/closer` fait partie du socle gratuit. « Le prospect est joué par
   * l'IA », c'est exactement « la machine travaille à ta place » — donc la
   * brique payante. Le Closer OS lui-même (la tournée, le débrief, les
   * priorités) reste gratuit : il ne dépense rien.
   */
  "/api/sparring": "/agent",

  // ── Agent ALPHA ──
  "/api/agent": "/agent",
  /**
   * ⚠ `/api/ai` ÉTAIT RATTACHÉE À `/pipeline`, DONC AU SOCLE CRM — ET LE CRM
   * EST DEVENU GRATUIT.
   *
   * Elle sert le script, l'audit, l'objection : ça ressemble à du CRM, et
   * c'était le bon rattachement tant que tous les comptes étaient payants.
   * Depuis l'ouverture des inscriptions, ça veut dire que n'importe quel
   * inconnu brûle nos jetons LLM en boucle depuis une fiche prospect, sans
   * jamais rien payer. Le compteur ne se voit que sur la facture du
   * fournisseur, un mois plus tard.
   *
   * Elle suit donc la brique « agent-alpha », qui est payante — la même
   * frontière que le reste : **ce qui dépense chez nous se paie**. Le gratuit
   * garde le CRM entier ; ce qu'il perd, c'est que la machine écrive à sa
   * place. C'est aussi une bien meilleure ligne de vente que « 50 fiches
   * maximum ».
   */
  "/api/ai": "/agent",

  // ── Notifications : transversales, liées au compte lui-même ──
  "/api/push": "/compte",

  // ── API publique v1 et serveur MCP : portent leur PROPRE authentification
  // par clé, avec portées. Ils ne sont pas gouvernés par une brique — ils
  // sont hors session.
  "/api/v1": "/",
  "/api/mcp": "/",
};
