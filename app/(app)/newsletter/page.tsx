"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, Eye, Loader2, Mail, Send, ShieldAlert, Users } from "lucide-react";
import { useAlpha } from "@/lib/store";
import { identiteEnvoi } from "@/lib/expediteur";
import type { Prospect, Sector } from "@/lib/types";
import { isDemoProspect } from "@/lib/seed";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/ui/page-header";

/**
 * Newsletter — le moteur du « tout le temps ».
 *
 * Une lettre régulière qui apporte une observation de terrain, sans rien
 * vendre, et dont le seul appel à l'action est : « voulez-vous l'audit de
 * votre accueil ? ». L'audit ne part JAMAIS d'office — il s'envoie
 * ensuite, depuis la fiche, quand la personne a dit oui.
 *
 * Différence avec les Campagnes : ici le contenu est IDENTIQUE pour tous
 * (une lettre), donc on le relit UNE fois et on confirme une fois. La
 * doctrine « rien ne part sans revue humaine » est respectée : tu vois
 * le rendu final et la liste exacte des destinataires avant d'envoyer.
 */

const SECTORS: { id: Sector | "tous"; label: string }[] = [
  { id: "tous", label: "Tous" },
  { id: "restaurant", label: "Restaurants" },
  { id: "pub", label: "Bars & pubs" },
  { id: "ambulance", label: "Ambulances" },
  { id: "artisan", label: "Artisans" },
  { id: "autre", label: "Autres" },
];

const DEFAULT_SUBJECT = "Ce que j'observe sur les accueils téléphoniques à Lyon";

const DEFAULT_BODY = `Bonjour {prenom},

Depuis quelques semaines, j'appelle des commerces et des cabinets lyonnais à des heures normales. Pas pour vendre : pour écouter ce qui se passe quand le téléphone sonne.

Ce que j'observe revient toujours au même endroit. Ce n'est pas que les gens répondent mal — c'est que personne n'est disponible au moment exact où le client appelle. Pendant le service, sur le chantier, en rendez-vous, entre midi et deux.

Et le client qui n'a personne au bout du fil ne rappelle pas. Il appelle le suivant. L'entreprise ne saura jamais qu'il a existé : aucune trace, aucun avis, aucune statistique. C'est une perte parfaitement invisible — c'est ce qui la rend dangereuse.

Je publie ici ce que je constate, métier par métier. C'est tout — je n'ai rien à vous vendre aujourd'hui.

Il m'arrive de préparer, pour une entreprise en particulier, un audit de son accueil téléphonique : ce qu'elle capte, ce qui lui échappe, et ce que ça représente sur un mois. Si un jour ça vous intéresse pour {commerce}, la porte est ouverte.

Zakaria — EAGLEYE CORP, Lyon`;

/**
 * La porte, jamais la demande. On n'ajoute aucune injonction à répondre :
 * le lien de réservation suffit — il rend le chemin visible sans rien
 * exiger. Sans lien configuré, la lettre se termine simplement.
 */
const withBooking = (text: string, url?: string) =>
  url?.trim()
    ? text.replace(
        "la porte est ouverte.",
        "la porte est ouverte — mon agenda est ici, au moment qui vous arrange :"
      )
    : text;

interface Result {
  sent: number;
  skipped: number;
  failed: number;
  errors: string[];
}

const fill = (t: string, p: Prospect) =>
  t
    .replaceAll("{prenom}", p.name?.split(" ")[0] || "bonjour")
    .replaceAll("{commerce}", p.company)
    .replaceAll("{ville}", p.city);

export default function NewsletterPage() {
  const { prospects, addEvent, logActivity, settings } = useAlpha();
  const [sector, setSector] = useState<Sector | "tous">("tous");
  const [city, setCity] = useState("");
  const [subject, setSubject] = useState(DEFAULT_SUBJECT);
  const [body, setBody] = useState(DEFAULT_BODY);
  const [preview, setPreview] = useState<{ html: string; lint: { level: string; warnings: string[] } } | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [sending, setSending] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<Result | null>(null);

  /**
   * L'audience : fiches avec email, filtrées.
   * Les désinscrits sont exclus par l'étape « perdu » — c'est le workflow
   * n8n alpha-inbound qui bascule une réponse STOP vers cette étape.
   *
   * ⚠ LES FICHES DE DÉMONSTRATION N'Y SONT PLUS. TROUVÉ EN SE SERVANT DU
   * PRODUIT : sur un store neuf, cet écran proposait « Envoyer à 4
   * destinataire(s) » — quatre adresses INVENTÉES
   * (contact@bouchondescanuts.fr et compagnie).
   *
   * La boîte d'envoi, elle, le refusait déjà, et sa propre explication dit
   * pourquoi : « Écrire à l'une d'elles produit un rebond dur, et les rebonds
   * comptent contre ton domaine pendant des mois. Sur une boîte qui démarre
   * son historique d'envoi, c'est la pire première journée possible. »
   *
   * Ici c'est PIRE qu'ailleurs, et c'est ce qui justifie d'exclure plutôt que
   * d'avertir : la newsletter part en LOT, d'un seul bouton. Il n'y a pas de
   * geste par fiche pendant lequel on pourrait se raviser — quatre rebonds
   * durs d'un coup, sur un domaine qui n'a aucun historique.
   */
  const demoExclues = useMemo(() => prospects.filter((p) => isDemoProspect(p.id) && p.email?.trim()).length, [prospects]);

  const audience = useMemo(
    () =>
      prospects
        .filter((p) => !isDemoProspect(p.id))
        .filter((p) => p.stage !== "perdu")
        .filter((p) => p.email?.trim())
        .filter((p) => (sector === "tous" ? true : p.sector === sector))
        .filter((p) => (city.trim() ? p.city.toLowerCase().includes(city.trim().toLowerCase()) : true)),
    [prospects, sector, city]
  );

  const loadPreview = async () => {
    setPreviewing(true);
    try {
      const sample = audience[0];
      const res = await fetch("/api/email/preview", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          subject: sample ? fill(subject, sample) : subject,
          body: withBooking(sample ? fill(body, sample) : body, settings.bookingUrl),
          ctaLabel: settings.bookingUrl?.trim() ? "Réserver 15 minutes" : undefined,
          ctaUrl: settings.bookingUrl?.trim() || undefined,
          // Même identité que l'envoi : un aperçu signé autrement ne prouve rien.
          ...identiteEnvoi(settings),
        }),
      });
      setPreview(await res.json());
    } catch {
      /* réseau indisponible */
    } finally {
      setPreviewing(false);
    }
  };

  const send = async () => {
    setSending(true);
    setConfirming(false);
    setProgress(0);
    const r: Result = { sent: 0, skipped: 0, failed: 0, errors: [] };

    for (let i = 0; i < audience.length; i++) {
      const p = audience[i];
      try {
        const res = await fetch("/api/send", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            channel: "email",
            // ⚠ QUI PARLE. Un humain a relu et cliqué : la divulgation IA serait
            // FAUSSE ici (`lib/signature-ia.ts`). Le champ est obligatoire côté
            // serveur, et son ABSENCE vaut « autonome » — donc un envoi
            // automatique qui l'oublie se fait refuser, jamais l'inverse.
            modeProduction: "valide-par-humain",
            to: p.email,
            subject: fill(subject, p),
            body: withBooking(fill(body, p), settings.bookingUrl),
            // Le bouton de réservation : c'est lui qui produit des RDV
            // pendant que tu es ailleurs.
            ctaLabel: settings.bookingUrl?.trim() ? "Réserver 15 minutes" : undefined,
            ctaUrl: settings.bookingUrl?.trim() || undefined,
            prospectId: p.id,
            campaignId: "newsletter",
            // Compte + signataire : la newsletter partait signée « EAGLEYE »
            // quel que soit le compte (`lib/expediteur.ts`).
            ...identiteEnvoi(settings),
          }),
        });
        const data = await res.json();
        if (res.ok) {
          r.sent++;
          addEvent(p.id, {
            date: new Date().toISOString(),
            kind: "email",
            summary: `Newsletter — ${fill(subject, p)}`,
          });
        } else if (res.status === 409 || data.alreadyContacted) {
          r.skipped++; // dédup « déjà contacté » : c'est une protection, pas une erreur
        } else {
          r.failed++;
          if (r.errors.length < 3) r.errors.push(`${p.company} : ${data.error ?? res.status}`);
          if (res.status === 429) {
            r.errors.push("Limite horaire atteinte — reprends l'envoi plus tard.");
            setProgress(i + 1);
            break;
          }
        }
      } catch {
        r.failed++;
        if (r.errors.length < 3) r.errors.push(`${p.company} : réseau indisponible`);
      }
      setProgress(i + 1);
    }

    logActivity({ kind: "campagne", message: `Newsletter envoyée — ${r.sent} destinataire(s), ${r.skipped} ignoré(s)` });
    setResult(r);
    setSending(false);
  };

  return (
    <div className="page">
      <PageHeader
        eyebrow="Le moteur du « tout le temps »"
        title="Newsletter"
        subtitle="Une observation de terrain, aucune vente. Le seul appel à l'action : « voulez-vous l'audit ? »"
      />

      {/* Audience */}
      <section className="card space-y-3 p-4">
        <p className="flex items-center gap-2 font-display text-sm font-bold text-paper">
          <Users size={15} className="text-bronze-400" /> Audience
          <span className="font-mono text-[12px] font-normal text-bronze-300">{audience.length} destinataire(s)</span>
        </p>

        {/* Ce qui a été retiré de la liste, et pourquoi — voir le commentaire
            sur `audience`. On le DIT : une audience qui rétrécit sans
            explication se lit comme un bug. */}
        {demoExclues > 0 && (
          <p className="flex items-start gap-2 rounded-lg border border-signal-amber/40 bg-signal-amber/5 px-2.5 py-2 text-[11.5px] leading-relaxed text-signal-amber">
            <AlertTriangle size={13} className="mt-0.5 shrink-0" />
            <span>
              {demoExclues} fiche(s) de <strong>démonstration</strong> retirées de l&apos;audience : leurs adresses sont
              inventées. Un lot de rebonds durs sur un domaine sans historique, c&apos;est la pire première journée
              possible — et la newsletter part d&apos;un seul bouton, sans geste par fiche pour se raviser.
              <span className="text-paper-faint">
                {" "}
                Charge tes vraies fiches (Réglages → Tout vider, puis importe ton CSV) et elles reviendront.
              </span>
            </span>
          </p>
        )}
        <div className="flex flex-wrap gap-1.5">
          {SECTORS.map((s) => (
            <button
              key={s.id}
              onClick={() => setSector(s.id)}
              className={cn(
                "chip transition-colors",
                s.id === sector ? "border-gold bg-gold font-semibold text-goldink" : "border-ink-600 text-paper-faint hover:text-paper"
              )}
            >
              {s.label}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <label className="label mb-0 shrink-0">Ville / quartier</label>
          <input className="input w-auto min-w-44" value={city} onChange={(e) => setCity(e.target.value)} placeholder="Lyon 6 (vide = tous)" />
          <p className="text-[11.5px] text-paper-faint">
            Fiches actives avec email, désinscrits exclus. Les déjà-contactés récents seront ignorés automatiquement.
          </p>
        </div>
      </section>

      {/* Composition */}
      <section className="card space-y-3 p-4">
        <p className="flex items-center gap-2 font-display text-sm font-bold text-paper">
          <Mail size={15} className="text-bronze-400" /> La lettre
        </p>
        <div>
          <label className="label">Objet</label>
          <input className="input" value={subject} onChange={(e) => setSubject(e.target.value)} />
        </div>
        <div>
          <label className="label">Corps — variables : {"{prenom} {commerce} {ville}"}</label>
          <textarea className="input min-h-[280px] font-body text-[13px] leading-relaxed" value={body} onChange={(e) => setBody(e.target.value)} />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button className="btn-ghost px-3 py-1.5 text-[12px]" onClick={loadPreview} disabled={previewing}>
            {previewing ? <Loader2 size={13} className="animate-spin" /> : <Eye size={13} />} Aperçu réel
          </button>
          {preview && (
            <span
              className={cn(
                "chip",
                preview.lint.level === "ok"
                  ? "border-signal-green/40 text-signal-green"
                  : preview.lint.level === "risque"
                    ? "border-signal-red/50 text-signal-red"
                    : "border-bronze-700 text-bronze-400"
              )}
              title={preview.lint.warnings.join(" · ")}
            >
              <ShieldAlert size={11} /> anti-spam : {preview.lint.level}
            </span>
          )}
        </div>
        {preview && (
          <iframe title="aperçu newsletter" sandbox="" srcDoc={preview.html} className="h-96 w-full rounded-xl border border-ink-700 bg-white" />
        )}
      </section>

      {/* Envoi */}
      <section className="card space-y-3 p-4">
        {!confirming && !sending && !result && (
          <button className="btn-bronze" onClick={() => setConfirming(true)} disabled={audience.length === 0 || !subject.trim() || !body.trim()}>
            <Send size={15} /> Envoyer à {audience.length} destinataire(s)
          </button>
        )}

        {confirming && (
          <div className="space-y-3 rounded-xl border border-bronze-700/60 bg-bronze-900/20 p-4">
            <p className="flex items-center gap-2 font-display text-sm font-bold text-paper">
              <AlertTriangle size={15} className="text-bronze-400" /> Dernière vérification
            </p>
            <p className="text-[13px] leading-relaxed text-paper-dim">
              Tu vas envoyer <strong className="text-paper">« {subject} »</strong> à <strong className="text-paper">{audience.length} destinataire(s)</strong>.
              Chaque email part avec le pied RGPD, le lien de désinscription STOP et le tracking. L&apos;audit n&apos;est joint à aucun d&apos;eux —
              il partira depuis la fiche, quand la personne aura répondu.
            </p>
            <div className="max-h-32 overflow-y-auto rounded-lg border border-ink-700 bg-ink-900 p-2.5 font-mono text-[11px] text-paper-faint">
              {audience.map((p) => (
                <div key={p.id}>{p.company} — {p.email}</div>
              ))}
            </div>
            <div className="flex gap-2">
              <button className="btn-bronze" onClick={send}>
                <Send size={15} /> Confirmer l&apos;envoi
              </button>
              <button className="btn-ghost" onClick={() => setConfirming(false)}>
                Annuler
              </button>
            </div>
          </div>
        )}

        {sending && (
          <div className="space-y-2">
            <p className="flex items-center gap-2 text-[13px] text-paper">
              <Loader2 size={14} className="animate-spin text-bronze-400" /> Envoi en cours — {progress}/{audience.length}
            </p>
            <div className="h-1.5 overflow-hidden rounded-full bg-ink-800">
              <div className="h-full rounded-full bg-bronze-400 transition-all" style={{ width: `${(progress / Math.max(1, audience.length)) * 100}%` }} />
            </div>
          </div>
        )}

        {result && (
          <div className="space-y-2">
            <p className="flex items-center gap-2 font-display text-sm font-bold text-paper">
              <CheckCircle2 size={15} className="text-signal-green" /> Envoi terminé
            </p>
            <p className="text-[13px] text-paper-dim">
              <strong className="text-signal-green">{result.sent} envoyé(s)</strong>
              {result.skipped > 0 && <> · {result.skipped} ignoré(s) (déjà contactés récemment)</>}
              {result.failed > 0 && <> · <span className="text-signal-red">{result.failed} en échec</span></>}
            </p>
            {result.errors.length > 0 && (
              <ul className="space-y-0.5 text-[12px] text-signal-red">
                {result.errors.map((e, i) => (
                  <li key={i}>⚠ {e}</li>
                ))}
              </ul>
            )}
            <button className="btn-ghost" onClick={() => { setResult(null); setProgress(0); }}>
              Préparer une autre lettre
            </button>
          </div>
        )}
      </section>

      <p className="text-center text-[11px] text-paper-faint">
        Chaque envoi est tracké et consigné dans la fiche. Une réponse « AUDIT » ? Ouvre la fiche → onglet Audit → joins le cadeau.
      </p>
    </div>
  );
}
