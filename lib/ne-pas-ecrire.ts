import type { CampaignDraft, Prospect } from "./types";
import { isDemoProspect } from "./seed";
import { aRefuseTouteRelance } from "./voice-script";
import { exclusionPublique } from "./signaux-publics";

/**
 * ─────────────────────────────────────────────────────────────────────
 * POURQUOI UN MESSAGE NE DOIT PAS PARTIR VERS CETTE FICHE — une seule réponse.
 *
 * Trois raisons qui ne se discutent pas à la relecture : la fiche de
 * démonstration (adresse inventée, rebond dur garanti), celui qui a demandé à
 * ne plus être contacté, la société qu'une annonce légale écarte (liquidation,
 * radiation, dissolution).
 *
 * ⚠⚠ TROUVÉ EN TOURNANT LE SPOT TV (22/10/2026), PAS PAR UN TEST.
 * `prepareCampaignDrafts` mettait bien ces brouillons de côté, avec leur
 * raison — et son commentaire affirmait que l'écran de revue l'affichait « sans
 * une ligne de code de plus ». Faux : la carte montre l'ADRESSE avant l'erreur,
 * donc la raison ne s'affichait jamais dès que la fiche avait un email. On
 * voyait « ignoré », sans savoir pourquoi, et UN clic sur « Ignoré » remettait
 * le message dans la pile à approuver. Rien ne revérifie côté serveur : le CRM
 * vit dans le navigateur. Une société en liquidation recevait donc le message
 * de qui croyait corriger un oubli.
 * · La raison se DÉRIVE de la fiche à chaque rendu, elle ne se lit pas dans le
 *   brouillon : un brouillon préparé HIER ne sait rien de l'annonce lue
 *   aujourd'hui.
 * · Ces trois raisons verrouillent le brouillon ; un « ignoré » posé à la main,
 *   ou « déjà contacté récemment », reste réversible — ce sont des jugements.
 * ─────────────────────────────────────────────────────────────────────
 */
export function raisonDeNePasEcrire(p: Prospect): string | null {
  if (isDemoProspect(p.id)) return "fiche de démonstration — adresse inventée, rebond dur garanti";
  if (aRefuseTouteRelance(p)) return "il a demandé à ne plus être contacté";
  const exclue = exclusionPublique(p);
  if (exclue) return `annonce légale — ${exclue.libelle}`;
  return null;
}

/**
 * Les brouillons encore EN JEU (à valider, ou déjà approuvés) dont la fiche
 * refuse désormais tout message — à remettre de côté, avec leur raison.
 * Une fiche supprimée depuis la préparation ne se juge pas ici : sans fiche,
 * on ne sait rien, et le brouillon garde son état.
 */
export function brouillonsAMettreDeCote(
  drafts: CampaignDraft[],
  prospects: Prospect[]
): { id: string; raison: string }[] {
  const parId = new Map(prospects.map((p) => [p.id, p]));
  return drafts.flatMap((d) => {
    if (d.status !== "pending" && d.status !== "approved") return [];
    const p = parId.get(d.prospectId);
    const raison = p ? raisonDeNePasEcrire(p) : null;
    return raison ? [{ id: d.id, raison }] : [];
  });
}
