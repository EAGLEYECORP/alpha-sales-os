import type { Prospect, Stage } from "./types";
import { stageById } from "./hormozi";
import { deepDive } from "./deep-dive";
import { guessSegmentForProspect } from "./segments";
import { getAccount } from "./accounts";
// ⚠ Pas d'import de `lib/bricks` : ce module est appelé depuis une page
// CLIENT (app/(app)/prospects/[id]/page.tsx), donc tout ce qu'il importe part
// dans un fichier JavaScript téléchargeable. Les libellés viennent de la vue
// publique ; les MONTANTS sont passés en paramètre, chiffrés par le serveur
// (/api/catalogue). Sans eux, la diapositive de prix n'existe pas — ce qui est
// le comportement correct, pas une dégradation.
import { CAPACITES } from "./public-catalogue";
import { vitalSigns } from "./vital-signs";

/**
 * ─────────────────────────────────────────────────────────────────────
 * LA PRÉSENTATION D'UN PROSPECT — celle de SON étape, pas une générique.
 *
 * Une présentation unique envoyée à tout le monde est la façon la plus
 * sûre de perdre un deal proprement : elle donne le prix à quelqu'un qui
 * n'a pas encore vu la démo, et elle re-explique le problème à quelqu'un
 * qui a déjà signé sur ce problème.
 *
 * La doctrine de la maison dit deux choses que ce module fait respecter
 * par CONSTRUCTION, pas par discipline :
 *
 *   · JAMAIS DE PRIX AVANT LA DÉMO. Avant l'étape « offre », aucune
 *     diapositive ne porte de montant. Ce n'est pas un réglage : la
 *     fonction ne les produit pas, et un test le verrouille.
 *   · JAMAIS DE CHIFFRE INVENTÉ. La perte estimée n'apparaît que si elle
 *     a été saisie, et elle est toujours annoncée comme une hypothèse à
 *     valider — sur SES chiffres à lui.
 *
 * Chaque diapositive porte une INTENTION unique. Une diapositive qui
 * essaie de faire deux choses n'en fait aucune.
 * ─────────────────────────────────────────────────────────────────────
 */

export interface Slide {
  /** Titre affiché. */
  title: string;
  /** Sur-titre discret : où on en est dans l'histoire. */
  kicker?: string;
  /** Corps : puces courtes, dicibles à voix haute. */
  bullets: string[];
  /** La phrase à prononcer en montrant cette diapositive. */
  say?: string;
  /** Chiffre mis en avant — uniquement s'il est RÉEL. */
  figure?: { value: string; label: string; caveat?: string };
}

export interface Deck {
  prospect: string;
  stage: Stage;
  stageLabel: string;
  /** L'objectif UNIQUE de cette présentation. */
  objective: string;
  slides: Slide[];
  /** Ce que la présentation ne dit pas, et pourquoi. */
  omissions: string[];
}

const eur = (n: number) => `${Math.round(n).toLocaleString("fr-FR")} €`;

/** Les étapes où le prix a le droit d'apparaître. */
const PRIX_AUTORISE: Stage[] = ["offre", "redzone", "signe"];

/**
 * Construit la présentation.
 *
 * `accountId` détermine l'offre et le rituel de closing : une présentation
 * Un compte mono-offre ne parle que de la sienne.
 *
 * `prix` : le chiffrage, calculé côté serveur. Absent = pas de diapositive de
 * prix, et l'omission est expliquée à l'opérateur. C'est volontairement le
 * même comportement que « trop tôt pour le prix » : dans les deux cas, mieux
 * vaut une présentation sans montant qu'un montant approximatif.
 */
export interface DeckPrix {
  /** Chiffrage des briques d'entrée du segment (€ HT). */
  setupHT: number;
  monthlyHT: number;
  /** La recommandation produite par le chiffrage (pack vs briques). */
  recommendation: string;
  /** Le pack complet, comme point d'ancrage. */
  packSetupHT: number;
  packMonthlyHT: number;
}

export function buildDeck(p: Prospect, accountId = "eagleye", now: Date = new Date(), prix?: DeckPrix): Deck {
  const dive = deepDive(p, accountId);
  const account = getAccount(accountId);
  const segment = guessSegmentForProspect({ sector: p.sector, company: p.company, notes: p.notes, problems: p.problems });
  const vitals = vitalSigns(p, now);
  const stage = stageById(p.stage);
  const prixOk = PRIX_AUTORISE.includes(p.stage);

  const slides: Slide[] = [];
  const omissions: string[] = [];

  // ── 1. Couverture — son nom, pas le nôtre ──────────────────────────
  slides.push({
    kicker: account.name,
    title: p.company || "(société sans nom)",
    bullets: [
      segment ? segment.who : "Organisation dont la vente dépend de personnes",
      p.city || "",
      `Préparé le ${now.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}`,
    ].filter(Boolean),
    say: "Je ne vous présente pas notre société. Je vous présente ce qu'on a vu chez vous.",
  });

  // ── 2. Le problème, dit avec SES mots ──────────────────────────────
  const douleurs = p.problems.length ? p.problems : segment ? segment.pains.slice(0, 3) : [];
  slides.push({
    kicker: "Ce qu'on a constaté",
    title: segment ? segment.corePain : "Ce qui vous coûte aujourd'hui",
    bullets: douleurs.length ? douleurs : ["À compléter pendant le cadrage — rien n'est inventé ici."],
    say: segment?.angle ?? "Dites-moi si je me trompe.",
  });
  if (!p.problems.length) {
    omissions.push("Les douleurs viennent du segment, pas de la fiche : l'audit n'a pas encore été saisi.");
  }

  // ── 3. Le coût de l'inaction — seulement s'il est CHIFFRÉ ──────────
  if (p.ignoranceTax > 0) {
    slides.push({
      kicker: "Ce que ça coûte de ne rien faire",
      title: "Le calcul, avec vos chiffres",
      bullets: [
        "Ce montant vient de ce que vous nous avez dit, pas d'une moyenne de marché.",
        "Il se vérifie en quinze minutes — et s'il est faux, on le corrige devant vous.",
      ],
      figure: {
        value: `${eur(p.ignoranceTax)}/mois`,
        label: `soit ${eur(p.ignoranceTax * 12)} par an`,
        caveat: "Estimation à valider ensemble — jamais une garantie.",
      },
      say: "Je préfère un chiffre juste à un chiffre impressionnant.",
    });
  } else {
    omissions.push("Aucun coût d'inaction affiché : il n'a pas été chiffré. Un montant inventé se retourne au premier rendez-vous technique.");
  }

  // ── 4. Ce qu'on installe — par étape ────────────────────────────────
  const briques = segment
    ? segment.entryBricks.map((id) => CAPACITES.find((c) => c.id === id)).filter(Boolean)
    : [];

  if (p.stage === "prospect" || p.stage === "contact") {
    // Trop tôt pour la solution : l'objectif est le rendez-vous d'audit.
    slides.push({
      kicker: "Ce qu'on propose maintenant",
      title: "Vingt minutes, chez vous, gratuites",
      bullets: [
        "On mesure ce que ça vous coûte réellement chaque mois.",
        "Vous gardez les chiffres, que vous travailliez avec nous ou non.",
        "Aucune obligation, aucun engagement, aucun prix annoncé ce jour-là.",
      ],
      say: "Je ne vends rien au téléphone. Je viens mesurer, vous décidez avec les vrais chiffres.",
    });
  } else {
    slides.push({
      kicker: "Ce qu'on installe",
      title: briques.length ? briques.map((b) => b!.label).join(" + ") : dive.offerLabel,
      bullets: briques.length
        ? briques.map((b) => `${b!.label} — ${b!.what}`)
        : [dive.angle],
      say: "Ce n'est pas un logiciel de plus à apprendre. C'est ce qui tourne sans vous.",
    });
  }

  // ── 5. Le prix — UNIQUEMENT à partir de l'offre ────────────────────
  if (prixOk && prix) {
    slides.push({
      kicker: "Le prix, sans détour",
      title: "Ce que ça coûte",
      bullets: [
        `Installation : ${eur(prix.setupHT)} HT`,
        `Abonnement : ${eur(prix.monthlyHT)} HT/mois`,
        prix.recommendation,
        `Le pack complet : ${eur(prix.packSetupHT)} HT + ${eur(prix.packMonthlyHT)} HT/mois.`,
      ],
      say: "Vous avez vu ce que ça fait. Voilà ce que ça coûte. Le reste, c'est votre décision.",
    });
  } else if (prixOk) {
    omissions.push(
      "Aucun prix : le chiffrage n'a pas répondu (il se calcule côté serveur pour ne pas publier la grille). " +
        "Recharge la fiche avant de présenter — un montant approximatif se paie au closing."
    );
  } else {
    omissions.push(
      `Aucun prix : le prospect est à l'étape « ${stage.label} ». Un chiffre annoncé avant la démo transforme la conversation en négociation.`
    );
  }

  // ── 6. Ce à quoi on s'engage / ce à quoi il a droit ────────────────
  slides.push({
    kicker: "Nos devoirs, vos droits",
    title: "Ce sur quoi vous pouvez nous tenir",
    bullets: [
      "Vos données et vos accès restent les vôtres, tout le temps.",
      "Aucune reconduction tacite : vous arrêtez quand vous voulez.",
      "Ce qui est promis est écrit ; ce qui n'est pas écrit n'est pas promis.",
      "Un interlocuteur, joignable, qui connaît votre dossier.",
    ],
    say: "Ce qu'on garantit, c'est le procédé. Pas un résultat qu'on ne maîtrise pas.",
  });

  // ── 7. La prochaine étape — DATÉE ──────────────────────────────────
  slides.push({
    kicker: "La suite",
    title: dive.objective,
    bullets: [
      // Le rituel de closing dépend du compte : se tromper de rituel perd le
      // deal au dernier mètre. Absent pour un compte qui n'en définit pas.
      account.closing?.action ?? "Convenir de la suite avec un interlocuteur nommé.",
      p.nextStep?.date
        ? `Convenu : ${new Date(p.nextStep.date).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })} — ${p.nextStep.action}`
        : "À dater maintenant : un contact qui se termine sans date se termine.",
    ],
    say: "On se fixe une date maintenant, pas « je vous rappelle ».",
  });

  // Signal utile à l'opérateur, jamais montré au prospect.
  if (vitals.readiness < 40 && prixOk) {
    omissions.push(
      `⚠ Signaux vitaux à ${vitals.readiness}/100 alors que le prix est affiché — vérifier ce qui bloque avant d'envoyer.`
    );
  }

  return {
    prospect: p.company,
    stage: p.stage,
    stageLabel: stage.label,
    objective: dive.objective,
    slides,
    omissions,
  };
}

/** Le deck en HTML autonome — imprimable, envoyable, sans dépendance. */
export function renderDeck(deck: Deck, brand = "EAGLEYE CORP"): string {
  const esc = (s: string) =>
    String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

  const slides = deck.slides
    .map(
      (s, i) => `
  <section class="s">
    <div class="n">${i + 1} / ${deck.slides.length}</div>
    ${s.kicker ? `<p class="k">${esc(s.kicker)}</p>` : ""}
    <h2>${esc(s.title)}</h2>
    ${
      s.figure
        ? `<div class="fig"><span class="v">${esc(s.figure.value)}</span><span class="l">${esc(s.figure.label)}</span>${
            s.figure.caveat ? `<span class="c">${esc(s.figure.caveat)}</span>` : ""
          }</div>`
        : ""
    }
    ${s.bullets.length ? `<ul>${s.bullets.map((b) => `<li>${esc(b)}</li>`).join("")}</ul>` : ""}
    ${s.say ? `<p class="say">« ${esc(s.say)} »</p>` : ""}
  </section>`
    )
    .join("");

  return `<!doctype html><html lang="fr"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(deck.prospect)} — ${esc(deck.stageLabel)}</title>
<style>
  :root { --ink:#191919; --cream:#F5F3EE; --accent:#B85A32; --muted:#6B6862; --line:#DEDAD1; }
  *{margin:0;padding:0;box-sizing:border-box}
  body{background:var(--cream);color:var(--ink);font:16px/1.6 ui-sans-serif,system-ui,sans-serif;-webkit-font-smoothing:antialiased}
  .s{max-width:760px;margin:0 auto;padding:64px 32px;border-bottom:1px solid var(--line);position:relative;page-break-after:always}
  .n{position:absolute;top:24px;right:32px;font:500 11px ui-monospace,monospace;color:var(--muted)}
  .k{font-size:12px;letter-spacing:.14em;text-transform:uppercase;color:var(--accent);margin-bottom:14px}
  h2{font-size:38px;line-height:1.12;letter-spacing:-.02em;font-weight:600}
  ul{margin-top:26px;list-style:none}
  li{padding:9px 0 9px 20px;border-left:2px solid var(--line);margin-bottom:2px;color:#333}
  .fig{margin-top:28px;padding:22px;border:1px solid var(--line);border-radius:12px;background:#fff}
  .fig .v{display:block;font-size:34px;font-weight:600;letter-spacing:-.02em}
  .fig .l{display:block;color:var(--muted);margin-top:4px}
  .fig .c{display:block;margin-top:10px;font-size:13px;color:var(--accent)}
  .say{margin-top:28px;font-style:italic;color:var(--muted);border-left:2px solid var(--accent);padding-left:16px}
  footer{max-width:760px;margin:0 auto;padding:40px 32px;color:var(--muted);font-size:13px}
  @media print{.s{padding:40px 0}body{background:#fff}}
</style></head><body>
${slides}
<footer>${esc(brand)} · document préparé pour ${esc(deck.prospect)} · les montants sont HT et les estimations sont à valider ensemble.</footer>
</body></html>`;
}
