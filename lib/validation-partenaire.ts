import { empreinte } from "./apprentissage";
import { getAccount } from "./accounts";
import { PROMPTS } from "./prompts";
import { cadresSortants, FORMAT_LABELS, STAGE_GROUPS } from "./templates";

/**
 * ─────────────────────────────────────────────────────────────────────
 * CE QUI SORT AU NOM D'UN PARTENAIRE DOIT AVOIR ÉTÉ VALIDÉ PAR LUI.
 *
 * ── LE PROBLÈME, DIT PAR SCINTIA EUX-MÊMES ──
 *
 * Sur un appel Callflow, c'est LEUR marque qui parle. Ils ont peur pour leur
 * script, et ils ont raison : un prospect démarché n'entend pas « Alpha Sales
 * OS pour le compte de ScintIA », il entend ScintIA. Ce qui se dit là engage
 * une réputation qui n'est pas la nôtre.
 *
 * Le dépôt savait déjà refuser un script non conforme (`auditScript`,
 * `EXIGENCE_MARQUE_PARTENAIRE`). Mais la conformité n'est pas l'accord : un
 * texte peut être parfaitement légal ET ne pas être celui que le partenaire a
 * relu. Ce module garde l'ACCORD, pas la loi.
 *
 * ── LA SEULE CHOSE QUI REND UNE VALIDATION UTILE ──
 *
 * Elle porte sur le TEXTE EXACT. Une validation attachée à un identifiant
 * (« la trame d'appel est validée ») survivrait à sa propre réécriture : on
 * fait relire un texte au partenaire, on le modifie le lendemain, et le
 * tampon reste. C'est pire que pas de validation, parce que tout le monde
 * croit que le contrôle a eu lieu.
 *
 * On enregistre donc l'EMPREINTE du texte validé, et l'état retombe à
 * `perimee` dès qu'un caractère bouge. Le partenaire revalide, ou on remet le
 * texte qu'il avait accepté.
 *
 * ⚠ CE QUE L'EMPREINTE N'EST PAS. `empreinte()` (lib/apprentissage.ts) est un
 * hachage 32 bits façon `hashCode`, pas de la cryptographie — c'est écrit
 * là-bas et ça reste vrai ici. Le modèle de menace n'est PAS quelqu'un qui
 * fabriquerait une collision pour faire passer un texte : c'est nous qui
 * oublions qu'on a modifié une phrase il y a trois semaines. Contre l'oubli,
 * 32 bits suffisent largement. Contre un adversaire, il faudrait autre chose —
 * et il faudrait surtout que le partenaire signe, pas nous.
 *
 * ⚠⚠ Le compte MAÎTRE n'est jamais concerné. Sur EAGLEYE, c'est notre marque,
 * notre risque, notre décision : exiger qu'on se valide soi-même ne
 * protégerait personne et ferait du contrôle une formalité qu'on apprend à
 * cliquer sans lire.
 * ─────────────────────────────────────────────────────────────────────
 */

export type EtatValidation =
  /** Compte maître : c'est notre marque, personne d'autre à consulter. */
  | "non-requise"
  /** Jamais soumis au partenaire. */
  | "jamais"
  /** Validé, et le texte n'a pas bougé depuis. */
  | "validee"
  /** Validé un jour, mais le texte a changé. L'accord ne porte plus. */
  | "perimee";

export interface Validation {
  /** Identifiant de ce qui a été validé (prompt ou modèle d'écrit). */
  cible: string;
  /** Le compte au nom duquel ça sort. */
  compte: string;
  /** Empreinte du texte exact que le partenaire a relu. */
  empreinte: string;
  /**
   * QUI a validé, chez eux. Un nom de personne, pas « le partenaire ».
   *
   * ⚠ Sans nom, une validation est une case qu'on coche soi-même. Le jour où
   * un appel dérape, « ScintIA a validé » ne vaut rien ; « Untel a validé le
   * 3 septembre en visio » se vérifie en un message.
   */
  par: string;
  /** ISO. */
  le: string;
  canal: CanalValidation;
}

export type CanalValidation = "visio" | "email" | "sms" | "reunion";

export const CANAUX: { id: CanalValidation; label: string }[] = [
  { id: "visio", label: "En visio" },
  { id: "reunion", label: "En rendez-vous" },
  { id: "email", label: "Par email" },
  { id: "sms", label: "Par SMS" },
];

/**
 * Ce qui doit passer devant le partenaire.
 *
 * ⚠ Uniquement ce qui ATTEINT LE PROSPECT. Les prompts internes (le copilote,
 * l'agent, le débrief) tournent chez nous, sur nos données : les faire relire
 * noierait ce qui compte sous ce qui ne compte pas, et un contrôle qu'on
 * survole ne contrôle rien.
 */
export interface CibleValidation {
  id: string;
  label: string;
  /** Ce que le partenaire lit, en une phrase. */
  quoi: string;
  /** Où ça part. */
  canal: "appel" | "email" | "sms";
}

/**
 * Les prompts SORTANTS du registre, dérivés — jamais recopiés.
 *
 * ⚠ La liste se déduit du `lieu` et de la présence d'un invariant d'appel à
 * froid. Une liste écrite à la main ici oublierait le prochain prompt sortant
 * ajouté au registre, et personne ne s'en apercevrait avant qu'il parte non
 * validé.
 */
export function ciblesPrompts(): CibleValidation[] {
  return PROMPTS.filter((p) => p.invariants.some((i) => i.cle === "objectif-unique" || i.cle === "droit-opposition")).map(
    (p) => ({
      id: p.id,
      label: p.label,
      quoi: p.aQuoiCaSert,
      canal: "appel" as const,
    })
  );
}

/**
 * Les ÉCRITS sortants — emails et messages directs.
 *
 * ⚠ Dérivés de `cadresSortants()`, jamais recopiés : ajouter un cadre à la
 * bibliothèque le soumet automatiquement au partenaire. Une liste tenue ici
 * oublierait le prochain, et personne ne s'en apercevrait avant qu'il parte
 * non validé au nom de leur marque.
 */
export function ciblesEcrits(): CibleValidation[] {
  return cadresSortants().map((c) => ({
    id: c.id,
    label: `${STAGE_GROUPS.find((g) => g.id === c.group)?.label ?? c.group} — ${FORMAT_LABELS[c.format]}`,
    quoi: c.title,
    canal: c.format === "email" ? ("email" as const) : ("sms" as const),
  }));
}

/**
 * TOUT ce qui doit passer devant le partenaire : la voix et l'écrit.
 *
 * ⚠ Une seule fonction, parce qu'il n'y a qu'une seule question — « qu'est-ce
 * qui sort au nom de leur marque ? ». Deux listes maintenues séparément
 * finiraient par diverger, et c'est la moins tenue qui laisserait passer.
 */
export function toutesLesCibles(): CibleValidation[] {
  return [...ciblesPrompts(), ...ciblesEcrits()];
}

/** L'identifiant de validation d'une étape de campagne. Stable, lisible. */
export const idEtapeCampagne = (campagneId: string, etapeId: string): string =>
  `campagne:${campagneId}:${etapeId}`;

/**
 * Les étapes d'UNE campagne, à faire valider avant de l'envoyer.
 *
 * ⚠ POURQUOI LES CAMPAGNES ET PAS SEULEMENT LES GABARITS. Les cadres de la
 * bibliothèque servent au copier-coller : l'opérateur les recopie dans sa
 * campagne, puis les modifie. Ce qui part réellement en masse, ce sont les
 * ÉTAPES de campagne — et c'est donc leur texte qu'il faut faire relire, pas
 * le modèle dont elles descendent.
 *
 * ⚠⚠ Ces textes vivent dans le navigateur. Le serveur ne les a jamais vus et
 * ne peut rien recalculer : le garde-fou est côté écran, et il est plus faible
 * qu'un 422. Dit ici pour que personne ne surestime ce qu'il couvre.
 */
export function ciblesCampagne(campagne: {
  id: string;
  name: string;
  steps: { id: string; kind: string; subject: string; body: string }[];
}): { cible: CibleValidation; texte: string }[] {
  return campagne.steps.map((e, i) => ({
    cible: {
      id: idEtapeCampagne(campagne.id, e.id),
      label: `${campagne.name} — étape ${i + 1}`,
      quoi: e.subject?.trim() || e.body.slice(0, 60),
      canal: e.kind === "email" ? ("email" as const) : ("sms" as const),
    },
    // Sujet ET corps : changer l'objet d'un email change ce que le prospect
    // voit en premier. Le valider sans lui laisserait passer la modification
    // la plus visible.
    texte: `${e.subject ?? ""}\n${e.body}`,
  }));
}

/**
 * Une campagne peut-elle partir au nom de ce compte ?
 *
 * Rend la liste des étapes qui bloquent — jamais un simple booléen : « la
 * campagne est bloquée » sans dire QUELLE étape oblige à tout rouvrir.
 */
export function campagnePeutPartir(
  campagne: { id: string; name: string; steps: { id: string; kind: string; subject: string; body: string }[] },
  compteId: string,
  validations: Validation[]
): { ok: boolean; bloquantes: { label: string; pourquoi: string }[] } {
  const bloquantes = ciblesCampagne(campagne)
    .map(({ cible, texte }) => ({ cible, verdict: etatValidation(cible.id, texte, compteId, validations) }))
    .filter(({ verdict }) => !peutSortir(verdict.etat))
    .map(({ cible, verdict }) => ({ label: cible.label, pourquoi: verdict.pourquoi }));
  return { ok: bloquantes.length === 0, bloquantes };
}

/** Un compte partenaire engage une marque qui n'est pas la nôtre. */
export function estPartenaire(compteId: string): boolean {
  const c = getAccount(compteId);
  return Boolean(c && c.kind !== "master");
}

export interface VerdictValidation {
  etat: EtatValidation;
  /** La phrase à afficher — ce qui manque, ou ce qui a bougé. */
  pourquoi: string;
  /** La validation retenue, quand il y en a une. */
  validation?: Validation;
}

/**
 * L'état de validation d'un texte, pour un compte donné.
 *
 * Pur : deux appels sur les mêmes entrées rendent le même verdict.
 */
export function etatValidation(
  cible: string,
  texteCourant: string,
  compteId: string,
  validations: Validation[]
): VerdictValidation {
  if (!estPartenaire(compteId)) {
    return {
      etat: "non-requise",
      pourquoi: "Compte maître : c'est notre marque. Rien à faire valider par personne.",
    };
  }

  const nom = getAccount(compteId)?.name ?? compteId;
  const v = validations.find((x) => x.cible === cible && x.compte === compteId);

  if (!v) {
    return {
      etat: "jamais",
      pourquoi: `Jamais soumis à ${nom}. Sur leur appel, c'est leur marque qui parle — rien ne part avant qu'ils aient lu ce texte.`,
    };
  }

  if (v.empreinte !== empreinte(texteCourant)) {
    return {
      etat: "perimee",
      validation: v,
      pourquoi:
        `Le texte a changé depuis la validation de ${v.par} (${new Date(v.le).toLocaleDateString("fr-FR")}). ` +
        `L'accord portait sur l'ancienne version : il ne couvre pas celle-ci.`,
      };
  }

  return {
    etat: "validee",
    validation: v,
    pourquoi: `Validé par ${v.par} le ${new Date(v.le).toLocaleDateString("fr-FR")}. Le texte n'a pas bougé depuis.`,
  };
}

/**
 * Ce texte a-t-il le droit de partir ?
 *
 * ⚠ La seule réponse à cette question dans tout le produit — même discipline
 * que `peutSynchroniser` pour le pipe serveur. Un deuxième endroit qui
 * déciderait « bon, ça peut sortir » finirait par répondre autrement un jour
 * de démonstration pressée.
 *
 * `perimee` REFUSE, et c'est le cas qui compte : un texte validé puis modifié
 * est exactement celui qu'on croit couvert.
 */
export function peutSortir(etat: EtatValidation): boolean {
  return etat === "non-requise" || etat === "validee";
}

/** Enregistre une validation. Le texte fait foi, pas l'intention. */
export function validerTexte(
  cible: string,
  texte: string,
  compteId: string,
  par: string,
  canal: CanalValidation,
  maintenant: Date = new Date()
): Validation {
  return {
    cible,
    compte: compteId,
    empreinte: empreinte(texte),
    par: par.trim(),
    le: maintenant.toISOString(),
    canal,
  };
}

/**
 * Remplace une validation existante, ou l'ajoute. Jamais de doublon : deux
 * validations pour la même cible et le même compte rendraient l'état
 * dépendant de l'ordre du tableau.
 */
export function poserValidation(validations: Validation[], v: Validation): Validation[] {
  return [...validations.filter((x) => !(x.cible === v.cible && x.compte === v.compte)), v];
}

/**
 * La preuve à joindre à un envoi, prête pour le corps de requête.
 *
 * ⚠ UNE SEULE FONCTION POUR LES QUATRE APPELANTS de `/api/send` (barre
 * d'envoi, campagnes, recette, newsletter). Quatre constructions à la main
 * auraient divergé — et c'est celle qui aurait oublié un champ qui aurait
 * fait passer un texte non validé.
 *
 * Rend `undefined` quand il n'y a rien à prouver : compte maître, ou cible
 * jamais validée. Le serveur tranche de toute façon, il ne fait pas confiance
 * à ce qu'on lui envoie sur le CONTENU — il recalcule l'empreinte lui-même.
 */
export function preuvePourEnvoi(
  cible: string,
  compteId: string,
  validations: Validation[]
): { par: string; le: string; empreinte: string } | undefined {
  if (!estPartenaire(compteId)) return undefined;
  const v = validations.find((x) => x.cible === cible && x.compte === compteId);
  return v ? { par: v.par, le: v.le, empreinte: v.empreinte } : undefined;
}

/** Ce qu'il reste à faire valider, pour l'écran d'onboarding partenaire. */
export interface LigneOnboarding {
  cible: CibleValidation;
  verdict: VerdictValidation;
}

export function planValidation(
  cibles: { cible: CibleValidation; texte: string }[],
  compteId: string,
  validations: Validation[]
): { lignes: LigneOnboarding[]; restantes: number; resume: string } {
  const lignes = cibles.map(({ cible, texte }) => ({
    cible,
    verdict: etatValidation(cible.id, texte, compteId, validations),
  }));
  const restantes = lignes.filter((l) => !peutSortir(l.verdict.etat)).length;
  const nom = getAccount(compteId)?.name ?? compteId;

  const resume = !estPartenaire(compteId)
    ? "Compte maître : aucune validation partenaire n'est requise."
    : restantes === 0
      ? `Tout ce qui sort au nom de ${nom} a été validé par eux.`
      : `${restantes} texte(s) sur ${lignes.length} ne peuvent pas partir : ${nom} ne les a pas validés, ou ils ont changé depuis.`;

  return { lignes, restantes, resume };
}
