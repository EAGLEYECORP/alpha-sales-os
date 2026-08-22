/**
 * ─────────────────────────────────────────────────────────────────────
 * Limitation des tentatives — en mémoire, best-effort, assumé comme tel.
 *
 * La porte d'accès protège TOUT le CRM avec un seul mot de passe. Sans
 * compteur, un bot peut tester des milliers de mots de passe : le délai de
 * 400 ms qui existait ne ralentit qu'une requête à la fois, et rien
 * n'empêche d'en lancer cent en parallèle.
 *
 * ⚠ CE QUE ÇA NE FAIT PAS. Ce compteur vit dans la mémoire du processus.
 * Sur une plateforme serverless, plusieurs instances tournent en parallèle
 * et chacune a le sien ; un attaquant qui tombe sur des instances
 * différentes retrouve du budget. Ça élève le coût d'une attaque, ça ne la
 * rend pas impossible. La vraie protection s'achète en amont (WAF, règle
 * de rate limit de l'hébergeur) — c'est écrit ici pour qu'on ne se raconte
 * pas d'histoire.
 * ─────────────────────────────────────────────────────────────────────
 */

export interface AttemptVerdict {
  allowed: boolean;
  /** Tentatives restantes avant blocage. */
  remaining: number;
  /** Secondes à attendre quand `allowed` est faux. */
  retryAfterSec: number;
}

interface Bucket {
  fails: number;
  /** Fin du blocage courant (ms epoch), 0 si non bloqué. */
  blockedUntil: number;
  /** Dernière activité — sert au nettoyage. */
  seen: number;
}

export class AttemptLimiter {
  private buckets = new Map<string, Bucket>();

  constructor(
    private readonly maxFails = 5,
    /** Fenêtre d'oubli : sans échec pendant ce délai, le compteur repart à zéro. */
    private readonly windowMs = 15 * 60_000,
    /** Blocage de base, doublé à chaque palier d'échecs franchi. */
    private readonly baseBlockMs = 60_000
  ) {}

  /** Peut-on tenter ? À appeler AVANT de vérifier le secret. */
  check(key: string, now = Date.now()): AttemptVerdict {
    const b = this.buckets.get(key);
    if (!b) return { allowed: true, remaining: this.maxFails, retryAfterSec: 0 };

    if (b.blockedUntil > now) {
      return { allowed: false, remaining: 0, retryAfterSec: Math.ceil((b.blockedUntil - now) / 1000) };
    }
    // Fenêtre écoulée sans échec : on oublie. Un opérateur qui se trompe le
    // lundi ne doit pas être puni le vendredi.
    if (now - b.seen > this.windowMs) {
      this.buckets.delete(key);
      return { allowed: true, remaining: this.maxFails, retryAfterSec: 0 };
    }
    return { allowed: true, remaining: Math.max(0, this.maxFails - b.fails), retryAfterSec: 0 };
  }

  /** Échec — incrémente et bloque au-delà du seuil. */
  fail(key: string, now = Date.now()): AttemptVerdict {
    this.sweep(now);
    const b = this.buckets.get(key) ?? { fails: 0, blockedUntil: 0, seen: now };
    if (now - b.seen > this.windowMs) b.fails = 0;
    b.fails += 1;
    b.seen = now;

    if (b.fails >= this.maxFails) {
      // Blocage doublé à chaque palier : 1 min, 2 min, 4 min… Un humain qui
      // se trompe cinq fois attend une minute ; un bot y perd tout intérêt.
      const paliers = Math.floor(b.fails / this.maxFails);
      b.blockedUntil = now + this.baseBlockMs * Math.pow(2, paliers - 1);
    }
    this.buckets.set(key, b);
    return this.check(key, now);
  }

  /** Succès — on efface l'ardoise. */
  succeed(key: string): void {
    this.buckets.delete(key);
  }

  /** Nettoyage : sans ça, la table grossit indéfiniment sur une route publique. */
  private sweep(now: number): void {
    if (this.buckets.size < 1000) return;
    for (const [k, b] of this.buckets) {
      if (b.blockedUntil < now && now - b.seen > this.windowMs) this.buckets.delete(k);
    }
  }
}

/**
 * L'identifiant d'appelant, tiré des en-têtes de l'hébergeur.
 *
 * `x-forwarded-for` est falsifiable par le client — sauf quand c'est le
 * proxy de l'hébergeur qui l'écrit, ce qui est le cas sur Vercel. On prend
 * donc la PREMIÈRE valeur (l'IP réelle vue par le proxy), et on retombe sur
 * une clé commune quand rien n'est disponible : dans ce cas la limite
 * devient globale, ce qui est plus strict, jamais plus permissif.
 */
export function callerKey(headers: Headers): string {
  const fwd = headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return headers.get("x-real-ip")?.trim() || "inconnu";
}
