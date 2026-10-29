"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, CalendarClock, CalendarPlus, Check, CircleDashed, KeyRound, Power, Rocket, X } from "lucide-react";
import { useAlpha } from "@/lib/store";
import { useMaitreProuve } from "@/lib/use-droits";
import { PageHeader } from "@/components/ui/page-header";
import { cn } from "@/lib/utils";
import { libelleNaf, proposerActivites } from "@/lib/naf";
import { agendaMasque, cleMasquee, enregistrerAdresseAgenda, enregistrerCleDropcontact, lireAdresseAgenda, lireCleDropcontact } from "@/lib/cle-locale";
import { adresseAgenda, lireReponseAgenda, type EtatAgenda } from "@/lib/agenda-occupe";
import { meetingToIcs } from "@/lib/ics";
import { labelCreneau } from "@/lib/creneaux-rdv";
import type { MeetingChannel } from "@/lib/types";
import type { TailleCible } from "@/lib/trouver-clients";
import {
  ETAT_AUTOPILOTE_VIDE, REGLAGES_AUTOPILOTE_DEFAUT, aContacter, envoisAlpha24h, nb, planifier, preRequis,
  type ReglagesAutopilote, type TypeJournal,
} from "@/lib/autopilote-inscrit";
import { aEnrichir } from "@/lib/enrichissement";
import { TAG_A_TRAITER } from "@/lib/reponses-inscrit";

/**
 * ─────────────────────────────────────────────────────────────────────
 * LE PILOTE AUTOMATIQUE — un interrupteur, ce qui manque, ce qui se passe.
 *
 * Le moteur tourne dans la coquille (`components/autopilote/moteur-autopilote.tsx`) ;
 * cet écran le RÈGLE et le MONTRE. Ordre voulu : l'interrupteur, puis ce qui
 * manque (et ce que chaque manque coupe), puis ce qui attend, puis le journal.
 * Un pilote qui ne dit pas pourquoi il ne fait rien ressemble à un pilote en
 * panne.
 * ─────────────────────────────────────────────────────────────────────
 */

const TAILLES: { id: TailleCible; libelle: string }[] = [
  { id: "toutes", libelle: "Toutes tailles" },
  { id: "employeur", libelle: "Au moins 1 salarié" },
  { id: "10-plus", libelle: "10 salariés et plus" },
  { id: "50-plus", libelle: "50 salariés et plus" },
];

const ICONE: Record<TypeJournal, string> = {
  cherche: "Cherche",
  enrichit: "Coordonnées",
  ecrit: "Écrit",
  relance: "Relance",
  lit: "Lit",
  repond: "Répond",
  rdv: "Rendez-vous",
  escalade: "À toi",
  pause: "Pause",
  erreur: "Bloqué",
};

export default function AutopilotePage() {
  const { settings, patchSettings, prospects, meetings } = useAlpha();
  const maitre = useMaitreProuve();
  const reglages: ReglagesAutopilote = { ...REGLAGES_AUTOPILOTE_DEFAUT, ...(settings.autopilote?.reglages ?? {}) };
  const etat = { ...ETAT_AUTOPILOTE_VIDE, ...(settings.autopilote?.etat ?? {}) };

  const [boite, setBoite] = useState(false);
  const [cle, setCle] = useState("");
  const [saisieCle, setSaisieCle] = useState("");
  const [saisieMetier, setSaisieMetier] = useState(settings.profil?.cibleSecteur ?? "");
  const [agenda, setAgenda] = useState("");
  const [saisieAgenda, setSaisieAgenda] = useState("");
  const [lectureAgenda, setLectureAgenda] = useState<EtatAgenda | "en-cours" | null>(null);
  const [maintenant, setMaintenant] = useState(() => new Date());

  useEffect(() => {
    setCle(lireCleDropcontact());
    setAgenda(lireAdresseAgenda());
  }, []);
  // La même lecture que celle du pilote (`/api/agenda`) : ce que l'écran annonce est ce qu'il utilisera.
  const verifierAgenda = async (url: string) => {
    setLectureAgenda("en-cours");
    try {
      const res = await fetch("/api/agenda", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ url }) });
      setLectureAgenda(lireReponseAgenda(await res.json().catch(() => null), res.status));
    } catch {
      setLectureAgenda({ etat: "non-lu", raison: "réseau indisponible" });
    }
  };
  useEffect(() => {
    const id = setInterval(() => setMaintenant(new Date()), 30_000);
    return () => clearInterval(id);
  }, []);
  useEffect(() => {
    if (maitre) return setBoite(true);
    fetch("/api/credentials")
      .then((r) => r.json())
      .then((j: { cles?: Record<string, { verifieLe?: string | null }> }) => setBoite(Boolean(j.cles?.email?.verifieLe)))
      .catch(() => setBoite(false));
  }, [maitre]);

  const regler = (patch: Partial<ReglagesAutopilote>) => patchSettings({ autopilote: { reglages: { ...reglages, ...patch }, etat } });

  const manques = preRequis({ metier: settings.profil?.metier ?? "", reglages, boite, cleDropcontact: Boolean(cle), bookingUrl: settings.bookingUrl });
  const plan = useMemo(
    () => planifier(prospects, { ...reglages, actif: true }, etat, { boite, cleDropcontact: Boolean(cle) }, maintenant),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [prospects, settings.autopilote, boite, cle, maintenant]
  );
  const propositions = useMemo(() => proposerActivites(saisieMetier, 6), [saisieMetier]);
  const prets = aContacter(prospects, maintenant).length;
  const aJoindre = prospects.filter(aEnrichir).length;
  const envoyes = envoisAlpha24h(prospects, maintenant);
  const aToi = prospects.filter((p) => (p.tags ?? []).includes(TAG_A_TRAITER) && p.stage !== "perdu" && p.stage !== "signe");
  const rdvAlpha = meetings.filter((m) => !m.done && prospects.find((p) => p.id === m.prospectId)?.events.some((e) => e.summary.startsWith("Rendez-vous posé par ALPHA")));

  return (
    <div className="page">
      <PageHeader
        eyebrow="ALPHA fait toute la chaîne"
        icon={<Rocket size={22} className="text-bronze-400" />}
        title="Pilote automatique"
        subtitle="ALPHA trouve tes clients, obtient leurs coordonnées, leur écrit, lit leurs réponses et pose les rendez-vous dans ton agenda. Tu ne reviens que pour le prix, la signature et le doute."
      />

      <section className={cn("card flex flex-wrap items-center justify-between gap-4 p-5", reglages.actif && "ring-1 ring-bronze-600")}>
        <div className="min-w-0">
          <p className="font-display text-lg font-bold text-paper">{reglages.actif ? "ALPHA travaille." : "ALPHA est à l'arrêt."}</p>
          <p className="text-[13px] text-paper-dim">
            {reglages.actif
              ? "Un passage toutes les trois minutes, tant qu'un onglet d'ALPHA est ouvert — à côté de ton travail, pas pendant ta nuit."
              : "Il ne fait rien tant que tu ne le lances pas. Tu peux l'arrêter à tout moment, d'un clic."}
          </p>
        </div>
        <button type="button" className={reglages.actif ? "btn-ghost" : "btn-bronze"} onClick={() => regler({ actif: !reglages.actif })}>
          <Power size={16} /> {reglages.actif ? "Arrêter ALPHA" : "Lancer ALPHA"}
        </button>
      </section>

      {maitre && (
        <p className="card flex gap-2 p-4 text-[13px] text-signal-amber">
          <AlertTriangle size={16} className="mt-0.5 shrink-0" />
          Compte maître : ici, ALPHA écrit sur « Ce que tu vends », pas sur l&apos;escalier de nos offres. L&apos;autopilote SERVEUR (Pilote) travaille déjà sur le pipe du serveur : n&apos;active pas les deux sur les mêmes fiches — `/api/send` refuserait le doublon, mais le journal serait faux.
        </p>
      )}

      <section className="card space-y-3 p-5">
        <h2 className="font-display text-base font-bold text-paper">Ce qu&apos;il lui faut</h2>
        <ul className="space-y-2">
          {manques.map((m) => (
            <li key={m.id} className="panel flex gap-3 px-4 py-3 text-[13px]">
              {m.ok ? <Check size={16} className="mt-0.5 shrink-0 text-signal-green" /> : <CircleDashed size={16} className="mt-0.5 shrink-0 text-signal-amber" />}
              <div className="min-w-0">
                <p className="font-semibold text-paper">{m.libelle}</p>
                {!m.ok && <p className="text-paper-dim">{m.manque}</p>}
                {/* Une ligne remplie ne répète pas ce qui lui manquerait : seule la note des rendez-vous reste une information. */}
                {m.ok && m.id === "rdv" && m.manque && <p className="text-paper-faint">{m.manque}</p>}
              </div>
            </li>
          ))}
        </ul>
        {!manques.find((m) => m.id === "boite")?.ok && (
          <Link href="/settings" className="inline-block text-[13px] text-bronze-400 hover:underline">
            Brancher ma boîte email →
          </Link>
        )}
      </section>

      <section className="card space-y-4 p-5">
        <h2 className="font-display text-base font-bold text-paper">Qui il cherche</h2>
        <div>
          <label htmlFor="metier-ap" className="text-sm font-semibold text-paper">Le métier de tes clients</label>
          <input id="metier-ap" className="input mt-2 w-full" placeholder="plombiers, agences immobilières, dentistes…" value={saisieMetier} onChange={(e) => setSaisieMetier(e.target.value)} />
          {propositions.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-2">
              {propositions.map((p) => {
                const deja = p.codes.every((c) => reglages.activites.includes(c));
                return (
                  <button
                    key={p.codes.join(",")}
                    type="button"
                    disabled={deja}
                    className={cn("chip text-[12px]", deja ? "border-ink-700 text-paper-faint" : "border-bronze-700 text-bronze-300")}
                    onClick={() => regler({ activites: [...new Set([...reglages.activites, ...p.codes])] })}
                  >
                    {deja ? <Check size={12} /> : "+"} {p.libelle}
                  </button>
                );
              })}
            </div>
          )}
          {reglages.activites.length > 0 && (
            <ul className="mt-3 space-y-1.5">
              {reglages.activites.map((c) => (
                <li key={c} className="panel flex items-center justify-between gap-3 px-3 py-2 text-sm">
                  <span className="min-w-0">
                    <span className="font-mono text-[11px] text-bronze-400">{c}</span> <span className="text-paper">{libelleNaf(c)}</span>
                  </span>
                  <button type="button" aria-label={`Retirer ${c}`} className="text-paper-faint hover:text-paper" onClick={() => regler({ activites: reglages.activites.filter((x) => x !== c) })}>
                    <X size={14} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="zone-ap" className="text-sm font-semibold text-paper">Où</label>
            <input id="zone-ap" className="input mt-2 w-full" placeholder="69 · ou 69003, 69006" value={reglages.zone} onChange={(e) => regler({ zone: e.target.value })} />
          </div>
          <div>
            <label htmlFor="taille-ap" className="text-sm font-semibold text-paper">Taille</label>
            <select id="taille-ap" className="input mt-2 w-full" value={reglages.taille} onChange={(e) => regler({ taille: e.target.value as TailleCible })}>
              {TAILLES.map((t) => (
                <option key={t.id} value={t.id}>{t.libelle}</option>
              ))}
            </select>
          </div>
        </div>
      </section>

      <section className="card space-y-4 p-5">
        <h2 className="font-display text-base font-bold text-paper">Ses moyens</h2>
        <div>
          <p className="flex items-center gap-2 text-sm font-semibold text-paper">
            <KeyRound size={14} className="text-bronze-400" /> Clé Dropcontact {cle && <span className="font-mono text-[11px] text-paper-faint">{cleMasquee(cle)}</span>}
          </p>
          <p className="mt-1 text-[12px] text-paper-faint">
            Elle reste dans ce navigateur : les recherches partent d&apos;ici vers Dropcontact, jamais par nos serveurs. Tu ne paies que les emails trouvés.
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            <input className="input min-w-0 flex-1" type="password" autoComplete="off" placeholder={cle ? "Remplacer la clé" : "Colle ta clé API Dropcontact"} value={saisieCle} onChange={(e) => setSaisieCle(e.target.value)} />
            <button
              type="button"
              className="btn-ghost"
              disabled={!saisieCle.trim()}
              onClick={() => {
                if (enregistrerCleDropcontact(saisieCle)) setCle(lireCleDropcontact());
                setSaisieCle("");
              }}
            >
              Enregistrer
            </button>
            {cle && (
              <button type="button" className="btn-ghost" onClick={() => enregistrerCleDropcontact("") && setCle("")}>
                Retirer
              </button>
            )}
          </div>
        </div>
        <div>
          <p className="flex items-center gap-2 text-sm font-semibold text-paper">
            <CalendarClock size={14} className="text-bronze-400" /> Ton agenda {agenda && <span className="font-mono text-[11px] text-paper-faint">{agendaMasque(agenda)}</span>}
          </p>
          <p className="mt-1 text-[12px] text-paper-faint">
            ALPHA ne propose que des créneaux libres dans ton agenda. Colle son adresse secrète : dans Google Agenda, paramètres de l&apos;agenda,
            « adresse secrète au format iCal » ; dans Outlook, publie ton calendrier en « disponibilités seulement ». Il transite par notre serveur à
            chaque lecture sans y être gardé, et seules les plages occupées reviennent ici — jamais un titre.
            {!agenda && " Sans lui, ALPHA n'évite que les rendez-vous qu'il a posés lui-même."}
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            <input
              className="input min-w-0 flex-1"
              type="password"
              autoComplete="off"
              placeholder={agenda ? "Remplacer l'adresse" : "https://… ou webcal://…"}
              value={saisieAgenda}
              onChange={(e) => setSaisieAgenda(e.target.value)}
            />
            <button
              type="button"
              className="btn-ghost"
              disabled={!adresseAgenda(saisieAgenda)}
              onClick={() => {
                const url = adresseAgenda(saisieAgenda);
                if (url && enregistrerAdresseAgenda(url)) {
                  setAgenda(url);
                  void verifierAgenda(url);
                }
                setSaisieAgenda("");
              }}
            >
              Enregistrer
            </button>
            {agenda && (
              <>
                <button type="button" className="btn-ghost" disabled={lectureAgenda === "en-cours"} onClick={() => void verifierAgenda(agenda)}>
                  Vérifier
                </button>
                <button
                  type="button"
                  className="btn-ghost"
                  onClick={() => {
                    if (enregistrerAdresseAgenda("")) {
                      setAgenda("");
                      setLectureAgenda(null);
                    }
                  }}
                >
                  Retirer
                </button>
              </>
            )}
          </div>
          {saisieAgenda.trim() && !adresseAgenda(saisieAgenda) && (
            <p className="mt-1 text-[12px] text-signal-amber">L&apos;adresse doit commencer par https:// ou webcal://.</p>
          )}
          {lectureAgenda === "en-cours" && <p className="mt-1 text-[12px] text-paper-faint">ALPHA lit ton agenda…</p>}
          {lectureAgenda && lectureAgenda !== "en-cours" && lectureAgenda.etat === "lu" && (
            <p className="mt-1 text-[12px] text-signal-green">
              Lu : {nb(lectureAgenda.plages.length, "plage occupée", "plages occupées")} sur les 30 prochains jours
              {lectureAgenda.approximes > 0 && ` (dont ${nb(lectureAgenda.approximes, "série bloquée", "séries bloquées")} par prudence : règle que je ne sais pas déplier exactement)`}.
            </p>
          )}
          {lectureAgenda && lectureAgenda !== "en-cours" && lectureAgenda.etat === "non-lu" && (
            <p className="mt-1 text-[12px] text-signal-amber">
              Non lu : {lectureAgenda.raison.replace(/[.!]?$/, ".")} Tant qu&apos;il ne l&apos;est pas, ALPHA te passe la main au lieu de proposer des heures.
            </p>
          )}
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <label htmlFor="envois-ap" className="text-sm font-semibold text-paper">Premiers messages / jour</label>
            <input id="envois-ap" type="number" min={1} max={40} className="input mt-2 w-full" value={reglages.envoisParJour} onChange={(e) => regler({ envoisParJour: Math.max(1, Math.min(40, Number(e.target.value) || 1)) })} />
            <p className="mt-1 text-[11px] text-paper-faint">Ta boîte a son propre plafond (5/jour la première semaine) : c&apos;est lui qui gagne.</p>
          </div>
          <div>
            <label htmlFor="enrich-ap" className="text-sm font-semibold text-paper">Recherches de coordonnées / jour</label>
            <input id="enrich-ap" type="number" min={0} max={250} className="input mt-2 w-full" value={reglages.enrichissementsParJour} onChange={(e) => regler({ enrichissementsParJour: Math.max(0, Math.min(250, Number(e.target.value) || 0)) })} />
          </div>
          <div>
            <label htmlFor="canal-ap" className="text-sm font-semibold text-paper">Rendez-vous</label>
            <select id="canal-ap" className="input mt-2 w-full" value={reglages.canalRdv} onChange={(e) => regler({ canalRdv: e.target.value as MeetingChannel })}>
              <option value="visio">En visio</option>
              <option value="appel">Par téléphone</option>
              <option value="physique">Sur place</option>
            </select>
          </div>
        </div>
        <div>
          <label htmlFor="imap-ap" className="text-sm font-semibold text-paper">Serveur de lecture (IMAP) — seulement si ALPHA te le demande</label>
          <input id="imap-ap" className="input mt-2 w-full" placeholder="imap.ton-hebergeur.fr" value={reglages.imapHost ?? ""} onChange={(e) => regler({ imapHost: e.target.value.trim() || undefined })} />
        </div>
      </section>

      <section className="card space-y-3 p-5">
        <h2 className="font-display text-base font-bold text-paper">Où il en est</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            ["Prêtes à recevoir un message", prets],
            ["À joindre (coordonnées)", aJoindre],
            ["Envoyés en 24 h", envoyes],
            ["Rendez-vous posés", rdvAlpha.length],
          ].map(([l, n]) => (
            <div key={String(l)} className="panel px-3 py-2">
              <p className="font-display text-xl font-bold text-paper">{n}</p>
              <p className="text-[11px] text-paper-faint">{l}</p>
            </div>
          ))}
        </div>
        {plan.attentes.length > 0 && (
          <ul className="space-y-1 text-[13px] text-paper-dim">
            {plan.attentes.map((a) => (
              <li key={a} className="flex gap-2">
                <AlertTriangle size={14} className="mt-0.5 shrink-0 text-signal-amber" /> {a}
              </li>
            ))}
          </ul>
        )}
        {aToi.length > 0 && (
          <div className="panel space-y-1 px-4 py-3 text-[13px]">
            <p className="font-semibold text-paper">À toi ({aToi.length}) — le prix, la signature ou le doute</p>
            {aToi.slice(0, 8).map((p) => (
              <Link key={p.id} href={`/prospects/${p.id}`} className="block text-bronze-400 hover:underline">
                {p.company} — {p.nextStep?.action ?? "lire sa réponse"}
              </Link>
            ))}
          </div>
        )}
        {rdvAlpha.length > 0 && (
          <div className="space-y-1.5">
            {rdvAlpha.slice(0, 8).map((m) => {
              const p = prospects.find((x) => x.id === m.prospectId);
              return (
                <a
                  key={m.id}
                  className="panel flex items-center justify-between gap-3 px-4 py-2 text-[13px] hover:text-paper"
                  download={`rendez-vous-${m.id}.ics`}
                  href={`data:text/calendar;charset=utf-8,${encodeURIComponent(meetingToIcs(m, p))}`}
                >
                  <span className="min-w-0 text-paper">{p?.company} · {labelCreneau(new Date(m.date))}</span>
                  <span className="inline-flex shrink-0 items-center gap-1 text-bronze-400"><CalendarPlus size={14} /> Mon agenda</span>
                </a>
              );
            })}
          </div>
        )}
      </section>

      <section className="card space-y-2 p-5">
        <h2 className="font-display text-base font-bold text-paper">Journal</h2>
        {etat.journal.length === 0 ? (
          <p className="text-[13px] text-paper-faint">Rien encore. Le journal se remplit dès le premier passage.</p>
        ) : (
          <ul className="space-y-1.5">
            {etat.journal.slice(0, 40).map((e, i) => (
              <li key={`${e.le}-${i}`} className="flex gap-3 text-[13px]">
                <span className="w-24 shrink-0 font-mono text-[11px] text-paper-faint">{new Date(e.le).toLocaleString("fr-FR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}</span>
                <span className={cn("w-24 shrink-0 text-[11px] font-semibold uppercase tracking-wide", e.type === "erreur" || e.type === "escalade" ? "text-signal-amber" : e.type === "rdv" ? "text-signal-green" : "text-bronze-400")}>
                  {ICONE[e.type]}
                </span>
                <span className="min-w-0 text-paper-dim">{e.texte}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="card space-y-1 p-5 text-[13px] text-paper-dim">
        <h2 className="font-display text-base font-bold text-paper">Ce qu&apos;il ne fera jamais</h2>
        <p>Parler du prix, faire signer ou répondre à un doute : ces réponses te reviennent, avec leur raison.</p>
        <p>Proposer une heure prise dans ton agenda : s&apos;il ne peut pas le lire, il te passe la main.</p>
        <p>Écrire la nuit, le week-end, à qui a dit non, à une société en liquidation, ou relancer sans raison neuve.</p>
        <p>Envoyer un message sans dire qu&apos;il est rédigé par un assistant IA, ni sans moyen de refus.</p>
        <p>Travailler onglet fermé : ton pipe vit dans ton navigateur, pas chez nous.</p>
      </section>
    </div>
  );
}
