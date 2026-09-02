"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Building2, Coins, FileQuestion, Layers } from "lucide-react";
import {
  ALPHA_VOICE_PALIERS,
  ALPHA_VOICE_SETUP_HT,
  ESSAI_CALLS,
  ESSAI_HT,
  OUTBOUND_UNIT_CALLS,
  PACK_MONTHLY_HT,
  PACK_SETUP_HT,
} from "@/lib/offres-publiques";
import {
  REV_SHARE_PCT,
  SEUIL_NUWACOM_HT,
  chiffrer,
  type BaremeCompte,
  type BriqueTarif,
  type Selection,
} from "@/lib/calculateur-offres";
import { cn, eur } from "@/lib/utils";

/**
 * ─────────────────────────────────────────────────────────────────────
 * LE CALCULATEUR DE TOUTES LES OFFRES — l'écran.
 *
 * ⚠ L'ANCIEN NE COUVRAIT QUE LES PETITES : un seul modèle (« Performance vs
 * Abonnement ») sur des paliers à 1 000 / 2 500 / 5 000 €. Le portefeuille en
 * compte dix, sur trois comptes, avec trois économies différentes — et les
 * deux plus grosses (le chantier Nuwacom > 40 k, l'OS personnalisé) n'étaient
 * chiffrables nulle part.
 *
 * ── LES DEUX COLONNES, ET POURQUOI ELLES NE SE MÉLANGENT JAMAIS ──
 *
 * « Le client paie » et « Il nous revient » sont deux nombres différents, et
 * les confondre fausse toute prévision. Sur un Alpha Voice à 990 €, le client
 * paie 990 et il nous revient 297. Sur un chantier Nuwacom à 60 000 €, le
 * client paie 60 000 et il nous revient 9 000 — plus 100 % de la maintenance
 * qui suit, qui est la vraie rente.
 *
 * ── CE QUI N'EST PAS CHIFFRÉ NE RENTRE PAS DANS LE TOTAL ──
 *
 * Les offres sur devis rendent `null`, pas 0. Elles s'affichent dans « à
 * chiffrer au cadrage ». Un total qui absorbe une ligne non chiffrée annonce
 * un devis faux, et on le découvre devant le client.
 * ─────────────────────────────────────────────────────────────────────
 */

interface Catalogue {
  bricks?: BriqueTarif[];
  baremes?: (BaremeCompte & { divergence?: string })[];
}

export function CalculateurComplet() {
  const [sel, setSel] = useState<Selection>({ vip: true });
  const [cat, setCat] = useState<Catalogue | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/catalogue")
      .then(async (r) => {
        if (!r.ok) throw new Error(`catalogue indisponible (${r.status})`);
        return (await r.json()) as Catalogue;
      })
      .then(setCat)
      .catch((e: Error) => setErreur(e.message));
  }, []);

  /**
   * Le prix des appels sortants vient du SERVEUR, jamais d'un calcul local.
   *
   * ⚠ J'avais écrit une seconde arithmétique dans le calculateur : elle
   * divergeait au-delà de 4 000 appels (2 184 € au lieu de 2 548 €). Le palier
   * 4 000 est volontairement cassé — l'estimer de tête donne un faux prix.
   */
  const [sortantHT, setSortantHT] = useState<number | undefined>(undefined);
  const appels = sel.appelsParMois ?? 0;
  useEffect(() => {
    if (appels <= 0) {
      setSortantHT(undefined);
      return;
    }
    let annule = false;
    const t = setTimeout(() => {
      fetch("/api/catalogue", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ calls: appels }),
      })
        .then((r) => (r.ok ? r.json() : null))
        .then((d: { sortant?: { monthlyHT?: number } } | null) => {
          if (!annule) setSortantHT(typeof d?.sortant?.monthlyHT === "number" ? d.sortant.monthlyHT : undefined);
        })
        .catch(() => !annule && setSortantHT(undefined));
    }, 250);
    return () => {
      annule = true;
      clearTimeout(t);
    };
  }, [appels]);

  const r = useMemo(
    () => chiffrer({ ...sel, sortantMensuelHT: sortantHT }, { briques: cat?.bricks, baremes: cat?.baremes }),
    [sel, sortantHT, cat]
  );

  const set = (patch: Partial<Selection>) => setSel((s) => ({ ...s, ...patch }));
  const toggleBrique = (id: string) =>
    setSel((s) => {
      const has = (s.briques ?? []).includes(id);
      return { ...s, briques: has ? (s.briques ?? []).filter((x) => x !== id) : [...(s.briques ?? []), id] };
    });
  const toggleDevis = (id: "os-personnalise" | "visibilite" | "digitalisation") =>
    setSel((s) => {
      const has = (s.surDevis ?? []).includes(id);
      return { ...s, surDevis: has ? (s.surDevis ?? []).filter((x) => x !== id) : [...(s.surDevis ?? []), id] };
    });

  const divergences = (cat?.baremes ?? []).filter((b) => b.divergence);

  return (
    <div className="space-y-4">
      {erreur && (
        <p className="flex items-start gap-2 rounded-xl border border-signal-amber/50 bg-signal-amber/5 px-3 py-2.5 text-[11.5px] leading-relaxed text-signal-amber">
          <AlertTriangle size={14} className="mt-0.5 shrink-0" />
          <span>
            <strong>Catalogue non chargé</strong> — {erreur}. Les briques à la carte sont indisponibles et « ce qui
            nous revient » est calculé à 100 % partout : juste pour EAGLEYE, <strong>faux</strong> pour
            Nuwacom.
          </span>
        </p>
      )}

      <div className="grid gap-4 xl:grid-cols-[minmax(0,380px)_1fr]">
        {/* ══════════ CE QU'ON COMPOSE ══════════ */}
        <div className="space-y-3">
          <Bloc titre="EAGLEYE — nos offres" sousTitre="100 % pour nous : c'est notre société, il n'y a personne à payer.">
            <Case
              actif={Boolean(sel.vip)}
              onClick={() => set({ vip: !sel.vip })}
              titre="Alpha Sales OS — VIP"
              droite={`${eur(PACK_SETUP_HT)} + ${eur(PACK_MONTHLY_HT)}/mois`}
            />

            <Ligne label="À la carte — par brique">
              {!cat?.bricks?.length ? (
                <p className="text-[11px] text-paper-faint">Catalogue des briques non chargé.</p>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {cat.bricks.map((b) => (
                    <button
                      key={b.id}
                      onClick={() => toggleBrique(b.id)}
                      title={`${eur(b.setupHT)} d'installation + ${eur(b.monthlyHT)}/mois`}
                      className={cn(
                        "chip transition-colors",
                        (sel.briques ?? []).includes(b.id)
                          ? "border-gold bg-gold font-semibold text-goldink"
                          : "border-ink-600 text-paper-faint hover:text-paper"
                      )}
                    >
                      {b.label}
                    </button>
                  ))}
                </div>
              )}
            </Ligne>

            <Curseur
              label="Appels sortants / mois"
              value={appels}
              min={0}
              max={10000}
              step={1000}
              onChange={(v) => set({ appelsParMois: v })}
              fmt={(v) => (v === 0 ? "aucun" : `${v.toLocaleString("fr-FR")} appels`)}
              note={
                appels > 0 && sortantHT === undefined
                  ? "prix en cours de chargement — la ligne reste non chiffrée"
                  : appels >= 4 * OUTBOUND_UNIT_CALLS
                    ? "le 4e millier est offert : palier de montée en charge, à ouvrir APRÈS le réglage"
                    : undefined
              }
            />

            <Case
              actif={Boolean(sel.essai)}
              onClick={() => set({ essai: !sel.essai })}
              titre={`Essai — ${ESSAI_CALLS} appels`}
              droite={`${eur(ESSAI_HT)} une fois`}
            />

            <Ligne label={`Modèle « ${REV_SHARE_PCT} % du CA généré » — alternative au VIP`}>
              <Curseur
                label="CA mensuel qu'on lui fait gagner"
                value={sel.caMensuelGenere ?? 0}
                min={0}
                max={200000}
                step={5000}
                onChange={(v) => set({ caMensuelGenere: v })}
                fmt={(v) => (v === 0 ? "—" : eur(v))}
              />
              <Curseur
                label="Frais d'installation (sur devis)"
                value={sel.setupRevShare ?? 0}
                min={0}
                max={30000}
                step={500}
                onChange={(v) => set({ setupRevShare: v || undefined })}
                fmt={(v) => (v === 0 ? "non chiffré — au cadrage" : eur(v))}
              />
              <p className="mt-1 text-[10.5px] leading-relaxed text-paper-faint">
                ⚠ Ces {REV_SHARE_PCT} %-là sont un <strong className="text-paper-dim">PRIX facturé au client</strong>{" "}
                sur SON chiffre d&apos;affaires. Ce n&apos;est pas une commission reversée — à ne jamais confondre avec
                la commission d'un partenaire, qui est ce qui <em>nous</em> revient.
              </p>
            </Ligne>

            <Ligne label="Sur devis — chiffré au cadrage">
              <div className="flex flex-wrap gap-1.5">
                {(
                  [
                    ["os-personnalise", "OS personnalisé"],
                    ["visibilite", "Visibilité / Growth"],
                    ["digitalisation", `Digitalisation < ${SEUIL_NUWACOM_HT / 1000} k`],
                  ] as const
                ).map(([id, label]) => (
                  <button
                    key={id}
                    onClick={() => toggleDevis(id)}
                    className={cn(
                      "chip transition-colors",
                      (sel.surDevis ?? []).includes(id)
                        ? "border-gold bg-gold font-semibold text-goldink"
                        : "border-ink-600 text-paper-faint hover:text-paper"
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </Ligne>
          </Bloc>

          <Bloc
            titre="Alpha Voice"
            sousTitre={`Vendu comme un produit : ${eur(ALPHA_VOICE_SETUP_HT)} d'installation + un palier de minutes.`}
          >
            <Ligne label="Palier de minutes">
              <div className="flex flex-wrap gap-1.5">
                <button
                  onClick={() => set({ alphaVoiceMinutes: undefined })}
                  className={cn(
                    "chip transition-colors",
                    !sel.alphaVoiceMinutes ? "border-gold bg-gold font-semibold text-goldink" : "border-ink-600 text-paper-faint hover:text-paper"
                  )}
                >
                  aucun
                </button>
                {ALPHA_VOICE_PALIERS.map((p) => (
                  <button
                    key={p.minutes}
                    onClick={() => set({ alphaVoiceMinutes: p.minutes })}
                    title={`${p.appels} · ${eur(p.prixHT)}/mois`}
                    className={cn(
                      "chip transition-colors",
                      sel.alphaVoiceMinutes === p.minutes
                        ? "border-gold bg-gold font-semibold text-goldink"
                        : "border-ink-600 text-paper-faint hover:text-paper"
                    )}
                  >
                    {p.minutes} min
                  </button>
                ))}
              </div>
            </Ligne>
          </Bloc>

          <Bloc
            titre="Nuwacom — gros chantier"
            sousTitre={`Au-delà de ${eur(SEUIL_NUWACOM_HT)} : trop lourd pour nous. En dessous, EAGLEYE le fait et garde tout.`}
          >
            <Curseur
              label="Montant du devis"
              value={sel.chantierHT ?? 0}
              min={0}
              max={300000}
              step={5000}
              onChange={(v) => set({ chantierHT: v || undefined })}
              fmt={(v) => (v === 0 ? "—" : eur(v))}
            />
            <Curseur
              label="Maintenance mensuelle qui suit"
              value={sel.maintenanceMensuelleHT ?? 0}
              min={0}
              max={10000}
              step={250}
              onChange={(v) => set({ maintenanceMensuelleHT: v || undefined })}
              fmt={(v) => (v === 0 ? "—" : eur(v))}
              note="C'est ici qu'est la rente : 100 % pour nous, quel que soit le taux sur le devis."
            />
          </Bloc>
        </div>

        {/* ══════════ CE QUE ÇA DONNE ══════════ */}
        <div className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <Colonne
              titre="Le client paie"
              icone={<Building2 size={15} />}
              t={r.client}
              teinte="paper"
              note="Ce qui apparaît sur son devis."
            />
            <Colonne
              titre="Il nous revient"
              icone={<Coins size={15} />}
              t={r.nous}
              teinte="bronze"
              note="Après application du taux de chaque compte."
            />
          </div>

          {r.parCompte.length > 1 && (
            <section className="card p-4">
              <p className="font-display text-sm font-semibold text-paper">D&apos;où vient l&apos;argent</p>
              <table className="mt-2 w-full text-[12px]">
                <thead>
                  <tr className="text-[10px] uppercase tracking-wider text-paper-faint">
                    <th className="py-1 text-left font-normal">Compte</th>
                    <th className="py-1 text-right font-normal">Client / an 1</th>
                    <th className="py-1 text-right font-normal">Nous / an 1</th>
                    <th className="py-1 text-right font-normal">Nous / mois</th>
                  </tr>
                </thead>
                <tbody>
                  {r.parCompte.map((c) => (
                    <tr key={c.accountId} className="border-t border-ink-700/60">
                      <td className="py-1.5 text-paper">{c.nom}</td>
                      <td className="py-1.5 text-right font-mono text-paper-dim">{eur(c.client.an1HT)}</td>
                      <td className="py-1.5 text-right font-mono text-bronze-400">{eur(c.nous.an1HT)}</td>
                      <td className="py-1.5 text-right font-mono text-paper-dim">{eur(c.nous.mensuelHT)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          )}

          {r.lignes.length > 0 && (
            <section className="card p-4">
              <p className="font-display text-sm font-semibold text-paper">Le détail, ligne par ligne</p>
              <ul className="mt-2 space-y-2">
                {r.lignes.map((l, i) => (
                  <li key={`${l.famille}-${i}`} className="rounded-lg border border-ink-700 bg-ink-850 px-3 py-2">
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <span className="text-[12.5px] font-medium text-paper">{l.label}</span>
                      <span className="font-mono text-[11.5px]">
                        {l.clientSetupHT === null && l.clientMensuelHT === null ? (
                          <span className="text-signal-amber">sur devis</span>
                        ) : (
                          <>
                            <span className="text-paper-dim">
                              {eur(l.clientSetupHT ?? 0)} + {eur(l.clientMensuelHT ?? 0)}/mois
                            </span>
                            <span className="text-paper-faint"> → </span>
                            <span className="text-bronze-400">
                              {eur(l.nousSetupHT ?? 0)} + {eur(l.nousMensuelHT ?? 0)}/mois
                            </span>
                          </>
                        )}
                      </span>
                    </div>
                    <p className="mt-0.5 text-[11px] leading-relaxed text-paper-faint">{l.detail}</p>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {r.aChiffrerAuCadrage.length > 0 && (
            <section className="card border-signal-amber/40 p-4">
              <p className="flex items-center gap-2 font-display text-sm font-semibold text-signal-amber">
                <FileQuestion size={15} /> À chiffrer au cadrage — {r.aChiffrerAuCadrage.length} ligne(s)
              </p>
              <ul className="mt-1.5 space-y-1 text-[12px] text-paper">
                {r.aChiffrerAuCadrage.map((l) => (
                  <li key={l}>· {l}</li>
                ))}
              </ul>
              <p className="mt-1.5 text-[11px] text-paper-faint">
                Elles ne sont <strong className="text-paper-dim">pas</strong> dans les totaux ci-dessus. Un total qui
                absorbe une ligne non chiffrée annonce un devis faux — et ça se découvre devant le client.
              </p>
            </section>
          )}

          {(r.alertes.length > 0 || divergences.length > 0) && (
            <section className="space-y-2">
              {r.alertes.map((a) => (
                <p
                  key={a}
                  className="flex items-start gap-2 rounded-xl border border-signal-amber/40 bg-signal-amber/5 px-3 py-2 text-[11.5px] leading-relaxed text-signal-amber"
                >
                  <AlertTriangle size={13} className="mt-0.5 shrink-0" />
                  {a}
                </p>
              ))}
              {divergences.map((b) => (
                <p
                  key={b.accountId}
                  className="flex items-start gap-2 rounded-xl border border-signal-amber/40 bg-signal-amber/5 px-3 py-2 text-[11.5px] leading-relaxed text-signal-amber"
                >
                  <AlertTriangle size={13} className="mt-0.5 shrink-0" />
                  <span>
                    <strong>{b.nom}</strong> — {b.divergence}
                  </span>
                </p>
              ))}
            </section>
          )}

          {r.lignes.length === 0 && (
            <p className="card p-6 text-center text-[12.5px] text-paper-faint">
              Compose une offre à gauche. Tout se recalcule à chaque clic — et rien n&apos;est arrondi en ta faveur.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

/* ────────────────────────────── petits blocs ────────────────────────────── */

function Bloc({ titre, sousTitre, children }: { titre: string; sousTitre: string; children: React.ReactNode }) {
  return (
    <section className="card p-4">
      <p className="flex items-center gap-2 font-display text-sm font-bold text-paper">
        <Layers size={14} className="text-bronze-400" /> {titre}
      </p>
      <p className="mt-0.5 text-[11px] leading-relaxed text-paper-faint">{sousTitre}</p>
      <div className="mt-3 space-y-3">{children}</div>
    </section>
  );
}

function Ligne({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-1.5 text-[10px] uppercase tracking-wider text-paper-faint">{label}</p>
      {children}
    </div>
  );
}

function Case({ actif, onClick, titre, droite }: { actif: boolean; onClick: () => void; titre: string; droite: string }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex w-full items-center justify-between gap-2 rounded-lg border px-3 py-2 text-left transition-colors",
        actif ? "border-gold bg-gold/10 text-paper" : "border-ink-700 bg-ink-850 text-paper-dim hover:text-paper"
      )}
    >
      <span className="text-[12.5px] font-medium">{titre}</span>
      <span className="font-mono text-[11.5px] text-bronze-400">{droite}</span>
    </button>
  );
}

function Curseur({
  label,
  value,
  min,
  max,
  step,
  onChange,
  fmt,
  note,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
  fmt: (v: number) => string;
  note?: string;
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-[11.5px] text-paper-dim">{label}</span>
        <span className="font-mono text-[12px] text-paper">{fmt(value)}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="mt-1 w-full accent-bronze-500"
      />
      {note && <p className="mt-0.5 text-[10.5px] leading-relaxed text-paper-faint">{note}</p>}
    </div>
  );
}

function Colonne({
  titre,
  icone,
  t,
  teinte,
  note,
}: {
  titre: string;
  icone: React.ReactNode;
  t: { setupHT: number; mensuelHT: number; an1HT: number };
  teinte: "paper" | "bronze";
  note: string;
}) {
  const accent = teinte === "bronze" ? "text-bronze-400" : "text-paper";
  return (
    <section className="card p-4">
      <p className={cn("flex items-center gap-2 font-display text-sm font-semibold", accent)}>
        {icone} {titre}
      </p>
      <p className={cn("mt-2 font-mono text-2xl font-bold", accent)}>{eur(t.an1HT)}</p>
      <p className="text-[10px] uppercase tracking-wider text-paper-faint">sur 12 mois (installation comprise)</p>
      <table className="mt-2 w-full text-[12px]">
        <tbody>
          <tr>
            <td className="py-0.5 text-paper-faint">Installation</td>
            <td className="py-0.5 text-right font-mono text-paper-dim">{eur(t.setupHT)}</td>
          </tr>
          <tr>
            <td className="py-0.5 text-paper-faint">Récurrent</td>
            <td className="py-0.5 text-right font-mono text-paper-dim">{eur(t.mensuelHT)}/mois</td>
          </tr>
        </tbody>
      </table>
      <p className="mt-1.5 text-[10.5px] text-paper-faint">{note}</p>
    </section>
  );
}
