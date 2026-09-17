/**
 * ─────────────────────────────────────────────────────────────────────
 * « CE CHAMP EST-IL UNE MESURE ? » — une seule définition.
 *
 * ══ CE QUI A ÉTÉ MESURÉ LE 17/09/2026 ══
 *
 * La question se posait à TROIS endroits, et deux d'entre eux ne répondaient
 * pas pareil sur la valeur exacte que TOUS les imports écrivent — la chaîne
 * vide.
 *
 * · `lib/ladder.ts` la posait bien : `filled(a.websiteState)` — une chaîne
 *   vide ne produit aucune preuve de visibilité.
 * · `lib/deep-dive.ts` la posait bien aussi, avec sa propre copie de `filled`.
 * · `lib/offer-match.ts` la posait FAUX : il testait `!== undefined`, et
 *   `weakWebsite("")` rend `true` — « site absent ou obsolète », +3.
 *
 * Or `prospectDefaults.deepAudit` (le socle de TOUS les imports, pas un jeu de
 * démonstration) vaut `{ websiteState: "", socialState: "", … }` : le champ
 * est toujours défini, jamais renseigné. **Le garde d'`offer-match` — écrit
 * mot pour mot pour dire « Donnée ABSENTE (undefined) ≠ signal : on ne score
 * que ce qui est mesuré » — ne pouvait donc JAMAIS se déclencher.** Le type
 * `DeepAudit` déclare ces quatre champs `string` OBLIGATOIRES : il n'existe
 * aucun chemin par lequel ils vaudraient `undefined`. La condition gardait un
 * état que le type rend impossible.
 *
 * Conséquence mesurée sur le chemin ICP réel (`permisVersProspect` sur les 8
 * arrêtés retenus) : **8 fiches sur 8** étaient routées vers Visibilité /
 * Growth, sur deux « signaux » que personne n'a jamais relevés — un arrêté de
 * permis ne porte ni site ni réseaux. L'escalier, lui, disait sur les mêmes
 * fiches qu'il n'y avait aucun trou de visibilité. Deux réponses opposées à la
 * même question, dans le même produit, sur la même fiche.
 *
 * ══ POURQUOI UN MODULE POUR TROIS LIGNES ══
 *
 * Parce que c'est exactement le défaut que la doctrine décrit : *combien
 * d'endroits posent cette règle, et répondent-ils tous pareil ?* Recopier la
 * bonne version dans `offer-match` aurait fait une TROISIÈME copie, donc une
 * troisième occasion de diverger. Elles importent maintenant la même.
 *
 * ⚠ DEUX AUTRES COPIES SURVIVENT, ET C'EST DÉLIBÉRÉ. `lib/master-rappel.ts`
 * et `lib/checkpoints.ts` utilisent la version FAIBLE — `Boolean(trim())`,
 * sans la liste « n/a · na · - · inconnu ». Les basculer changerait leur
 * comportement (« n/a » deviendrait vide) sur des écrans que je n'ai pas
 * mesurés. On ne corrige pas en aveugle un troisième module pour faire joli :
 * c'est nommé ici, ça se tranche avec une mesure.
 * ─────────────────────────────────────────────────────────────────────
 */

/**
 * Les valeurs qui veulent dire « on n'a pas regardé », par opposition à une
 * observation. « aucun » n'en fait PAS partie : c'est un constat, et il est
 * même le plus fort de tous — quelqu'un est allé voir et il n'y a rien.
 */
const VIDES = ["", "n/a", "na", "-", "—", "inconnu", "inconnue", "?"];

/**
 * Ce champ porte-t-il une OBSERVATION ?
 *
 * ⚠ La distinction qui compte n'est pas « rempli / vide » mais « mesuré /
 * pas regardé ». Un champ obligatoire par le type a toujours une valeur ; ça
 * ne veut pas dire que quelqu'un l'a relevée. Confondre les deux fabrique un
 * signal à partir d'un formulaire.
 */
export function estMesure(v: string | undefined | null): boolean {
  const t = (v ?? "").trim().toLowerCase();
  return t.length > 0 && !VIDES.includes(t);
}
