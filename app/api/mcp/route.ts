import { NextRequest, NextResponse } from "next/server";
import type { Portee } from "@/lib/api-keys";
import { autoriserAppelant, origineDe } from "@/lib/autoriser-appelant";
import { defiBearer, secretOAuth } from "@/lib/mcp-oauth";
import { TYPES_PROPOSITION } from "@/lib/propositions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * ─────────────────────────────────────────────────────────────────────
 * SERVEUR MCP — brancher un agent (Claude, Cowork…) sur Alpha Sales OS.
 *
 * MCP en HTTP, c'est du JSON-RPC 2.0 en POST : `initialize`, `tools/list`,
 * `tools/call`. Écrit à la main plutôt qu'avec un SDK — la maison n'ajoute
 * pas de dépendance runtime, et le protocole tient en trois méthodes.
 *
 * ── LE POINT QUI COMPTE ──
 *
 * Les outils exposés sont VOLONTAIREMENT asymétriques :
 *   · en LECTURE, l'agent voit le pipe ET peut PRÉPARER une campagne à froid —
 *     le texte exact de chaque mail, plafonné au palier du jour ;
 *   · en ÉCRITURE, il n'a QU'UNE chose : déposer une proposition.
 *
 * Aucun outil n'envoie d'email, ne lance d'appel, ne déplace une fiche — et
 * « préparer une campagne » rend un PLAN, pas un envoi. Ce n'est pas une
 * omission, c'est la conception : un agent qui orchestre un pipe réel doit
 * pouvoir se tromper sans que ça coûte un client. L'envoi reste gardé côté
 * serveur (palier, DKIM, mentions) et armé par un humain.
 *
 * Les droits viennent de la CLÉ (ALPHA_API_KEYS) ou du JETON OAUTH : un agent
 * sans `propositions.write` ne peut que regarder, et l'outil disparaît de sa
 * liste plutôt que d'échouer à l'appel.
 *
 * ── OAUTH (29/09/2026) ──
 *
 * claude.ai et Cowork ne savent se brancher qu'en OAuth pour la plupart des
 * comptes. Sans authentification valide, ce serveur répond donc 401 avec un
 * `WWW-Authenticate` qui pointe vers ses métadonnées : c'est CE 401 qui fait
 * démarrer la connexion côté Claude (un en-tête sur un 200 est ignoré).
 * Un jeton OAuth ne porte que les portées du cerveau — voir `lib/mcp-oauth.ts`.
 * ─────────────────────────────────────────────────────────────────────
 */

/**
 * Versions du protocole qu'on sait servir. On n'utilise que des outils et des
 * réponses JSON, communs à toutes : on renvoie donc celle que le client
 * demande si on la connaît, au lieu d'imposer la plus ancienne — un client
 * récent qui reçoit une version qu'il ne parle plus se déconnecte.
 */
const VERSIONS_MCP = ["2025-11-25", "2025-06-18", "2025-03-26", "2024-11-05"];

interface RequeteRpc {
  jsonrpc?: string;
  id?: number | string | null;
  method?: string;
  params?: Record<string, unknown>;
}

const rpcOk = (id: RequeteRpc["id"], result: unknown) =>
  NextResponse.json({ jsonrpc: "2.0", id: id ?? null, result });

const rpcErr = (id: RequeteRpc["id"], code: number, message: string) =>
  NextResponse.json({ jsonrpc: "2.0", id: id ?? null, error: { code, message } });

/** Un outil MCP, avec la portée qu'il exige. */
interface Outil {
  name: string;
  description: string;
  portee: Portee;
  /** Chemin de l'API v1 qu'il appelle réellement. */
  chemin: string;
  methode: "GET" | "POST";
  inputSchema: Record<string, unknown>;
}

const OUTILS: Outil[] = [
  {
    name: "etat_du_pipe",
    description:
      "Lit l'état du pipeline commercial : qui est prêt à signer, qui dort, qui n'a pas de prochaine étape, qui est saturé. " +
      "Aucune coordonnée n'est rendue (ni email, ni téléphone) : un moniteur n'a pas besoin de savoir comment joindre " +
      "quelqu'un pour dire qu'il faut le joindre. Commence TOUJOURS par cet outil avant de proposer quoi que ce soit.",
    portee: "etat.read",
    chemin: "/api/v1/etat",
    methode: "GET",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "lister_propositions",
    description:
      "Liste les propositions déjà déposées et leur statut (en attente, approuvée, rejetée, expirée). " +
      "À consulter AVANT d'en déposer une nouvelle : reproposer ce qui a déjà été rejeté fait perdre la confiance " +
      "de l'opérateur, et il n'y a aucune mémoire entre deux sessions.",
    portee: "propositions.read",
    chemin: "/api/v1/propositions",
    methode: "GET",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "proposer",
    description:
      "Dépose une proposition pour revue humaine. N'EXÉCUTE RIEN : aucun email n'est envoyé, aucun appel lancé, " +
      "aucune fiche modifiée. L'opérateur approuve ou rejette dans l'app. " +
      "Le champ « pourquoi » doit citer des FAITS de la fiche — une proposition sans raison vérifiable ne s'approuve pas, " +
      "elle se subit. Pour un email ou un appel, fournis le texte EXACT : approuver une intention revient à envoyer " +
      "un texte que personne n'a lu.",
    portee: "propositions.write",
    chemin: "/api/v1/propositions",
    methode: "POST",
    inputSchema: {
      type: "object",
      properties: {
        type: { type: "string", enum: [...TYPES_PROPOSITION], description: "Nature de ce qui est proposé." },
        titre: { type: "string", description: "Une ligne, lisible d'un coup d'œil." },
        pourquoi: { type: "string", description: "Les FAITS de la fiche qui justifient. 20 caractères minimum." },
        prospectId: { type: "string", description: "La fiche concernée, si applicable." },
        contenu: { type: "string", description: "Le texte exact (email, script d'appel, note)." },
        etape: { type: "string", description: "Pour type=etape : l'étape visée." },
        quand: { type: "string", description: "Pour type=rendez-vous : date ISO." },
      },
      required: ["type", "titre", "pourquoi"],
      additionalProperties: false,
    },
  },
  {
    name: "diagnostic",
    description:
      "Lit l'ÉTAT D'EXPLOITATION de la machine (pas le pipe) : autopilote armé ou non, palier d'envoi du jour, " +
      "si les réponses partent seules (attestation DKIM), et QUEL moteur classe les réponses — le souverain local " +
      "(Laya), l'API US (Jev), ou le repli LLM. Sert à faire un rapport du matin complet : « est-ce que ça tourne, " +
      "et qu'est-ce qui bloque ». N'AGIT PAS, ne rend aucun secret ni coordonnée.",
    portee: "etat.read",
    chemin: "/api/v1/diagnostic",
    methode: "GET",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "preparer_campagne",
    description:
      "PLANIFIE une campagne d'emails à froid sur les prospects éligibles du pipe (stade prospect/contact, email présent, " +
      "aucun refus). Rend le TEXTE EXACT de chaque mail (objet + corps, avec la divulgation IA de l'article 50 dans le corps) " +
      "et le préflight, PLAFONNÉ au palier d'envoi du jour — le reste attend un prochain tour. " +
      "N'ENVOIE RIEN et ne modifie aucune fiche : c'est un plan à faire approuver ; l'envoi réel reste gardé côté serveur " +
      "(palier, DKIM, mentions) et armé par l'opérateur. Ne rend AUCUNE adresse email — seulement le texte à relire. " +
      "Le champ « max » resserre le lot sous le palier, il ne peut jamais l'élargir.",
    portee: "campagne.read",
    chemin: "/api/v1/campagne",
    methode: "POST",
    inputSchema: {
      type: "object",
      properties: {
        max: {
          type: "number",
          description: "Plafonne le lot à N mails (jamais au-dessus du palier du jour). Omis = tout le palier du jour.",
        },
      },
      required: [],
      additionalProperties: false,
    },
  },
];

/** Base absolue pour les appels internes — Vercel ne résout pas les chemins nus. */
function base(req: NextRequest): string {
  return process.env.APP_BASE_URL?.trim() || new URL(req.url).origin;
}

export async function POST(req: NextRequest) {
  let body: RequeteRpc;
  try {
    body = (await req.json()) as RequeteRpc;
  } catch {
    return rpcErr(null, -32700, "JSON invalide.");
  }

  const auth = req.headers.get("authorization");
  const { id, method } = body;

  /**
   * ⚠ LE 401 QUI DÉMARRE LA CONNEXION. Aucune authentification valide (ni clé,
   * ni jeton) ⇒ 401 + pointeur vers les métadonnées OAuth. Un jeton EXPIRÉ
   * tombe ici aussi, avec `error="invalid_token"` : c'est ce qui fait
   * rafraîchir Claude. Un appelant authentifié mais sans `etat.read` n'est pas
   * refusé ici : ses outils sont filtrés plus bas, comme avant.
   * Si OAuth n'est pas configuré (aucun secret), on garde l'ancien comportement
   * — annoncer un serveur d'autorisation qui ne peut rien signer serait mentir.
   */
  const ident = autoriserAppelant(auth, "etat.read");
  if (!ident.ok && ident.statut === 401 && secretOAuth()) {
    const origine = origineDe(req);
    return NextResponse.json(
      { jsonrpc: "2.0", id: id ?? null, error: { code: -32001, message: `${ident.erreur} ${ident.pourquoi}` } },
      { status: 401, headers: { "WWW-Authenticate": defiBearer(origine, Boolean(auth?.trim())) } },
    );
  }

  // Une notification n'attend pas de réponse : 202, corps vide (MCP HTTP).
  if (typeof method === "string" && method.startsWith("notifications/")) {
    return new NextResponse(null, { status: 202 });
  }
  if (method === "ping") return rpcOk(id, {});

  if (method === "initialize") {
    const demandee = body.params?.protocolVersion;
    return rpcOk(id, {
      protocolVersion: typeof demandee === "string" && VERSIONS_MCP.includes(demandee) ? demandee : VERSIONS_MCP[0],
      capabilities: { tools: {} },
      serverInfo: { name: "alpha-sales-os", version: "1.0.0" },
      instructions:
        "Alpha Sales OS — orchestration en LECTURE et PROPOSITION. Tu observes le pipe et tu proposes ; " +
        "tu n'envoies jamais rien. Chaque proposition est tranchée par un humain. " +
        "Commence par etat_du_pipe, vérifie lister_propositions pour ne pas répéter ce qui a été rejeté, " +
        "puis propose en citant des faits.",
    });
  }

  if (method === "tools/list") {
    // On n'expose que ce que la clé permet : un outil qui échouerait à
    // l'appel est pire qu'un outil absent — l'agent le retente.
    const dispo = OUTILS.filter((o) => autoriserAppelant(auth, o.portee).ok);
    return rpcOk(id, {
      tools: dispo.map(({ name, description, inputSchema }) => ({ name, description, inputSchema })),
    });
  }

  if (method === "tools/call") {
    const nom = (body.params?.name as string) ?? "";
    const args = (body.params?.arguments as Record<string, unknown>) ?? {};
    const outil = OUTILS.find((o) => o.name === nom);
    if (!outil) return rpcErr(id, -32601, `Outil inconnu : ${nom}`);

    const v = autoriserAppelant(auth, outil.portee);
    if (!v.ok) {
      return rpcOk(id, {
        isError: true,
        content: [{ type: "text", text: `${v.erreur} ${v.pourquoi}` }],
      });
    }

    const r = await fetch(base(req) + outil.chemin, {
      method: outil.methode,
      headers: { authorization: auth ?? "", "content-type": "application/json" },
      ...(outil.methode === "POST" ? { body: JSON.stringify(args) } : {}),
      cache: "no-store",
    });
    const texte = await r.text();

    return rpcOk(id, {
      isError: !r.ok,
      content: [{ type: "text", text: texte }],
    });
  }

  return rpcErr(id, -32601, `Méthode non supportée : ${method}. Ce serveur implémente initialize, tools/list, tools/call.`);
}

/** GET : sonde de configuration, sans rien exposer. */
export async function GET(req: NextRequest) {
  // Un client MCP qui ouvre un flux d'événements (GET + text/event-stream)
  // reçoit 405 : on ne pousse rien vers le client. Lui servir notre JSON de
  // sonde le ferait croire à un flux cassé.
  const accepte = req.headers.get("accept") ?? "";
  if (accepte.includes("text/event-stream") && !accepte.includes("application/json")) {
    return new NextResponse(null, { status: 405, headers: { Allow: "POST" } });
  }
  const auth = req.headers.get("authorization");
  const v = autoriserAppelant(auth, "etat.read");
  return NextResponse.json({
    serveur: "alpha-sales-os",
    protocole: "MCP 2024-11-05 (JSON-RPC 2.0 sur POST)",
    authentifie: v.ok,
    ...(v.ok
      ? { appelant: v.appelant.nom, portees: v.appelant.portees }
      : { pourquoi: v.pourquoi }),
    outils: OUTILS.map((o) => ({ nom: o.name, portee: o.portee })),
    doctrine: "Lecture et proposition uniquement. Aucun outil n'envoie, n'appelle ni ne modifie.",
  });
}
