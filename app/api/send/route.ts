import { NextRequest, NextResponse } from "next/server";
import { renderEmail, plainText } from "@/lib/email-html";
import { createTrackedEmail, countRecentSends, contactedEmails, firstSendAt } from "@/lib/tracking";
import { rampDepuisPremierEnvoi } from "@/lib/email-ramp";
import { deliverabilityHeaders, lintForSpam, maxSendsPerHour } from "@/lib/deliverability";
import { getTenant } from "@/lib/tenant";
import { accountTier } from "@/lib/stripe";
import { FREE_TIER, startOfMonthMs } from "@/lib/plans";
import { isDemoProspect, estAdresseDeDemo } from "@/lib/seed";
import { estPartenaire } from "@/lib/validation-partenaire";
import { cadreParId } from "@/lib/templates";
import { empreinte } from "@/lib/apprentissage";
import { habillageEnvoi } from "@/lib/expediteur";
import { verifieMentions } from "@/lib/conformite";

export const runtime = "nodejs";
export const maxDuration = 30;

/**
 * Envoi réel — 100 % open-source, zéro vendor lock-in :
 *  · email : Nodemailer (MIT) sur n'importe quel SMTP
 *      env : SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM
 *  · sms   : API compatible Textbelt (open-source, auto-hébergeable)
 *      env : TEXTBELT_URL (défaut https://textbelt.com/text), TEXTBELT_KEY
 *
 * Les emails partent en HTML soigné (multipart html + texte), avec :
 *  · tracking ouvertures + clics (nombre de clics),
 *  · pied « Répondez STOP » + List-Unsubscribe mailto (géré par n8n),
 *  · lint anti-spam (bloque ou avertit selon la sévérité).
 *
 * Le WhatsApp part en lien wa.me côté client (ton numéro, ta conversation).
 */

interface SendRequest {
  channel: "email" | "sms";
  to: string;
  subject?: string;
  body: string;
  /** Métadonnées de tracking (facultatives). */
  prospectId?: string;
  campaignId?: string;
  /**
   * Compte au nom duquel on écrit (portefeuille white-label). Absent = maître.
   */
  accountId?: string;
  /**
   * Le CADRE dont ce message est issu (`lib/templates.ts` → `idCadre`).
   * Absent = message écrit à la main, que l'humain assume lui-même.
   */
  cadreId?: string;
  /** La preuve que le partenaire a validé ce cadre (`lib/validation-partenaire.ts`). */
  validationPartenaire?: { par: string; le: string; empreinte: string };
  /**
   * QUI SIGNE. Le nom saisi par l'opérateur dans Réglages, et sa société.
   * Absents, le serveur retombe sur la marque du COMPTE — jamais sur la
   * nôtre (`lib/signature.ts`).
   */
  closerName?: string;
  agencyName?: string;
  /** Bouton d'appel à l'action optionnel dans l'email. */
  ctaLabel?: string;
  ctaUrl?: string;
  /** Forcer l'envoi malgré un score anti-spam élevé. */
  force?: boolean;
  /** Pièces jointes (ex. audit cadeau). Contenu en base64. */
  attachments?: { filename: string; contentBase64: string; contentType?: string }[];
}

/**
 * Ce qu'on répond quand une mention manque. Une seule chaîne : deux copies
 * dérivent, et l'écran finit par expliquer autre chose que le SMS.
 */
const QUOI_FAIRE_MENTIONS =
  "Le message doit dire QUI écrit (ton nom ou ta société, Réglages → Agence) et COMMENT refuser (« répondez STOP »). Ajoute les deux, puis renvoie.";

/** Borne les pièces jointes : ≤ 3 fichiers, ≤ 400 Ko chacun (décodé). */
function safeAttachments(atts: SendRequest["attachments"]) {
  if (!Array.isArray(atts) || atts.length === 0) return [];
  return atts.slice(0, 3).flatMap((a) => {
    if (!a?.filename || !a?.contentBase64) return [];
    const content = Buffer.from(a.contentBase64, "base64");
    if (content.length === 0 || content.length > 400_000) return [];
    return [{ filename: a.filename.slice(0, 120), content, contentType: a.contentType || undefined }];
  });
}

/** Compte les liens de contenu uniques (hors désinscription). */
function countContentLinks(html: string): number {
  const urls = [...html.matchAll(/href="(https?:\/\/[^"]+)"/gi)]
    .map((m) => m[1])
    .filter((u) => !u.includes("/api/unsubscribe"));
  return new Set(urls).size;
}

/** URL publique de base pour les liens de tracking / désinscription. */
function baseUrlFrom(req: NextRequest): string {
  return (
    process.env.TRACKING_BASE_URL ||
    process.env.APP_BASE_URL ||
    req.nextUrl.origin
  ).replace(/\/+$/, "");
}

export async function GET() {
  // Capability probe — the UI shows/hides send buttons based on this.
  return NextResponse.json({
    email: Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS),
    sms: Boolean(process.env.TEXTBELT_KEY),
    tracking: true,
  });
}

export async function POST(request: NextRequest) {
  // Garde-fou taille : borne les charges utiles (anti-abus mémoire).
  // Marge pour d'éventuelles pièces jointes en base64 (audit cadeau ≈ 6 Ko).
  const len = Number(request.headers.get("content-length") ?? 0);
  if (len > 1_500_000) {
    return NextResponse.json({ error: "Charge utile trop volumineuse." }, { status: 413 });
  }
  let body: SendRequest;
  try {
    body = (await request.json()) as SendRequest;
  } catch {
    return NextResponse.json({ error: "JSON invalide" }, { status: 400 });
  }
  if (!body.to?.trim() || !body.body?.trim()) {
    return NextResponse.json({ error: "champs to et body requis" }, { status: 400 });
  }

  /**
   * ─────────────────────────────────────────────────────────────────────
   * AUCUN ENVOI VERS UNE FICHE DE DÉMONSTRATION — AU POINT DE PASSAGE.
   *
   * ⚠ TROUVÉ EN SE SERVANT DU PRODUIT. La boîte d'envoi refusait ces fiches,
   * et elle expliquait pourquoi : « Écrire à l'une d'elles produit un rebond
   * dur, et les rebonds comptent contre ton domaine pendant des mois. »
   *
   * Trois AUTRES surfaces appelaient cette route sans ce contrôle :
   * `/newsletter` (« Envoyer à 4 destinataire(s) », en LOT, d'un seul
   * bouton), la revue de campagne, et la barre d'envoi d'une fiche. La garde
   * existait, câblée à un seul endroit — le défaut le plus fréquent de ce
   * dépôt.
   *
   * Le contrôle vit donc ICI, où passent tous les envois. Une quatrième
   * surface écrite demain est couverte sans que personne y pense.
   *
   * Deux clés, toutes deux DÉRIVÉES du jeu de démonstration :
   *  · `prospectId` — l'identifiant, quand l'appelant le fournit ;
   *  · l'adresse elle-même — pour l'appelant qui ne le fournirait pas.
   * On refuse en 409 (conflit d'état), pas en 400 : la requête est correcte,
   * c'est la CIBLE qui ne doit pas être écrite.
   * ─────────────────────────────────────────────────────────────────────
   */
  /**
   * ⚠ LES DEUX CLÉS SONT DEVENUES STRUCTURELLES, ET C'EST CE QUI LES REND
   * SÛRES MAINTENANT QUE LE JEU DE DÉMO SE GÉNÈRE.
   *
   * Elles interrogeaient deux LISTES dérivées des huit fiches écrites à la
   * main. Depuis que la démo se fabrique à partir de l'ICP de l'inscrit, ces
   * listes ne connaissent plus les fiches produites : le verrou se serait
   * ouvert tout seul, sans rien casser ni rien dire. `isDemoProspect` lit
   * désormais un préfixe réservé, `estAdresseDeDemo` un domaine réservé par
   * la RFC 2606 — deux propriétés qu'aucune fiche réelle ne peut porter.
   */
  const cibleDemo =
    (body.prospectId ? isDemoProspect(body.prospectId) : false) || estAdresseDeDemo(body.to);
  if (cibleDemo) {
    return NextResponse.json(
      {
        error:
          "Fiche de démonstration — adresse inventée. Écrire dessus produit un rebond dur, et les rebonds comptent contre ton domaine pendant des mois. Charge tes vraies fiches (Réglages → Tout vider, puis importe ton CSV).",
        demo: true,
      },
      { status: 409 }
    );
  }

  /**
   * ─────────────────────────────────────────────────────────────────────
   * QUI SIGNE CE MESSAGE — RÉSOLU DEPUIS LE COMPTE, PAS DEPUIS UNE ENV.
   *
   * ⚠ CETTE ROUTE ÉTAIT LA CINQUIÈME RÉPONSE À « qui signe ? ».
   * `lib/signature.ts` a été écrit pour réunir les quatre premières, et
   * personne ne l'a branché ICI — le seul endroit d'où un email PART.
   * Elle lisait une variable d'environnement de signature, avec repli sur
   * « EAGLEYE ».
   *
   * Deux fautes dans cette ligne :
   *  · une ENV UNIQUE pour un produit MULTI-COMPTE : le même nom signe les
   *    envois de tous les comptes du portefeuille ;
   *  · un repli sur NOTRE marque : un email envoyé au nom d'un partenaire
   *    partait signé « EAGLEYE », avec « EAGLEYE CORP — Lyon, France » en
   *    pied. C'est une identité d'expéditeur fausse dans un message
   *    commercial — et c'est précisément la réputation que la validation
   *    partenaire, dix lignes plus haut, s'emploie à protéger.
   *
   * L'ordre de repli est celui de `signataire()` : le nom saisi, sinon la
   * SOCIÉTÉ (une raison sociale identifie légalement, et elle appartient
   * bien à l'expéditeur), sinon le libellé d'usine — qui sera refusé plus
   * bas au lieu de partir en silence.
   * ─────────────────────────────────────────────────────────────────────
   */
  const habillage = habillageEnvoi({
    accountId: body.accountId,
    closerName: body.closerName,
    agencyName: body.agencyName,
    base: baseUrlFrom(request),
  });
  const marque = habillage.marque;

  /**
   * ─────────────────────────────────────────────────────────────────────
   * L'ACCORD DU PARTENAIRE SUR CE QUI PART PAR ÉCRIT.
   *
   * Même règle que pour l'appel (`/api/voice/call`) : ce qui sort au nom d'une
   * marque qui n'est pas la nôtre doit avoir été relu par elle, et l'accord
   * porte sur le TEXTE EXACT — il tombe dès qu'un caractère bouge.
   *
   * ⚠ CE QUE CETTE PORTE COUVRE, ET CE QU'ELLE NE COUVRE PAS — dit
   * exactement, parce qu'une garde dont on surestime la portée est pire
   * qu'une garde absente.
   *
   * Elle ne vérifie QUE les gabarits de la bibliothèque (`cadreId`), parce que
   * ce sont les seuls textes que le SERVEUR connaît : ils vivent dans
   * `lib/templates.ts`, partagé. Il recalcule l'empreinte lui-même, donc le
   * client ne peut pas mentir sur le contenu.
   *
   * Elle ne couvre PAS les campagnes de l'opérateur ni la newsletter : leurs
   * textes vivent dans le navigateur (`campaign.steps[].body`), le serveur ne
   * les a jamais vus et ne peut rien recalculer. Une première version refusait
   * tout envoi portant un `campaignId` sans cadre — ça bloquait l'envoi de
   * RECETTE (un test à soi-même) et la newsletter, deux usages légitimes, sans
   * protéger quoi que ce soit de plus. Le garde-fou des campagnes est côté
   * écran (`campaign-review`), et il est plus faible : c'est écrit là-bas.
   *
   * Un message écrit à la main n'est pas bloqué non plus — l'humain qui
   * l'écrit l'assume, et exiger une validation pour répondre à un prospect
   * rendrait le contrôle insupportable, donc contourné.
   *
   * ⚠⚠ Comme pour l'appel, ça ne résiste pas à une requête qui forgerait
   * l'empreinte. Assumé : le modèle de menace est notre propre oubli, pas un
   * adversaire — voir `lib/validation-partenaire.ts`.
   * ─────────────────────────────────────────────────────────────────────
   */
  if (estPartenaire(body.accountId ?? "") && body.cadreId) {
    const cadre = cadreParId(body.cadreId);
    const v = body.validationPartenaire;
    if (!cadre || !v || v.empreinte !== empreinte(cadre.body)) {
      return NextResponse.json(
        {
          error: "Texte non validé par le partenaire — rien ne part.",
          why:
            `Vous écrivez au nom de ${marque}. ` +
            (!cadre
              ? "Le gabarit annoncé est inconnu de la bibliothèque."
              : v
                ? "Ce gabarit a changé depuis leur validation : leur accord ne couvre pas cette version."
                : "Ce gabarit ne leur a jamais été soumis."),
          quoiFaire: "Ouvrir Réglages → Validation partenaire, faire relire le texte, puis enregistrer qui a validé.",
        },
        { status: 422 }
      );
    }
  }

  // Locataire courant (multi-compte) : identité + accès. Résolu une fois, réutilisé.
  const tenant = await getTenant(request);
  const tenantId = tenant?.id ?? null;

  // Freemium (opt-in REQUIRE_SUBSCRIPTION). Envoyer est l'action à valeur :
  //  · unmetered/owner/active → illimité (usage loyal) ;
  //  · anon (aucun compte)    → bloqué ;
  //  · free                   → autorisé jusqu'au quota mensuel, puis 402.
  // Solo / facturation non exigée : « unmetered » → aucun effet.
  const tier = await accountTier(tenantId, tenant?.email ?? null);
  if (tier === "anon") {
    return NextResponse.json(
      { error: "Compte requis pour envoyer — connecte-toi (/compte).", needsSubscription: true },
      { status: 402 }
    );
  }
  if (tier === "free" && body.channel === "email" && tenantId) {
    const usedThisMonth = await countRecentSends("email", Date.now() - startOfMonthMs(), tenantId);
    if (usedThisMonth >= FREE_TIER.emailsPerMonth) {
      return NextResponse.json(
        {
          error: `Quota gratuit atteint (${FREE_TIER.emailsPerMonth} e-mails/mois). Passe à Solo ou Pro pour continuer — /compte.`,
          needsSubscription: true,
          quota: { used: usedThisMonth, limit: FREE_TIER.emailsPerMonth },
        },
        { status: 402 }
      );
    }
  }

  if (body.channel === "email") {
    const { SMTP_HOST, SMTP_USER, SMTP_PASS, SMTP_FROM } = process.env;
    if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) {
      return NextResponse.json(
        { error: "SMTP non configuré — renseigne SMTP_HOST / SMTP_USER / SMTP_PASS dans .env.local (n'importe quel fournisseur SMTP fonctionne)." },
        { status: 503 }
      );
    }

    const to = body.to.trim();

    // Le tenantId (résolu plus haut) borne rate-limit, dédup et tracking à SON
    // périmètre. En solo (pas de compte), null → comportement d'origine.

    // Rate-limit anti-pic (durable) : nb d'emails partis dans la dernière heure.
    const recent = await countRecentSends("email", 3600_000, tenantId);
    if (recent >= maxSendsPerHour()) {
      return NextResponse.json(
        { error: `Limite d'envoi atteinte (${maxSendsPerHour()}/h, anti-spam). Réessaie plus tard.` },
        { status: 429, headers: { "retry-after": "300" } }
      );
    }

    /**
     * ─────────────────────────────────────────────────────────────────────
     * LA MONTÉE EN CHARGE, APPLIQUÉE ICI — pas seulement dans un écran.
     *
     * ⚠ ELLE NE L'ÉTAIT PAS, ET LE TROU ÉTAIT STRUCTUREL.
     *
     * `lib/email-ramp.ts` coupait la FILE de `/outbox` : le chemin d'envoi
     * normal était borné, et lui seul. Les trois autres appelants de cette
     * route — revue de campagne, newsletter, recette — ne connaissaient que
     * le plafond horaire (40/h). Le palier du jour tenait donc par l'USAGE,
     * c'est-à-dire par la mémoire de celui qui envoie.
     *
     * C'est le défaut le plus fréquent de ce dépôt : une règle juste,
     * branchée à un seul endroit. Il est devenu structurant le jour où le
     * transactionnel et la prospection ont commencé à partager une seule
     * boîte (décision du 10/09/2026) — une campagne qui grille l'adresse fait
     * tomber les mails d'inscription avec elle.
     *
     * ══ POURQUOI 24 H GLISSANTES, ET PAS « AUJOURD'HUI » ══
     *
     * L'écran raisonne en jour calendaire : il masque les fiches déjà écrites
     * dans la journée. Le serveur compte sur 24 h GLISSANTES, et ce n'est pas
     * une divergence par négligence — c'est ce que mesure un fournisseur de
     * messagerie. Un jour calendaire autorise cinq envois à 23h59 et cinq à
     * 00h01 : dix messages en deux minutes depuis une boîte neuve, soit
     * exactement le schéma que les filtres cherchent.
     *
     * ══ CE QUE `force` NE FAIT PAS ══
     *
     * ⚠ Il ne passe PAS outre, comme pour le plafond horaire. `force` arbitre
     * des JUGEMENTS — le score anti-spam, la fenêtre de recontact. La
     * réputation d'un domaine n'en est pas un : elle ne se répare pas en
     * redéployant, et un opérateur pressé ne peut pas décider seul de la
     * dépenser.
     * ─────────────────────────────────────────────────────────────────────
     */
    const premierEnvoi = await firstSendAt("email", tenantId);
    const ramp = rampDepuisPremierEnvoi(premierEnvoi);
    const envoyes24h = await countRecentSends("email", 86_400_000, tenantId);
    if (envoyes24h >= ramp.today) {
      return NextResponse.json(
        {
          error:
            `Palier du jour atteint : ${envoyes24h}/${ramp.today} e-mails sur 24 h. ${ramp.why} ` +
            "Ce plafond protège la réputation de la boîte — il monte tout seul, semaine après semaine.",
          ramp: { today: ramp.today, sent: envoyes24h, weeks: ramp.weeks, next: ramp.next, daysToNext: ramp.daysToNext },
        },
        { status: 429, headers: { "retry-after": "3600" } }
      );
    }

    // Dédup durable « déjà contacté » : ne pas recontacter avant la fenêtre de
    // refroidissement (partagé entre instances via Supabase). force:true passe outre.
    const cooldownDays = Number(process.env.CONTACT_COOLDOWN_DAYS ?? 14);
    if (cooldownDays > 0 && !body.force) {
      const already = await contactedEmails([to], cooldownDays * 86_400_000, tenantId);
      if (already.has(to.toLowerCase())) {
        return NextResponse.json(
          { error: `Déjà contacté dans les ${cooldownDays} derniers jours — renvoie avec force:true si nécessaire.`, alreadyContacted: true },
          { status: 409 }
        );
      }
    }

    const subject = body.subject?.trim() || "(sans objet)";
    const base = baseUrlFrom(request);

    // Rendu HTML soigné + alternative texte (pied « Répondez STOP »).
    const emailOpts = {
      subject,
      body: body.body,
      closerName: habillage.closerName,
      addressLine: habillage.addressLine,
      ctaLabel: body.ctaLabel,
      ctaUrl: body.ctaUrl,
      /**
       * Logo aigle hébergé (PNG public, non gaté par le middleware) — mais
       * SEULEMENT sur le compte maître (`habillageEnvoi`). Il partait sur
       * tous les comptes : un email partenaire s'ouvrait sur NOTRE aigle. Sans
       * logo, le rendu retombe sur le monogramme de l'expéditeur
       * (`lib/email-html.ts`). Le jour où un revendeur fournit le sien, ça
       * se passe dans `lib/expediteur.ts`, pour l'aperçu comme pour l'envoi.
       */
      logoUrl: habillage.logoUrl,
    };
    const html = renderEmail(emailOpts);
    const text = plainText(emailOpts);

    /**
     * Les mentions obligatoires, vérifiées sur le texte RENDU — pas sur le
     * corps saisi. La différence n'est pas cosmétique : le pied « Répondez
     * STOP », la signature et l'adresse légale sont ajoutés par le rendu.
     * Contrôler `body.body` refuserait tous les emails du produit.
     */
    const manques = verifieMentions(text, habillage.closerName, marque);
    if (manques.length > 0) {
      return NextResponse.json(
        { error: "Mentions obligatoires manquantes — rien ne part.", manques, quoiFaire: QUOI_FAIRE_MENTIONS },
        { status: 422 }
      );
    }

    // Lint anti-spam — ne compter que les VRAIS liens de contenu (uniques,
    // hors désinscription ; le bouton « bulletproof » duplique son href).
    const lint = lintForSpam(subject, body.body, true, countContentLinks(html));
    if (lint.level === "risque" && !body.force) {
      return NextResponse.json(
        { error: "Score anti-spam élevé — corrige ou renvoie avec force:true.", lint },
        { status: 422 }
      );
    }

    // Injection tracking (ouvertures + clics).
    const { id: trackingId, html: trackedHtml } = await createTrackedEmail(html, base, {
      channel: "email",
      email: to,
      prospectId: body.prospectId,
      campaignId: body.campaignId,
      subject,
      userId: tenantId ?? undefined,
    });

    try {
      const nodemailer = (await import("nodemailer")).default;
      const port = Number(process.env.SMTP_PORT ?? 587);
      const transporter = nodemailer.createTransport({
        host: SMTP_HOST,
        port,
        secure: port === 465,
        auth: { user: SMTP_USER, pass: SMTP_PASS },
      });
      // List-Unsubscribe en mailto : le clic natif envoie un email STOP,
      // traité par le même flux entrant que « Répondez STOP ».
      const stopMailto = (SMTP_FROM ?? SMTP_USER)?.match(/<([^>]+)>/)?.[1] ?? SMTP_FROM ?? SMTP_USER;
      const info = await transporter.sendMail({
        from: SMTP_FROM ?? SMTP_USER,
        to,
        subject,
        text,
        html: trackedHtml,
        headers: deliverabilityHeaders(stopMailto),
        attachments: safeAttachments(body.attachments),
      });
      return NextResponse.json({ ok: true, id: info.messageId, trackingId, lint });
    } catch (e) {
      return NextResponse.json(
        { error: `Envoi email échoué : ${e instanceof Error ? e.message : "erreur inconnue"}` },
        { status: 502 }
      );
    }
  }

  if (body.channel === "sms") {
    const url = process.env.TEXTBELT_URL ?? "https://textbelt.com/text";
    const key = process.env.TEXTBELT_KEY;
    if (!key) {
      return NextResponse.json(
        { error: "SMS non configuré — renseigne TEXTBELT_KEY (et TEXTBELT_URL si auto-hébergé)." },
        { status: 503 }
      );
    }

    /**
     * ─────────────────────────────────────────────────────────────────────
     * LE SMS PARTAIT NU. C'EST LE TROU LE PLUS CHER DE CETTE ROUTE.
     *
     * L'email reçoit son pied « Répondez STOP », sa signature et son adresse
     * légale du RENDU (`lib/email-html.ts`). Le SMS, lui, partait tel quel :
     * `message: body.body`. Rien n'ajoutait de moyen de refus, rien ne
     * vérifiait qu'il y en avait un — donc un SMS de prospection partait sans
     * la seule mention qui n'est pas négociable.
     *
     * ⚠ ON NE L'AJOUTE PAS EN SILENCE, ON REFUSE. Deux raisons :
     *  · un SMS se paie au segment ; rallonger le texte du client sans le lui
     *    dire change son coût et peut couper sa phrase ;
     *  · c'est la doctrine de `lib/signature.ts` — masquer un trou le rend
     *    indétectable. On le montre, et on dit quoi écrire.
     *
     * ⚠⚠ ET `force` NE PASSE PAS OUTRE. `force` sert au score anti-spam et à
     * la fenêtre de recontact : deux jugements. Une mention obligatoire n'en
     * est pas un. Une garde qu'un booléen désarme n'est pas une garde — elle
     * fabrique juste la preuve qu'on savait.
     * ─────────────────────────────────────────────────────────────────────
     */
    const manquesSms = verifieMentions(body.body, habillage.closerName, marque);
    if (manquesSms.length > 0) {
      return NextResponse.json(
        { error: "Mentions obligatoires manquantes dans le SMS — rien ne part.", manques: manquesSms, quoiFaire: QUOI_FAIRE_MENTIONS },
        { status: 422 }
      );
    }

    try {
      const res = await fetch(url, {
        signal: AbortSignal.timeout(30_000),
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: body.to, message: body.body, key }),
      });
      const data = (await res.json()) as { success?: boolean; error?: string; textId?: string };
      if (!data.success) {
        return NextResponse.json({ error: `SMS refusé : ${data.error ?? "erreur inconnue"}` }, { status: 502 });
      }
      return NextResponse.json({ ok: true, id: data.textId });
    } catch (e) {
      return NextResponse.json(
        { error: `Envoi SMS échoué : ${e instanceof Error ? e.message : "erreur inconnue"}` },
        { status: 502 }
      );
    }
  }

  return NextResponse.json({ error: "channel invalide (email | sms)" }, { status: 400 });
}
