"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  Check,
  Copy,
  ExternalLink,
  FlaskConical,
  Info,
  Mail,
  RefreshCw,
  Send,
} from "lucide-react";
import { useAlpha } from "@/lib/store";
import { emailRamp } from "@/lib/email-ramp";
import {
  buildOutbox,
  clipboardText,
  composeFitsInUrl,
  gmailComposeUrl,
  mailtoUrl,
  type ComposeDraft,
  type OutboxTarget,
} from "@/lib/mail-compose";
import { stageById } from "@/lib/hormozi";
import type { Prospect } from "@/lib/types";
import { cn } from "@/lib/utils";

const SENDER_KEY = "alpha_manual_sender";
const TEST_KEY = "alpha_manual_test_to";

/**
 * Boîte d'envoi manuelle — ALPHA rédige, tu envoies de ta main.
 *
 * Le même geste que la machine LinkedIn : l'app prépare le message
 * personnalisé, ouvre la fenêtre de rédaction pré-remplie, tu relis, tu
 * cliques « Envoyer » dans TA messagerie. Puis tu marques « Envoyé » ici,
 * et la touche entre dans le CRM.
 *
 * Aucun identifiant SMTP requis : utilisable immédiatement, sur
 * n'importe quelle adresse.
 */
export default function OutboxPage() {
  const { prospects, settings, addEvent, logActivity } = useAlpha();
  const [sender, setSender] = useState("");
  const [sent, setSent] = useState<Record<string, boolean>>({});
  const [drafts, setDrafts] = useState<Record<string, ComposeDraft>>({});
  const [copied, setCopied] = useState("");
  const [warn, setWarn] = useState<Record<string, string>>({});
  const [open, setOpen] = useState<string | null>(null);
  const [testTo, setTestTo] = useState("");
  const [testMsg, setTestMsg] = useState("");

  useEffect(() => {
    try {
      const saved = localStorage.getItem(SENDER_KEY) ?? "";
      setSender(saved);
      setTestTo(localStorage.getItem(TEST_KEY) ?? saved);
    } catch {
      /* stockage indisponible — le compte se choisira dans Gmail */
    }
  }, []);

  const changeSender = (v: string) => {
    setSender(v);
    try {
      localStorage.setItem(SENDER_KEY, v);
    } catch {
      /* idem */
    }
  };

  const ramp = useMemo(() => emailRamp(prospects), [prospects]);
  const targets = useMemo(
    () =>
      buildOutbox(prospects, ramp.today, {
        bookingUrl: settings.bookingUrl,
        closerName: settings.closerName,
        agencyName: settings.agencyName,
      }),
    [prospects, ramp.today, settings.bookingUrl, settings.closerName, settings.agencyName]
  );

  /**
   * Une fiche consignée sort de la file (elle a reçu un email aujourd'hui).
   * Si on la laissait disparaître, la carte s'évanouirait sous le curseur au
   * moment même du clic : aucun retour, et surtout aucun moyen de revenir en
   * arrière sur un « J'ai envoyé » cliqué par erreur. On la garde à l'écran
   * jusqu'au prochain chargement.
   */
  const [keep, setKeep] = useState<OutboxTarget[]>([]);
  const list = useMemo(() => {
    const live = new Set(targets.map((t) => t.prospect.id));
    return [...targets, ...keep.filter((k) => !live.has(k.prospect.id))];
  }, [targets, keep]);

  const draftFor = (id: string, fallback: ComposeDraft) => drafts[id] ?? fallback;
  const patch = (id: string, over: Partial<ComposeDraft>, base: ComposeDraft) =>
    setDrafts((d) => ({ ...d, [id]: { ...draftFor(id, base), ...over } }));

  /**
   * Enregistre le message côté serveur AVANT d'ouvrir la fenêtre : c'est
   * ce qui donne l'anti-doublon et les liens tracés. Si le serveur ne
   * répond pas, on ouvre quand même — le message compte plus que sa
   * télémétrie.
   */
  const prepare = async (id: string, d: ComposeDraft): Promise<ComposeDraft> => {
    try {
      const res = await fetch("/api/compose", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ to: d.to, subject: d.subject, body: d.body, prospectId: id }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "préparation impossible");
      if (json.alreadyContacted) {
        setWarn((w) => ({
          ...w,
          [id]: `Déjà contacté dans les ${json.cooldownDays} derniers jours — à toi de voir si c'est justifié.`,
        }));
      }
      return { ...d, body: json.body as string };
    } catch {
      setWarn((w) => ({ ...w, [id]: "Liens non tracés (serveur injoignable) — le message part quand même." }));
      return d;
    }
  };

  const openGmail = async (id: string, base: ComposeDraft) => {
    const d = await prepare(id, draftFor(id, base));
    const url = composeFitsInUrl(d, sender) ? gmailComposeUrl(d, sender) : null;
    if (!url) {
      void navigator.clipboard.writeText(clipboardText(d));
      setWarn((w) => ({ ...w, [id]: "Message trop long pour être pré-rempli — il est dans le presse-papier." }));
      window.open(gmailComposeUrl({ ...d, body: "" }, sender), "_blank", "noopener");
      return;
    }
    window.open(url, "_blank", "noopener");
  };

  const openMailto = async (id: string, base: ComposeDraft) => {
    const d = await prepare(id, draftFor(id, base));
    window.location.href = mailtoUrl(d);
  };

  const copy = async (id: string, base: ComposeDraft) => {
    const d = await prepare(id, draftFor(id, base));
    await navigator.clipboard.writeText(clipboardText(d));
    setCopied(id);
    setTimeout(() => setCopied(""), 2000);
  };

  /** La seule chose que l'app ne peut pas constater : que tu as cliqué Envoyer. */
  const markSent = (target: OutboxTarget, subject: string) => {
    const { id, company } = { id: target.prospect.id, company: target.prospect.company };
    setKeep((k) => (k.some((x) => x.prospect.id === id) ? k : [...k, target]));
    addEvent(id, {
      date: new Date().toISOString(),
      kind: "email",
      summary: `→ Email envoyé à la main : ${subject}`.slice(0, 200),
    });
    logActivity({ kind: "campagne", message: `Email manuel envoyé — ${company}`, prospectId: id });
    setSent((s) => ({ ...s, [id]: true }));
  };

  /**
   * Le test à soi-même. Il emprunte le brouillon de la première fiche —
   * texte identique, seule l'adresse change — et ne consigne RIEN : un
   * test n'est pas une touche, et le faire apparaître dans le CRM
   * fausserait le compte du jour comme les preuves.
   */
  const sendTest = async () => {
    const first = list[0];
    if (!first) return;
    const d = {
      ...draftFor(first.prospect.id, first.draft),
      to: testTo.trim(),
      subject: `[TEST] ${first.draft.subject}`,
    };
    try {
      localStorage.setItem(TEST_KEY, d.to);
    } catch {
      /* stockage indisponible */
    }
    if (!composeFitsInUrl(d, sender)) {
      await navigator.clipboard.writeText(clipboardText(d));
      setTestMsg("Message trop long pour l'URL — il est dans le presse-papier, colle-le dans Gmail.");
      return;
    }
    window.open(gmailComposeUrl(d, sender), "_blank", "noopener");
    setTestMsg(
      "Gmail est ouvert. Envoie, puis va lire le message dans ta boîte : le rendu, le dossier d'arrivée, et clique le lien s'il y en a un."
    );
  };

  const doneToday = Object.keys(sent).length;
  const demoCount = list.filter((t) => t.demo).length;

  return (
    <div className="space-y-4 animate-fade-up">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-bronze-400">
            ALPHA rédige · tu envoies de ta main
          </p>
          <h1 className="font-display text-2xl font-bold text-paper">Boîte d&apos;envoi</h1>
        </div>
        <div className="flex items-center gap-4 font-mono text-[11px] uppercase tracking-[0.14em]">
          <span className="text-paper-faint">
            Envoyés <b className="ml-1 font-display text-base text-signal-green">{doneToday}</b>
          </span>
          <span className="text-paper-faint">
            Palier du jour <b className="ml-1 font-display text-base text-paper">{ramp.today}</b>
          </span>
        </div>
      </header>

      {/* Le compte expéditeur — sinon Gmail rédige depuis le dernier compte utilisé */}
      <section className="card p-4">
        <label className="block font-mono text-[10px] uppercase tracking-[0.16em] text-paper-faint">
          Compte Gmail expéditeur
        </label>
        <input
          className="input mt-1.5 w-full max-w-md text-[13px]"
          placeholder="eagleyecorp.ad@gmail.com"
          value={sender}
          onChange={(e) => changeSender(e.target.value)}
        />
        <p className="mt-1.5 text-[11px] text-paper-faint">
          Sert à sélectionner le bon compte si plusieurs sessions Google sont ouvertes. Sans lui, Gmail rédige depuis
          le dernier compte utilisé — l&apos;erreur qu&apos;on ne remarque qu&apos;après.
        </p>
      </section>

      {/* Le premier test : se l'envoyer à soi-même. Personne d'autre. */}
      <section className="card border-bronze-700 p-4">
        <h2 className="flex items-center gap-2 font-display text-sm font-semibold text-paper">
          <FlaskConical size={15} className="text-bronze-400" /> Premier test — envoie-le-toi
        </h2>
        <p className="mt-1 text-[12px] text-paper-dim">
          Le premier message ne part jamais vers un prospect. Envoie-toi exactement ce que recevra ta cible : tu
          verras le rendu réel dans une boîte de réception, tu vérifieras qu&apos;il n&apos;atterrit pas en spam, et
          tu pourras cliquer le lien pour voir le clic remonter dans l&apos;app.
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <input
            className="input w-full max-w-xs text-[13px]"
            placeholder="ton adresse"
            value={testTo}
            onChange={(e) => setTestTo(e.target.value)}
          />
          <button
            className="btn-bronze px-3 py-2 text-[13px]"
            onClick={() => void sendTest()}
            disabled={!testTo.includes("@") || list.length === 0}
          >
            <ExternalLink size={14} /> M&apos;envoyer le message de test
          </button>
        </div>
        {testMsg && <p className="mt-2 text-[12px] text-paper-faint">{testMsg}</p>}
        <p className="mt-2 text-[11px] text-paper-faint">
          Le message reprend la première fiche de la file, avec son texte exact — seule l&apos;adresse change. Rien
          n&apos;est consigné au CRM : c&apos;est un test, pas une touche.
        </p>
      </section>

      {/* Ce que ce mode fait et ne fait pas — dit une fois, en haut */}
      <section className="card border-ink-700 p-4">
        <h2 className="flex items-center gap-2 font-display text-sm font-semibold text-paper">
          <Info size={15} className="text-bronze-400" /> Ce que fait ce mode, et ce qu&apos;il ne fait pas
        </h2>
        <ul className="mt-2 space-y-1 text-[12px] text-paper-dim">
          <li>
            <b className="text-paper">Aucun SMTP requis.</b> Le message part de ta boîte, de ta main, avec ton
            historique de conversation. Ce n&apos;est pas de l&apos;envoi en masse déguisé : c&apos;est de la
            correspondance, une par une.
          </li>
          <li>
            <b className="text-paper">Texte brut, volontairement.</b> Pour un premier contact, ça bat le HTML : ça
            ressemble à un humain qui écrit.
          </li>
          <li>
            <b className="text-paper">Les clics sont tracés</b>, l&apos;anti-doublon fonctionne. Les{" "}
            <b className="text-paper">ouvertures ne le sont pas</b> — un message sans image n&apos;a pas de pixel. On
            ne les invente pas.
          </li>
          <li>
            <b className="text-paper">Le palier reste le palier.</b> {ramp.why}
          </li>
        </ul>
      </section>

      {demoCount > 0 && (
        <section className="card border-signal-red/50 p-4">
          <h2 className="flex items-center gap-2 font-display text-sm font-semibold text-signal-red">
            <AlertTriangle size={15} /> {demoCount} fiche{demoCount > 1 ? "s" : ""} de démonstration dans la file —
            envoi bloqué
          </h2>
          <p className="mt-1.5 text-[12px] text-paper">
            Ces fiches portent des adresses <b>inventées</b> (Le Bouchon des Canuts, The Smoking Dog…). Écrire à
            l&apos;une d&apos;elles produit un rebond dur, et les rebonds comptent contre ton domaine pendant des
            mois. Sur une boîte qui démarre son historique d&apos;envoi, c&apos;est la pire première journée
            possible.
          </p>
          <p className="mt-1.5 text-[12px] text-paper-dim">
            Charge tes vraies fiches — <Link href="/settings" className="text-bronze-400 underline">Réglages →
            Données réelles → « Tout vider »</Link>, puis importe ton CSV. Les boutons d&apos;envoi se rallumeront
            tout seuls.
          </p>
        </section>
      )}

      {list.length === 0 ? (
        <EmptyOutbox prospects={prospects} done={doneToday} ramp={ramp.today} />
      ) : (
        <ul className="space-y-2">
          {list.map((target) => {
            const { prospect: p, draft: base, reason } = target;
            const d = draftFor(p.id, base);
            const isOpen = open === p.id;
            const isSent = sent[p.id];
            // Une adresse inventée ne doit pas pouvoir partir, même par
            // inadvertance : le coût d'un rebond est trop asymétrique pour
            // être laissé au jugement d'un opérateur pressé.
            const blocked = target.demo;
            return (
              <li
                key={p.id}
                className={cn("card p-4", isSent && "opacity-60", isOpen && "border-bronze-700")}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="flex items-center gap-2 text-[14px] font-medium text-paper">
                      {isSent && <Check size={14} className="shrink-0 text-signal-green" />}
                      {p.company}
                      <span className="chip border-ink-700 text-[10px] text-paper-faint">
                        {stageById(p.stage).label}
                      </span>
                      {target.demo && (
                        <span className="chip border-signal-red/50 text-[10px] text-signal-red">démo — adresse inventée</span>
                      )}
                    </p>
                    <p className="mt-0.5 truncate text-[11px] text-paper-faint">
                      {d.to} · {p.city} · {reason}
                    </p>
                  </div>
                  <button className="btn-ghost px-2.5 py-1.5 text-[12px]" onClick={() => setOpen(isOpen ? null : p.id)}>
                    {isOpen ? "Replier" : "Relire"}
                  </button>
                </div>

                {warn[p.id] && (
                  <p className="mt-2 flex items-start gap-1.5 text-[11px] text-signal-amber">
                    <AlertTriangle size={12} className="mt-0.5 shrink-0" /> {warn[p.id]}
                  </p>
                )}

                {isOpen && (
                  <div className="mt-3 space-y-2">
                    <input
                      className="input w-full text-[13px]"
                      value={d.subject}
                      onChange={(e) => patch(p.id, { subject: e.target.value }, base)}
                    />
                    <textarea
                      className="input min-h-[220px] w-full font-sans text-[13px] leading-relaxed"
                      value={d.body}
                      onChange={(e) => patch(p.id, { body: e.target.value }, base)}
                    />
                  </div>
                )}

                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    className="btn-bronze px-3 py-2 text-[13px]"
                    onClick={() => void openGmail(p.id, base)}
                    disabled={blocked}
                    title={blocked ? "Adresse de démonstration — inventée. Charge tes vraies fiches." : undefined}
                  >
                    <ExternalLink size={14} /> Ouvrir dans Gmail
                  </button>
                  <button
                    className="btn-ghost px-3 py-2 text-[13px]"
                    onClick={() => void openMailto(p.id, base)}
                    disabled={blocked}
                  >
                    <Mail size={13} /> Client mail
                  </button>
                  <button className="btn-ghost px-3 py-2 text-[13px]" onClick={() => void copy(p.id, base)}>
                    <Copy size={13} /> {copied === p.id ? "Copié ✓" : "Copier"}
                  </button>
                  <button
                    className={cn("px-3 py-2 text-[13px]", isSent ? "btn-ghost" : "btn-bronze")}
                    onClick={() => markSent(target, d.subject)}
                    disabled={isSent || blocked}
                  >
                    <Send size={13} /> {isSent ? "Consigné ✓" : "J'ai envoyé"}
                  </button>
                  <Link href={`/prospects/${p.id}`} className="btn-ghost px-3 py-2 text-[13px]">
                    Fiche <ArrowRight size={13} />
                  </Link>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <p className="flex items-start gap-1.5 px-1 text-[11px] text-paper-faint">
        <RefreshCw size={12} className="mt-0.5 shrink-0" />
        « J&apos;ai envoyé » est la seule chose que l&apos;app ne peut pas constater seule — clique-le, sinon la touche
        n&apos;existe pas et la fiche te sera reproposée demain.
      </p>
    </div>
  );
}

/**
 * File vide — DIRE POURQUOI.
 *
 * « Soit le palier est atteint, soit aucune fiche n'a d'email » : l'app
 * connaît la réponse, il n'y a aucune raison de laisser l'opérateur
 * deviner. Trois causes distinctes, trois diagnostics, et à chaque fois
 * l'action qui débloque — jamais un cul-de-sac.
 */
function EmptyOutbox({ prospects, done, ramp }: { prospects: Prospect[]; done: number; ramp: number }) {
  const actifs = prospects.filter((p) => p.stage !== "signe" && p.stage !== "perdu");
  const avecEmail = actifs.filter((p) => /^[^\s@]+@[^\s@]+\.[A-Za-z]{2,}$/.test((p.email ?? "").trim()));
  const avecTel = actifs.filter((p) => p.phone?.trim()).length;

  if (actifs.length === 0)
    return (
      <p className="card px-4 py-8 text-center text-sm text-paper-faint">
        Aucune fiche active. Le pipe est vide — c&apos;est le seul goulot que l&apos;outil ne peut pas lever.{" "}
        <Link href="/settings" className="text-bronze-400 hover:underline">
          Importer des fiches →
        </Link>
      </p>
    );

  if (avecEmail.length === 0)
    return (
      <section className="card border-signal-amber/40 p-4">
        <p className="flex items-start gap-2 text-[13px] text-paper">
          <AlertTriangle size={15} className="mt-0.5 shrink-0 text-signal-amber" />
          <span>
            <b>
              {actifs.length} fiches actives, aucune avec adresse email.
            </b>{" "}
            Ce canal ne peut rien faire aujourd&apos;hui — mais ce n&apos;est pas bloquant : {avecTel} d&apos;entre
            elles ont un téléphone, et l&apos;appel est le canal qui signe.
          </span>
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Link href="/appels" className="btn-bronze px-3 py-2 text-[13px]">
            Passer aux appels <ArrowRight size={13} />
          </Link>
          <Link href="/linkedin" className="btn-ghost px-3 py-2 text-[13px]">
            LinkedIn <ArrowRight size={13} />
          </Link>
          <Link href="/pipeline" className="btn-ghost px-3 py-2 text-[13px]">
            Compléter les emails <ArrowRight size={13} />
          </Link>
        </div>
      </section>
    );

  return (
    <p className="card px-4 py-8 text-center text-sm text-paper-faint">
      Palier du jour atteint : {done}/{ramp} envoyés. C&apos;est volontaire — au-delà, la réputation d&apos;envoi
      décroche.{" "}
      <Link href="/appels" className="text-bronze-400 hover:underline">
        Bascule sur les appels →
      </Link>
    </p>
  );
}
