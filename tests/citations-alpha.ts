import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Vérifie qu'une règle « ce qu'ALPHA fait » désigne quelque chose qui EXISTE :
 * un fichier du dépôt, et dans ce fichier un nom qui porte la règle.
 *
 * ⚠ Les commentaires sont retirés avant de chercher. Sans ça, le nom cité dans
 * une phrase d'explication satisferait le test alors que le code a disparu :
 * l'assertion serait satisfaite par la PROSE (précédent : le garde du repli
 * sans serrure, qui a dû être écrit deux fois).
 *
 * Le nom doit être DÉCLARÉ (`export function/const/interface/type/class`) ou
 * être une propriété (`nom:` — les actions du store).
 */
const R = process.cwd();

export function sansCommentaires(src: string): string {
  /**
   * ⚠ Un LECTEUR, pas deux expressions régulières. La première version a
   * mangé la déclaration de `STAGES` : un commentaire de LIGNE de
   * `lib/hormozi.ts` cite un chemin qui contient une étoile entre deux barres,
   * et cette suite ouvrait, pour l'expression régulière, un faux commentaire de
   * bloc qui avalait le code jusqu'au prochain vrai. Une mutation qui
   * « supprime » du code en silence est exactement le défaut que ce fichier
   * est là pour attraper — il ne peut pas le porter lui-même.
   */
  let sortie = "";
  let i = 0;
  const n = src.length;
  while (i < n) {
    const c = src[i];
    const suite = src[i + 1];
    if (c === "/" && suite === "/") {
      while (i < n && src[i] !== "\n") i++;
      continue;
    }
    if (c === "/" && suite === "*") {
      i += 2;
      while (i < n && !(src[i] === "*" && src[i + 1] === "/")) i++;
      i += 2;
      continue;
    }
    if (c === '"' || c === "'" || c === "`") {
      sortie += c;
      i++;
      while (i < n && src[i] !== c) {
        if (src[i] === "\\") sortie += src[i++];
        if (i < n) sortie += src[i++];
      }
      sortie += c;
      i++;
      continue;
    }
    sortie += c;
    i++;
  }
  return sortie;
}

/** `null` si la citation tient, sinon la raison — pour un message d'échec lisible. */
export function citationFausse(fichier: string, symbole: string): string | null {
  const chemin = join(R, fichier);
  if (!existsSync(chemin)) return `${fichier} n'existe pas`;
  const code = sansCommentaires(readFileSync(chemin, "utf8"));
  const declare = new RegExp(`export\\s+(?:async\\s+)?(?:function|const|let|interface|type|class)\\s+${symbole}\\b`);
  const propriete = new RegExp(`(?:^|[\\s,{(])${symbole}\\s*:`, "m");
  return declare.test(code) || propriete.test(code) ? null : `${fichier} ne déclare pas « ${symbole} »`;
}
