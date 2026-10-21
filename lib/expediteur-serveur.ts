import { habillageEnvoi, type HabillageEnvoi } from "./expediteur";
import { installationClient } from "./entitlements";

/**
 * ─────────────────────────────────────────────────────────────────────
 * QUI SIGNE LES ENVOIS QUE LE SERVEUR FAIT SEUL — l'autopilote d'emails.
 *
 * Les trois ticks (`mail-tick`, `relance-tick`, `reply-tick`) écrivent pour
 * le pipe de l'OPÉRATEUR, sans navigateur derrière. Ils appelaient
 * `habillageEnvoi({ accountId: "eagleye" })` en dur.
 *
 * ⚠⚠ SUR UNE INSTALLATION « CHEZ VOUS », L'OPÉRATEUR EST LE CLIENT. Le même
 * code y signait donc ses emails de prospection « EAGLEYE CORP », avec notre
 * aigle, depuis SA boîte — et la vérification des mentions passait, puisque
 * la marque était bien dans le texte. Trouvé le 21/10/2026 en fermant le même
 * défaut sur `/api/send`.
 *
 * · Sur notre cloud : le compte maître, comme avant.
 * · Chez un client : `ALPHA_SOCIETE` (la raison sociale du client, posée à
 *   l'installation — `docs/INSTALLATION-CHEZ-VOUS.md`). Absente, la société
 *   manque et `verifieMentions` refuse chaque envoi : l'autopilote se tait
 *   plutôt que de signer d'un nom qui n'est pas le sien.
 *
 * Serveur seulement : `lib/entitlements` ne descend pas dans le navigateur.
 * ─────────────────────────────────────────────────────────────────────
 */
export function habillageOperateur(base: string): HabillageEnvoi {
  if (installationClient()) {
    return habillageEnvoi({ maitre: false, agencyName: process.env.ALPHA_SOCIETE, base });
  }
  return habillageEnvoi({ maitre: true, accountId: "eagleye", base });
}
