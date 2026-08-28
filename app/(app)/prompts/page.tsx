"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AlertTriangle, Check, RotateCcw, Send, ShieldAlert, Sparkles } from "lucide-react";
import { useAlpha } from "@/lib/store";
import {
  PROMPTS,
  aPousser,
  diffPrompt,
  promptById,
  texteEffectif,
  validerPrompt,
  type PromptDef,
} from "@/lib/prompts";
import { n8nConnected, pousserPrompts } from "@/lib/n8n";
import { cn } from "@/lib/utils";

/**
 * ─────────────────────────────────────────────────────────────────────
 * CHANGER UN PROMPT — l'écran.
 *
 * La règle de cet écran tient en une phrase : on ne peut pas appliquer une
 * modification qui a retiré un invariant, et on ne peut pas croire qu'une
 * modification est partie chez n8n si n8n ne l'a pas confirmée.
 *
 * Les deux mensonges qu'un écran comme celui-ci fait naturellement :
 *  · afficher « enregistré » alors que le texte a perdu une règle légale ;
 *  · afficher « poussé » parce que l'appel HTTP a rendu 200. Le routeur du
 *    workflow n8n répond `ping` à toute action inconnue — donc un 200
 *    réjouissant sur une installation qui n'a jamais entendu parler de
 *    `prompts.set`. `pousserPrompts` exige un compte d'écritures en retour.
 * ─────────────────────────────────────────────────────────────────────
 */
export default function PromptsPage() {
  const { settings, setPrompt, marquerPromptsPousses } = useAlpha();
  const modifies = useMemo(() => settings.prompts ?? [], [settings.prompts]);

  /**
   * Les TEXTES LIVRÉS viennent du serveur, jamais du bundle.
   *
   * ⚠ Ils y étaient au premier jet, et `tests/vitrine-fuite.test.ts` l'a
   * refusé : la doctrine récite l'offre, la grille par brique et le taux de
   * chaque compte, et un chunk `_next/static/**` se télécharge sans cookie.
   * Une route se garde ; un chunk ne se garde pas.
   */
  const [livres, setLivres] = useState<Record<string, string> | null>(null);
  const [erreurCharge, setErreurCharge] = useState<string | null>(null);
  useEffect(() => {
    fetch("/api/prompts")
      .then(async (r) => {
        if (!r.ok) {
          const d = (await r.json().catch(() => ({}))) as { error?: string };
          throw new Error(d.error ?? `Erreur ${r.status}`);
        }
        return r.json() as Promise<{ prompts: { id: string; defaut: string }[] }>;
      })
      .then((d) => setLivres(Object.fromEntries(d.prompts.map((p) => [p.id, p.defaut]))))
      .catch((e: Error) => setErreurCharge(e.message));
  }, []);

  const [sel, setSel] = useState<string>(PROMPTS[0]!.id);
  const def = promptById(sel)!;
  const modifie = modifies.find((m) => m.id === sel);
  const defaut = livres?.[sel] ?? "";

  const [brouillon, setBrouillon] = useState<string | null>(null);
  const texteCourant = brouillon ?? modifie?.texte ?? defaut;
  const enEdition = brouillon !== null && brouillon !== (modifie?.texte ?? defaut);

  const verdict = useMemo(() => validerPrompt(sel, texteCourant, defaut), [sel, texteCourant, defaut]);
  const diff = useMemo(() => diffPrompt(defaut, texteCourant), [defaut, texteCourant]);
  const effectif = texteEffectif(sel, defaut, modifies);

  const [pousse, setPousse] = useState<{ ok: boolean; message: string } | null>(null);
  const [enCours, setEnCours] = useState(false);

  const choisir = (id: string) => {
    setSel(id);
    setBrouillon(null);
    setPousse(null);
  };

  const enregistrer = () => {
    if (!verdict.ok) return;
    // Enregistrer le texte livré à l'identique n'est pas une modification :
    // ce serait figer la version du jour, et une amélioration livrée plus tard
    // n'atteindrait plus cet opérateur.
    setPrompt(sel, texteCourant === defaut ? "" : texteCourant);
    setBrouillon(null);
  };

  const revenirAuDefaut = () => {
    setPrompt(sel, "");
    setBrouillon(null);
  };

  const pousserVersN8n = async () => {
    setEnCours(true);
    setPousse(null);
    // On ne pousse que ce qui est VALIDE et qui a bougé depuis le dernier envoi.
    const aEnvoyer = modifies
      .filter((m) => validerPrompt(m.id, m.texte).ok && aPousser(m))
      .map((m) => ({ id: m.id, texte: m.texte, modifieLe: m.modifieLe }));
    const r = await pousserPrompts(aEnvoyer);
    if (r.ok) {
      marquerPromptsPousses(aEnvoyer.map((m) => m.id));
      setPousse({
        ok: true,
        message:
          r.pousses === 0
            ? "Rien à pousser : tout est déjà à jour côté n8n."
            : `${r.pousses} prompt(s) écrits par n8n. « Écrit » ≠ « utilisé » : vérifie que tes nœuds IA lisent bien l'onglet PROMPTS.`,
      });
    } else {
      setPousse({ ok: false, message: r.error ?? "Échec inconnu." });
    }
    setEnCours(false);
  };

  const enAttente = modifies.filter((m) => validerPrompt(m.id, m.texte).ok && aPousser(m)).length;

  return (
    <div className="space-y-4 animate-fade-up">
      <header>
        <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-bronze-400">
          Une seule source · validée avant de s&apos;appliquer
        </p>
        <h1 className="font-display text-2xl font-bold text-paper">Prompts</h1>
        <p className="text-sm text-paper-faint">
          Ce que l&apos;IA a le droit de dire, et ce qu&apos;elle ne peut pas oublier. Une modification s&apos;applique
          aux écrans dès qu&apos;elle est enregistrée ; à n8n seulement quand tu la pousses.
        </p>
      </header>

      {erreurCharge && (
        <p className="flex items-start gap-2 rounded-xl border border-signal-red/50 bg-signal-red/5 px-3 py-2.5 text-[11.5px] leading-relaxed text-signal-red">
          <ShieldAlert size={14} className="mt-0.5 shrink-0" />
          <span>
            <strong>Textes livrés non chargés</strong> — {erreurCharge}. L&apos;écran ne peut rien afficher à éditer :
            les textes ne sont pas dans le navigateur, ils sont servis par <code className="code">/api/prompts</code>,
            réservée au compte maître.
          </span>
        </p>
      )}
      {!livres && !erreurCharge && (
        <p className="text-[12px] text-paper-faint">Chargement des textes livrés…</p>
      )}

      <div className="grid gap-4 lg:grid-cols-[260px_1fr]">
        {/* ── La liste ── */}
        <nav className="card h-fit p-2">
          {PROMPTS.map((p) => {
            const m = modifies.find((x) => x.id === p.id);
            const invalide = m ? !validerPrompt(p.id, m.texte).ok : false;
            return (
              <button
                key={p.id}
                onClick={() => choisir(p.id)}
                className={cn(
                  "flex w-full flex-col gap-0.5 rounded-lg px-3 py-2 text-left transition-colors",
                  p.id === sel ? "bg-ink-800 text-paper" : "text-paper-dim hover:bg-ink-850 hover:text-paper"
                )}
              >
                <span className="flex items-center gap-1.5 text-[13px] font-medium">
                  {p.label}
                  {invalide && <ShieldAlert size={12} className="text-signal-red" />}
                  {!invalide && m && <span className="h-1.5 w-1.5 rounded-full bg-bronze-400" />}
                </span>
                <span className="text-[10.5px] uppercase tracking-wider text-paper-faint">
                  {p.lieu.ou === "app" ? "app" : `n8n · ${p.lieu.workflow}`}
                </span>
              </button>
            );
          })}

          <div className="mt-2 border-t border-ink-700 px-3 pb-1 pt-3">
            <button
              className="btn-bronze w-full justify-center text-[12px]"
              onClick={pousserVersN8n}
              disabled={enCours || enAttente === 0}
              title={
                enAttente === 0
                  ? "Rien de nouveau à envoyer à n8n"
                  : `${enAttente} modification(s) validée(s) en attente d'envoi`
              }
            >
              <Send size={13} /> {enCours ? "Envoi…" : `Pousser vers n8n${enAttente ? ` (${enAttente})` : ""}`}
            </button>
            {!n8nConnected() && (
              <p className="mt-1.5 text-[10.5px] text-paper-faint">
                n8n non connecté —{" "}
                <Link href="/settings" className="text-bronze-400 underline">
                  Réglages
                </Link>
                . Les modifications s&apos;appliquent quand même aux écrans de l&apos;app.
              </p>
            )}
            {pousse && (
              <p className={cn("mt-1.5 text-[10.5px]", pousse.ok ? "text-signal-green" : "text-signal-amber")}>
                {pousse.message}
              </p>
            )}
          </div>
        </nav>

        {/* ── L'éditeur ── */}
        <div className="space-y-3">
          <FicheIdentite def={def} />

          {/* Ce qui tourne VRAIMENT en ce moment. */}
          {effectif.source === "defaut" && modifie && (
            <p className="flex items-start gap-2 rounded-xl border border-signal-red/50 bg-signal-red/5 px-3 py-2.5 text-[11.5px] leading-relaxed text-signal-red">
              <ShieldAlert size={14} className="mt-0.5 shrink-0" />
              <span>
                <strong>Ta version n&apos;est pas utilisée.</strong> C&apos;est le texte livré qui tourne, parce que{" "}
                {effectif.raison}. Ça arrive quand un invariant est AJOUTÉ après ta modification : ta version reste
                stockée, elle n&apos;est simplement pas servie tant qu&apos;elle n&apos;est pas remise en conformité.
              </span>
            </p>
          )}

          <div className="card p-4">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <p className="font-display text-sm font-semibold text-paper">Le texte</p>
              <div className="flex items-center gap-2">
                {modifie && (
                  <button className="btn-ghost text-[12px]" onClick={revenirAuDefaut} title="Supprime ta version et reprend le texte livré">
                    <RotateCcw size={13} /> Revenir au livré
                  </button>
                )}
                <button className="btn-bronze text-[12px]" onClick={enregistrer} disabled={!enEdition || !verdict.ok}>
                  <Check size={13} /> Enregistrer
                </button>
              </div>
            </div>
            <textarea
              className="input min-h-[320px] font-mono text-[12px] leading-relaxed"
              value={texteCourant}
              onChange={(e) => setBrouillon(e.target.value)}
              spellCheck={false}
            />
            <p className="mt-1 text-[10.5px] text-paper-faint">
              {texteCourant.length} caractères · {texteCourant.split("\n").length} lignes
              {modifie && ` · ta version date du ${new Date(modifie.modifieLe).toLocaleString("fr-FR")}`}
              {modifie?.pousseLe && ` · poussée le ${new Date(modifie.pousseLe).toLocaleString("fr-FR")}`}
              {modifie && aPousser(modifie) && " · jamais poussée depuis"}
            </p>
          </div>

          <Verdict verdict={verdict} />

          {defaut && texteCourant !== defaut && <Diff lignes={diff} />}
        </div>
      </div>
    </div>
  );
}

/** Ce que ce prompt est, où il tourne, ce qu'il reçoit, ce qu'il doit rendre. */
function FicheIdentite({ def }: { def: PromptDef }) {
  return (
    <section className="card p-4">
      <p className="flex items-center gap-2 font-display text-sm font-semibold text-paper">
        <Sparkles size={15} className="text-bronze-400" /> {def.label}
      </p>
      <p className="mt-1 text-[12.5px] text-paper-dim">{def.aQuoiCaSert}</p>
      <dl className="mt-3 grid gap-2 text-[11.5px] sm:grid-cols-3">
        <div>
          <dt className="text-[10px] uppercase tracking-wider text-paper-faint">Où il tourne</dt>
          <dd className="text-paper">
            {def.lieu.ou === "app" ? def.lieu.route : `n8n · ${def.lieu.workflow} → ${def.lieu.noeud}`}
          </dd>
        </div>
        <div>
          <dt className="text-[10px] uppercase tracking-wider text-paper-faint">Ce qu&apos;il reçoit</dt>
          <dd className="text-paper">{def.variables.length ? def.variables.join(" · ") : "rien — c'est un socle"}</dd>
        </div>
        <div>
          <dt className="text-[10px] uppercase tracking-wider text-paper-faint">Ce qu&apos;il doit rendre</dt>
          <dd className="text-paper">{def.sortie === "json" ? "JSON strict (parsé par du code)" : "texte"}</dd>
        </div>
      </dl>
      {def.lieu.ou === "n8n" && (
        <p className="mt-2 text-[11px] text-paper-faint">
          Ce prompt tourne dans n8n : l&apos;enregistrer ne suffit pas, il faut le <strong>pousser</strong>.
        </p>
      )}
    </section>
  );
}

/** Ce que le texte a perdu, et ce que ça coûte. */
function Verdict({ verdict }: { verdict: ReturnType<typeof validerPrompt> }) {
  if (verdict.ok && verdict.alertes.length === 0) {
    return (
      <p className="flex items-center gap-2 rounded-xl border border-signal-green/40 bg-signal-green/5 px-3 py-2 text-[11.5px] text-signal-green">
        <Check size={14} /> Tous les invariants sont là. La modification peut s&apos;appliquer.
      </p>
    );
  }
  return (
    <div className="space-y-2">
      {verdict.manques.map((m) => (
        <div key={m.cle} className="rounded-xl border border-signal-red/50 bg-signal-red/5 px-3 py-2.5">
          <p className="flex items-center gap-2 text-[12px] font-semibold text-signal-red">
            <ShieldAlert size={14} /> {m.exige}
          </p>
          <p className="mt-1 text-[11.5px] leading-relaxed text-paper-dim">{m.pourquoi}</p>
        </div>
      ))}
      {verdict.alertes.map((a) => (
        <p
          key={a}
          className="flex items-start gap-2 rounded-xl border border-signal-amber/40 bg-signal-amber/5 px-3 py-2 text-[11.5px] leading-relaxed text-signal-amber"
        >
          <AlertTriangle size={13} className="mt-0.5 shrink-0" />
          {a}
        </p>
      ))}
    </div>
  );
}

/** Ce qui a changé par rapport au texte livré — surtout : ce qui a disparu. */
function Diff({ lignes }: { lignes: ReturnType<typeof diffPrompt> }) {
  const retirees = lignes.filter((l) => l.etat === "retiree").length;
  const ajoutees = lignes.filter((l) => l.etat === "ajoutee").length;
  return (
    <section className="card p-4">
      <p className="font-display text-sm font-semibold text-paper">
        Écart avec le texte livré{" "}
        <span className="font-mono text-[11px] font-normal text-paper-faint">
          −{retirees} / +{ajoutees}
        </span>
      </p>
      <p className="mt-0.5 text-[11px] text-paper-faint">
        La colonne qui compte est celle des lignes RETIRÉES : ajouter une consigne se remarque, en supprimer une ne se
        remarque jamais.
      </p>
      <div className="mt-2 max-h-72 overflow-y-auto rounded-lg border border-ink-700 bg-ink-950/60 p-2 font-mono text-[11px] leading-relaxed">
        {lignes.map((l, i) => (
          <p
            key={i}
            className={cn(
              "whitespace-pre-wrap",
              l.etat === "retiree" && "bg-signal-red/10 text-signal-red",
              l.etat === "ajoutee" && "bg-signal-green/10 text-signal-green",
              l.etat === "inchangee" && "text-paper-faint"
            )}
          >
            {l.etat === "retiree" ? "− " : l.etat === "ajoutee" ? "+ " : "  "}
            {l.texte || " "}
          </p>
        ))}
      </div>
    </section>
  );
}
