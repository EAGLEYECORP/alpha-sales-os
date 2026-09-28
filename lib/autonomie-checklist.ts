/**
 * ─────────────────────────────────────────────────────────────────────
 * « PRÊT POUR L'AUTONOMIE ? » — la checklist, en une lecture.
 *
 * Décidé le 28/09/2026. L'état de préparation d'Alpha vit éparpillé
 * (`/api/health`, réglages, DNS…). Ce module le RÉSUME en une liste lisible au
 * pouce : une ligne par prérequis, verte/rouge, avec l'action exacte.
 *
 * ⚠ IL NE MESURE RIEN LUI-MÊME. Il TRADUIT ce que `/api/health` rapporte déjà —
 * pas de seconde définition de « Supabase est-il là ? ». Le seul point que le
 * serveur ne peut pas voir est le **DKIM** (c'est du DNS) : on le dit `inconnu`,
 * jamais `ok`, et l'action reste « à relever à la main ». Un diagnostic qui
 * rassure à tort est pire qu'aucun.
 * ─────────────────────────────────────────────────────────────────────
 */

/** ok = vérifié vert · manque = à faire · inconnu = le serveur ne peut pas le voir (DNS). */
export type EtatItem = "ok" | "manque" | "inconnu";

export interface ItemAutonomie {
  id: string;
  label: string;
  etat: EtatItem;
  /** Ce qu'il reste à faire si ce n'est pas `ok`. Jamais décoratif. */
  action: string;
  /** Un `manque` bloque l'autonomie ; un `inconnu` se confirme à la main. */
  bloquant: boolean;
}

/**
 * Forme PARTIELLE de `capabilities` de `/api/health` — on lit défensivement,
 * un champ absent vaut « pas prêt ».
 */
export interface HealthCapabilities {
  ai?: { configured?: boolean };
  email?: { configured?: boolean };
  tracking?: { baseUrl?: boolean };
  supabase?: { serviceRole?: boolean };
  proprietaire?: { coherent?: boolean };
}

export interface Preparation {
  items: ItemAutonomie[];
  /** true si tout ce que le SERVEUR peut voir est vert (DKIM exclu, non visible). */
  pret: boolean;
  /** Combien de prérequis bloquants restent à faire. */
  manquants: number;
}

const vrai = (x: unknown): boolean => x === true;

/**
 * `caps` = `capabilities` de `/api/health`, ou `null` si la sonde n'a rien
 * rendu (non authentifié, ou route muette). `null` ⇒ tout est « manque » : on
 * ne suppose jamais prêt ce qu'on n'a pas pu lire.
 */
export function preparationAutonomie(caps: HealthCapabilities | null): Preparation {
  const items: ItemAutonomie[] = [
    {
      id: "supabase",
      label: "Base serveur (Supabase)",
      etat: vrai(caps?.supabase?.serviceRole) ? "ok" : "manque",
      action: "Poser SUPABASE_SERVICE_ROLE_KEY sur l'hébergeur, puis redéployer.",
      bloquant: true,
    },
    {
      id: "proprietaire",
      label: "Compte maître cohérent",
      etat: vrai(caps?.proprietaire?.coherent) ? "ok" : "manque",
      action: "OWNER_EMAILS et NEXT_PUBLIC_OWNER_EMAILS doivent porter la MÊME liste.",
      bloquant: true,
    },
    {
      id: "smtp",
      label: "Envoi email (SMTP)",
      etat: vrai(caps?.email?.configured) ? "ok" : "manque",
      action: "Poser SMTP_HOST / SMTP_USER / SMTP_PASS (voir docs/SMTP-SUPABASE-AMEN.md).",
      bloquant: true,
    },
    {
      id: "url",
      label: "URL publique (APP_BASE_URL)",
      etat: vrai(caps?.tracking?.baseUrl) ? "ok" : "manque",
      action: "Poser APP_BASE_URL = l'adresse publique de l'app.",
      bloquant: true,
    },
    {
      id: "ia",
      label: "IA (tri des réponses)",
      etat: vrai(caps?.ai?.configured) ? "ok" : "manque",
      action: "Configurer un moteur IA (clé serveur ou BYOK) — sinon pas de tri auto des réponses.",
      bloquant: true,
    },
    {
      // ⚠ Le serveur ne voit PAS le DNS. On ne prétend jamais que c'est vert.
      id: "dkim",
      label: "DKIM aligné (délivrabilité)",
      etat: "inconnu",
      action: "À relever à la main : d=eagleyecorp.fr dans un mail reçu (docs/SMTP-SUPABASE-AMEN.md §3).",
      bloquant: false,
    },
  ];

  const manquants = items.filter((i) => i.bloquant && i.etat === "manque").length;
  const pret = manquants === 0;
  return { items, pret, manquants };
}
