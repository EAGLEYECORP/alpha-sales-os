"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  Bot,
  CheckCircle2,
  EyeOff,
  Gavel,
  Hand,
  Info,
  RefreshCw,
  Wrench,
} from "lucide-react";
import { useAlpha } from "@/lib/store";
import {
  anglesMorts,
  diagnostiquer,
  PANNES,
  POINTS,
  type Alerte,
  type Gravite,
  type NaturePoint,
} from "@/lib/alpha-ceo";
import { etatDepuisSondes, type ReponseMoniteur, type ReponsePresence, type ReponseSante } from "@/lib/ceo-sondes";
import { readStorageHealth, type StorageLevel } from "@/lib/storage-health";
import { evaluerProgression } from "@/lib/paliers-campagne";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/ui/page-header";

/**
 * ─────────────────────────────────────────────────────────────────────
 * ALPHA CEO — l'écran.
 *
 * Trois blocs, dans cet ordre, et l'ordre est le produit :
 *
 *  1. CE QUI DEMANDE UNE MAIN MAINTENANT — trié urgent d'abord, avec le
 *     drapeau qui dit si Alpha s'en occupe ou s'il t'attend.
 *  2. CE QU'ON N'A PAS REGARDÉ — dit à part, en gris, sans alarme. Un tableau
 *     tout vert qui n'a rien mesuré ment plus qu'un tableau rouge.
 *  3. LE MICRO — la carte des points humains par nature, et le relevé des
 *     pannes silencieuses. C'est là qu'on ouvre le capot.
 *
 * ⚠ TOUT LE BRANCHEMENT VIT DANS `lib/ceo-sondes.ts`, PAS ICI. Un mapping
 * écrit dans un composant client n'est testable par rien — et le piège de
 * `/api/health` (réponse tronquée sans le cookie d'accès → `null`, jamais
 * `false`) est précisément ce qu'un test doit tenir.
 *
 * ⚠ Écran réservé au compte MAÎTRE (`ACCES_PAR_CHEMIN` → `"/ceo": []`), et
 * MASQUÉ plutôt que grisé chez les autres : c'est l'exploitation de NOTRE
 * déploiement, rien n'y est à vendre. Ce qui concerne le client — son
 * stockage, ses brouillons, ses fiches sans suite — vit déjà sur ses écrans.
 * ─────────────────────────────────────────────────────────────────────
 */

const TON_GRAVITE: Record<Gravite, { texte: string; bord: string; libelle: string }> = {
  urgent: { texte: "text-signal-red", bord: "border-signal-red/40", libelle: "Irrécupérable" },
  "a-traiter": { texte: "text-signal-amber", bord: "border-signal-amber/40", libelle: "Coûte chaque jour" },
  info: { texte: "text-paper-faint", bord: "border-ink-700", libelle: "Peut attendre" },
};

const NATURES: { id: NaturePoint; titre: string; phrase: string; icone: typeof Bot }[] = [
  {
    id: "automatisable",
    titre: "Alpha peut le prendre",
    phrase: "Un humain le fait par habitude ou par manque d'outil. Rien ne se perd à l'automatiser.",
    icone: Bot,
  },
  {
    id: "humain-par-decision",
    titre: "Nous avons choisi que tu tranches",
    phrase: "L'automatiser FABRIQUERAIT de la preuve. Alpha prépare la décision et s'arrête avant de la prendre.",
    icone: Hand,
  },
  {
    id: "humain-par-contrainte",
    titre: "La loi ou un tiers l'exige",
    phrase: "Ce n'est même pas notre choix. Aucune quantité d'ingénierie ne les supprime.",
    icone: Gavel,
  },
];

export default function CeoPage() {
  const prospects = useAlpha((s) => s.prospects);
  const drafts = useAlpha((s) => s.drafts);
  const settings = useAlpha((s) => s.settings);
  const hydratationPipe = useAlpha((s) => s.hydratationPipe);

  const [sante, setSante] = useState<ReponseSante | null>(null);
  /** L'autopilote, lu sur le serveur — jamais déduit d'un réglage local. */
  const [moniteur, setMoniteur] = useState<ReponseMoniteur | null>(null);
  const [chargement, setChargement] = useState(true);
  /**
   * ⚠ Mesuré dans un effet, pas au rendu. `readStorageHealth` lit
   * `localStorage` : appelé pendant le rendu serveur il rendrait `null`, et
   * l'écran afficherait « stockage non mesuré » une fraction de seconde avant
   * de se corriger. Un angle mort qui clignote apprend à ignorer les angles
   * morts.
   */
  const [stockage, setStockage] = useState<StorageLevel | null>(null);
  const [presence, setPresence] = useState<ReponsePresence | null>(null);

  const sonder = () => {
    setChargement(true);
    fetch("/api/health")
      .then((r) => (r.ok ? r.json() : null))
      /**
       * ⚠ Un échec réseau rend `null`, pas un objet vide. `null` = « on n'a
       * pas regardé » → angle mort. Un objet vide se lirait comme « on a
       * regardé et il n'y a rien », donc comme une panne.
       */
      .then((j: ReponseSante | null) => setSante(j))
      .catch(() => setSante(null))
      .finally(() => setChargement(false));

    fetch("/api/moniteur")
      .then((r) => (r.ok ? r.json() : null))
      .then((j: ReponseMoniteur | null) => setMoniteur(j))
      .catch(() => setMoniteur(null));

    /**
     * ⚠ LA SONDE QUI MANQUAIT, ET C'EST LA PLUS CHÈRE DU RELEVÉ. `agent-absent`
     * portait sa détection écrite en toutes lettres — « GET /api/voice/presence
     * → etat vaut silencieux ou inconnu alors que l'autopilote est armé » — et
     * personne ne l'appelait. Un cron qui compose sans agent fait sonner dans
     * le vide : fiche brûlée, numéro grillé, minutes facturées, journaux verts.
     */
    fetch("/api/voice/presence")
      .then((r) => (r.ok ? r.json() : null))
      .then((j: ReponsePresence | null) => setPresence(j))
      .catch(() => setPresence(null));

    setStockage(readStorageHealth()?.level ?? null);
  };

  useEffect(sonder, []);

  /**
   * Le palier en attente — `pret` veut dire « tous les points sont verts »,
   * et JAMAIS « validé ». C'est exactement la distinction que la doctrine
   * protège : « Aucun palier ne se valide seul, même tout vert. »
   */
  const palierPret = useMemo(() => {
    const etat = settings.paliersCampagne ?? { valides: [], coches: [] };
    return evaluerProgression(prospects, { valides: etat.valides, coches: etat.coches, closers: 1 }).courant.etat === "pret";
  }, [prospects, settings.paliersCampagne]);

  const etat = useMemo(
    () =>
      etatDepuisSondes({
        sante,
        stockage,
        pipeServeur: Boolean(settings.pipeServeur),
        hydratation: hydratationPipe,
        brouillons: drafts,
        prospects,
        presence,
        palierPret,
        moniteur,
      }),
    [sante, stockage, settings.pipeServeur, hydratationPipe, drafts, prospects, palierPret, moniteur]
  );

  const alertes = useMemo(() => diagnostiquer(etat), [etat]);
  const aveugles = useMemo(() => anglesMorts(etat), [etat]);

  const urgentes = alertes.filter((a) => a.gravite === "urgent").length;

  return (
    <div className="page">
      <PageHeader
        eyebrow="Le pilote, pas le maximiseur"
        title="Alpha CEO"
        subtitle="Ce qui demande une main maintenant, ce qui est cassé sans le dire, et dans quel ordre s'en occuper. Ce qui n'a pas été mesuré n'alarme pas — il se dit."
        badge={
          alertes.length > 0 ? (
            <span
              className={cn(
                "rounded-full border px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.14em]",
                urgentes > 0 ? "border-signal-red/40 text-signal-red" : "border-signal-amber/40 text-signal-amber"
              )}
            >
              {alertes.length} à traiter{urgentes > 0 && ` · ${urgentes} urgent${urgentes > 1 ? "s" : ""}`}
            </span>
          ) : null
        }
        actions={
          <button className="btn-ghost" onClick={sonder} disabled={chargement}>
            <RefreshCw size={14} className={chargement ? "animate-spin" : undefined} /> Re-sonder
          </button>
        }
      />

      {/* ══ 1. CE QUI DEMANDE UNE MAIN ══ */}
      <section className="card p-4">
        <h2 className="font-display text-sm font-semibold text-paper">Ce qui demande une main maintenant</h2>

        {alertes.length === 0 ? (
          <p className="mt-2 flex items-start gap-2 text-[12.5px] leading-relaxed text-paper-faint">
            <CheckCircle2 size={15} className="mt-0.5 shrink-0 text-signal-green" />
            <span>
              Rien à traiter sur ce qui a été mesuré.{" "}
              {aveugles.length > 0 && (
                <strong className="text-paper-dim">
                  Ce n&apos;est pas « tout va bien » : {aveugles.length} sonde{aveugles.length > 1 ? "s" : ""} n&apos;
                  {aveugles.length > 1 ? "ont" : "a"} rien renvoyé, voir juste en dessous.
                </strong>
              )}
            </span>
          </p>
        ) : (
          <ul className="mt-3 space-y-2">
            {alertes.map((a) => (
              <LigneAlerte key={a.id} a={a} />
            ))}
          </ul>
        )}
      </section>

      {/* ══ 2. LES ANGLES MORTS ══
          ⚠ Séparés des alertes, et jamais colorés comme elles. Un angle mort
          n'est pas une panne — mais le taire serait pire. */}
      <section className="card p-4">
        <h2 className="flex items-center gap-2 font-display text-sm font-semibold text-paper">
          <EyeOff size={15} className="text-paper-faint" /> Ce qu&apos;on n&apos;a pas regardé
        </h2>
        {aveugles.length === 0 ? (
          <p className="mt-2 text-[12px] text-paper-faint">Toutes les sondes ont répondu.</p>
        ) : (
          <>
            <ul className="mt-2 space-y-1">
              {aveugles.map((phrase) => (
                <li key={phrase} className="flex items-start gap-2 text-[12px] leading-relaxed text-paper-faint">
                  <span className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-paper-faint" />
                  {phrase}
                </li>
              ))}
            </ul>
            <p className="mt-2 text-[11px] leading-relaxed text-paper-faint">
              Zéro donnée → zéro chiffre : aucune de ces lignes ne compte comme une panne.{" "}
              <strong className="text-paper-dim">
                Le détail de <code className="font-mono">/api/health</code> exige le cookie d&apos;accès du site
              </strong>{" "}
              — sans lui la sonde rend <code className="font-mono">{"{ ok }"}</code> et rien d&apos;autre, ce qui est un
              angle mort et pas un défaut de configuration.
            </p>
          </>
        )}
      </section>

      {/* ══ 3. LE MICRO — LA CARTE DES POINTS HUMAINS ══ */}
      <section className="space-y-3">
        <div>
          <h2 className="font-display text-lg font-bold text-paper">Où un humain intervient, et pourquoi</h2>
          <p className="mt-1 max-w-3xl text-[12px] leading-relaxed text-paper-faint">
            La demande était « automatiser au max ». Le résultat honnête est que la majorité des points humains
            restants ne sont pas un retard à rattraper : ils sont le produit.{" "}
            <strong className="text-paper-dim">Alpha CEO respecte ces gardes plus vite, il ne les retire pas.</strong>
          </p>
        </div>

        <div className="grid gap-3 lg:grid-cols-3">
          {NATURES.map((n) => {
            const points = POINTS.filter((p) => p.nature === n.id);
            const Icone = n.icone;
            return (
              <div key={n.id} className="card p-4">
                <h3 className="flex items-center gap-2 font-display text-[13px] font-semibold text-paper">
                  <Icone size={15} className="text-bronze-400" /> {n.titre}
                  <span className="font-mono text-[10.5px] font-normal text-paper-faint">{points.length}</span>
                </h3>
                <p className="mt-1 text-[11px] leading-relaxed text-paper-faint">{n.phrase}</p>

                <ul className="mt-3 space-y-2.5">
                  {points.map((p) => (
                    <li key={p.id} className="panel px-3 py-2">
                      <p className="text-[12px] leading-snug text-paper">{p.quoi}</p>
                      {/* ⚠ La RAISON est affichée, pas rangée dans un tooltip.
                          Un point marqué « humain » sans sa raison sous les yeux
                          se lit comme un retard, et finit automatisé. */}
                      <p className="mt-1 text-[11px] leading-relaxed text-paper-faint">{p.pourquoi}</p>
                      <p className="mt-1.5 flex flex-wrap items-center gap-2 font-mono text-[10px] text-paper-faint">
                        <span className={TON_GRAVITE[p.gravite].texte}>{TON_GRAVITE[p.gravite].libelle}</span>
                        <span className="opacity-50">·</span>
                        <code>{p.module}</code>
                        <Link href={p.ecran} className="text-bronze-400 hover:underline">
                          {p.ecran}
                        </Link>
                      </p>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      </section>

      {/* ══ LE RELEVÉ DES PANNES SILENCIEUSES ══ */}
      <section className="card p-4">
        <h2 className="flex items-center gap-2 font-display text-sm font-semibold text-paper">
          <Wrench size={15} className="text-bronze-400" /> Les pannes qui ne se voient pas
        </h2>
        <p className="mt-1 max-w-3xl text-[11.5px] leading-relaxed text-paper-faint">
          Aucune de celles-ci ne produit d&apos;erreur à l&apos;écran — c&apos;est ce qui les rend chères : le produit a
          l&apos;air de fonctionner. Le champ qui compte est le deuxième : <em>pourquoi personne ne le voit</em>.
        </p>

        <ul className="mt-3 space-y-2">
          {PANNES.map((p) => {
            const active = alertes.some((a) => a.id === p.id);
            return (
              <li
                key={p.id}
                className={cn(
                  "rounded-lg border px-3 py-2.5",
                  active ? TON_GRAVITE[p.gravite].bord : "border-ink-700 opacity-70"
                )}
              >
                <p className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="text-[12.5px] font-medium text-paper">{p.symptome}</span>
                  <span className={cn("font-mono text-[10px] uppercase tracking-[0.14em]", TON_GRAVITE[p.gravite].texte)}>
                    {active ? "constatée maintenant" : TON_GRAVITE[p.gravite].libelle}
                  </span>
                </p>
                <p className="mt-1 text-[11.5px] leading-relaxed text-paper-faint">{p.pourquoiInvisible}</p>
                <p className="mt-1 text-[11px] leading-relaxed text-paper-dim">
                  <strong className="font-mono text-[10px] uppercase tracking-[0.14em] text-paper-faint">
                    Détection
                  </strong>{" "}
                  {p.detection}
                </p>
                <p className="mt-1 font-mono text-[10px] text-paper-faint">
                  <code>{p.module}</code>
                </p>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}

/**
 * Une alerte. Trois choses obligatoires, et c'est le module qui les garantit :
 * une action à l'impératif, un écran où aller, et le drapeau `humain`.
 */
function LigneAlerte({ a }: { a: Alerte }) {
  const ton = TON_GRAVITE[a.gravite];
  return (
    <li className={cn("rounded-lg border px-3 py-2.5", ton.bord)}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="flex items-start gap-2 text-[12.5px] font-medium text-paper">
          {a.gravite === "info" ? (
            <Info size={14} className={cn("mt-0.5 shrink-0", ton.texte)} />
          ) : (
            <AlertTriangle size={14} className={cn("mt-0.5 shrink-0", ton.texte)} />
          )}
          {a.quoi}
        </p>
        {/* ⚠ « Alpha s'en occupe » vs « Alpha t'attend » n'est pas cosmétique :
            c'est la différence entre une tâche faite et une tâche qui dort. */}
        <span
          className={cn(
            "shrink-0 rounded-full border px-2 py-0.5 font-mono text-[9.5px] uppercase tracking-[0.14em]",
            a.humain ? "border-bronze-400/50 text-bronze-400" : "border-ink-600 text-paper-faint"
          )}
        >
          {a.humain ? "Alpha attend que tu tranches" : "Alpha peut s'en charger"}
        </span>
      </div>
      <p className="mt-1.5 text-[12px] leading-relaxed text-paper-dim">{a.action}</p>
      <Link
        href={a.ecran}
        className="mt-1.5 inline-flex items-center gap-1 font-mono text-[11px] text-bronze-400 hover:underline"
      >
        {a.ecran} <ArrowRight size={12} />
      </Link>
    </li>
  );
}
