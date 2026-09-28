"use client";

import { useMemo, useState } from "react";
import {
  AlertTriangle,
  Check,
  ChevronDown,
  Copy,
  Handshake,
  Plus,
  Trash2,
  TrendingUp,
} from "lucide-react";
import { useAlpha } from "@/lib/store";
import {
  PARTNER_ARCHETYPES,
  archetypeById,
  partnerPotential,
  type PartnerArchetype,
} from "@/lib/prescripteurs";
import type { Partner, PartnerStatus } from "@/lib/types";
import { cn, eur, uid } from "@/lib/utils";
import { PageHeader } from "@/components/ui/page-header";

/**
 * Prescripteurs — le seul canal qui compose.
 *
 * Un prospect, tu le convaincs une fois et tu recommences le mois
 * suivant. Un prescripteur, tu le convaincs une fois et il te ramène des
 * affaires pendant des années.
 *
 * L'écran a deux moitiés : la MÉTHODE par archétype (comment on parle à
 * un expert-comptable, ce qui n'a rien à voir avec un vendeur de caisses)
 * et le SUIVI de ceux qu'on a approchés — dont la seule mesure qui
 * compte : les mises en relation reçues.
 */

const STATUS_META: Record<PartnerStatus, { label: string; tone: string }> = {
  identifie: { label: "Identifié", tone: "border-ink-600 text-paper-faint" },
  contacte: { label: "Contacté", tone: "border-ink-600 text-paper" },
  rdv: { label: "RDV", tone: "border-bronze-700 text-bronze-400" },
  accord: { label: "Accord", tone: "border-signal-amber/50 text-signal-amber" },
  actif: { label: "Actif", tone: "border-signal-green/50 text-signal-green" },
  dormant: { label: "Dormant", tone: "border-signal-red/50 text-signal-red" },
};

/** Au-delà, un accord qui n'a rien produit n'est plus un partenariat. */
const DORMANT_DAYS = 60;

export default function PrescripteursPage() {
  const { partners, settings, upsertPartner, deletePartner, addIntro, deleteIntro } = useAlpha();
  const [tab, setTab] = useState<"methode" | "suivi">("methode");
  const [openArch, setOpenArch] = useState<string | null>(PARTNER_ARCHETYPES[0].id);
  const [copied, setCopied] = useState("");
  const [openPartner, setOpenPartner] = useState<string | null>(null);

  const setup = settings.role === "team" ? 2000 : 1500;
  const monthly = 200;

  const copy = (id: string, text: string) => {
    void navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(""), 2000);
  };

  const addPartner = (a: PartnerArchetype) => {
    const now = new Date().toISOString();
    const p: Partner = {
      id: uid(),
      name: "",
      organisation: "Nouveau prescripteur",
      archetype: a.id,
      status: "identifie",
      city: "Lyon",
      intros: [],
      nextStep: null,
      notes: "",
      createdAt: now,
      updatedAt: now,
    };
    upsertPartner(p);
    setTab("suivi");
    setOpenPartner(p.id);
  };

  /** Un accord qui ne produit rien depuis 60 jours n'est pas un partenariat. */
  const stale = useMemo(
    () =>
      partners.filter((p) => {
        if (p.status !== "accord" && p.status !== "actif") return false;
        const last = p.intros[0]?.date ?? p.updatedAt;
        return Date.now() - new Date(last).getTime() > DORMANT_DAYS * 86_400_000;
      }),
    [partners]
  );

  const totals = useMemo(() => {
    const intros = partners.flatMap((p) => p.intros);
    return {
      partners: partners.length,
      actifs: partners.filter((p) => p.status === "actif").length,
      intros: intros.length,
      revenue: intros.reduce((s, i) => s + (i.revenue || 0), 0),
    };
  }, [partners]);

  return (
    <div className="page">
      <PageHeader
        eyebrow="Le seul canal qui compose"
        title="Prescripteurs"
        actions={
          <div className="flex flex-wrap items-center gap-4 font-mono text-[11px] uppercase tracking-[0.14em]">
            <span className="text-paper-faint">
              Actifs <b className="ml-1 font-display text-base text-signal-green">{totals.actifs}</b>/{totals.partners}
            </span>
            <span className="text-paper-faint">
              Mises en relation <b className="ml-1 font-display text-base text-paper">{totals.intros}</b>
            </span>
            <span className="text-paper-faint">
              Encaissé <b className="ml-1 font-display text-base text-bronze-400">{eur(totals.revenue)}</b>
            </span>
          </div>
        }
      />

      <section className="card p-4">
        <p className="text-[13px] text-paper">
          Un prospect, tu le convaincs une fois et tu recommences le mois suivant. Un prescripteur, tu le convaincs
          une fois et il te ramène des affaires pendant des années.
        </p>
        <p className="mt-1.5 text-[12px] text-paper-dim">
          <b className="text-paper">La faute qui tue ce canal :</b> approcher un prescripteur comme un prospect. Un
          expert-comptable n&apos;a pas de problème d&apos;appels manqués — il a un problème de valeur perçue et de
          risque relationnel. Lui parler de chiffre d&apos;affaires perdu ne produit rien : ce n&apos;est pas le sien.
        </p>
      </section>

      {stale.length > 0 && (
        <section className="card border-signal-red/50 p-4">
          <h2 className="flex items-center gap-2 font-display text-sm font-semibold text-signal-red">
            <AlertTriangle size={15} /> {stale.length} accord{stale.length > 1 ? "s" : ""} sans mise en relation
            depuis {DORMANT_DAYS} jours
          </h2>
          <p className="mt-1 text-[12px] text-paper">
            {stale.map((p) => p.organisation).join(", ")} — un accord signé qui dort vaut zéro. C&apos;est le piège
            classique du canal : on célèbre la signature du partenariat et personne ne rappelle. Reprends contact
            avec un prétexte concret, pas une relance.
          </p>
        </section>
      )}

      <div className="flex gap-1.5">
        {(
          [
            ["methode", "La méthode", Handshake],
            ["suivi", `Mes prescripteurs (${partners.length})`, TrendingUp],
          ] as const
        ).map(([k, label, Icon]) => (
          <button
            key={k}
            onClick={() => setTab(k)}
            className={cn(
              "flex items-center gap-2 rounded-full border px-4 py-2 text-sm transition-colors",
              tab === k
                ? "border-bronze-400/60 bg-bronze-900/60 font-medium text-bronze-300"
                : "border-ink-600 text-paper-faint hover:text-paper"
            )}
          >
            <Icon size={14} /> {label}
          </button>
        ))}
      </div>

      {tab === "methode" &&
        PARTNER_ARCHETYPES.map((a) => {
          const isOpen = openArch === a.id;
          const pot = partnerPotential(a, setup, monthly);
          return (
            <section key={a.id} className={cn("card overflow-hidden", isOpen && "border-bronze-700")}>
              <button
                className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
                onClick={() => setOpenArch(isOpen ? null : a.id)}
              >
                <span className="min-w-0">
                  <span className="block font-display text-sm font-bold text-paper">{a.label}</span>
                  <span className="block truncate text-[11px] text-paper-faint">{a.who}</span>
                </span>
                <span className="flex shrink-0 items-center gap-2">
                  <span className="chip border-ink-700 text-[10px] text-paper-faint">
                    {pot.clientsLow}–{pot.clientsHigh} clients/an
                  </span>
                  <ChevronDown size={16} className={cn("text-paper-faint transition-transform", isOpen && "rotate-180")} />
                </span>
              </button>

              {isOpen && (
                <div className="space-y-4 border-t border-ink-700 px-4 py-4">
                  <Block title="Ce qui le motive — dans SON ordre">
                    <ol className="space-y-1">
                      {a.motivations.map((m, i) => (
                        <li key={i} className="flex gap-2 text-[13px] text-paper">
                          <span className="mt-0.5 font-mono text-[11px] text-bronze-400">{i + 1}.</span>
                          {m}
                        </li>
                      ))}
                    </ol>
                  </Block>

                  <Block title="Sa peur — non traitée, elle bloque tout">
                    <p className="text-[13px] text-signal-amber">{a.fear}</p>
                  </Block>

                  <Block title="La structure de deal qui lui correspond">
                    <p className="text-[13px] text-paper">{a.deal.structure}</p>
                    <p className="mt-1 text-[12px] text-paper-dim">{a.deal.why}</p>
                  </Block>

                  <Block title="L'ouverture — mot pour mot">
                    <div className="flex items-start gap-2">
                      <p className="flex-1 rounded-lg border border-ink-700 bg-ink-850 p-3 text-[13px] italic text-paper">
                        {a.opener}
                      </p>
                      <button className="btn-ghost shrink-0 px-2.5 py-1.5 text-[12px]" onClick={() => copy(`o-${a.id}`, a.opener)}>
                        <Copy size={12} /> {copied === `o-${a.id}` ? "Copié ✓" : "Copier"}
                      </button>
                    </div>
                  </Block>

                  <Block title="Diagnostic — poser, puis se taire">
                    <ul className="space-y-1">
                      {a.diagnostic.map((q, i) => (
                        <li key={i} className="text-[13px] text-paper">— {q}</li>
                      ))}
                    </ul>
                  </Block>

                  <Block title="La demande — petite et concrète, jamais « un partenariat »">
                    <div className="flex items-start gap-2">
                      <p className="flex-1 rounded-lg border border-bronze-700 bg-ink-850 p-3 text-[13px] text-bronze-300">
                        {a.ask}
                      </p>
                      <button className="btn-ghost shrink-0 px-2.5 py-1.5 text-[12px]" onClick={() => copy(`a-${a.id}`, a.ask)}>
                        <Copy size={12} /> {copied === `a-${a.id}` ? "Copié ✓" : "Copier"}
                      </button>
                    </div>
                  </Block>

                  <Block title="Objections">
                    <ul className="space-y-2">
                      {a.objections.map((o, i) => (
                        <li key={i} className="rounded-lg border border-ink-700 bg-ink-850 p-3">
                          <p className="text-[12px] font-medium text-bronze-300">« {o.q} »</p>
                          <p className="mt-1 text-[13px] text-paper">{o.a}</p>
                        </li>
                      ))}
                    </ul>
                  </Block>

                  <Block title="Le potentiel — en fourchette, hypothèses visibles">
                    <p className="text-[13px] text-paper">
                      {pot.clientsLow} à {pot.clientsHigh} clients la première année ={" "}
                      <b className="text-bronze-400">{eur(pot.setupLow)} à {eur(pot.setupHigh)}</b> de setup, plus{" "}
                      <b className="text-bronze-400">{eur(pot.recurringLow)} à {eur(pot.recurringHigh)}/mois</b>.
                    </p>
                    <ul className="mt-1.5 space-y-0.5">
                      {pot.assumptions.map((h, i) => (
                        <li key={i} className="text-[11px] text-paper-faint">· {h}</li>
                      ))}
                    </ul>
                  </Block>

                  <button className="btn-bronze px-3 py-2 text-[13px]" onClick={() => addPartner(a)}>
                    <Plus size={14} /> Ajouter un {a.label.toLowerCase()} à suivre
                  </button>
                </div>
              )}
            </section>
          );
        })}

      {tab === "suivi" &&
        (partners.length === 0 ? (
          <p className="card px-4 py-8 text-center text-sm text-paper-faint">
            Aucun prescripteur suivi. Ouvre « La méthode », choisis un archétype, et ajoute le premier.
            <br />
            <span className="text-[12px]">Cinq prescripteurs valent 500 emails froids — et eux, ils composent.</span>
          </p>
        ) : (
          <ul className="space-y-2">
            {partners.map((p) => (
              <PartnerCard
                key={p.id}
                partner={p}
                open={openPartner === p.id}
                onToggle={() => setOpenPartner(openPartner === p.id ? null : p.id)}
                onPatch={(over) => upsertPartner({ ...p, ...over })}
                onDelete={() => deletePartner(p.id)}
                onAddIntro={(intro) => addIntro(p.id, intro)}
                onDeleteIntro={(introId) => deleteIntro(p.id, introId)}
              />
            ))}
          </ul>
        ))}
    </div>
  );
}

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-1.5 font-mono text-[10px] uppercase tracking-[0.16em] text-paper-faint">{title}</p>
      {children}
    </div>
  );
}

function PartnerCard({
  partner: p,
  open,
  onToggle,
  onPatch,
  onDelete,
  onAddIntro,
  onDeleteIntro,
}: {
  partner: Partner;
  open: boolean;
  onToggle: () => void;
  onPatch: (over: Partial<Partner>) => void;
  onDelete: () => void;
  onAddIntro: (intro: { date: string; company: string; revenue: number }) => void;
  onDeleteIntro: (introId: string) => void;
}) {
  const a = archetypeById(p.archetype);
  const [company, setCompany] = useState("");
  const [revenue, setRevenue] = useState("");
  const meta = STATUS_META[p.status];
  const earned = p.intros.reduce((s, i) => s + (i.revenue || 0), 0);

  return (
    <li className={cn("card p-4", open && "border-bronze-700")}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <button className="min-w-0 text-left" onClick={onToggle}>
          <p className="flex flex-wrap items-center gap-2 text-[14px] font-medium text-paper">
            {p.organisation}
            <span className={cn("chip text-[10px]", meta.tone)}>{meta.label}</span>
            {a && <span className="chip border-ink-700 text-[10px] text-paper-faint">{a.label}</span>}
          </p>
          <p className="mt-0.5 text-[11px] text-paper-faint">
            {p.name || "contact non nommé"} · {p.city} · {p.intros.length} mise
            {p.intros.length > 1 ? "s" : ""} en relation
            {earned > 0 && ` · ${eur(earned)} encaissés`}
          </p>
        </button>
        <div className="flex shrink-0 gap-2">
          <select
            className="input px-2 py-1.5 text-[12px]"
            value={p.status}
            onChange={(e) => onPatch({ status: e.target.value as PartnerStatus })}
          >
            {(Object.keys(STATUS_META) as PartnerStatus[]).map((s) => (
              <option key={s} value={s}>
                {STATUS_META[s].label}
              </option>
            ))}
          </select>
          <button className="btn-ghost px-2 py-1.5 text-[12px]" onClick={onToggle}>
            <ChevronDown size={13} className={cn("transition-transform", open && "rotate-180")} />
          </button>
        </div>
      </div>

      {open && (
        <div className="mt-3 space-y-3 border-t border-ink-700 pt-3">
          <div className="grid gap-2 sm:grid-cols-2">
            <Field label="Organisation">
              <input className="input w-full text-[13px]" value={p.organisation} onChange={(e) => onPatch({ organisation: e.target.value })} />
            </Field>
            <Field label="Contact">
              <input className="input w-full text-[13px]" placeholder="Prénom Nom" value={p.name} onChange={(e) => onPatch({ name: e.target.value })} />
            </Field>
            <Field label="Ville">
              <input className="input w-full text-[13px]" value={p.city} onChange={(e) => onPatch({ city: e.target.value })} />
            </Field>
            <Field label="Portefeuille annoncé (par LUI)">
              <input
                className="input w-full text-[13px]"
                type="number"
                placeholder="ex. 120"
                value={p.portfolio ?? ""}
                onChange={(e) => onPatch({ portfolio: e.target.value ? Number(e.target.value) : undefined })}
              />
            </Field>
          </div>

          <Field label="Ce qui a été convenu — en clair. Un accord flou ne produit rien.">
            <textarea
              className="input min-h-[70px] w-full text-[13px]"
              placeholder="ex. Il choisit 3 clients, je fais l'audit gratuit, il relit avant envoi. Commission non abordée."
              value={p.agreement ?? ""}
              onChange={(e) => onPatch({ agreement: e.target.value })}
            />
          </Field>

          {/* La seule mesure qui compte */}
          <div>
            <p className="mb-1.5 font-mono text-[10px] uppercase tracking-[0.16em] text-paper-faint">
              Mises en relation reçues — la seule mesure qui compte
            </p>
            <div className="flex flex-wrap gap-2">
              <input
                className="input flex-1 text-[13px]"
                placeholder="Entreprise présentée"
                value={company}
                onChange={(e) => setCompany(e.target.value)}
              />
              <input
                className="input w-32 text-[13px]"
                type="number"
                placeholder="€ encaissés"
                value={revenue}
                onChange={(e) => setRevenue(e.target.value)}
              />
              <button
                className="btn-bronze px-3 py-2 text-[13px]"
                disabled={!company.trim()}
                onClick={() => {
                  onAddIntro({ date: new Date().toISOString(), company: company.trim(), revenue: Number(revenue) || 0 });
                  setCompany("");
                  setRevenue("");
                }}
              >
                <Plus size={13} /> Ajouter
              </button>
            </div>
            {p.intros.length > 0 && (
              <ul className="mt-2 space-y-1">
                {p.intros.map((i) => (
                  <li key={i.id} className="flex items-center gap-2 rounded-lg border border-ink-700 bg-ink-850 px-3 py-2">
                    <Check size={12} className="shrink-0 text-signal-green" />
                    <span className="min-w-0 flex-1 truncate text-[13px] text-paper">{i.company}</span>
                    <span className="shrink-0 font-mono text-[12px] text-bronze-400">
                      {i.revenue > 0 ? eur(i.revenue) : "—"}
                    </span>
                    <span className="shrink-0 font-mono text-[11px] text-paper-faint">
                      {new Date(i.date).toLocaleDateString("fr-FR")}
                    </span>
                    <button className="btn-ghost shrink-0 px-1.5 py-1" onClick={() => onDeleteIntro(i.id)} aria-label="Retirer">
                      <Trash2 size={11} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-1.5 text-[11px] text-paper-faint">
              Le « € encaissé » ne se remplit que quand l&apos;argent est arrivé. Comme partout dans ALPHA : la
              promesse ne compte pas.
            </p>
          </div>

          <Field label="Notes">
            <textarea
              className="input min-h-[60px] w-full text-[13px]"
              value={p.notes}
              onChange={(e) => onPatch({ notes: e.target.value })}
            />
          </Field>

          <button className="btn-ghost px-2.5 py-1.5 text-[12px] text-signal-red" onClick={onDelete}>
            <Trash2 size={12} /> Retirer ce prescripteur
          </button>
        </div>
      )}
    </li>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-1 font-mono text-[10px] uppercase tracking-[0.16em] text-paper-faint">{label}</p>
      {children}
    </div>
  );
}
