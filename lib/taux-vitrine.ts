// `import type` est EFFACÉ à la compilation : la forme voyage, pas les
// données. C'est ce qui permet à ce module d'être importé côté navigateur
// sans rembarquer `accounts-commercial` avec lui.
import type { AccountCommercial } from "./accounts-commercial";

/**
 * ─────────────────────────────────────────────────────────────────────
 * LE TAUX « VITRINE » D'UN COMPTE — dérivé, jamais recopié.
 *
 * ⚠ CE NOMBRE ÉTAIT ÉCRIT DANS `lib/accounts.ts`, DONC DANS UN CHUNK PUBLIC.
 *
 * `commissionPct: 30` à côté d'un partenaire et `commissionPct: 15` à côté de
 * « Nuwacom » se téléchargeaient depuis `_next/static/**`, chemin exclu du
 * middleware : vérifié sur serveur réel, 200 sans cookie, SITE_PASSWORD actif.
 *
 * Le commentaire qui l'y laissait plaidait que « chaque partenaire connaît
 * déjà son propre taux ». La moitié tient. L'autre non : le chunk les montre
 * TOUS LES TROIS, à n'importe qui — et CLAUDE.md pose que le taux Nuwacom se
 * dresse APRÈS le cadrage. Ce n'est pas un chiffre connu, c'est l'enjeu.
 *
 * ── POURQUOI DÉRIVER PLUTÔT QU'AJOUTER UN CHAMP ──
 *
 * Écrire `tauxVitrinePct: 30` dans le module serveur aurait fait une
 * TROISIÈME copie du même nombre — exactement le défaut qu'on passe la
 * journée à réparer. On le lit donc dans les offres, qui sont la source.
 *
 * ── ET POURQUOI `null` PLUTÔT QU'UN CHOIX MALIN ──
 *
 * Aujourd'hui Nuwacom n'a qu'UNE offre, et les cinq
 * offres EAGLEYE sont toutes à 100 % : le taux du compte est sans ambiguïté.
 * Le jour où un compte portera deux taux différents, il n'y aura plus de
 * réponse automatique — prendre la première offre, ou la plus basse, serait
 * inventer. On rend `null`, l'écran le dit, et un humain tranche.
 *
 * ── POURQUOI CE MODULE EXISTE SÉPARÉMENT ──
 *
 * La fonction doit être lisible des deux côtés : par le sélecteur de comptes
 * (navigateur) et par les tests. La poser dans `client-catalogue` l'aurait
 * enfermée dans un fichier à hooks React ; la poser dans `accounts-commercial`
 * l'aurait rendue inatteignable depuis le navigateur, puisque ce module ne
 * doit jamais y descendre. Un module sans dépendance de valeur règle les deux.
 * ─────────────────────────────────────────────────────────────────────
 */
export function tauxVitrinePct(c: AccountCommercial | null | undefined): number | null {
  const taux = new Set((c?.offerings ?? []).map((o) => o.commissionPct));
  return taux.size === 1 ? [...taux][0] : null;
}
