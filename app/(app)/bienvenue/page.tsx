"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle, ArrowRight, Check, CircleDot, Globe, Loader2, PenLine, Sparkles } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { useAlpha } from "@/lib/store";
import { useDroits } from "@/lib/use-droits";
import { nettoyerProfil, PROFIL_VIDE } from "@/lib/profil-operateur";
import { etapesDeConfiguration, patchReglages, type EtapeConfig, type IdEtape } from "@/lib/bienvenue";
import type { LectureSite, PropositionConfig } from "@/lib/lecture-site";
import { cn } from "@/lib/utils";

/**
 * ─────────────────────────────────────────────────────────────────────
 * « DONNE TON SITE. ALPHA SE CONFIGURE DEVANT TOI. »
 *
 * Trois temps, et l'ordre est le sujet :
 *  1. une seule question — l'adresse du site ;
 *  2. la configuration se MONTRE, réglage par réglage, avec d'où vient
 *     chaque valeur et ce qu'elle change (`lib/bienvenue.ts`) ;
 *  3. l'inscrit corrige ce qu'il veut, puis valide. Rien n'est posé avant.
 *
 * ⚠ CE QU'ON NE FAIT PAS : simuler. Pendant la lecture, l'écran dit ce que
 * le serveur fait (ouvrir l'accueil, chercher contact et mentions légales,
 * recouper au registre) sans cocher d'étape qu'il n'a pas vu se terminer.
 * Les coches n'apparaissent qu'avec la réponse — une barre de progression
 * inventée est une petite preuve fabriquée.
 *
 * ⚠ CE QU'ON NE BLOQUE PAS : « Plus tard » marche vraiment, aucun champ
 * n'est obligatoire. Un profil rempli de force est un profil faux.
 *
 * ⚠⚠ LE COMPTE MAÎTRE EST PRÉVENU AVANT DE VALIDER. Montrer la lecture
 * devant un prospect, en rendez-vous, est un usage voulu de cet écran ; la
 * VALIDER depuis notre compte remplacerait notre raison sociale par la sienne
 * sur tout ce qui part de chez nous.
 * ─────────────────────────────────────────────────────────────────────
 */

type Phase = "saisie" | "lecture" | "revue" | "fait" | "erreur";

/** Ce que le serveur fait VRAIMENT pendant la lecture — dit, jamais coché. */
const PENDANT_LA_LECTURE = [
  "Ouverture de ta page d'accueil",
  "Recherche de ta page contact, de tes mentions légales et de ta page « à propos »",
  "Recoupement au registre national, si un SIREN est affiché",
];

const DELAI_REVELATION_MS = 420;

export default function BienvenuePage() {
  const router = useRouter();
  const droits = useDroits();
  const settings = useAlpha((s) => s.settings);
  const appliquerProfil = useAlpha((s) => s.appliquerProfil);
  const patchSettings = useAlpha((s) => s.patchSettings);

  const [phase, setPhase] = useState<Phase>("saisie");
  const [url, setUrl] = useState("");
  const [erreur, setErreur] = useState("");
  const [lecture, setLecture] = useState<LectureSite | null>(null);
  const [proposition, setProposition] = useState<PropositionConfig | null>(null);
  const [visibles, setVisibles] = useState(0);

  // Ce que l'inscrit garde ou corrige — initialisé par la lecture.
  const [nom, setNom] = useState("");
  const [ville, setVille] = useState("");
  const [metier, setMetier] = useState("");
  const [cibleSecteur, setCibleSecteur] = useState("");
  const [cibleRole, setCibleRole] = useState("");
  const [cibleZone, setCibleZone] = useState("");
  const [lien, setLien] = useState("");
  const [cestMoi, setCestMoi] = useState(false);
  const [edition, setEdition] = useState<Partial<Record<IdEtape, boolean>>>({});

  const champ = useRef<HTMLInputElement>(null);

  // Vu une fois : l'écran ne se rouvrira plus tout seul (`proposerBienvenue`).
  useEffect(() => {
    if (!settings.bienvenueVue) patchSettings({ bienvenueVue: true });
  }, [settings.bienvenueVue, patchSettings]);

  useEffect(() => {
    if (phase === "saisie") champ.current?.focus();
  }, [phase]);

  const etapes = useMemo(
    () => (lecture && proposition ? etapesDeConfiguration(lecture, proposition) : []),
    [lecture, proposition]
  );

  /**
   * La révélation, réglage par réglage. ⚠ `prefers-reduced-motion` montre
   * tout d'un coup : c'est un réglage d'accessibilité, pas un goût.
   */
  useEffect(() => {
    if (phase !== "revue" || etapes.length === 0) return;
    const reduit = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduit) {
      setVisibles(etapes.length);
      return;
    }
    setVisibles(1);
    const t = window.setInterval(() => {
      setVisibles((v) => {
        if (v >= etapes.length) {
          window.clearInterval(t);
          return v;
        }
        return v + 1;
      });
    }, DELAI_REVELATION_MS);
    return () => window.clearInterval(t);
  }, [phase, etapes.length]);

  const lire = async () => {
    if (!url.trim()) return;
    setPhase("lecture");
    setErreur("");
    try {
      const res = await fetch("/api/onboarding/site", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: url.trim() }),
      });
      const json = (await res.json().catch(() => ({}))) as {
        error?: string;
        lecture?: LectureSite;
        proposition?: PropositionConfig;
      };
      if (!res.ok || !json.lecture || !json.proposition) {
        setErreur(json.error ?? `Lecture impossible (HTTP ${res.status}).`);
        setPhase("erreur");
        return;
      }
      const p = json.proposition;
      setLecture(json.lecture);
      setProposition(p);
      setNom(p.agencyName);
      setVille(p.offer.city);
      setMetier(p.profil.metier);
      setCibleSecteur(p.profil.cibleSecteur);
      setCibleRole(p.profil.cibleRole);
      setCibleZone(p.profil.cibleZone);
      setLien(p.bookingUrl);
      setCestMoi(false);
      setEdition({});
      setPhase("revue");
    } catch {
      setErreur("Réseau indisponible — réessaie dans un instant.");
      setPhase("erreur");
    }
  };

  const toutVisible = visibles >= etapes.length && etapes.length > 0;

  /**
   * ⚠ CHAQUE RÉGLAGE QUI SE POSE EST AMENÉ À L'ÉCRAN. Vu au rendu sur un
   * téléphone : à partir de la troisième étape, tout apparaissait SOUS la
   * ligne de flottaison — l'inscrit regardait un écran immobile pendant que
   * la configuration se faisait plus bas. Le « devant toi » disparaissait
   * exactement là où il se joue. En mouvement réduit, on ne fait pas défiler.
   */
  useEffect(() => {
    if (phase !== "revue" || visibles === 0) return;
    const reduit = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduit) return;
    const cible = document.querySelector(toutVisible ? "#bienvenue-recap" : `[data-etape-rang="${visibles - 1}"]`);
    cible?.scrollIntoView({ behavior: "smooth", block: toutVisible ? "start" : "center" });
  }, [phase, visibles, toutVisible]);
  const nomFinal = nom.trim() || settings.agencyName;

  const valider = () => {
    if (!proposition) return;
    const base = settings.profil ?? PROFIL_VIDE;
    appliquerProfil(nettoyerProfil({ ...base, metier, cibleSecteur, cibleRole, cibleZone }));
    patchSettings({
      ...patchReglages(
        { agencyName: settings.agencyName, offer: settings.offer },
        {
          identite: {
            agencyName: nom,
            offer: {
              city: ville,
              // La description lue sert d'offre, sauf si l'inscrit l'a réécrite.
              whatYouSell: metier === proposition.profil.metier ? proposition.offer.whatYouSell : metier,
              valueProp: proposition.offer.valueProp,
            },
          },
          garderIdentite: true,
          lien,
          dirigeant: proposition.dirigeant,
          cestMoi,
        }
      ),
      bienvenueVue: true,
    });
    setPhase("fait");
  };

  return (
    <div className="page mx-auto max-w-2xl">
      <PageHeader
        eyebrow="Bienvenue"
        title="Donne ton site. Alpha se configure devant toi."
        subtitle="On lit ton site, tu vois chaque réglage se poser avec d'où il vient, tu corriges ce que tu veux, et tu valides. Trente secondes."
      />

      {(phase === "saisie" || phase === "erreur") && (
        <section className="card space-y-3 p-5">
          <label htmlFor="bienvenue-site" className="label">
            L&apos;adresse de ton site
          </label>
          {/* ⚠ En colonne sur mobile : côte à côte, le bouton écrasait le
              champ à dix caractères (« monentrepi ») — vu au rendu. */}
          <form
            className="flex flex-col gap-2 sm:flex-row"
            onSubmit={(e) => {
              e.preventDefault();
              void lire();
            }}
          >
            <input
              id="bienvenue-site"
              ref={champ}
              className="input w-full min-w-0 flex-1 text-base"
              inputMode="url"
              autoComplete="url"
              placeholder="monentreprise.fr"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
            />
            <button type="submit" disabled={!url.trim()} className="btn-bronze disabled:opacity-40">
              <Sparkles size={15} /> Configurer Alpha
            </button>
          </form>
          {phase === "erreur" && (
            <p className="flex items-start gap-2 text-[12.5px] text-signal-red">
              <AlertTriangle size={14} className="mt-0.5 shrink-0" /> {erreur}
            </p>
          )}
          <p className="text-[12px] leading-relaxed text-paper-faint">
            On lit ton accueil, ta page contact et tes mentions légales — rien d&apos;autre, et rien n&apos;est posé
            avant que tu valides.
          </p>
          <div className="flex flex-wrap gap-x-4 gap-y-1 pt-1 text-[12px]">
            <Link href="/settings" className="text-bronze-300 hover:underline">
              Pas de site ? Je remplis à la main
            </Link>
            <Link href="/aujourdhui" className="text-paper-faint hover:text-paper">
              Plus tard
            </Link>
          </div>
        </section>
      )}

      {phase === "lecture" && (
        <section className="card space-y-3 p-5" aria-live="polite">
          <p className="flex items-center gap-2 text-sm font-medium text-paper">
            <Loader2 size={16} className="animate-spin text-bronze-400" /> Lecture de{" "}
            {url.replace(/^https?:\/\//, "").replace(/\/$/, "")}…
          </p>
          <ul className="space-y-2">
            {PENDANT_LA_LECTURE.map((t) => (
              <li key={t} className="flex items-start gap-2 text-[12.5px] text-paper-dim">
                <CircleDot size={13} className="mt-0.5 shrink-0 animate-pulse text-bronze-400" /> {t}
              </li>
            ))}
          </ul>
        </section>
      )}

      {phase === "revue" && lecture && proposition && (
        <>
          <ol className="space-y-2.5" aria-live="polite">
            {etapes.slice(0, visibles).map((e, rang) => (
              <Etape
                key={e.id}
                rang={rang}
                e={e}
                enEdition={Boolean(edition[e.id])}
                onEditer={() => setEdition((v) => ({ ...v, [e.id]: true }))}
              >
                {e.id === "entreprise" && (e.statut === "a-completer" || edition.entreprise) && (
                  <div className="grid gap-2 sm:grid-cols-2">
                    <input className="input" placeholder="Nom de ton entreprise" value={nom} onChange={(x) => setNom(x.target.value)} />
                    <input className="input" placeholder="Ville" value={ville} onChange={(x) => setVille(x.target.value)} />
                  </div>
                )}
                {e.id === "activite" && (e.statut === "a-completer" || edition.activite) && (
                  <input className="input" placeholder="ce que tu vends, en une ligne" value={metier} onChange={(x) => setMetier(x.target.value)} />
                )}
                {e.id === "cible" && e.statut === "a-choisir" && (
                  <div className="flex flex-wrap gap-1.5">
                    {lecture.clienteles.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        title={c.preuve.extrait}
                        aria-pressed={cibleSecteur === c.libelle}
                        onClick={() => {
                          setCibleSecteur(c.libelle);
                          setCibleRole(c.role);
                        }}
                        className={cn(
                          "panel px-2.5 py-1 text-[12px] transition-colors",
                          cibleSecteur === c.libelle ? "border-bronze-400 text-paper" : "text-paper-dim hover:text-paper"
                        )}
                      >
                        {c.libelle} <span className="text-paper-faint">×{c.occurrences}</span>
                      </button>
                    ))}
                  </div>
                )}
                {e.id === "cible" && (e.statut === "a-completer" || edition.cible) && (
                  <div className="grid gap-2 sm:grid-cols-2">
                    <input className="input" placeholder="le secteur de tes clients" value={cibleSecteur} onChange={(x) => setCibleSecteur(x.target.value)} />
                    <input className="input" placeholder="qui tu cherches à joindre" value={cibleRole} onChange={(x) => setCibleRole(x.target.value)} />
                  </div>
                )}
                {e.id === "zone" && (e.statut === "a-completer" || edition.zone) && (
                  <input className="input" placeholder="Rhône, Île-de-France… (facultatif)" value={cibleZone} onChange={(x) => setCibleZone(x.target.value)} />
                )}
                {e.id === "signataire" && e.statut === "a-choisir" && (
                  <label className="flex items-start gap-2 text-[12.5px] text-paper-dim">
                    <input type="checkbox" className="mt-0.5" checked={cestMoi} onChange={(x) => setCestMoi(x.target.checked)} />
                    <span>
                      C&apos;est moi, <strong className="text-paper">{e.valeur}</strong>, qui signe les messages.
                    </span>
                  </label>
                )}
                {e.id === "rdv" && (e.statut === "a-completer" || edition.rdv) && (
                  <input className="input" placeholder="https://cal.com/ton-nom/15min" value={lien} onChange={(x) => setLien(x.target.value)} />
                )}
              </Etape>
            ))}
            {!toutVisible && (
              <li className="flex items-center gap-2 px-1 text-[12px] text-paper-faint">
                <Loader2 size={13} className="animate-spin" /> Réglage suivant…
              </li>
            )}
          </ol>

          {toutVisible && (
            <section id="bienvenue-recap" className="card animate-fade-up scroll-mt-20 space-y-3 p-5">
              <p className="text-sm font-medium text-paper">En validant, Alpha :</p>
              <ul className="space-y-1.5 text-[13px] leading-relaxed text-paper-dim">
                <li>
                  · signe tes messages et tes devis au nom de <strong className="text-paper">{nomFinal}</strong>
                  {cestMoi && proposition.dirigeant ? <>, par <strong className="text-paper">{proposition.dirigeant}</strong></> : null} ;
                </li>
                <li>
                  {cibleSecteur.trim() ? (
                    <>
                      · refait les fiches d&apos;exemple sur <strong className="text-paper">{cibleSecteur.trim()}</strong>
                      {cibleZone.trim() ? <> — {cibleZone.trim()}</> : null} ;
                    </>
                  ) : (
                    <>· garde les fiches d&apos;exemple actuelles — sans cible, on ne fabrique pas ton marché ;</>
                  )}
                </li>
                {lien.trim() && <li>· ajoute ton lien de rendez-vous à tes emails et tes messages LinkedIn ;</li>}
                <li>
                  · <strong className="text-paper">ne touche pas à tes vraies fiches</strong>. Tout se modifie ensuite dans
                  les Réglages.
                </li>
              </ul>
              {droits.maitre && (
                <p className="flex items-start gap-2 rounded-lg border border-signal-amber/50 bg-signal-amber/5 px-3 py-2 text-[12px] leading-relaxed text-signal-amber">
                  <AlertTriangle size={14} className="mt-0.5 shrink-0" />
                  Tu es sur le compte maître : valider remplace TON identité ({settings.agencyName}) par celle de ce site,
                  sur tout ce qui part de chez nous. Pour une démonstration devant un prospect, montre la lecture et ne
                  valide pas.
                </p>
              )}
              <div className="flex flex-wrap items-center gap-2">
                <button type="button" onClick={valider} className="btn-bronze">
                  <Check size={15} /> {droits.maitre ? "Appliquer quand même à mon compte" : "Valider et ouvrir ma journée"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setPhase("saisie");
                    setLecture(null);
                    setProposition(null);
                  }}
                  className="btn-ghost"
                >
                  Lire un autre site
                </button>
              </div>
            </section>
          )}
        </>
      )}

      {phase === "fait" && (
        <section className="card animate-fade-up space-y-3 p-5">
          <p className="flex items-center gap-2 text-base font-medium text-paper">
            <Check size={18} className="text-signal-green" /> Alpha est réglé sur {nomFinal}.
          </p>
          <p className="text-[13px] leading-relaxed text-paper-dim">
            Ta journée est prête : qui appeler, quoi écrire, dans quel ordre. Les fiches d&apos;exemple restent
            inventées — remplace-les par les tiennes quand tu les auras (Réglages → importer un fichier ou un Google
            Sheet).
          </p>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => router.push("/aujourdhui")} className="btn-bronze">
              Ouvrir ma journée <ArrowRight size={14} />
            </button>
            <Link href="/pipeline" className="btn-ghost">
              Mon pipeline
            </Link>
            <Link href="/offre-brique" className="btn-ghost">
              Gratuit ou payant ?
            </Link>
          </div>
        </section>
      )}
    </div>
  );
}

function Etape({
  e,
  rang,
  enEdition,
  onEditer,
  children,
}: {
  e: EtapeConfig;
  rang: number;
  enEdition: boolean;
  onEditer: () => void;
  children?: React.ReactNode;
}) {
  const lu = e.statut === "lu";
  // On corrige ce qui a été lu ; ce qui est à compléter a déjà son champ, et
  // la signature ne se « corrige » pas : elle se confirme, ou pas.
  const editable = e.statut !== "a-completer" && e.id !== "lecture" && e.id !== "signataire";
  return (
    <li data-etape-rang={rang} className="card animate-fade-up p-4">
      <div className="flex items-start gap-3">
        <span
          className={cn(
            "mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full",
            lu ? "bg-signal-green/15 text-signal-green" : "bg-signal-amber/15 text-signal-amber"
          )}
          aria-hidden
        >
          {lu ? <Check size={14} /> : e.id === "lecture" ? <Globe size={13} /> : <CircleDot size={13} />}
        </span>
        <div className="min-w-0 flex-1 space-y-1.5">
          <div className="flex flex-wrap items-baseline justify-between gap-x-3">
            <p className="text-[13px] font-medium text-paper">{e.quoi}</p>
            <span
              className={cn(
                "font-mono text-[10px] uppercase tracking-wider",
                lu ? "text-signal-green" : "text-signal-amber"
              )}
            >
              {e.statut === "lu" ? "réglé" : e.statut === "a-choisir" ? "à confirmer" : "à compléter"}
            </span>
          </div>
          {e.valeur && <p className="break-words text-[14px] text-paper">{e.valeur}</p>}
          {e.source && <p className="text-[11px] text-paper-faint">lu : {e.source}</p>}
          <p className="text-[12px] leading-relaxed text-paper-dim">{e.effet}</p>
          {children}
          {editable && !enEdition && (
            <button type="button" onClick={onEditer} className="flex items-center gap-1 text-[11.5px] text-bronze-300 hover:underline">
              <PenLine size={12} /> Corriger
            </button>
          )}
        </div>
      </div>
    </li>
  );
}
