/**
 * ─────────────────────────────────────────────────────────────────────
 * QUELLE API SERT QUELLE FONCTIONNALITÉ.
 *
 * Une page bloquée dont l'API répond ne protège RIEN : le client qui n'a pas
 * acheté le Cerveau ne verra pas `/cerveau`, mais `fetch("/api/brain")` lui
 * rendra la donnée. C'est le trou classique du contrôle d'accès « par écran ».
 *
 * Plutôt que de recopier la carte des briques une deuxième fois — deux cartes
 * finissent toujours par diverger — on traduit chaque route API vers le
 * CHEMIN MÉTIER qu'elle sert, et on réutilise la carte unique de
 * `lib/bricks-access.ts`.
 *
 * ⚠ Une API absente de cette table retombe sur son propre chemin, donc sur
 * « non classé », donc REFUSÉE. C'est voulu : une route ajoutée sans être
 * classée doit échouer bruyamment en développement, pas s'ouvrir en silence
 * en production. Un test liste les routes non classées.
 * ─────────────────────────────────────────────────────────────────────
 */

/** Préfixe de route API → chemin métier gouverné par la même brique. */
export const CHEMIN_PAR_API: Record<string, string> = {
  // ── Communs : tout compte authentifié, quelle que soit son offre ──
  "/api/gate": "/login",
  "/api/billing": "/compte",
  /**
   * L'attribution d'apport se pose sur le compte de CELUI QUI S'INSCRIT, donc
   * elle doit être atteignable par n'importe quel compte authentifié — y
   * compris un gratuit, puisque c'est au moment de la création qu'elle se
   * joue. La rattacher à `/payouts` (réflexe : « c'est de l'apporteur ») en
   * aurait fait une route MAÎTRE, et plus aucun client n'aurait pu être
   * attribué à personne.
   *
   * ⚠ Elle n'ouvre rien : elle écrit deux colonnes qui ne gouvernent aucun
   * accès. C'est ce qui rend cette classification sûre.
   */
  "/api/apporteur/attribution": "/compte",
  "/api/health": "/",
  // Le catalogue sert le chiffrage et l'offre : accessible à tout compte,
  // sinon un client ne peut pas voir ce qu'il pourrait acheter en plus.
  "/api/catalogue": "/compte",
  // Les textes de prompt s'éditent depuis /prompts. La route est en plus
  // réservée au compte maître (la doctrine récite les taux du portefeuille) :
  // la porte de l'écran ne suffit pas, et c'est voulu.
  "/api/prompts": "/prompts",
  "/api/compte": "/compte",
  /**
   * ⚠ Rangée sur `/settings`, un chemin GRATUIT, et c'est tout le point : la
   * route par laquelle un locataire apporte SA clé doit être joignable par
   * quelqu'un qui n'a encore rien acheté. La ranger derrière une brique
   * payante rendrait le BYOK inatteignable par ceux à qui il est destiné.
   * Elle ne dépense rien chez nous — sauf l'appel de VÉRIFICATION, qui est
   * fait avec la clé du locataire, donc à ses frais.
   */
  "/api/credentials": "/settings",
  /**
   * Mon équipe : qui m'est rattaché. Chemin COMMUN, comme `/compte`.
   *
   * ⚠ Elle ne rend que de l'EXPLOITATION — des compteurs et des états, jamais
   * une fiche. La rattacher à `crm` aurait été le réflexe et aurait été faux
   * de deux façons : elle serait refusée à un compte sans CRM (or tout le
   * monde doit pouvoir voir sa propre équipe), et elle laisserait croire
   * qu'elle sert des données de pipe. Elle n'en sert aucune.
   */
  "/api/organisation": "/compte",
  // File de propositions : c'est du pilotage du pipe, donc du CRM.
  "/api/propositions": "/pipeline",

  // Le positionnement sert notre modèle de coût agrégé : même porte que
  // l'écran qu'il alimente, donc maître seul.
  "/api/positionnement": "/offre",

  // Le moniteur suit la même porte que l'écran qu'il alimente.
  "/api/moniteur": "/moniteur",

  // ── CRM & Pipeline ──
  "/api/crm": "/pipeline",
  "/api/import": "/pipeline",
  /**
   * ⚠ PAS `/pipeline` — voir `/jeux-internes` dans `lib/bricks-access.ts`.
   *
   * Cette route ne sert pas le pipe DU CLIENT : elle sert NOS 78 fiches
   * réelles. Le middleware la protège déjà (`MAITRE_SEULEMENT`) ; c'est cette
   * table qui la classait sous la brique `crm`, devenue gratuite — deux
   * réponses opposées à la même question, dont une seule tenait.
   */
  "/api/pipeline": "/jeux-internes",
  /**
   * ⚠ `/api/digest` ÉTAIT RATTACHÉE À `/aujourdhui`, DONC AU CRM GRATUIT.
   *
   * Elle ENVOIE : un SMS via `TEXTBELT_KEY` et un email via `SMTP_*` — nos
   * crédits, notre serveur. Le bouton « M'envoyer le récap » de /aujourdhui
   * était donc, pour un compte gratuit, un bouton qui dépense chez nous.
   * Elle suit l'envoi, comme tout ce qui sort de la machine.
   */
  "/api/digest": "/campaigns",
  "/api/calendar": "/meetings",
  "/api/notion": "/pipeline",

  // ── Alpha Voice ──
  "/api/voice": "/voice",
  "/api/voice-costs": "/voice",
  "/api/transcribe": "/voice",
  "/api/campaign": "/voice",

  // ── Campagnes & outreach ──
  "/api/send": "/campaigns",
  "/api/compose": "/outbox",
  /**
   * ⚠⚠ CLASSÉE SUR `/campaigns`, DONC PAYANTE — ET ELLE N'ENVOIE RIEN.
   *
   * `app/api/email/` ne contient qu'une seule route : `preview`. Elle rend
   * l'email tel qu'il s'affichera, et ne touche ni `sendMail`, ni transport,
   * ni SMTP — vérifié en lisant le fichier, pas en le supposant. C'est
   * l'aperçu de `/templates`, l'écran où l'on ÉCRIT.
   *
   * La ranger avec l'envoi fermait l'aperçu à un compte gratuit, donc lui
   * faisait écrire à l'aveugle un texte qu'il allait copier lui-même.
   *
   * ⚠ LE RISQUE DE CE RECLASSEMENT, ET CE QUI LE TIENT. `cheminMetierDeLApi`
   * prend le PREMIER préfixe qui correspond : tout ce qui serait ajouté sous
   * `app/api/email/` hériterait désormais d'un chemin GRATUIT. Un
   * `app/api/email/send/` créé demain partirait donc de notre SMTP sans
   * qu'aucune brique ne le garde. `tests/entitlements.test.ts` refuse toute
   * route sous ce préfixe autre que `preview` — quiconque en ajoute une doit
   * la classer explicitement, et le test le lui dit.
   */
  "/api/email": "/templates",
  "/api/gmail": "/outbox",
  "/api/social": "/social",
  "/api/video": "/social",
  "/api/deliverability": "/campaigns",

  // ── Le Cerveau ──
  "/api/brain": "/cerveau",
  // La synchro pousse le pipe de l'opérateur : même porte que le pipeline.
  "/api/sync": "/pipeline",
  "/api/knowledge": "/cerveau",
  // Le catalogue de références (livres, vidéos) alimente le Cerveau : même porte.
  "/api/references": "/cerveau",

  // ── Audits ──
  "/api/audit": "/audits",
  "/api/icp": "/audits",

  // ── Tracking ──
  "/api/track": "/activity",
  "/api/webhooks": "/activity",

  // ── Closer OS & débrief ──
  "/api/debrief": "/debrief",
  /**
   * ⚠ Même défaut : le sparring appelle un LLM (NVIDIA ou Anthropic, NOTRE
   * clé) et `/closer` fait partie du socle gratuit. « Le prospect est joué par
   * l'IA », c'est exactement « la machine travaille à ta place » — donc la
   * brique payante. Le Closer OS lui-même (la tournée, le débrief, les
   * priorités) reste gratuit : il ne dépense rien.
   */
  "/api/sparring": "/agent",

  // ── Agent ALPHA ──
  "/api/agent": "/agent",
  /**
   * ⚠ `/api/ai` ÉTAIT RATTACHÉE À `/pipeline`, DONC AU SOCLE CRM — ET LE CRM
   * EST DEVENU GRATUIT.
   *
   * Elle sert le script, l'audit, l'objection : ça ressemble à du CRM, et
   * c'était le bon rattachement tant que tous les comptes étaient payants.
   * Depuis l'ouverture des inscriptions, ça veut dire que n'importe quel
   * inconnu brûle nos jetons LLM en boucle depuis une fiche prospect, sans
   * jamais rien payer. Le compteur ne se voit que sur la facture du
   * fournisseur, un mois plus tard.
   *
   * Elle suit donc la brique « agent-alpha », qui est payante — la même
   * frontière que le reste : **ce qui dépense chez nous se paie**. Le gratuit
   * garde le CRM entier ; ce qu'il perd, c'est que la machine écrive à sa
   * place. C'est aussi une bien meilleure ligne de vente que « 50 fiches
   * maximum ».
   */
  "/api/ai": "/agent",

  // ── Notifications : transversales, liées au compte lui-même ──
  "/api/push": "/compte",

  // ── API publique v1 et serveur MCP : portent leur PROPRE authentification
  // par clé, avec portées. Ils ne sont pas gouvernés par une brique — ils
  // sont hors session.
  "/api/v1": "/",
  "/api/mcp": "/",
  /**
   * Webhook Telegram du propriétaire : appelé par Telegram (aucune session),
   * gardé par son secret d'en-tête + l'id de l'expéditeur. Comme `/api/v1` et
   * `/api/mcp`, il porte sa propre serrure et n'est pas gouverné par une
   * brique — d'où le chemin commun. Il est AUSSI dans `PUBLIC_PREFIXES`
   * (middleware), sinon la porte d'accès le fermerait à Telegram.
   */
  "/api/telegram": "/",
};

/**
 * ─────────────────────────────────────────────────────────────────────
 * CE QUI PARLE DE NOTRE EXPLOITATION — jamais de celle du client.
 *
 * ⚠ DÉPLACÉE DEPUIS `middleware.ts` LE 16/09/2026. Elle y était seule, et le
 * BYOK a besoin de la même liste : une API réservée au maître n'est JAMAIS
 * atteignable par un locataire, donc elle ne doit pas empêcher une clé
 * apportée d'ouvrir un chemin. Deux copies de cette liste divergeraient, et
 * c'est celle qu'on ne relit pas qui déciderait.
 *
 * · `/api/pipeline` — nos fiches de prospection (données de tiers).
 * · `/api/voice-costs` — notre modèle de coût et nos marges.
 * · `/api/knowledge` · `/api/references` — le playbook maison.
 * · `/api/digest` — ⚠ AJOUTÉE LE 16/09. Son destinataire n'est JAMAIS pris
 *   dans la requête : il vient de `ALERT_PHONE` / `DIGEST_EMAIL`, donc de
 *   NOTRE environnement. Cette propriété la rendait sûre quand l'app servait
 *   une seule personne ; en multi-locataire elle la retourne — un tiers
 *   l'appelle, et le SMS part sur NOTRE téléphone, à NOS frais. Le défaut
 *   préexistait ; le BYOK le rendait atteignable.
 * · `/api/notion` — ⚠⚠ AJOUTÉE LE 16/09, trouvée en BALAYANT la famille que
 *   `/api/digest` venait de révéler : « quelles autres routes ont une
 *   destination qui vient de NOTRE environnement ? ». Celle-ci ÉCRIT dans
 *   `NOTION_DATABASE_ID` — une base précise, la nôtre — et elle était servie
 *   par `/pipeline`, chemin GRATUIT. N'importe quel inscrit poussait donc ses
 *   fiches dans NOTRE espace de travail.
 *   Deux torts, et le premier est pour LUI : ses prospects sont des données
 *   de tiers, et elles atterrissaient chez nous — on devenait responsable
 *   d'un traitement qu'on n'a jamais demandé. Le second est pour nous : notre
 *   base se remplissait des fiches d'inconnus.
 *   ⚠ Le jour où un locataire pourra apporter SON jeton Notion (aucun chemin
 *   ne le permet aujourd'hui, vérifié), cette entrée se rediscute — pas avant.
 * ─────────────────────────────────────────────────────────────────────
 */
export const MAITRE_SEULEMENT: readonly string[] = [
  "/api/pipeline",
  "/api/voice-costs",
  "/api/knowledge",
  "/api/references",
  "/api/digest",
  "/api/notion",
];
