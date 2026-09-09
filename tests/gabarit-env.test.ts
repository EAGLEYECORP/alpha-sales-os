import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { OFFRES } from "../lib/offres-publiques";

/**
 * ─────────────────────────────────────────────────────────────────────
 * LE GABARIT D'ENVIRONNEMENT SE COPIE-COLLE — donc il ne ment pas.
 *
 * `ENV_TEMPLATE` n'est pas de la documentation : c'est un bloc que quelqu'un
 * copie dans son `.env` ou chez son hébergeur, en bloc, sans le relire ligne
 * à ligne. Ce qui y est faux devient une configuration fausse.
 * ─────────────────────────────────────────────────────────────────────
 */

const racine = process.cwd();
const src = readFileSync(join(racine, "components/settings/system-status.tsx"), "utf8");
const gabarit = src.slice(src.indexOf("ENV_TEMPLATE"), src.indexOf("`;", src.indexOf("ENV_TEMPLATE")));

test("⚠ AUCUN MONTANT DANS LE BLOC STRIPE DU GABARIT", () => {
  /**
   * ⚠ TROUVÉ PAR UN BALAYAGE, PAS PAR UNE RELECTURE.
   *
   * Le bloc annonçait six prix en dur — « abonnement 149 €/mois », « acompte
   * 2 500 € ». La grille avait déjà bougé une fois (les paliers du revendeur
   * disparu), et rien ici ne l'aurait suivi.
   *
   * Le coût du mensonge n'est pas cosmétique : ce bloc se colle chez
   * l'hébergeur, et on crée les prix Stripe d'après ses commentaires. Un
   * montant périmé fait créer chez Stripe un prix que l'app n'annonce plus —
   * et ça ne se voit qu'au premier paiement, du côté du client.
   *
   * Mutation vérifiée : remettre « 149 €/mois » dans le bloc fait tomber ce
   * test.
   */
  const bloc = gabarit.slice(gabarit.indexOf("STRIPE_SECRET_KEY"));
  const montants = [...bloc.matchAll(/\d[\d\s ]*\s?€/g)].map((m) => m[0].trim());
  assert.deepEqual(
    montants,
    [],
    `montant(s) recopié(s) dans le gabarit : ${montants.join(", ")} — les prix vivent dans lib/offres-publiques.ts`
  );
});

test("⚠ les variables de prix du gabarit sont EXACTEMENT celles de la grille", () => {
  /**
   * L'autre moitié : retirer les montants ne sert à rien si les NOMS de
   * variables dérivent. Une offre ajoutée sans sa ligne ici donne un bouton
   * « payer » qui tombe dans le vide ; une ligne restée après la suppression
   * d'une offre fait créer chez Stripe un prix que plus aucun bouton
   * n'atteint — c'est exactement ce qui est arrivé à `STRIPE_PRICE_SOLO` et
   * `STRIPE_PRICE_PRO`.
   *
   * Mutation vérifiée : retirer une ligne du gabarit, ou changer un
   * `priceEnv` dans la grille, fait tomber ce test.
   */
  const duGabarit = [...gabarit.matchAll(/^(STRIPE_PRICE_[A-Z0-9_]*)=/gm)].map((m) => m[1]).sort();
  const deLaGrille = OFFRES.map((o) => o.priceEnv).filter((v): v is string => Boolean(v)).sort();

  assert.deepEqual(duGabarit, deLaGrille, "le gabarit et la grille ne nomment pas les mêmes variables de prix");
});

test("⚠ aucune doc ne cite un fichier du dépôt qui n'existe pas", () => {
  /**
   * ⚠ Deux références mortes trouvées au balayage : `app/prospects/[id]/page.tsx`
   * (le vrai chemin porte le groupe de routes `(app)`) et un fichier de
   * dépendance présenté comme s'il était à nous.
   *
   * Une référence morte ne plante rien. Elle fait juste conclure au lecteur
   * que la doc est périmée — donc qu'il peut cesser de la croire. C'est la
   * même raison qui a fait délier les liens de l'export public.
   */
  const docs = [
    ...readdirSync(join(racine, "docs"))
      .filter((f) => f.endsWith(".md"))
      .map((f) => join("docs", f)),
    "README.md",
    "CLAUDE.md",
  ];

  const morts: string[] = [];
  for (const d of docs) {
    const texte = readFileSync(join(racine, d), "utf8");
    // Seulement ce qui ressemble à un chemin DE CE DÉPÔT, entre accents
    // graves. Un chemin de dépendance ou un exemple ne matche pas.
    for (const m of texte.matchAll(/`((?:lib|app|components|tests|supabase|scripts|integrations)\/[\w\-./()[\]]+\.\w+)`/g)) {
      if (!existsSync(join(racine, m[1]))) morts.push(`${d} → ${m[1]}`);
    }
  }

  assert.deepEqual(morts, [], `référence(s) morte(s) : ${morts.join(" · ")}`);
});
