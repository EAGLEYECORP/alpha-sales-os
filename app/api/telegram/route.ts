import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { safeEqual } from "@/lib/access";
import {
  analyserCommande,
  estProprietaire,
  etatTelegram,
  reponsePour,
  texteAide,
  texteStatut,
  type MessageTelegram,
} from "@/lib/telegram";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * ─────────────────────────────────────────────────────────────────────
 * WEBHOOK TELEGRAM — la route qui reçoit « dis à Alpha quoi faire ».
 *
 * Appelée par les serveurs de Telegram (donc SANS session, cross-origin) :
 * elle vit dans `PUBLIC_PREFIXES` du middleware et n'est PAS dans `INTERNAL`.
 * Sa seule serrure est le secret d'en-tête + l'identité de l'expéditeur.
 *
 * ⚠ FAIL-CLOSED, comme le cron. Pas de `TELEGRAM_WEBHOOK_SECRET` configuré →
 * la route « n'existe pas » (404). Un webhook de commande ne s'ouvre jamais
 * par défaut.
 *
 * ⚠ On répond TOUJOURS 200 à une requête authentifiée, même si la commande est
 * inconnue : sinon Telegram réémet en boucle. Le refus se fait AVANT (secret /
 * propriétaire), là où un 401/404 est le bon signal.
 * ─────────────────────────────────────────────────────────────────────
 */

/** Envoie un message à un chat via l'API Bot. Aucune dépendance : `fetch`. */
async function envoyerTelegram(token: string, chatId: string, texte: string): Promise<void> {
  try {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text: texte }),
    });
  } catch {
    // Un échec d'envoi ne doit pas faire réémettre Telegram : on avale.
  }
}

/** L'envoi email est-il réellement branché ? Même test que la sonde de `/api/send`. */
const envoiPret = (): boolean =>
  Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);

/** L'autopilote serveur est-il armé ? Même verrou que `/api/campaign/tick`. */
const autopiloteArme = (): boolean =>
  (process.env.CAMPAIGN_AUTOPILOT ?? "").trim().toLowerCase() === "on";

/** Range une consigne dans la file. Renvoie true si vraiment persistée. */
async function rangerNote(texte: string, chatId: string): Promise<boolean> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return false;
  try {
    const db = createClient(url, key, { auth: { persistSession: false } });
    const { error } = await db.from("commandes_alpha").insert({ chat_id: chatId, texte, source: "telegram" });
    return !error;
  } catch {
    return false;
  }
}

export async function POST(req: NextRequest) {
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET?.trim();
  const token = process.env.TELEGRAM_BOT_TOKEN?.trim();

  // Fail-closed : sans secret, la route n'existe pas. (Volontaire, comme le cron.)
  if (!secret) return NextResponse.json({ error: "non configuré" }, { status: 404 });

  // Telegram renvoie le secret dans cet en-tête, posé au setWebhook.
  const fourni = (req.headers.get("x-telegram-bot-api-secret-token") ?? "").trim();
  if (!(fourni.length > 0 && safeEqual(fourni, secret))) {
    return NextResponse.json({ error: "secret invalide" }, { status: 401 });
  }

  let update: { message?: { text?: string; from?: { id?: number }; chat?: { id?: number } } };
  try {
    update = await req.json();
  } catch {
    return NextResponse.json({ ok: true }); // rien à traiter, on acquitte
  }

  const m = update.message;
  const chatId = String(m?.from?.id ?? m?.chat?.id ?? "");
  const message: MessageTelegram = { chatId, texte: m?.text ?? "" };

  // L'expéditeur DOIT être le propriétaire déclaré. Sinon : acquitté, ignoré,
  // rien ne fuit (on ne répond même pas « accès refusé » à un inconnu).
  if (!estProprietaire(message.chatId, process.env.TELEGRAM_OWNER_CHAT_ID)) {
    return NextResponse.json({ ok: true });
  }

  const cmd = analyserCommande(message.texte);
  const r = reponsePour(cmd);

  // On construit le texte final (les effets de bord vivent ici, pas dans lib).
  let reponse: string;
  if (r.verbe === "statut") {
    reponse = texteStatut(etatTelegram(process.env), envoiPret(), autopiloteArme());
  } else if (r.verbe === "note" && r.texte === null) {
    const persistee = await rangerNote(cmd.args, message.chatId);
    reponse = persistee
      ? "Noté ✅ — rangé dans ta file."
      : "Noté, mais NON persisté (file indisponible). Je te le redis : ce n'est pas stocké.";
  } else {
    reponse = r.texte ?? texteAide();
  }

  if (token) await envoyerTelegram(token, message.chatId, reponse);
  return NextResponse.json({ ok: true });
}

/**
 * Sonde de configuration — quelles variables sont posées, JAMAIS leur valeur.
 * Utile pour vérifier le branchement sans exposer le token.
 */
export function GET() {
  return NextResponse.json({ telegram: etatTelegram(process.env) });
}
