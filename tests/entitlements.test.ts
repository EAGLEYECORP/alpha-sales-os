import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { ACCES_PAR_CHEMIN, CHEMINS_COMMUNS, briquesPourChemin, normaliser, peutOuvrir } from "../lib/bricks-access";
import { CHEMIN_PAR_API } from "../lib/api-access";
import {
  autorise, BRIQUES_GRATUITES, deploiementSansSerrure, DROIT_REFUSE, DROIT_SOLO, droitGratuit, estMaitre,
  normaliserBriques, statutEffectif, BRIQUES_CONNUES,
  type Entitlement,
} from "../lib/entitlements";
import { BRICKS } from "../lib/bricks";
import { BRIQUES_CONSOMMATRICES } from "../lib/offres-publiques";
import { COUTS_BRIQUES } from "../lib/pricing-briques";

/**
 * ─────────────────────────────────────────────────────────────────────
 * LA VENTE À LA CARTE — « il ne voit QUE sa brique ».
 *
 * Cette phrase était dans la doctrine et sur la vitrine, et nulle part dans
 * le code. Ces tests sont ce qui la rend vraie, et surtout ce qui l'empêche
 * de redevenir fausse : un contrôle d'accès se dégrade par ajout — une page
 * nouvelle, une route nouvelle, et le trou est ouvert sans que rien ne casse.
 * ─────────────────────────────────────────────────────────────────────
 */

const compte = (over: Partial<Entitlement> = {}): Entitlement => ({
  tenantId: "t1",
  bricks: [],
  statut: "actif",
  maitre: false,
  solo: false,
  ...over,
});

// ── LA RÈGLE DE FOND : refusé par défaut ───────────────────────────────

test("accès — une page NON CLASSÉE est refusée, jamais autorisée", () => {
  /**
   * C'est l'inverse du réflexe, et c'est le seul choix tenable : on ajoute des
   * pages sans y penser. En « autorisé par défaut », une page oubliée est une
   * fuite qui ne se voit jamais.
   */
  assert.equal(briquesPourChemin("/page-qui-nexiste-pas"), undefined);
  assert.equal(peutOuvrir("/page-qui-nexiste-pas", ["crm", "cerveau", "pilotage"]), false);
});

test("accès — chaque page de l'app est classée", () => {
  // Le test qui rattrape l'ajout distrait. Une page non classée est refusée
  // à TOUT LE MONDE sauf le maître : le bug se voit en développement, pas en
  // production — mais seulement si quelqu'un le cherche. Le voilà.
  const pages = readdirSync(join(process.cwd(), "app/(app)"), { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => "/" + e.name);

  const nonClassees = pages.filter(
    (p) => !CHEMINS_COMMUNS.includes(p) && ACCES_PAR_CHEMIN[p] === undefined
  );
  assert.deepEqual(nonClassees, [], `pages sans brique : ${nonClassees.join(", ")}`);
});

test("accès — chaque route API est traduite vers un chemin métier", () => {
  /**
   * Une page bloquée dont l'API répond ne protège rien. Le client qui n'a pas
   * le Cerveau ne verra pas /cerveau, mais fetch("/api/brain") lui rendrait la
   * donnée.
   */
  const routes = new Set<string>();
  const visite = (rel: string) => {
    for (const e of readdirSync(join(process.cwd(), rel), { withFileTypes: true })) {
      if (e.isDirectory()) visite(`${rel}/${e.name}`);
      else if (e.name === "route.ts") routes.add(rel.replace(/^app/, ""));
    }
  };
  visite("app/api");

  const prefixes = Object.keys(CHEMIN_PAR_API);
  const orphelines = [...routes].filter(
    (r) => !prefixes.some((p) => r === p || r.startsWith(p + "/"))
  );
  assert.deepEqual(orphelines, [], `routes API non classées : ${orphelines.join(", ")}`);
});

test("accès — toute brique du catalogue ouvre au moins une page", () => {
  // Une brique vendue qui n'ouvre rien est une brique qu'on facture sans la
  // livrer. Le test l'attrape le jour où on ajoute la brique, pas le jour où
  // le client s'en plaint.
  const ouvertes = new Set(Object.values(ACCES_PAR_CHEMIN).flat());
  for (const b of BRICKS) {
    assert.ok(ouvertes.has(b.id as never), `la brique « ${b.id} » n'ouvre aucune page`);
  }
});

// ── LES DEUX ÉCHECS QUI N'ONT RIEN À VOIR ──────────────────────────────

test("droits — SOLO ouvre tout : l'usage d'aujourd'hui reste intact", () => {
  // Sans système de comptes configuré, Alpha Sales OS est l'outil d'une seule
  // personne. Refuser ici transformerait un outil qui marche en écran vide.
  for (const chemin of ["/cerveau", "/payouts", "/voice", "/nimporte-quoi"]) {
    assert.equal(autorise(DROIT_SOLO, chemin), true, chemin);
  }
});

test("droits — REFUS (aucune session) ne laisse passer que les chemins communs", () => {
  // `DROIT_REFUSE` ne sert plus qu'à UN cas : il n'y a pas de session du tout.
  // Un compte connecté, lui, a au minimum le socle gratuit.
  assert.equal(autorise(DROIT_REFUSE, "/login"), true);
  assert.equal(autorise(DROIT_REFUSE, "/compte"), true);
  assert.equal(autorise(DROIT_REFUSE, "/pipeline"), false);
  assert.equal(autorise(DROIT_REFUSE, "/cerveau"), false);
});

/* ── LE SOCLE GRATUIT ─────────────────────────────────────────────────── */

test("gratuit — un compte créé librement a un vrai produit, tout de suite", () => {
  /**
   * Le gratuit doit être UTILISABLE, pas une vitrine. S'il ne sert à rien, il
   * ne convertit personne — il fabrique juste des comptes morts.
   */
  const g = droitGratuit("t-neuf");
  for (const ouvert of ["/pipeline", "/aujourdhui", "/prospects", "/meetings", "/closer", "/debrief", "/cerveau", "/kpis", "/preuves"]) {
    assert.equal(autorise(g, ouvert), true, `${ouvert} doit être ouvert au gratuit`);
  }
});

test("⚠ gratuit — RIEN de ce qui dépense chez nous n'y est inclus", () => {
  /**
   * ⚠ C'EST L'ASSERTION QUI TIENT LA FACTURE, ET ELLE N'EST PAS COSMÉTIQUE.
   *
   * `/api/send` lit `SMTP_*` dans l'environnement du SERVEUR, `/api/voice/call`
   * lit `LIVEKIT_*`, `/api/ai` brûle nos jetons. Il n'existe aucun chemin
   * d'identifiants par locataire. Ouvrir l'une de ces briques au gratuit, c'est
   * donner notre carte de crédit et notre nom de domaine à des inconnus — et
   * ça ne se voit que sur la facture du fournisseur, un mois plus tard.
   *
   * Le jour où les identifiants deviennent par locataire, cette liste pourra
   * se rediscuter. Pas avant, et pas sans changer ce test.
   */
  /**
   * ⚠⚠ CETTE LISTE ÉTAIT ÉCRITE À LA MAIN, ET ELLE A FINI PAR MENTIR.
   *
   * Elle contenait `/overlay` et affirmait donc « il dépense chez nous ».
   * Mesuré le 12/09/2026 : AUCUNE route n'est classée sur `/overlay` et le
   * composant n'appelle aucun `/api/…`. La liste n'avait pas mesuré — elle
   * avait recopié l'ensemble PAYANT en le baptisant « coûteux », ce qui est
   * une pétition de principe : le test prouvait ce qu'il supposait.
   *
   * Elle se DÉRIVE maintenant des deux tables qui portent le fait :
   * `API_QUI_DEPENSENT` (ce qui coûte) × `CHEMIN_PAR_API` (où ça vit). Une
   * route coûteuse ajoutée demain entre d'office ; un chemin qui cesse de
   * coûter en sort sans qu'on ait à y penser.
   */
  const g = droitGratuit("t-neuf");
  const cheminsCouteux = [
    ...new Set(Object.keys(API_QUI_DEPENSENT).map((api) => CHEMIN_PAR_API[api]).filter(Boolean)),
  ];
  assert.ok(cheminsCouteux.length >= 6, `extraction cassée : ${cheminsCouteux.length} chemin(s) coûteux`);
  for (const ferme of cheminsCouteux) {
    assert.equal(autorise(g, ferme), false, `${ferme} dépense chez nous : il ne peut pas être gratuit`);
  }
  // Et notre économie reste hors d'atteinte, gratuit ou payant.
  assert.equal(autorise(g, "/payouts"), false);
  assert.equal(autorise(g, "/offre"), false);
});

test("gratuit — il ne contient que des briques connues, et jamais les payantes", () => {
  /**
   * ⚠ LA LISTE DES PAYANTES ÉTAIT ÉCRITE À LA MAIN ICI AUSSI, et elle a
   * bloqué le passage d'`alpha-live` au gratuit en affirmant simplement
   * « alpha-live ne doit jamais être gratuite ». Une assertion qui répète la
   * décision qu'elle est censée contrôler ne contrôle rien.
   *
   * Ce qui reste vrai et vérifiable : le socle ne contient que des briques
   * CONNUES (sinon on accorde un droit qui n'existe pas), et il ne recoupe
   * pas les briques dont une route coûteuse dépend — mais ça, c'est le test
   * au-dessus qui le tient, sur le FAIT plutôt que sur une liste.
   */
  for (const b of BRIQUES_GRATUITES) {
    assert.ok(BRIQUES_CONNUES.includes(b), `${b} n'est pas une brique connue`);
  }
  assert.equal(
    new Set(BRIQUES_GRATUITES).size,
    BRIQUES_GRATUITES.length,
    "une brique est listée deux fois dans le socle gratuit"
  );
  // Non-vacuité : un socle vide passerait tout ce qui précède.
  assert.ok(BRIQUES_GRATUITES.length >= 4, `socle gratuit à ${BRIQUES_GRATUITES.length} brique(s)`);
});

// ── LE CŒUR : un client ne voit QUE sa brique ──────────────────────────

test("droits — un client Alpha Voice n'ouvre pas le Cerveau", () => {
  const client = compte({ bricks: ["alpha-voice"] });
  assert.equal(autorise(client, "/voice"), true, "sa brique s'ouvre");
  /**
   * ⚠ `/appels` A QUITTÉ CETTE BRIQUE LE 12/09/2026, et l'assertion a changé
   * de sens plutôt que d'être supprimée.
   *
   * La « liste du matin » est une session d'appels HUMAINE : l'opérateur
   * compose depuis SON téléphone, aucun `fetch`, aucune minute chez nous.
   * `alpha-voice` est le robot qui compose depuis NOS minutes. Seul le mot
   * « appel » les rapprochait. Elle est passée au socle `crm`.
   *
   * ⚠ CE COMPTE EST UNE FICTION, et c'est ce qui rend le changement sûr :
   * l'invariant du dépôt est « on ne descend jamais sous le gratuit ». Aucun
   * compte réel ne porte `alpha-voice` SANS `crm` — un vrai client Alpha
   * Voice garde donc sa liste du matin. Ce que le test vérifie ici reste le
   * cloisonnement : une brique achetée n'en ouvre pas une autre.
   */
  assert.equal(autorise(client, "/appels"), false, "la liste du matin appartient au socle, pas au robot");
  assert.equal(autorise(compte({ bricks: ["alpha-voice", "crm"] }), "/appels"), true, "…et tout compte réel l'a");
  assert.equal(autorise(client, "/cerveau"), false, "le Cerveau reste fermé");
  assert.equal(autorise(client, "/campaigns"), false);
  assert.equal(autorise(client, "/pipeline"), false);
});

test("droits — notre économie n'est ouverte par AUCUNE brique", () => {
  /**
   * Payouts et /offre parlent des commissions entre nous et nos partenaires,
   * et de nos coûts. Un client qui achète TOUT le catalogue ne doit pas y
   * accéder : ce ne sont pas des fonctionnalités, c'est notre comptabilité.
   */
  const clientComplet = compte({ bricks: BRICKS.map((b) => b.id) as never });
  assert.equal(autorise(clientComplet, "/payouts"), false);
  assert.equal(autorise(clientComplet, "/offre"), false);
  // Nous, si.
  assert.equal(autorise(compte({ maitre: true }), "/payouts"), true);
});

test("droits — le MAÎTRE voit tout, y compris les pages non classées", () => {
  // C'est nous qui vendons l'OS : notre compte ne doit jamais se retrouver
  // dehors parce qu'une page vient d'être ajoutée.
  const nous = compte({ maitre: true, bricks: [] });
  for (const chemin of ["/cerveau", "/payouts", "/page-toute-neuve"]) {
    assert.equal(autorise(nous, chemin), true, chemin);
  }
});

test("droits — les sous-chemins suivent leur page", () => {
  // Sans normalisation, chaque fiche prospect serait un chemin non classé,
  // donc refusée, et l'app deviendrait inutilisable pour tout le monde.
  const client = compte({ bricks: ["crm"] });
  assert.equal(normaliser("/prospects/abc-123/edit"), "/prospects");
  assert.equal(autorise(client, "/prospects/abc-123"), true);
  assert.equal(autorise(client, "/cerveau/une-note"), false, "un sous-chemin n'échappe pas au contrôle");
});

// ── ESSAI, SUSPENSION, DONNÉES DOUTEUSES ───────────────────────────────

test("statut — un essai expiré vaut suspension, sans qu'on ait à le réécrire", () => {
  // Le droit suit la DATE, pas un statut qu'un cron aurait dû mettre à jour.
  // Un cron qui ne tourne pas ne doit pas prolonger un essai indéfiniment.
  const ent = compte({ statut: "essai", essaiJusquA: "2026-08-01T00:00:00Z", bricks: ["crm"] });
  assert.equal(statutEffectif(ent, new Date("2026-07-30T00:00:00Z")), "essai");
  assert.equal(statutEffectif(ent, new Date("2026-08-10T00:00:00Z")), "suspendu");

  assert.equal(autorise(ent, "/pipeline", new Date("2026-07-30T00:00:00Z")), true);
  // Mais il peut toujours venir payer.
  assert.equal(autorise(ent, "/compte", new Date("2026-08-10T00:00:00Z")), true);
});

test("suspendu — on retombe au GRATUIT, pas au néant", () => {
  /**
   * ⚠ CHANGEMENT DÉLIBÉRÉ. Avant, un impayé ne gardait que les chemins
   * communs : plus de pipeline, plus de fiches, plus rien. Ses données sont
   * pourtant toujours là et lui appartiennent. Le mettre dehors ne récupère
   * aucun impayé — ça fabrique un ancien client qui ne peut même pas exporter
   * son CRM, et qui le racontera.
   *
   * Il perd exactement ce qui COÛTE, il garde ce qui ne coûte rien.
   */
  const apres = new Date("2026-08-10T00:00:00Z");
  const lache = compte({ statut: "essai", essaiJusquA: "2026-08-01T00:00:00Z", bricks: ["crm", "campagnes", "alpha-voice"] });
  assert.equal(statutEffectif(lache, apres), "suspendu");

  assert.equal(autorise(lache, "/pipeline", apres), true, "il garde SES données");
  assert.equal(autorise(lache, "/cerveau", apres), true);
  assert.equal(autorise(lache, "/campaigns", apres), false, "il perd l'envoi, qui coûte");
  assert.equal(autorise(lache, "/voice", apres), false, "et les appels, qui coûtent");
  assert.equal(autorise(lache, "/compte", apres), true, "et il peut venir payer");
});

test("droits — une brique inconnue venue de la base n'accorde rien", () => {
  // On n'accorde jamais un droit qu'on ne comprend pas : une valeur inventée
  // en base ne doit pas devenir une clé.
  assert.deepEqual(normaliserBriques(["crm", "admin-total", 42, null]), ["crm"]);
  assert.deepEqual(normaliserBriques("crm"), []);
  assert.deepEqual(normaliserBriques(undefined), []);
});

test("maître — une variable d'environnement vide n'ouvre rien", () => {
  // Sans cette garde, un OWNER_EMAILS mal rempli donnerait le compte maître
  // à tout le monde. C'est le genre de faute qui ne se voit qu'après.
  const avant = process.env.OWNER_EMAILS;
  try {
    process.env.OWNER_EMAILS = "";
    assert.equal(estMaitre("zakaria@eagleyecorp.fr"), false);
    process.env.OWNER_EMAILS = "@eagleyecorp.fr";
    assert.equal(estMaitre("zakaria@eagleyecorp.fr"), true);
    assert.equal(estMaitre("z@autre.fr"), false);
    assert.equal(estMaitre(""), false);
    assert.equal(estMaitre(null), false);
  } finally {
    process.env.OWNER_EMAILS = avant;
  }
});

// ── LA BARRIÈRE EST BIEN AU BON ENDROIT ────────────────────────────────

test("barrière — le middleware garde les PAGES et les API par la même règle", () => {
  /**
   * Le contrôle d'accès par écran est le trou classique : le menu masque la
   * page, l'API répond quand même. Ce test verrouille le fait que les deux
   * passent par `autorise()`.
   */
  const mw = readFileSync(join(process.cwd(), "middleware.ts"), "utf8");
  assert.match(mw, /resoudreDroits\(req\)/);
  assert.match(mw, /autorise\(droits, chemin\)/);
  assert.match(mw, /cheminMetierDeLApi/, "les API sont traduites, pas exemptées");
  assert.match(mw, /code: "brique_absente"/);
});

test("barrière — la route qui expose les droits ne décide de rien", () => {
  // Si un jour on autorise à partir de cette réponse, on aura reconstruit le
  // trou qu'on vient de fermer.
  const src = readFileSync(join(process.cwd(), "app/api/compte/droits/route.ts"), "utf8");
  assert.match(src, /ne décide de RIEN/i);
});

/**
 * ─────────────────────────────────────────────────────────────────────
 * ⚠ AUCUNE API QUI DÉPENSE CHEZ NOUS N'EST ATTEIGNABLE PAR LE GRATUIT.
 *
 * C'est LA garde du modèle freemium, et elle ne protège pas une règle
 * commerciale : elle protège une facture et un nom de domaine.
 *
 * Toutes ces routes lisent des identifiants dans l'ENVIRONNEMENT DU SERVEUR —
 * les nôtres. Il n'existe aujourd'hui aucun chemin d'identifiants par
 * locataire. Une seule d'entre elles rattachée par erreur à une brique
 * gratuite, et n'importe quel inconnu inscrit en trente secondes envoie des
 * emails depuis notre domaine, compose des numéros sur nos minutes ou brûle
 * nos jetons — en boucle, et sans que rien ne le signale avant la facture du
 * fournisseur.
 *
 * TROIS ONT ÉTÉ TROUVÉES EN ÉCRIVANT CE TEST, et aucune ne se voyait :
 *   · `/api/ai`      → `/pipeline` (CRM) — rédaction de script, audit, objection ;
 *   · `/api/sparring`→ `/closer`         — le prospect joué par l'IA ;
 *   · `/api/digest`  → `/aujourdhui`     — SMS Textbelt + email SMTP.
 * Les trois pointaient vers des chemins devenus gratuits le même jour.
 * ─────────────────────────────────────────────────────────────────────
 */
const API_QUI_DEPENSENT: Record<string, string> = {
  "/api/send": "SMTP_HOST/USER/PASS — notre serveur, notre réputation de domaine",
  "/api/voice": "LIVEKIT_URL/API_KEY/API_SECRET — nos minutes de téléphonie",
  "/api/transcribe": "DEEPGRAM_API_KEY / WHISPER_API_KEY — facturé à la minute",
  "/api/ai": "jetons LLM (NVIDIA ou Anthropic) sur notre clé",
  "/api/agent": "jetons LLM sur notre clé",
  "/api/sparring": "jetons LLM sur notre clé",
  "/api/icp": "jetons LLM sur notre clé",
  "/api/social": "jetons LLM sur notre clé",
  "/api/video": "rendu vidéo — calcul et stockage",
  "/api/audit": "récupération de sites tiers depuis notre serveur (egress + abus)",
  "/api/digest": "SMS Textbelt + email SMTP — nos crédits",
  /**
   * ⚠⚠ `/api/email` A ÉTÉ RETIRÉE DE CETTE LISTE LE 12/09/2026, ET SON ENTRÉE
   * ÉTAIT FAUSSE — pas seulement trop large.
   *
   * Elle disait « SMTP — notre serveur ». Mesuré en ouvrant le dossier :
   * `app/api/email/` ne contient QUE `preview`, une route qui rend l'email
   * tel qu'il s'affichera et ne touche ni `sendMail`, ni transport, ni SMTP.
   * Le vrai envoi est `/api/send`, qui reste ici et le restera.
   *
   * Ce n'est pas une nuance comptable : c'est cette ligne qui fermait
   * l'aperçu d'email à un compte gratuit, donc qui lui faisait écrire à
   * l'aveugle un texte qu'il allait de toute façon copier lui-même.
   *
   * ⚠ Ce qui remplace la garde : `tests` refuse toute route sous
   * `app/api/email/` autre que `preview` (voir plus bas). Retirer une entrée
   * de cette liste sans la remplacer par un garde structurel serait ouvrir
   * une porte en silence.
   */
  "/api/gmail": "SMTP / API Google — notre compte",
  "/api/track": "notre infrastructure de tracking et sa persistance",
};

test("⚠ freemium — aucune API qui dépense chez nous n'est ouverte au gratuit", () => {
  const gratuit = droitGratuit("t-neuf");
  const fautes: string[] = [];
  for (const [api, cout] of Object.entries(API_QUI_DEPENSENT)) {
    const chemin = CHEMIN_PAR_API[api];
    assert.ok(chemin, `${api} doit être classée dans CHEMIN_PAR_API`);
    if (autorise(gratuit, chemin)) fautes.push(`${api} → ${chemin} est OUVERT au gratuit · coût : ${cout}`);
  }
  assert.deepEqual(fautes, [], "ces routes dépensent NOS identifiants :\n  " + fautes.join("\n  "));
});

test("freemium — la liste des API coûteuses ne survit pas à leur suppression", () => {
  // Une entrée qui ne correspond plus à aucune route classée est une garde
  // qui surveille une porte murée, pendant qu'une autre s'ouvre ailleurs.
  const inconnues = Object.keys(API_QUI_DEPENSENT).filter((a) => !CHEMIN_PAR_API[a]);
  assert.deepEqual(inconnues, [], `entrées orphelines : ${inconnues.join(", ")}`);
});

/* ═══════════════════════════════════════════════════════════════════
   UN DÉPLOIEMENT PUBLIC SANS SERRURE NE REND PLUS PERSONNE MAÎTRE
   ═══════════════════════════════════════════════════════════════════ */

/** Pose un environnement, exécute, puis remet exactement ce qui était là. */
function avecEnv(vars: Record<string, string | undefined>, fn: () => void): void {
  const avant: Record<string, string | undefined> = {};
  for (const [k, v] of Object.entries(vars)) {
    avant[k] = process.env[k];
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
  try {
    fn();
  } finally {
    for (const [k, v] of Object.entries(avant)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  }
}

test("⚠ production + aucune serrure = plus personne n'est maître", () => {
  /**
   * ⚠ LE DÉFAUT RÉEL, ET IL A ÉTÉ EN LIGNE.
   *
   * `resoudreDroits` rendait `DROIT_SOLO` — donc `maitre: true`, donc TOUT
   * ouvert — dès que les comptes n'étaient pas configurés. C'était juste pour
   * un outil local. Sur une production joignable, ça voulait dire : quiconque
   * connaît l'URL ouvre `/payouts`, `/offre`, notre portefeuille, envoie de
   * vrais emails depuis notre domaine et compose de vrais numéros sur nos
   * minutes.
   *
   * Rien ne l'annonçait : l'application avait exactement le même air.
   */
  avecEnv(
    {
      NODE_ENV: "production",
      SITE_PASSWORD: undefined,
      SUPABASE_JWT_SECRET: undefined,
      NEXT_PUBLIC_SUPABASE_URL: undefined,
    },
    () => {
      assert.equal(deploiementSansSerrure(), true, "production nue = sans serrure");
    }
  );
});

test("les trois échappatoires, chacune pour une raison différente", () => {
  const nu = { SITE_PASSWORD: undefined, SUPABASE_JWT_SECRET: undefined, NEXT_PUBLIC_SUPABASE_URL: undefined };

  // 1. En développement : c'est l'outil local, et le mode solo est fait pour ça.
  avecEnv({ ...nu, NODE_ENV: "development" }, () => {
    assert.equal(deploiementSansSerrure(), false, "npm run dev ne doit rien changer à l'usage local");
  });

  // 2. Un mot de passe de site EST une serrure : le middleware mure déjà tout,
  //    et le mode solo derrière ce mur est l'outil interne voulu.
  avecEnv({ ...nu, NODE_ENV: "production", SITE_PASSWORD: "quelque-chose" }, () => {
    assert.equal(deploiementSansSerrure(), false, "le mot de passe compte comme serrure");
  });

  // 3. Des comptes configurés : on ne passe plus par le mode solo du tout.
  avecEnv(
    { ...nu, NODE_ENV: "production", SUPABASE_JWT_SECRET: "s", NEXT_PUBLIC_SUPABASE_URL: "https://x.supabase.co" },
    () => {
      assert.equal(deploiementSansSerrure(), false, "les comptes sont la vraie serrure");
    }
  );

  // ⚠ Un mot de passe VIDE n'est pas un mot de passe. Sans ce `.trim()`, une
  // variable posée à "" sur Vercel — ce qui arrive quand on la crée sans la
  // remplir — passerait pour une serrure et rouvrirait le trou en silence.
  avecEnv({ ...nu, NODE_ENV: "production", SITE_PASSWORD: "   " }, () => {
    assert.equal(deploiementSansSerrure(), true, "une variable vide n'est pas une serrure");
  });
});

test("sans serrure, on retombe au GRATUIT — pas sur une page blanche", () => {
  /**
   * On ne coupe pas un site en ligne pour corriger une faille : une panne
   * blanche est une panne. Le socle gratuit garde l'application utilisable et
   * la démonstration possible, tout en fermant ce qui dépense et ce qui parle
   * de notre économie.
   */
  const gratuit = droitGratuit("anonyme");
  assert.equal(autorise(gratuit, "/pipeline"), true, "l'app reste utilisable");
  assert.equal(autorise(gratuit, "/payouts"), false, "notre économie se referme");
  assert.equal(autorise(gratuit, "/offre"), false);
  assert.equal(autorise(gratuit, "/campaigns"), false, "plus d'envoi depuis notre domaine");
  assert.equal(autorise(gratuit, "/voice"), false, "plus d'appels sur nos minutes");
});

test("⚠ le contrôle passe AVANT le mode solo, sinon il ne sert à rien", () => {
  /**
   * C'est la ligne `return DROIT_SOLO` qui rendait tout le monde maître : un
   * contrôle placé après elle ne serait jamais atteint. On vérifie l'ORDRE
   * dans la source, parce que c'est lui qui porte la correction — pas la
   * présence de la fonction.
   */
  const src = readFileSync(join(process.cwd(), "lib/entitlements.ts"), "utf8")
    // ⚠ On retire les commentaires AVANT de chercher. Le commentaire qui
    // explique la correction cite `return DROIT_SOLO` en prose, et il est
    // placé au-dessus du code : sans ce nettoyage, l'index trouvé est celui
    // de l'explication, pas celui de l'instruction. Le test échouait en
    // accusant un ordre correct — deuxième fois dans ce dépôt qu'une
    // recherche de source se fait piéger par sa propre documentation.
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");
  const corps = src.slice(src.indexOf("export async function resoudreDroits"));
  const iGarde = corps.indexOf("deploiementSansSerrure()");
  const iSolo = corps.indexOf("return DROIT_SOLO");
  assert.ok(iGarde > 0, "la garde doit être appelée dans resoudreDroits");
  assert.ok(iSolo > 0);
  assert.ok(iGarde < iSolo, "la garde doit précéder le repli solo, sinon elle est morte");
});

/* ────────────────────────────────────────────────────────────────────
   CE QU'UN INSCRIT GRATUIT VOIT EN PREMIER.
   Le parcours de démarrage déroulait seize étapes à tout le monde, en
   commençant par des variables d'environnement du SERVEUR.
   ──────────────────────────────────────────────────────────────────── */

test("⚠ le parcours de démarrage RETIRE les étapes que le compte ne peut pas faire", async () => {
  const { buildPath, STEPS } = await import("../lib/onboarding-path");
  const { BRIQUES_GRATUITES } = await import("../lib/entitlements");

  const base = {
    prospects: [],
    meetings: [],
    health: null,
    dns: null,
    n8n: false,
    manual: [] as string[],
  };

  const gratuit = buildPath({ ...base, bricks: [...BRIQUES_GRATUITES], maitre: false });
  const maitre = buildPath({ ...base, bricks: [...BRIQUES_GRATUITES], maitre: true });

  assert.ok(gratuit.total < maitre.total, "un compte gratuit doit voir moins d'étapes que le maître");
  assert.equal(gratuit.verrouillees, STEPS.length - gratuit.total, "ce qui est retiré doit être COMPTÉ, pas escamoté");
  assert.equal(maitre.verrouillees, 0, "le maître ne perd aucune étape : c'est notre propre installation");

  // Les étapes nommément impossibles pour un gratuit ne doivent plus apparaître.
  const vues = gratuit.phases.flatMap((p) => p.steps.map((s) => s.id));
  for (const id of ["smtp", "dns", "ia", "first-email", "first-call"]) {
    assert.ok(!vues.includes(id), `« ${id} » ne doit pas être proposée à un compte gratuit`);
  }
  // Et la contrepartie : il lui reste de quoi travailler, sinon on l'a vidé.
  assert.ok(vues.includes("fuel"), "charger des prospects reste faisable au gratuit — c'est le socle CRM");
  assert.ok(gratuit.total >= 3, `parcours vidé : ${gratuit.total} étape(s)`);
});

test("droits pas encore chargés : on ne cache RIEN", () => {
  /**
   * Même optimisme que `useDroits`. Un parcours qui se vide une seconde au
   * chargement ressemble à une panne — et comme le serveur refuse de toute
   * façon les portes fermées, l'optimisme ne coûte aucune sécurité.
   *
   * ⚠ On mute la condition : avec des briques FOURNIES, le même appel doit
   * filtrer. Sans cette moitié, un `buildPath` qui ne filtrerait jamais
   * passerait le test.
   */
  return import("../lib/onboarding-path").then(({ buildPath, STEPS }) => {
    const base = { prospects: [], meetings: [], health: null, dns: null, n8n: false, manual: [] as string[] };
    const inconnu = buildPath({ ...base, bricks: null, maitre: false });
    assert.equal(inconnu.total, STEPS.length, "droits inconnus : toutes les étapes restent visibles");
    assert.equal(inconnu.verrouillees, 0);

    const connu = buildPath({ ...base, bricks: ["crm"], maitre: false });
    assert.ok(connu.total < STEPS.length, "avec des briques connues, le filtre doit mordre");
  });
});

test("⚠ l'inscription dit où revenir — sinon le lien de confirmation pointe vers localhost", () => {
  /**
   * `resetPassword` passait un `redirectTo`, `signUp` ne passait rien : le
   * lien du mail de confirmation retombait sur la Site URL du tableau de bord
   * Supabase, dont la valeur d'usine est `http://localhost:3000`. L'inscrit
   * cliquait sur un lien mort et n'avait aucun moyen de comprendre.
   *
   * On lit la source : sans projet Supabase joignable depuis ce bac à sable,
   * c'est la seule vérification possible — et elle vaut mieux que rien, parce
   * que le défaut était précisément une ligne absente.
   */
  const src = readFileSync(join(process.cwd(), "lib/auth.ts"), "utf8").replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, "");
  const signUpBody = src.slice(src.indexOf("export async function signUp"), src.indexOf("\nexport async function signIn"));
  assert.match(signUpBody, /emailRedirectTo/, "signUp doit fournir une URL de retour");
  /**
   * ⚠ CETTE ASSERTION EXIGEAIT `window.location.origin` DANS LE CORPS DE
   * `signUp`, et elle est entrée en conflit avec la règle qui compte
   * davantage : l'origine ne se lit QU'UNE FOIS dans tout le fichier
   * (`tests/lien-confirmation.test.ts`). Deux constructions de la même URL
   * divergent, et il faudrait alors deux entrées dans la liste blanche
   * Supabase — dont l'oubli ne se découvre qu'au premier inscrit.
   *
   * On vérifie donc la DÉLÉGATION, et l'autre test vérifie que la fonction
   * déléguée lit bien l'origine du navigateur. Les deux moitiés de la
   * garantie sont couvertes, sans qu'aucune n'autorise un second calcul.
   */
  assert.match(signUpBody, /urlRetourAuth\(/, "signUp doit passer par l'unique constructeur d'URL de retour");
  const helper = src.slice(src.indexOf("export function urlRetourAuth"), src.indexOf("export async function signUp"));
  assert.match(helper, /window\.location\.origin/, "l'origine du navigateur est la seule source juste en prod comme en local");
});

test("⚠ NOS 78 FICHES RÉELLES ne sont ouvertes qu'au compte MAÎTRE", async () => {
  /**
   * `/api/pipeline` sert `lib/pipeline-juillet` — 78 entreprises réellement
   * démarchées, avec raison sociale, adresse, NUMÉRO DE TÉLÉPHONE, étape de
   * vente et montant. Le module le dit en tête : « Ce n'est PAS de la donnée
   * de démonstration. »
   *
   * ⚠ LA ROUTE N'A JAMAIS FUITÉ : `MAITRE_SEULEMENT` (middleware.ts) la liste
   * et refuse 403 à tout compte non maître, avant même le contrôle par brique.
   * Ce test ne colmate rien.
   *
   * Ce qu'il verrouille, c'est la SECONDE couche, qui disait l'inverse :
   * `CHEMIN_PAR_API` rattachait cette route à `/pipeline`, donc à la brique
   * `crm`, devenue gratuite le 02/09/2026. Alléger `MAITRE_SEULEMENT` — un
   * geste qui ressemble à du rangement — aurait alors suffi à ouvrir nos
   * fiches à tous les inscrits, sans que rien ne le signale. Deux couches qui
   * répondent l'inverse à la même question ne font pas une défense en
   * profondeur : elles font un point unique déguisé en deux.
   */
  const { BRIQUES_GRATUITES } = await import("../lib/entitlements");

  const chemin = CHEMIN_PAR_API["/api/pipeline"];
  assert.ok(chemin, "/api/pipeline doit rester classée : une route non classée est refusée, mais par accident");

  // La CONDITION, pas la présence : aucune brique, gratuite ou payante,
  // n'ouvre ce chemin. Seul `maitre` passe.
  assert.equal(
    peutOuvrir(chemin, [...BRIQUES_GRATUITES], false),
    false,
    "un compte gratuit ne doit PAS pouvoir lire notre dossier commercial"
  );
  assert.equal(
    peutOuvrir(chemin, [...ACCES_PAR_CHEMIN["/pipeline"]], false),
    false,
    "posséder le CRM ne doit rien y donner : ce ne sont pas les fiches DU CLIENT"
  );
  assert.equal(peutOuvrir(chemin, [], true), true, "le compte maître y accède : c'est notre dossier");

  // Et le garde-fou qui rend le test concluant : si demain quelqu'un remappe
  // la route vers un chemin ouvert, cette assertion tombe.
  assert.notEqual(chemin, "/pipeline", "la route ne doit plus suivre la brique CRM, qui est gratuite");
});

test("⚠ l'assistant de configuration ne s'ouvre PAS tout seul chez un inscrit", async () => {
  /**
   * MESURÉ SUR UNE CAPTURE, pas déduit : la toute première chose qu'un inscrit
   * voyait était un panneau PLEIN ÉCRAN qui lui expliquait « Google Sheets =
   * la mémoire, n8n = le cerveau, Supabase = la mémoire durable ».
   *
   * C'est la pile de l'OPÉRATEUR : des variables d'environnement du serveur et
   * des services tiers qu'un locataire ne possède pas et ne peut pas poser. Le
   * même défaut que `/demarrage`, en pire — celui-ci est MODAL : il ne se
   * contente pas d'être hors sujet, il barre l'écran jusqu'à ce qu'on trouve
   * la croix.
   */
  const src = readFileSync(join(process.cwd(), "components/onboarding.tsx"), "utf8");

  assert.match(src, /chargerDroits\(\)/, "l'ouverture doit dépendre des droits réels");
  assert.match(
    src,
    /if \(!\(d\.maitre \|\| d\.solo\)\) return;/,
    "seul l'opérateur (maître ou solo) doit voir s'ouvrir un assistant qui configure NOTRE installation"
  );

  /**
   * ⚠⚠ ET IL DOIT ATTENDRE LA RÉPONSE, pas lire la valeur optimiste.
   * `useDroits` rend `maitre: true` tant que le serveur n'a pas répondu — bon
   * pour un menu qui ne doit pas clignoter, faux pour un panneau qui barre
   * l'écran et ne se referme pas seul : il se serait ouvert pendant le
   * chargement, et serait resté.
   */
  assert.doesNotMatch(src, /useDroits\(\)/, "useDroits est optimiste : il ne peut pas décider d'ouvrir un modal");

  const { chargerDroits } = await import("../lib/use-droits");
  assert.equal(typeof chargerDroits, "function", "la promesse partagée doit être exportée, pas réécrite sur place");
});

test("⚠⚠ UNE BRIQUE N'EST PAYANTE QUE SI ELLE COÛTE — le critère devient exécutable", () => {
  /**
   * ⚠⚠ LA DOCTRINE AFFIRMAIT CECI DEPUIS LE DÉBUT : « Cette ligne n'est PAS un
   * arbitrage commercial, elle est imposée par un fait technique. » C'était
   * écrit, jamais vérifié — et une brique y échappait.
   *
   * `alpha-live` était payante au titre de « la machine agit à ta place », une
   * FAMILLE, alors que le critère énoncé est le COÛT. Mesuré : elle garde un
   * seul chemin, `/overlay`, qu'AUCUNE route API ne sert ; le composant
   * n'appelle aucun `/api/…` et tourne entièrement dans le navigateur. Elle ne
   * consomme ni jetons, ni minutes, ni SMTP, ni bande passante.
   *
   * Le test croise les deux tables qui existaient déjà : les routes qui
   * dépensent, et la carte chemin → brique. Une brique payante dont aucun
   * chemin n'est servi par une route coûteuse est une brique payante SANS
   * RAISON — et le gratuit est notre meilleur argument de vente.
   *
   * ⚠ Il ne dit PAS l'inverse (« toute brique coûteuse est payante ») : c'est
   * l'autre test, `aucune API qui dépense chez nous n'est ouverte au gratuit`,
   * qui tient ce sens-là. Les deux ensemble ferment la boucle ; séparément,
   * chacun laisse passer la moitié.
   */
  const payantes = BRIQUES_CONNUES.filter((b) => !BRIQUES_GRATUITES.includes(b));
  assert.ok(payantes.length >= 4, `extraction cassée : ${payantes.length} brique(s) payante(s)`);

  // Les chemins servis par une route qui dépense chez nous.
  const cheminsCouteux = new Set(
    Object.keys(API_QUI_DEPENSENT).map((api) => CHEMIN_PAR_API[api]).filter(Boolean)
  );
  assert.ok(cheminsCouteux.size > 0, "aucun chemin coûteux — le test ne mesure rien");

  const sansRaison: string[] = [];
  for (const brique of payantes) {
    // Un compte qui n'a QUE cette brique : ce qu'elle ouvre, et rien d'autre.
    const seul = compte({ bricks: [brique] });
    const ouvreUnCheminCouteux = [...cheminsCouteux].some(
      (chemin) => autorise(seul, chemin) && !autorise(droitGratuit("t"), chemin)
    );
    if (!ouvreUnCheminCouteux) sansRaison.push(brique);
  }

  assert.deepEqual(
    sansRaison,
    [],
    "ces briques sont PAYANTES sans garder la moindre route qui dépense chez nous — " +
      "elles sont classées par famille, pas par coût, et le gratuit est notre meilleur " +
      "argument de vente :\n  " + sansRaison.join("\n  ")
  );
});

test("⚠⚠ UNE BRIQUE GRATUITE N'EST DÉCLARÉE COÛTEUSE NULLE PART AILLEURS", () => {
  /**
   * ⚠⚠ LE TEST CI-DESSUS A FERMÉ LE CONTRÔLE D'ACCÈS, ET LE RESTE DU DÉPÔT A
   * CONTINUÉ D'AFFIRMER LE CONTRAIRE PENDANT LE MÊME COMMIT. C'est le défaut
   * récurrent d'ici, dans sa forme exacte : la règle corrigée à UN endroit.
   *
   * Trois affirmations survivaient à la bascule d'`alpha-live` au gratuit, et
   * toutes les trois venaient du même raisonnement par analogie (« une session
   * en direct, même mécanique que l'agent ») :
   *  · `COUTS_BRIQUES` la chiffrait `nature: "consommation"`, 5 €/mois de
   *    « transcription en direct » — or l'écoute se fait par le moteur du
   *    NAVIGATEUR ; la transcription serveur existe mais appartient à
   *    `/voice`, où son coût est déjà compté. Deux fois le même euro ;
   *  · `BRIQUES_CONSOMMATRICES` l'interdisait au lifetime — donc une capacité
   *    retenue pour éviter une dépense inexistante ;
   *  · le `passThrough` du catalogue annonçait au client des minutes
   *    facturées au réel qui n'arrivent jamais.
   *
   * ⚠ CE TEST NE LIT AUCUNE SOURCE ET NE CHERCHE AUCUN MOT. Il croise trois
   * tables écrites indépendamment, ce qui le rend insensible à la formulation :
   * ce qui est gratuit ne peut pas être déclaré consommateur ailleurs.
   *
   * ⚠ Il vise la NATURE, pas le montant. `closer` est gratuite et porte 2 €
   * de coût mensuel résiduel — un reste de transcription serveur, qui est de
   * toute façon derrière `alpha-voice`. Exiger zéro euro ferait tomber une
   * ligne honnête ; exiger qu'aucune brique gratuite ne soit rangée dans les
   * CONSOMMATRICES attrape la faute réelle sans refuser la nuance.
   */
  const gratuites = [...BRIQUES_GRATUITES] as string[];
  assert.ok(gratuites.length >= 4, "extraction cassée : le socle gratuit est vide");

  // 1. La liste exécutable qui interdit la vente à vie.
  const aVieInterdite = gratuites.filter((b) => BRIQUES_CONSOMMATRICES.includes(b));
  assert.deepEqual(
    aVieInterdite,
    [],
    "ces briques sont GRATUITES et pourtant rangées parmi celles qu'on ne vend jamais à vie " +
      "parce qu'elles nous coûtent à chaque usage. Les deux ne peuvent pas être vraies :\n  " +
      aVieInterdite.join("\n  ")
  );

  // 2. Le modèle de coût interne, écrit par une autre main, dans un autre fichier.
  const consommatrices = gratuites.filter(
    (b) => COUTS_BRIQUES.find((c) => c.brickId === b)?.nature === "consommation"
  );
  assert.deepEqual(
    consommatrices,
    [],
    "ces briques sont GRATUITES et chiffrées « consommation » dans le modèle de coût — " +
      "on les offre donc en croyant qu'elles nous coûtent à l'usage :\n  " + consommatrices.join("\n  ")
  );

  // 3. Ce qu'on ANNONCE au client sur le devis : un coût variable refacturé.
  const avecPassThrough = gratuites.filter((b) => BRICKS.find((x) => x.id === b)?.passThrough);
  assert.deepEqual(
    avecPassThrough,
    [],
    "ces briques sont GRATUITES et annoncent au client des frais refacturés à l'usage :\n  " +
      avecPassThrough.join("\n  ")
  );
});

test("⚠⚠ RIEN NE S'AJOUTE SOUS /api/email SANS ÊTRE RECLASSÉ", () => {
  /**
   * ⚠⚠ LE GARDE QUI REMPLACE UNE ENTRÉE RETIRÉE DE `API_QUI_DEPENSENT`.
   *
   * `/api/email` est désormais classée sur `/templates`, un chemin GRATUIT,
   * parce que la seule route qu'elle contient rend un aperçu et n'envoie
   * rien. Et `cheminMetierDeLApi` (middleware) prend le PREMIER préfixe qui
   * correspond, pas le plus spécifique : tout ce qu'on ajouterait sous
   * `app/api/email/` hériterait donc du chemin gratuit.
   *
   * Un `app/api/email/send/route.ts` créé demain partirait de notre SMTP,
   * sur notre domaine, pour n'importe quel inscrit — et ça ne se verrait que
   * sur la réputation du domaine, des semaines plus tard.
   *
   * Le test ne cherche pas un mot dans un fichier : il liste le DOSSIER.
   * Ajouter une route y est possible, mais impose de venir ici dire laquelle
   * et de la classer.
   */
  const dossier = join(process.cwd(), "app/api/email");
  const routes = readdirSync(dossier, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name);

  assert.deepEqual(
    routes.sort(),
    ["preview"],
    "une route a été ajoutée sous /api/email, qui est classée sur un chemin GRATUIT (/templates). " +
      "Si elle envoie quoi que ce soit, elle doit être classée à part dans CHEMIN_PAR_API et " +
      "déclarée dans API_QUI_DEPENSENT — sinon elle part de notre SMTP pour n'importe quel inscrit.\n" +
      `  trouvé : ${routes.join(", ")}`
  );

  /**
   * ⚠ Et la vérification de fond, sur la route elle-même : « preview » doit
   * rester un aperçu. Un nom ne garantit rien — c'est l'absence de transport
   * qui garantit l'absence d'envoi.
   */
  const src = readFileSync(join(dossier, "preview/route.ts"), "utf8");
  for (const interdit of [/sendMail/, /createTransport/, /nodemailer/]) {
    assert.doesNotMatch(
      src,
      interdit,
      "/api/email/preview envoie réellement quelque chose — elle ne peut plus être sur un chemin gratuit"
    );
  }
});

test("⚠⚠ LE PARCOURS ORGANIQUE COMPLET TIENT DANS LE GRATUIT", () => {
  /**
   * ─────────────────────────────────────────────────────────────────
   * LE BUT DU GRATUIT, ÉCRIT COMME UNE ASSERTION.
   *
   * Ce n'est pas « donner un aperçu ». C'est qu'un opérateur sans un euro
   * puisse prospecter POUR DE VRAI — cibler, écrire, approcher, appeler,
   * décrocher des rendez-vous, en tirer du chiffre — et acheter ENSUITE ce
   * qui lui fait gagner du temps. Un gratuit qui s'arrête avant le premier
   * rendez-vous ne convertit personne : il fabrique des comptes morts.
   *
   * ⚠ CE TEST EST LE SEUL QUI REGARDE LA CHAÎNE, PAS LES MAILLONS. Chaque
   * écran pris isolément avait l'air correctement classé ; c'est le PARCOURS
   * qui était coupé, à deux endroits, et personne ne pouvait le voir parce
   * qu'aucun test ne le parcourait. Trois écrans étaient payants sans nous
   * coûter un centime — `/templates`, `/linkedin`, `/appels` — tous les trois
   * rangés par FAMILLE (« campagnes », « appels ») au lieu de l'être par
   * coût.
   *
   * ⚠ Il n'affirme PAS que tout est gratuit. Ce qui part de notre
   * infrastructure reste fermé, et le contre-test juste en dessous le tient.
   * ─────────────────────────────────────────────────────────────────
   */
  const g = droitGratuit("t-neuf");

  const PARCOURS: [string, string][] = [
    ["/pipeline", "charger et cibler ses fiches"],
    ["/prospects", "ouvrir une fiche et lire son angle"],
    ["/aujourdhui", "savoir qui travailler ce matin"],
    ["/templates", "ÉCRIRE le message — et le voir tel qu'il s'affichera"],
    ["/linkedin", "APPROCHER : la file LinkedIn, copiée à la main"],
    ["/appels", "APPELER : la liste du matin, depuis son propre téléphone"],
    ["/debrief", "consigner ce qui s'est dit"],
    ["/meetings", "poser le rendez-vous décroché"],
    ["/nurture", "relancer ceux qui n'ont pas répondu"],
    ["/closer", "préparer le closing"],
    ["/cerveau", "retrouver quoi dire face à une objection"],
    ["/preuves", "montrer que ça a produit quelque chose"],
    ["/kpis", "mesurer, pour savoir quoi acheter ensuite"],
  ];

  const coupures = PARCOURS.filter(([chemin]) => !autorise(g, chemin));
  assert.deepEqual(
    coupures,
    [],
    "le parcours organique est COUPÉ ici — un opérateur sans budget ne peut pas aller au bout, " +
      "donc il n'aura jamais l'argent pour acheter la suite :\n  " +
      coupures.map(([c, quoi]) => `${c} — ${quoi}`).join("\n  ")
  );
});

test("⚠ …et il s'arrête net quand ça part de CHEZ NOUS", () => {
  /**
   * Le contre-test, sans lequel le précédent serait satisfait par un produit
   * entièrement gratuit. La frontière n'est pas « ce qui est utile » : c'est
   * « ce qui quitte notre infrastructure ». Un gratuit écrit tout ce qu'il
   * veut et l'envoie LUI-MÊME ; le jour où il veut que la machine envoie à sa
   * place, il paie.
   */
  const g = droitGratuit("t-neuf");
  const FERMES: [string, string][] = [
    ["/campaigns", "envoyer en séquence par NOTRE SMTP"],
    ["/outbox", "la file d'envoi, sur NOTRE domaine"],
    ["/newsletter", "l'envoi de masse"],
    ["/voice", "le robot qui compose NOS minutes"],
    ["/agent", "l'agent qui brûle NOS jetons"],
    ["/audits", "la récupération de sites depuis NOTRE IP"],
    ["/activity", "NOTRE infrastructure de tracking"],
    ["/social", "génération et rendu vidéo chez NOUS"],
  ];
  const ouvertes = FERMES.filter(([chemin]) => autorise(g, chemin));
  assert.deepEqual(
    ouvertes,
    [],
    "ces chemins dépensent chez nous et sont ouverts au gratuit :\n  " +
      ouvertes.map(([c, quoi]) => `${c} — ${quoi}`).join("\n  ")
  );
});

test("⚠⚠ UN ÉCRAN QUI NE NOUS COÛTE RIEN EST GRATUIT — audit de TOUS les écrans", () => {
  /**
   * ─────────────────────────────────────────────────────────────────
   * LE GARDE QUI REMPLACE MA RELECTURE.
   *
   * ⚠⚠ TROIS ÉCRANS PAYANTS SANS COÛT ONT ÉTÉ TROUVÉS À LA MAIN, UN PAR UN,
   * SUR TROIS PASSES DIFFÉRENTES (`alpha-live`, puis `/linkedin` et
   * `/templates`, puis `/appels`). Trouver le quatrième à la main est une
   * question de temps, pas de méthode — et entre-temps il reste fermé à des
   * gens qui n'ont rien pour payer.
   *
   * Le test pose donc la question à TOUS les écrans, et il la pose sur le
   * FAIT : cet écran atteint-il, directement ou par ses composants, une route
   * que `API_QUI_DEPENSENT` déclare coûteuse ?
   *  · oui  → payant, légitime, rien à dire ;
   *  · non  → il doit être gratuit, OU figurer ci-dessous avec son motif.
   *
   * ⚠ POURQUOI ON SUIT LES COMPOSANTS ET PAS SEULEMENT LA PAGE. Mesuré :
   * `/templates` ne montre aucun `/api/send` dans sa page, et en embarque un
   * par `SendBar`. Un audit qui ne lit que `page.tsx` rate la moitié des
   * appels et rend un verdict faux avec l'air d'avoir mesuré.
   * ─────────────────────────────────────────────────────────────────
   */
  const PAYANT_SANS_COUT: Record<string, string> = {
    "/moniteur":
      "Il affiche ce que l'AUTOPILOTE a fait — une brique payante. Ouvert au gratuit, il montrerait " +
      "un écran de zéros, ce qui se lit comme un produit cassé et non comme une porte fermée. " +
      "L'entrée grisée du rail dit déjà qu'il existe, et c'est ce qu'on veut qu'elle dise.",
    "/activity":
      "Il affiche les ouvertures et les clics remontés par NOTRE infrastructure de tracking. " +
      "Sans la brique, il n'y a littéralement aucune donnée à montrer : le même écran de zéros.",
  };

  const racine = join(process.cwd(), "app/(app)");
  const lire = (f: string) => { try { return readFileSync(f, "utf8"); } catch { return ""; } };

  /**
   * ⚠⚠ ON CHERCHE UN `fetch(`, PAS UNE MENTION DE `/api/…`. LA PREMIÈRE
   * RÉDACTION CHERCHAIT LA CHAÎNE, ET ELLE A ÉCHOUÉ EN S'OUVRANT.
   *
   * Mesuré : `/linkedin` ne fait aucun appel réseau, et sa page contient la
   * phrase « Un email part par `/api/send`, qui refuse le libellé d'usine ».
   * Le motif l'a comptée comme une dépense, donc le garde a conclu « cet
   * écran coûte, il a le droit d'être payant » — et il n'aurait JAMAIS
   * signalé `/linkedin` s'il était resté fermé. Un garde qui se trompe dans
   * ce sens-là ne fait pas de bruit : il valide.
   *
   * ⚠ CE QUE CE MOTIF NE VOIT PAS, et c'est dit plutôt que tu : une URL
   * construite (`fetch(url)`) lui échappe. Le dépôt n'en contient aucune sur
   * ces écrans — vérifié — mais le jour où il y en a une, ce garde la rate.
   * Il ne prétend pas mesurer plus que la forme qu'il reconnaît.
   */
  const apisAtteintes = (ecran: string): string[] => {
    const src = lire(join(racine, ecran, "page.tsx"));
    const composants = [...src.matchAll(/from "@\/components\/([a-z0-9/-]+)"/g)]
      .map((m) => join(process.cwd(), "components", `${m[1]}.tsx`));
    const tout = [src, ...composants.map(lire)].join("\n");
    return [...tout.matchAll(/fetch\(\s*["'`](\/api\/[a-z0-9/-]+)/g)].map((m) => m[1]);
  };

  const gratuites = new Set<string>(BRIQUES_GRATUITES);
  const manques: string[] = [];

  for (const [chemin, briques] of Object.entries(ACCES_PAR_CHEMIN)) {
    if (briques.length === 0) continue;                       // maître seul : notre économie
    if (briques.some((b) => gratuites.has(b))) continue;      // déjà au socle
    const coute = apisAtteintes(chemin.slice(1)).some((api) =>
      Object.keys(API_QUI_DEPENSENT).some((d) => api === d || api.startsWith(d + "/"))
    );
    if (coute) continue;
    const motif = PAYANT_SANS_COUT[chemin];
    if (!motif || motif.length < 80) {
      manques.push(
        `${chemin} [${briques.join(",")}] — payant, et n'atteint AUCUNE route coûteuse. ` +
          `Soit il passe au socle, soit son motif s'écrit dans PAYANT_SANS_COUT.`
      );
    }
  }
  assert.deepEqual(manques, [], "écrans payants sans coût mesuré :\n  " + manques.join("\n  "));

  /**
   * ⚠ LE CONTRE-SENS : une exception qui n'a plus lieu d'être. Une liste
   * d'exceptions qu'on ne nettoie pas finit par tout couvrir.
   */
  for (const chemin of Object.keys(PAYANT_SANS_COUT)) {
    assert.ok(ACCES_PAR_CHEMIN[chemin] !== undefined, `${chemin} est listé en exception et n'existe plus`);
    assert.ok(
      !(ACCES_PAR_CHEMIN[chemin] ?? []).some((b) => gratuites.has(b)),
      `${chemin} est listé comme « payant sans coût » alors qu'il est devenu GRATUIT — l'exception ment`
    );
  }
});

test("⚠⚠ LA GARDE DE BRIQUES S'EXÉCUTE AUSSI SUR UN DÉPLOIEMENT SANS SERRURE", () => {
  /**
   * ══ LE FAIL-OPEN QUE CE TEST TIENT, ET COMMENT IL A ÉTÉ TROUVÉ ══
   *
   * Pas par une relecture : en frappant un `next start` de PRODUCTION avec
   * la configuration exacte d'une prod fraîche — aucun compte, aucun
   * `SITE_PASSWORD`. Relevé :
   *
   *   POST /api/send        → 400  (« champs to et body requis »)
   *   POST /api/voice/call  → 400  (« Numéro inexploitable »)
   *
   * Autrement dit, la requête d'un inconnu était ACCEPTÉE et ne butait que
   * sur la forme du corps. Avec `SITE_PASSWORD` posé, les deux rendaient 401 :
   * le mot de passe était la seule serrure, et la doctrine a justement décidé
   * qu'il ne murerait plus l'app.
   *
   * La cause n'était pas `resoudreDroits`, qui retombait correctement au
   * socle GRATUIT (`deploiementSansSerrure`). C'est que le middleware ne
   * l'appelait pas : TOUTE la garde vivait derrière `comptesActifs()` seul.
   * Une règle juste, calculée, testée — et lue à un endroit de moins que
   * nécessaire. Le défaut récurrent du dépôt, sur la porte la plus chère.
   *
   * ⚠ Ce test regarde la CONDITION, pas la présence du 403. Un `403` laissé
   * en place sous un `if` qui ne s'évalue jamais passerait n'importe quelle
   * assertion de présence — le piège déjà payé quatre fois ici.
   */
  /**
   * ⚠⚠ CE GARDE A DÛ ÊTRE ÉCRIT DEUX FOIS, ET LA PREMIÈRE VERSION S'EST FAIT
   * ATTRAPER PAR LA MUTATION — pas par la relecture.
   *
   * Elle capturait `[\s\S]*?` avant `&& !startsWithAny(...)`, donc à travers
   * les lignes. Le commentaire ci-dessus nomme `comptesActifs()` ET
   * `deploiementSansSerrure()` pour expliquer la règle : la capture avalait ce
   * commentaire, et l'assertion était satisfaite PAR LA PROSE. Remis à l'état
   * vulnérable, le test restait vert.
   *
   * C'est la famille de panne la plus coûteuse du dépôt — un garde qui échoue
   * EN S'OUVRANT ne fait pas de bruit, il valide. On retire donc les
   * commentaires AVANT de chercher, comme le fait déjà le test de
   * `lib/auth.ts`, et on exige la condition sur UNE seule ligne de code.
   */
  const mw = readFileSync(join(process.cwd(), "middleware.ts"), "utf8").replace(
    /\/\*[\s\S]*?\*\/|\/\/.*$/gm,
    "",
  );

  const condition = mw.match(/if\s*\(([^\n]*?)&&\s*!startsWithAny\(pathname,\s*PUBLIC_PREFIXES\)\)/);
  assert.ok(
    condition,
    "la garde de briques doit s'ouvrir sur DEUX cas — comptes actifs OU déploiement sans serrure",
  );
  assert.match(condition![1], /comptesActifs\(\)/, "le cas nominal (comptes configurés) doit rester");
  assert.match(
    condition![1],
    /deploiementSansSerrure\(\)/,
    "sans ce second cas, une prod sans compte et sans mot de passe n'exécute AUCUN contrôle de brique : /api/send envoie de vrais emails depuis notre domaine pour n'importe qui",
  );
  assert.match(
    mw,
    /import\s*\{[\s\S]*?deploiementSansSerrure[\s\S]*?\}\s*from\s*"@\/lib\/entitlements"/,
    "le symbole vient de lib/entitlements — jamais une redéfinition locale de « l'app est-elle protégée ? »",
  );
});

test("⚠ …et le socle gratuit reste OUVERT dans ce même état", () => {
  /**
   * Contre-test obligatoire. Refermer la faille en murant tout serait une
   * panne déguisée en correctif : la doctrine dit « on ne coupe PAS le site,
   * on retombe au socle gratuit ». Sans cette assertion, un middleware qui
   * répond 403 à TOUT satisferait le test précédent.
   *
   * Vérifié aussi au rendu sur un serveur de production réel : /aujourdhui,
   * /pipeline, /templates, /linkedin, /appels et /overlay rendent 200 pendant
   * que /api/send et /api/voice/call rendent 403 brique_absente.
   */
  const gratuit = droitGratuit("t-sans-serrure");
  for (const chemin of ["/aujourdhui", "/pipeline", "/templates", "/linkedin", "/appels", "/overlay"]) {
    assert.ok(autorise(gratuit, chemin), `${chemin} doit rester ouvert au socle gratuit`);
  }
  // ⚠ On vise le chemin MÉTIER, pas l'URL de l'API. `CHEMIN_PAR_API` est une
  // table de PRÉFIXES (`/api/voice` couvre `/api/voice/call`) et la fonction
  // qui l'applique vit dans le middleware, non exportée. Recopier cette
  // résolution ici créerait une deuxième définition de la traduction — celle
  // que le test voisin (`API_QUI_DEPENSENT`) tient déjà.
  for (const [api, chemin] of [
    ["/api/send", "/campaigns"],
    ["/api/voice/call", "/voice"],
  ] as const) {
    assert.equal(
      CHEMIN_PAR_API[api] ?? CHEMIN_PAR_API[api.split("/").slice(0, 3).join("/")],
      chemin,
      `${api} doit se traduire en ${chemin} — sinon cette assertion mesure autre chose que ce qu'elle annonce`,
    );
    assert.ok(
      !autorise(gratuit, chemin),
      `${api} DÉPENSE chez nous : elle doit être refusée au socle gratuit`,
    );
  }
});
