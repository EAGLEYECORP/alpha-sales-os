import { sirenDeLaFiche } from "./siren";

/**
 * ─────────────────────────────────────────────────────────────────────
 * DEUX FICHES SONT-ELLES LA MÊME ENTREPRISE ? — la question que pose chaque
 * import (`importProspects`, `lib/store.ts`), sortie du magasin pour être
 * testée.
 *
 * Ordre : le SIREN, s'il est des DEUX côtés, tranche seul. Sinon le
 * téléphone, puis l'email, puis le nom.
 *
 * ⚠⚠ POURQUOI LE SIREN PASSE DEVANT TOUT (29/10/2026). La fusion se faisait
 * en dernier recours sur le NOM d'entreprise. Avec la recherche au registre
 * (`lib/trouver-clients.ts`), deux sociétés homonymes dans deux villes
 * (« GARAGE DU CENTRE », il y en a des centaines) seraient devenues UNE
 * fiche : la seconde écrasait l'adresse et les notes de la première, et l'une
 * des deux disparaissait du CRM sans un mot. Deux SIREN différents sont deux
 * entreprises, quel que soit leur nom — et un même SIREN est la même, même
 * écrit « SARL » d'un côté et pas de l'autre.
 *
 * Un seul côté porte un SIREN : on ne sait pas, et on retombe sur les autres
 * clés — une fiche saisie à la main avant d'avoir son numéro doit toujours
 * pouvoir rejoindre celle que le registre apporte.
 * ─────────────────────────────────────────────────────────────────────
 */

interface FicheComparable {
  siren?: string;
  notes?: string;
  phone?: string;
  email?: string;
  company: string;
}

/**
 * Numéro réduit à ses chiffres significatifs, pour comparer deux écritures.
 *
 * « 04 65 71 34 56 », « +33465713456 » et « 0465713456 » sont le même
 * téléphone. Comparer les chaînes brutes ferait échouer la fusion sur la seule
 * différence de mise en forme entre deux sources — et deux fiches au même
 * numéro, c'est deux appels à la même personne.
 */
export function normTel(tel: string | undefined): string {
  const d = (tel ?? "").replace(/\D/g, "");
  if (!d) return "";
  // 0465713456 et 33478123456 pointent le même poste : on garde les 9 derniers
  // chiffres, qui suffisent à identifier une ligne française.
  return d.length >= 9 ? d.slice(-9) : d;
}

export function memeFiche(existante: FicheComparable, entrante: FicheComparable): boolean {
  const a = sirenDeLaFiche(existante);
  const b = sirenDeLaFiche(entrante);
  if (a && b) return a === b;
  /**
   * ⚠ LE TÉLÉPHONE AVANT LE NOM. Sur un import terrain, « Carrosserie des
   * Lilas » et « Carrosserie des Lilas SARL » sont deux noms — donc deux
   * fiches, donc DEUX APPELS au même numéro. Un numéro est unique, un nom
   * d'entreprise ne l'est pas.
   */
  const tel = normTel(entrante.phone);
  if (tel && normTel(existante.phone) === tel) return true;
  if (entrante.email && existante.email && existante.email.toLowerCase() === entrante.email.toLowerCase()) return true;
  return existante.company.trim().toLowerCase() === entrante.company.trim().toLowerCase();
}
