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
  "/api/compte": "/compte",
  // File de propositions : c'est du pilotage du pipe, donc du CRM.
  "/api/propositions": "/pipeline",

  // ── CRM & Pipeline ──
  "/api/crm": "/pipeline",
  "/api/import": "/pipeline",
  "/api/pipeline": "/pipeline",
  "/api/digest": "/aujourdhui",
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
  "/api/sparring": "/closer",

  // ── Agent ALPHA ──
  "/api/agent": "/agent",
  // L'IA générique sert le script, l'audit, l'objection : c'est le socle CRM.
  "/api/ai": "/pipeline",

  // ── Notifications : transversales, liées au compte lui-même ──
  "/api/push": "/compte",

  // ── API publique v1 et serveur MCP : portent leur PROPRE authentification
  // par clé, avec portées. Ils ne sont pas gouvernés par une brique — ils
  // sont hors session.
  "/api/v1": "/",
  "/api/mcp": "/",
};
