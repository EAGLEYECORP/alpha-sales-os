/**
 * ─────────────────────────────────────────────────────────────────────
 * LE LIMITEUR DE DÉBIT — en mémoire, par instance, fenêtre par IP.
 *
 * Sorti de `middleware.ts` le 21/10/2026 pour deux raisons : le tester sans
 * monter un serveur, et réparer ce qu'une mesure venait de montrer.
 *
 * ⚠⚠ L'ANCIENNE VERSION ÉTAIT QUADRATIQUE SOUS UN AFFLUX. À chaque NOUVELLE IP,
 * au-delà de 10 000 entrées, elle balayait toute la table pour purger les
 * expirées. Quand tout le monde est encore dans la fenêtre — un pic de
 * visiteurs distincts, c'est-à-dire exactement le cas d'un post qui marche —
 * le balayage ne libère rien et recommence à la requête suivante. Mesuré en
 * rejouant la logique à l'identique :
 *
 *     10 000 IP distinctes →   1,4 µs par requête
 *     30 000 IP distinctes → 226   µs par requête  (×160)
 *    100 000 IP distinctes → 925   µs par requête  (92 s cumulées)
 *
 * Le mécanisme anti-abus devenait le goulot, sur la boucle d'événements qui
 * sert aussi tout le monde. Il ne fuyait pas (la mémoire restait bornée par la
 * fenêtre) : il COÛTAIT, et ça ne se voit qu'en charge.
 *
 * Réparation : **un balayage au plus toutes les `balayageMs`**, et un PLAFOND
 * DUR (`plafond`). Sous un flot d'IP toutes fraîches le balayage ne libère rien ;
 * sans plafond la table grossirait jusqu'à la fin de la fenêtre. Au-delà, on
 * repart d'une table vide : on perd la MÉMOIRE de qui a trop frappé, on ne
 * bloque jamais personne à tort. Un limiteur par instance est de toute façon un
 * filet, pas un mur (chaque instance serverless a le sien) — le perdre par
 * saturation est acceptable, saturer la boucle d'événements ne l'est pas.
 * ─────────────────────────────────────────────────────────────────────
 */

export interface EntreeLimiteur {
  count: number;
  start: number;
}

export interface OptionsLimiteur {
  /** Durée d'une fenêtre, en ms. */
  fenetreMs: number;
  /** Taille de table au-delà de laquelle on envisage un balayage. */
  seuilBalayage?: number;
  /** Intervalle MINIMAL entre deux balayages — c'est ce qui casse le quadratique. */
  balayageMs?: number;
  /** Plafond dur : au-delà, après balayage, la table est vidée. */
  plafond?: number;
}

export interface Limiteur {
  /** `true` = cette IP dépasse `max` dans la fenêtre courante. */
  bump(ip: string, max: number, maintenant?: number): boolean;
  taille(): number;
  /** Combien de balayages complets ont eu lieu (pour prouver qu'ils sont rares). */
  balayages(): number;
}

export function creerLimiteur(opts: OptionsLimiteur): Limiteur {
  const { fenetreMs } = opts;
  const seuil = opts.seuilBalayage ?? 10_000;
  const intervalle = opts.balayageMs ?? 10_000;
  const plafond = opts.plafond ?? 100_000;

  const table = new Map<string, EntreeLimiteur>();
  let dernierBalayage = 0;
  let nBalayages = 0;

  function balayer(maintenant: number): void {
    if (maintenant - dernierBalayage < intervalle) return;
    dernierBalayage = maintenant;
    nBalayages += 1;
    for (const [k, v] of table) if (maintenant - v.start > fenetreMs) table.delete(k);
    // Le balayage n'a rien libéré parce que tout le monde est frais : on borne.
    if (table.size > plafond) table.clear();
  }

  return {
    bump(ip, max, maintenant = Date.now()) {
      const e = table.get(ip);
      if (!e || maintenant - e.start > fenetreMs) {
        table.set(ip, { count: 1, start: maintenant });
        if (table.size > seuil) balayer(maintenant);
        return false;
      }
      e.count += 1;
      return e.count > max;
    },
    taille: () => table.size,
    balayages: () => nBalayages,
  };
}
