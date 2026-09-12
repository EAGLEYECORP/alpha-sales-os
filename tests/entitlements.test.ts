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
  assert.equal(autorise(client, "/appels"), true);
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
  "/api/email": "SMTP — notre serveur",
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
