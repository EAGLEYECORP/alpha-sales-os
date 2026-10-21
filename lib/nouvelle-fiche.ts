import type { Prospect } from "./types";
import { prospectDefaults } from "./seed";
import { daysAhead, uid } from "./utils";

/**
 * ─────────────────────────────────────────────────────────────────────
 * UNE FICHE SAISIE À LA MAIN — ce qu'elle porte avant qu'on y tape quoi que
 * ce soit.
 *
 * ⚠⚠ MESURÉ LE 21/10/2026 : le formulaire partait de « maîtrise d'ouvrage »,
 * « Lyon », 290 €/mois, 1 800 € de setup et 1 500 € de « taxe d'ignorance » —
 * NOS prix, sur NOTRE ICP. Chaque fiche créée par un inscrit entrait donc dans
 * son pipe pondéré avec un montant qu'il n'avait jamais saisi, pour un
 * produit qu'il ne vend pas. Un tableau de bord qui additionne nos tarifs
 * dans le pipe de quelqu'un d'autre ment tous les matins.
 *
 * Le socle est `prospectDefaults` (la règle n° 1 des écrans : la seule valeur
 * neutre de chaque champ), donc zéro montant. Le secteur est « autre » : la
 * fiche dit son métier quand on le choisit, pas avant. La ville vient de la
 * zone que l'inscrit vise, si elle est déclarée — sinon vide.
 * ─────────────────────────────────────────────────────────────────────
 */
export function nouvelleFiche(zone = ""): Prospect {
  const maintenant = new Date().toISOString();
  return {
    ...prospectDefaults,
    id: uid(),
    name: "",
    company: "",
    sector: "autre",
    city: zone.trim(),
    stage: "prospect",
    likeness: 50,
    croyances: { produit: 5, soutien: 5, pourLui: 3 },
    nextStep: { date: daysAhead(2), action: "Premier contact" },
    createdAt: maintenant,
    updatedAt: maintenant,
  } as Prospect;
}
