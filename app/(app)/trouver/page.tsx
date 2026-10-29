"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { AlertTriangle, ArrowRight, Building2, Check, ExternalLink, Landmark, Loader2, MapPin, Search, Users, X } from "lucide-react";
import { useAlpha } from "@/lib/store";
import { PageHeader } from "@/components/ui/page-header";
import { cn } from "@/lib/utils";
import { libelleNaf, proposerActivites } from "@/lib/naf";
import { nomenclaturePerimee } from "@/lib/registre-entreprises";
import { lireLot } from "@/lib/signaux-publics";
import { sirenDeLaFiche } from "@/lib/siren";
import { projeterImport, readStorageHealth } from "@/lib/storage-health";
import {
  LIBELLE_ECART, PAR_PAGE, chercherEntreprises, croiserAnnonces, entrepriseVersProspect, lireZone,
  type Croisement, type LectureRegistre, type MotifEcart, type TailleCible,
} from "@/lib/trouver-clients";

/**
 * ─────────────────────────────────────────────────────────────────────
 * TROUVER DES CLIENTS — le registre officiel, par métier et par zone.
 *
 * Tout part du NAVIGATEUR (`lib/trouver-clients.ts`) : ni la recherche ni
 * les annonces légales ne passent par notre serveur, qui ne voit donc pas
 * qui un inscrit vise. Gratuit, sans compte : la page ne dépense rien chez
 * nous.
 *
 * Ordre de l'écran, et il est voulu : ce que le registre NE donne PAS (ni
 * téléphone ni email) est dit AVANT le premier résultat — sinon l'import
 * ressemble à une liste d'appels prête, et la file s'ouvre muette.
 * ─────────────────────────────────────────────────────────────────────
 */

const TAILLES: { id: TailleCible; libelle: string }[] = [
  { id: "toutes", libelle: "Toutes tailles" },
  { id: "employeur", libelle: "Au moins 1 salarié" },
  { id: "10-plus", libelle: "10 salariés et plus" },
  { id: "50-plus", libelle: "50 salariés et plus" },
];

/** Les codes de zone écrits dans la zone déclarée du profil (« Lyon (69) » → « 69 »). */
function codesDuProfil(zone: string): string {
  const codes = zone.toUpperCase().match(/\b(?:\d{5}|\d{2,3}|2A|2B)\b/g) ?? [];
  const lu = lireZone(codes.join(" "));
  return lu.ok ? lu.zone.codes.join(", ") : "";
}

/** « Liquidation judiciaire (BODACC du …) » → « liquidation judiciaire (BODACC du …) » : le sigle garde ses capitales. */
const minusculeInitiale = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);

function compterEcarts(ecartees: LectureRegistre["ecartees"]): [MotifEcart, number][] {
  const n = new Map<MotifEcart, number>();
  for (const e of ecartees) n.set(e.motif, (n.get(e.motif) ?? 0) + 1);
  return [...n.entries()];
}

export default function TrouverPage() {
  const { prospects, settings, importProspects } = useAlpha();
  const profilSecteur = settings.profil?.cibleSecteur?.trim() ?? "";
  const profilZone = settings.profil?.cibleZone?.trim() ?? "";

  const [saisie, setSaisie] = useState(profilSecteur);
  const [activites, setActivites] = useState<string[]>([]);
  const [zone, setZone] = useState(() => codesDuProfil(profilZone));
  const [taille, setTaille] = useState<TailleCible>("toutes");

  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [lecture, setLecture] = useState<LectureRegistre | null>(null);
  const [croisement, setCroisement] = useState<Croisement | null>(null);
  const [annoncesEnCours, setAnnoncesEnCours] = useState(false);
  const [decoches, setDecoches] = useState<Set<string>>(new Set());
  const [importees, setImportees] = useState<Set<string>>(new Set());
  const [bilan, setBilan] = useState<string | null>(null);

  const propositions = useMemo(() => proposerActivites(saisie, 8), [saisie]);
  const dejaConnus = useMemo(() => new Set(prospects.map((p) => sirenDeLaFiche(p)).filter((s): s is string => Boolean(s))), [prospects]);
  const zoneLue = zone.trim() ? lireZone(zone) : null;

  function ajouter(codes: string[]) {
    setActivites((a) => Array.from(new Set([...a, ...codes])));
  }

  async function chercher(page = 1) {
    setEnCours(true);
    setErreur(null);
    setBilan(null);
    setCroisement(null);
    setDecoches(new Set());
    const r = await chercherEntreprises({ activites, zone, taille }, page, (url, init) => fetch(url, init), dejaConnus);
    setEnCours(false);
    if (r.etat !== "lu") {
      // ⚠ Une panne se DIT : jamais une liste vide à la place.
      setErreur(r.raison);
      setLecture(null);
      return;
    }
    setLecture(r.lecture);
    // Les annonces légales de chaque SIREN, lues aussitôt : on n'importe pas
    // une société en liquidation.
    setAnnoncesEnCours(true);
    const lectures = await lireLot(r.lecture.entreprises.map((e) => e.siren), (url, init) => fetch(url, init));
    setCroisement(croiserAnnonces(r.lecture.entreprises, lectures));
    setAnnoncesEnCours(false);
  }

  const aImporter = useMemo(
    () => (croisement?.retenues ?? []).filter((x) => !decoches.has(x.entreprise.siren) && !importees.has(x.entreprise.siren)),
    [croisement, decoches, importees]
  );
  const fiches = useMemo(() => aImporter.map((x) => entrepriseVersProspect(x.entreprise, new Date(), x.annonces)), [aImporter]);
  /**
   * Le mur de stockage du navigateur, AVANT d'écrire (règle d'écran n° 4) :
   * une écriture qui échoue ne ressemble pas à une panne, les fiches
   * disparaissent à la fermeture de l'onglet. Poids MESURÉ sur le lot réel.
   */
  const stockage = useMemo(
    () => (fiches.length ? projeterImport(readStorageHealth(), fiches, Math.round(JSON.stringify(fiches).length / fiches.length)) : null),
    [fiches]
  );

  function importer() {
    const { added, updated } = importProspects(fiches);
    setImportees((s) => new Set([...s, ...aImporter.map((x) => x.entreprise.siren)]));
    // Le « ✓ » ne se pose que si quelque chose a été écrit (même règle que l'import CRM).
    setBilan(added + updated > 0 ? `✓ ${added} ajoutée${added > 1 ? "s" : ""}${updated ? `, ${updated} complétée${updated > 1 ? "s" : ""}` : ""} dans ton CRM` : "Rien n'a été écrit.");
  }

  return (
    <div className="page">
      <PageHeader
        eyebrow="ALPHA SCOUT"
        icon={<Search size={22} className="text-bronze-400" />}
        title="Trouver des clients"
        subtitle="Le registre officiel des entreprises, par métier et par zone. Gratuit, sans compte, depuis ton navigateur."
      />

      <section className="card space-y-5 p-5">
        <div>
          <label htmlFor="metier" className="text-sm font-semibold text-paper">Qui vises-tu ?</label>
          <input
            id="metier"
            className="input mt-2 w-full"
            placeholder="plombiers, agences immobilières, dentistes, 43.22A…"
            value={saisie}
            onChange={(e) => setSaisie(e.target.value)}
            autoComplete="off"
          />
          {propositions.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-2">
              {propositions.map((p) => {
                const deja = p.codes.every((c) => activites.includes(c));
                return (
                  <button
                    key={p.codes.join(",")}
                    type="button"
                    disabled={deja}
                    onClick={() => ajouter(p.codes)}
                    className={cn("chip text-[12px]", deja ? "border-ink-700 text-paper-faint" : "border-bronze-700 text-bronze-300 hover:border-bronze-500")}
                    title={p.codes.map((c) => `${c} — ${libelleNaf(c)}`).join("\n")}
                  >
                    {deja ? <Check size={12} /> : "+"} {p.libelle}
                    {p.origine === "nomenclature" && <span className="ml-1 font-mono text-[10px] text-paper-faint">{p.codes[0]}</span>}
                  </button>
                );
              })}
            </div>
          )}
          {saisie.trim().length >= 3 && propositions.length === 0 && (
            <p className="mt-2 text-[12px] text-signal-amber">
              Aucune activité officielle ne correspond à « {saisie.trim().slice(0, 40)} ». Essaie un autre mot (le métier de tes clients, au singulier) ou un code NAF.
            </p>
          )}
          {activites.length > 0 && (
            <ul className="mt-3 space-y-1.5" aria-label="Activités retenues">
              {activites.map((c) => (
                <li key={c} className="panel flex items-center justify-between gap-3 px-3 py-2 text-sm">
                  <span className="min-w-0">
                    <span className="font-mono text-[11px] text-bronze-400">{c}</span>{" "}
                    <span className="text-paper">{libelleNaf(c)}</span>
                  </span>
                  <button type="button" aria-label={`Retirer ${c}`} className="text-paper-faint hover:text-paper" onClick={() => setActivites((a) => a.filter((x) => x !== c))}>
                    <X size={14} />
                  </button>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-2 text-[12px] text-paper-faint">
            Chaque activité est un code officiel (NAF). Retire ce qui ne te concerne pas : un même métier se déclare parfois sous deux codes.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="zone" className="text-sm font-semibold text-paper">Où ?</label>
            <input id="zone" className="input mt-2 w-full" placeholder="69 · ou 69003, 69006" value={zone} onChange={(e) => setZone(e.target.value)} inputMode="text" autoComplete="off" />
            <p className={cn("mt-1 text-[12px]", zoneLue && !zoneLue.ok ? "text-signal-amber" : "text-paper-faint")}>
              {zoneLue && !zoneLue.ok
                ? zoneLue.raison
                : profilZone && !zone.trim()
                  ? `Ta zone déclarée est « ${profilZone} » : donne son département ou ses codes postaux.`
                  : "Un département (69) ou des codes postaux (69003, 69006)."}
            </p>
          </div>
          <div>
            <label htmlFor="taille" className="text-sm font-semibold text-paper">Taille</label>
            <select id="taille" className="input mt-2 w-full" value={taille} onChange={(e) => setTaille(e.target.value as TailleCible)}>
              {TAILLES.map((t) => (
                <option key={t.id} value={t.id}>{t.libelle}</option>
              ))}
            </select>
            <p className="mt-1 text-[12px] text-paper-faint">L&apos;effectif déclaré à l&apos;INSEE, souvent avec un an de retard.</p>
          </div>
        </div>

        <div className="panel flex gap-3 px-4 py-3 text-[13px] text-paper-dim">
          <Landmark size={16} className="mt-0.5 shrink-0 text-bronze-400" />
          <p>
            Le registre donne le nom, l&apos;adresse, l&apos;activité, la taille et le dirigeant déclaré. <strong className="text-paper">Il ne donne ni téléphone ni email</strong> :
            chaque entreprise importée arrive avec la tâche « trouver le bon interlocuteur et son numéro ». Leurs annonces légales sont lues au passage — une société en
            liquidation, radiée ou dissoute n&apos;est pas importée.
          </p>
        </div>

        {nomenclaturePerimee() && (
          <p className="flex gap-2 text-[12px] text-signal-amber">
            <AlertTriangle size={14} className="mt-0.5 shrink-0" />
            La nomenclature NAF 2025 est en vigueur depuis le 1ᵉʳ janvier 2027 ; cette recherche filtre encore sur l&apos;ancienne. Si le registre refuse, c&apos;est la raison.
          </p>
        )}

        <button type="button" className="btn-bronze w-full sm:w-auto" disabled={enCours || !activites.length || !zoneLue?.ok} onClick={() => chercher(1)}>
          {enCours ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />} Chercher dans le registre
        </button>
        {!activites.length && <p className="text-[12px] text-paper-faint">Choisis au moins une activité dans les propositions.</p>}
      </section>

      {erreur && (
        <p role="alert" className="card flex gap-2 p-4 text-sm text-signal-amber">
          <AlertTriangle size={16} className="mt-0.5 shrink-0" /> Non lu : {erreur}. Rien n&apos;a été conclu — réessaie.
        </p>
      )}

      {lecture && (
        <section className="card space-y-4 p-5" aria-live="polite">
          <header className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="font-display text-lg font-bold text-paper">
              {lecture.totalPlafonne ? "10 000 entreprises ou plus" : `${lecture.total.toLocaleString("fr-FR")} entreprise${lecture.total > 1 ? "s" : ""}`}
            </h2>
            <span className="text-[12px] text-paper-faint">
              page {lecture.page} sur {lecture.pages.toLocaleString("fr-FR")} · {PAR_PAGE} par page
            </span>
          </header>

          {lecture.ecartees.length > 0 && (
            <p className="text-[12px] text-paper-faint">
              Écartées de cette page :{" "}
              {compterEcarts(lecture.ecartees)
                .map(([m, n]) => `${n} ${LIBELLE_ECART[m]}`)
                .join(" · ")}
            </p>
          )}

          {annoncesEnCours && (
            <p className="flex items-center gap-2 text-[13px] text-paper-dim">
              <Loader2 size={14} className="animate-spin" /> Lecture des annonces légales de {lecture.entreprises.length} entreprises…
            </p>
          )}

          {croisement && (
            <>
              {croisement.exclues.length > 0 && (
                <div className="panel space-y-1 px-4 py-3 text-[13px]">
                  <p className="font-semibold text-signal-red">{croisement.exclues.length} écartée{croisement.exclues.length > 1 ? "s" : ""} par une annonce légale — non importée{croisement.exclues.length > 1 ? "s" : ""}</p>
                  {croisement.exclues.map(({ entreprise, exclusion }) => (
                    <p key={entreprise.siren} className="text-paper-dim">
                      {entreprise.nom} · {minusculeInitiale(exclusion.libelle)}{" "}
                      <a href={exclusion.source} target="_blank" rel="noreferrer" className="inline-flex items-center gap-0.5 text-bronze-400 hover:underline">
                        l&apos;annonce <ExternalLink size={11} />
                      </a>
                    </p>
                  ))}
                </div>
              )}
              {croisement.nonLues > 0 && (
                <p className="text-[12px] text-signal-amber">
                  Annonces non lues pour {croisement.nonLues} entreprise{croisement.nonLues > 1 ? "s" : ""} : non lu n&apos;est pas « sain » — la file d&apos;appels les relira avant de te les servir.
                </p>
              )}

              <ul className="space-y-2">
                {croisement.retenues.map(({ entreprise: e, moment }) => {
                  const faite = importees.has(e.siren);
                  const coche = !faite && !decoches.has(e.siren);
                  return (
                    <li key={e.siren} className={cn("panel flex gap-3 px-4 py-3", faite && "opacity-60")}>
                      <input
                        type="checkbox"
                        className="mt-1 h-4 w-4 shrink-0 accent-bronze-500"
                        aria-label={`Importer ${e.nom}`}
                        checked={coche}
                        disabled={faite}
                        onChange={() =>
                          setDecoches((s) => {
                            const n = new Set(s);
                            if (n.has(e.siren)) n.delete(e.siren);
                            else n.add(e.siren);
                            return n;
                          })
                        }
                      />
                      <div className="min-w-0 flex-1 space-y-1">
                        <p className="flex flex-wrap items-center gap-2 text-sm font-semibold text-paper">
                          <Building2 size={14} className="shrink-0 text-bronze-400" />
                          <span className="min-w-0 break-words">{e.enseigne && e.enseigne.toUpperCase() !== e.nom.toUpperCase() ? `${e.enseigne} · ${e.nom}` : e.nom}</span>
                          {faite && <span className="chip border-signal-green/50 text-[10px] text-signal-green">dans ton CRM</span>}
                        </p>
                        <p className="flex flex-wrap gap-x-3 gap-y-0.5 text-[12px] text-paper-dim">
                          <span className="inline-flex items-center gap-1"><MapPin size={12} /> {e.codePostal} {e.commune}</span>
                          <span className="inline-flex items-center gap-1"><Users size={12} /> {e.taille.libelle}</span>
                          <span>{e.activite.libelle}</span>
                        </p>
                        {e.dirigeants.length > 0 && <p className="text-[12px] text-paper-faint">Dirigeant déclaré : {e.dirigeants.join(" · ")}</p>}
                        <div className="flex flex-wrap gap-1.5">
                          {moment && <span className="chip border-bronze-600 text-[10px] text-bronze-300">moment : {minusculeInitiale(moment.libelle)} ({moment.date.split("-").reverse().join("/")})</span>}
                          {e.etablissementsDansLaZone > 1 && <span className="chip border-ink-600 text-[10px] text-paper-faint">{e.etablissementsDansLaZone} établissements dans ta zone — un réseau</span>}
                          {e.entrepreneurIndividuel && <span className="chip border-ink-600 text-[10px] text-paper-faint">entrepreneur individuel</span>}
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>

              {stockage && (
                <p className={cn("rounded-lg border px-3 py-2 text-[12px]", stockage.alerte ? "border-signal-red/50 bg-signal-red/5 text-signal-red" : "border-ink-700 text-paper-faint")}>
                  {stockage.phrase}
                </p>
              )}
              <div className="flex flex-wrap items-center gap-3">
                <button type="button" className="btn-bronze" disabled={!aImporter.length} onClick={importer}>
                  Importer {aImporter.length} entreprise{aImporter.length > 1 ? "s" : ""} dans mon CRM
                </button>
                {lecture.page < lecture.pages && (
                  <button type="button" className="btn-ghost" disabled={enCours} onClick={() => chercher(lecture.page + 1)}>
                    Page suivante <ArrowRight size={14} />
                  </button>
                )}
              </div>
              {bilan && (
                <p className="text-sm text-paper">
                  {bilan}{" "}
                  <Link href="/pipeline" className="text-bronze-400 hover:underline">Voir le pipeline</Link>
                </p>
              )}
            </>
          )}
        </section>
      )}
    </div>
  );
}
