import { estimationPublique, peutEmettreDevis, type EtatCadrage, type Estimation } from "./cadrage";

/**
 * ─────────────────────────────────────────────────────────────────────
 * LA PROPOSITION COMMERCIALE — et la porte qui sépare le PRÉ-DEVIS du DEVIS.
 *
 * Deux documents, deux régimes, et c'est toute la question :
 *
 *  · **PRÉ-DEVIS** — un ordre de grandeur, envoyable AVANT le cadrage. Il
 *    n'engage rien, il porte ses réserves, et il sert à obtenir le rendez-vous.
 *  · **DEVIS** — chiffré, daté, engageant. Il exige que le cadrage ait EU LIEU
 *    et que la suite ait été validée (`peutEmettreDevis`).
 *
 * ══ ⚠⚠ POURQUOI LA PORTE EST ICI, ET PAS DANS L'ÉCRAN ══
 *
 * `peutEmettreDevis()` existait depuis hier et n'était interrogé par personne :
 * la règle était exécutable et jamais exécutée. Le défaut récurrent du dépôt,
 * sur la porte la plus chère — celle d'où part un engagement.
 *
 * La garde est posée dans la FONCTION QUI REND LE DOCUMENT, pas dans le bouton.
 * Un bouton se contourne (une autre route, un script, un copier-coller) ;
 * la fonction qui fabrique le HTML, non. Même raisonnement que `/api/send` :
 * on arbitre là où la chose PART, jamais là où on clique.
 *
 * ══ CE QUE LE PRÉ-DEVIS N'A PAS LE DROIT D'ÊTRE ══
 *
 * Il ne doit jamais pouvoir se lire comme un devis. D'où trois contraintes,
 * toutes testées : le mot « devis » n'apparaît pas seul dans son titre, les
 * réserves de `lib/cadrage.ts` voyagent avec le chiffre, et le document
 * s'annonce lui-même comme non engageant en tête — pas en pied.
 *
 * ⚠ Le rendu est du HTML IMPRIMABLE, comme `lib/audit-doc.ts`. Il n'y a pas de
 * générateur de PDF dans ce dépôt, et c'est délibéré : une dépendance de plus
 * pour une chose que le navigateur fait déjà (Imprimer → PDF).
 * ─────────────────────────────────────────────────────────────────────
 */

export interface MarqueProposition {
  /** Raison sociale qui ÉMET — white-label : elle suit le compte, jamais nous. */
  societe: string;
  ville: string;
  /** Qui signe. Voir `lib/signature.ts` : on ne devine jamais un humain. */
  signataire: string;
}

export interface CibleProposition {
  entreprise: string;
  /** Effectif commercial annoncé par le prospect. */
  sieges: number;
}

/** Ce qu'un rendu produit — jamais une chaîne nue. */
export interface Document {
  titre: string;
  html: string;
  /** Le document engage-t-il ? Un pré-devis : jamais. */
  engageant: boolean;
}

/** Ce qui empêche un devis de partir. Vide = il peut partir. */
export interface RefusDevis {
  manquants: string[];
  motif: string;
}

const ECHAP = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

const eur = (n: number) => `${n.toLocaleString("fr-FR")} €`;

const STYLE = `
  * { box-sizing: border-box; margin: 0; }
  body { font-family: 'Inter', 'Helvetica Neue', Arial, sans-serif; background: #F5F3EE; color: #191919; line-height: 1.65; }
  .page { max-width: 760px; margin: 0 auto; padding: 40px 28px 60px; }
  .sheet { background: #fff; border: 1px solid #DEDAD1; border-radius: 18px; padding: 38px 40px 44px; }
  h1 { font-family: Georgia, serif; font-size: 28px; line-height: 1.2; font-weight: 400; }
  .brand { font-size: 11px; letter-spacing: .18em; text-transform: uppercase; color: #6B6862; font-weight: 600; }
  .avert { margin: 22px 0 28px; padding: 14px 16px; border-left: 3px solid #B85A32; background: #FBF7F4; font-size: 14px; }
  table { width: 100%; border-collapse: collapse; margin-top: 26px; }
  td { padding: 12px 0; border-bottom: 1px solid #EDEAE3; font-size: 15px; }
  td.n { text-align: right; font-variant-numeric: tabular-nums; }
  tr.total td { border-bottom: none; padding-top: 18px; font-size: 18px; font-weight: 600; }
  ul.res { margin: 26px 0 0; padding: 0; list-style: none; }
  ul.res li { font-size: 13.5px; color: #6B6862; padding-left: 16px; position: relative; margin-top: 8px; }
  ul.res li:before { content: "—"; position: absolute; left: 0; color: #B85A32; }
  .pied { margin-top: 30px; padding-top: 18px; border-top: 1px solid #EDEAE3; font-size: 12.5px; color: #6B6862; }
  .print { position: fixed; top: 16px; right: 16px; padding: 10px 16px; border: 1px solid #DEDAD1; background: #fff; border-radius: 999px; cursor: pointer; }
  @media print { .print { display: none } body { background: #fff } .sheet { border: none } }
`;

function enveloppe(titre: string, corps: string): string {
  return `<!doctype html>
<html lang="fr"><head><meta charset="utf-8"><title>${ECHAP(titre)}</title><style>${STYLE}</style></head>
<body><button class="print" onclick="window.print()">Imprimer / PDF</button>
<div class="page"><div class="sheet">${corps}</div></div></body></html>`;
}

function tableau(e: Estimation): string {
  return `<table>
  <tr><td>Installation, paramétrage et formation</td><td class="n">${eur(e.setupHT)}</td></tr>
  <tr><td>Abonnement — ${e.sieges} utilisateur${e.sieges > 1 ? "s" : ""}</td><td class="n">${eur(e.mensuelHT)} / mois</td></tr>
  <tr class="total"><td>Première année, installation comprise</td><td class="n">${eur(e.annee1HT)}</td></tr>
</table>`;
}

/**
 * LE PRÉ-DEVIS — envoyable avant le cadrage, et qui ne peut pas passer pour
 * un devis.
 *
 * Rend `null` si l'effectif ne permet aucune estimation défendable : au-delà
 * de la borne, `estimationPublique` refuse, et fabriquer un chiffre ici
 * contournerait ce refus par la porte de derrière.
 */
export function renderPreDevis(cible: CibleProposition, marque: MarqueProposition): Document | null {
  const e = estimationPublique(cible.sieges);
  if (!e) return null;

  const titre = `Ordre de grandeur — ${cible.entreprise}`;
  const corps = `
  <p class="brand">${ECHAP(marque.societe)} · ${ECHAP(marque.ville)}</p>
  <h1>${ECHAP(cible.entreprise)}</h1>
  <!-- ⚠ L'AVERTISSEMENT EST EN TÊTE, PAS EN PIED. Un lecteur qui découvre en
       bas de page que ce n'est pas un devis a déjà lu le montant comme un
       engagement — et c'est ce qu'il retiendra. -->
  <div class="avert"><strong>Ce document n'est pas un devis.</strong> C'est notre grille appliquée à
  votre effectif, pour que vous ayez un ordre de grandeur avant qu'on se parle. Le périmètre — donc
  le prix — se décide au cadrage.</div>
  ${tableau(e)}
  <ul class="res">${e.reserves.map((r) => `<li>${ECHAP(r)}</li>`).join("")}</ul>
  <p class="pied">Établi par ${ECHAP(marque.signataire)} · ${ECHAP(marque.societe)}. Aucun engagement
  de part et d'autre.</p>`;

  return { titre, html: enveloppe(titre, corps), engageant: false };
}

/**
 * LE DEVIS — engageant, et il exige le cadrage.
 *
 * ⚠⚠ C'EST ICI QUE LA RÈGLE MORD. Elle rend un `RefusDevis` plutôt qu'un
 * document : l'appelant ne peut pas « oublier » de vérifier, il n'a pas de
 * document à envoyer tant que les trois conditions ne sont pas remplies.
 * Rendre un document ET un drapeau `autorise` aurait laissé le drapeau se
 * faire ignorer.
 */
export function renderDevis(
  cible: CibleProposition,
  marque: MarqueProposition,
  cadrage: EtatCadrage,
  montantHT: number,
): Document | RefusDevis {
  const v = peutEmettreDevis(cadrage);
  if (!v.autorise) return { manquants: v.manquants, motif: v.motif };

  const titre = `Devis — ${cible.entreprise}`;
  const corps = `
  <p class="brand">${ECHAP(marque.societe)} · ${ECHAP(marque.ville)}</p>
  <h1>Devis — ${ECHAP(cible.entreprise)}</h1>
  <div class="avert">Établi après le cadrage du ${ECHAP(new Date(cadrage.creneauIso!).toLocaleDateString("fr-FR"))},
  validé par ${ECHAP(cadrage.validePar!)}. Périmètre arrêté d'un commun accord.</div>
  <table><tr class="total"><td>Montant</td><td class="n">${eur(montantHT)} HT</td></tr></table>
  <p class="pied">Établi par ${ECHAP(marque.signataire)} · ${ECHAP(marque.societe)}.</p>`;

  return { titre, html: enveloppe(titre, corps), engageant: true };
}

/** Un document est-il un refus ? Discriminant, pour que l'appelant soit forcé de choisir. */
export function estRefus(d: Document | RefusDevis): d is RefusDevis {
  return "manquants" in d;
}

/**
 * L'email qui accompagne le PRÉ-DEVIS.
 *
 * ⚠ Il ne promet rien et ne chiffre rien dans son corps : le montant vit dans
 * la pièce jointe, avec ses réserves. Un chiffre répété dans un email se
 * retrouve cité hors contexte, sans les trois lignes qui le bornent.
 *
 * ⚠ Pas de divulgation IA ici : cet email se relit et s'envoie par un humain.
 * L'y mettre serait FAUX — voir `lib/signature-ia.ts`. S'il devait partir
 * automatiquement, c'est `divulgation("email", "autonome")` qui décide.
 */
export function emailPreDevis(cible: CibleProposition, marque: MarqueProposition): { objet: string; corps: string } {
  return {
    objet: `${cible.entreprise} — un ordre de grandeur avant qu'on se parle`,
    corps:
      `Bonjour,\n\n` +
      `Vous trouverez en pièce jointe un ordre de grandeur, calculé sur votre effectif ` +
      `(${cible.sieges} personne${cible.sieges > 1 ? "s" : ""} au commerce).\n\n` +
      `Ce n'est pas un devis : le périmètre se décide au cadrage, et c'est lui qui fait le prix. ` +
      `Je préfère vous donner le chiffre maintenant plutôt que de vous faire prendre un rendez-vous ` +
      `pour le découvrir.\n\n` +
      `Si l'ordre de grandeur vous va, on cale trente minutes et on regarde votre cas précis.\n\n` +
      `${marque.signataire}\n${marque.societe} · ${marque.ville}`,
  };
}
