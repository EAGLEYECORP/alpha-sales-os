import { NextRequest, NextResponse } from "next/server";
import { autoriserApi, type Portee } from "@/lib/api-keys";
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
 *   · en LECTURE, l'agent voit tout ce qui l'aide à comprendre le pipe ;
 *   · en ÉCRITURE, il n'a QU'UNE chose : déposer une proposition.
 *
 * Aucun outil n'envoie d'email, ne lance d'appel, ne déplace une fiche. Ce
 * n'est pas une omission — c'est la conception. Un agent qui orchestre un
 * pipe réel doit pouvoir se tromper sans que ça coûte un client.
 *
 * Les droits viennent de la CLÉ (ALPHA_API_KEYS) : un agent branché avec une
 * clé sans `propositions.write` ne peut que regarder, et l'outil disparaît de
 * sa liste plutôt que d'échouer à l'appel.
 * ─────────────────────────────────────────────────────────────────────
 */

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

  if (method === "initialize") {
    return rpcOk(id, {
      protocolVersion: "2024-11-05",
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
    const dispo = OUTILS.filter((o) => autoriserApi(auth, o.portee).ok);
    return rpcOk(id, {
      tools: dispo.map(({ name, description, inputSchema }) => ({ name, description, inputSchema })),
    });
  }

  if (method === "tools/call") {
    const nom = (body.params?.name as string) ?? "";
    const args = (body.params?.arguments as Record<string, unknown>) ?? {};
    const outil = OUTILS.find((o) => o.name === nom);
    if (!outil) return rpcErr(id, -32601, `Outil inconnu : ${nom}`);

    const v = autoriserApi(auth, outil.portee);
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
  const auth = req.headers.get("authorization");
  const v = autoriserApi(auth, "etat.read");
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
