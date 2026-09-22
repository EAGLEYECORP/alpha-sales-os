/**
 * ─────────────────────────────────────────────────────────────────────
 * CLIENT LAYA (Convai Innovations) — le modèle « System One » SOUVERAIN.
 *
 * Sorti le 19/09/2026, Apache-2.0, poids OUVERTS. Comme Jev, il rend une
 * DÉCISION TYPÉE (une valeur d'un domaine connu + une confiance) sans générer de
 * texte — la forme exacte de nos classements (intention d'une réponse, intent).
 * Mais contrairement à Jev, il tourne EN LOCAL (`pip install laya`, pas d'API
 * hébergée, pas de palier payant, ~33 ms/décision).
 *
 * ⚠⚠ POURQUOI LAYA PLUTÔT QUE JEV, ET CE N'EST PAS UN GOÛT. Notre vitrine
 * défend que l'automatisation des PME françaises ne devrait pas dépendre
 * d'acteurs américains, et `tests/vitrine-fuite` EXIGE que cet angle reste.
 * Envoyer le texte d'un vrai prospect à Jev — API US propriétaire — contredirait
 * cet argument dans la même page. Laya tourne CHEZ NOUS : rien de la donnée
 * métier ne sort. C'est la doctrine « rien de ce qui touche la donnée métier ne
 * passe par un tiers », appliquée au moteur de décision.
 *
 * ⚠ LAYA EST PYTHON/torch, ALPHA EST TS. Il tourne donc en SIDECAR — un petit
 * service HTTP local, exactement comme `voice/agent.py`. Ce module parle à ce
 * sidecar par un contrat que NOUS définissons (POST /decide {texte, choix} →
 * {valeur, confiance}) : stable, local, sans clé (la serrure, c'est le réseau
 * local / le VPS, pas un secret d'API). Tant que `LAYA_URL` n'est pas posé,
 * `layaDisponible()` rend false et le décideur reste sur le repli (Jev éventuel,
 * sinon le LLM). Aucune dépendance npm ajoutée : `fetch` natif.
 * ─────────────────────────────────────────────────────────────────────
 */

/** Ce que le sidecar Laya rend : une valeur du domaine + sa confiance (0..1). */
export interface DecisionLaya<T extends string> {
  valeur: T;
  confiance: number;
}

/**
 * Le sidecar Laya est-il configuré ? Une seule variable : son URL. Pas de clé —
 * c'est un service LOCAL (souveraineté), sa serrure est le réseau, pas un
 * secret. Fail-closed : sans URL, on ne passe pas par Laya.
 */
export function layaDisponible(): boolean {
  return Boolean(process.env.LAYA_URL?.trim());
}

/**
 * Décide via le sidecar Laya. Contrat (le NÔTRE, stable) : POST `${LAYA_URL}/decide`
 * avec `{ texte, choix }` → `{ valeur, confiance }`. Toute réponse inattendue,
 * réseau coupé, ou sidecar absent LÈVE — et le décideur retombe sur le repli.
 * On ne renvoie jamais une valeur inventée : la validation finale reste au module
 * qui possède l'enum (`decision-typee` → `valider`).
 */
export async function deciderViaLaya<T extends string>(opts: {
  texteEntrant: string;
  valeurs: readonly T[];
}): Promise<DecisionLaya<T>> {
  const base = (process.env.LAYA_URL ?? "").trim().replace(/\/+$/, "");
  if (!base) throw new Error("laya: LAYA_URL absent");

  // Un classement ne doit pas bloquer un tick : délai court, puis repli.
  const ctrl = new AbortController();
  const minuteur = setTimeout(() => ctrl.abort(), 4_000);
  try {
    const r = await fetch(`${base}/decide`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ texte: opts.texteEntrant, choix: opts.valeurs }),
      signal: ctrl.signal,
    });
    if (!r.ok) throw new Error(`laya: HTTP ${r.status}`);
    const data: unknown = await r.json();
    if (!data || typeof data !== "object") throw new Error("laya: réponse non-objet");
    const o = data as Record<string, unknown>;
    const valeur = typeof o.valeur === "string" ? o.valeur : "";
    const confiance = typeof o.confiance === "number" ? o.confiance : NaN;
    if (!valeur || Number.isNaN(confiance)) throw new Error("laya: réponse incomplète");
    // Le type T est garanti par `valider` en aval ; ici on rend la chaîne brute.
    return { valeur: valeur as T, confiance };
  } finally {
    clearTimeout(minuteur);
  }
}
