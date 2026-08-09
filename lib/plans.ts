/**
 * Plans — source unique des limites, utilisable côté serveur ET client
 * (aucune directive "use client", aucune dépendance). Voir legal/OFFRE-FREEMIUM.md.
 */

/**
 * Formule GRATUITE (freemium) : le socle local-first, sans carte. Bornée en
 * VOLUME (pas en valeur). Les seuils sont un point de départ ajustable.
 */
export const FREE_TIER = {
  name: "Gratuit",
  maxProspects: 50,
  emailsPerMonth: 20,
  features: [
    "CRM + pipeline complet",
    "Rédaction par templates (hors-ligne)",
    "Studio social (templates)",
    "Local-first — tes données, tes clés",
  ],
  excluded: ["IA cloud", "Tracking durable", "Voix / transcription", "Synchro multi-appareils"],
} as const;

/**
 * Horodatage (ms) du 1er du mois courant à 00:00 UTC — borne du quota mensuel
 * d'envois. UTC pour être déterministe quel que soit le fuseau du serveur.
 */
export function startOfMonthMs(now: number = Date.now()): number {
  const d = new Date(now);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1);
}
