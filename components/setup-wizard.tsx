"use client";

import { useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Circle,
  Cpu,
  Download,
  Link2,
  Loader2,
  PlugZap,
  Sparkles,
  X,
} from "lucide-react";
import { Eagle } from "@/components/eagle";
import { cn } from "@/lib/utils";
import { useAlpha } from "@/lib/store";
import { setN8nConfig, getN8nConfig, testN8n, syncFromN8n } from "@/lib/n8n";

/** Ouvre l'assistant depuis n'importe où (ex. bouton Réglages). */
export function openSetupWizard() {
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent("alpha:open-setup"));
}

const STEPS = ["Bienvenue", "Préparer n8n", "Connecter", "Vérifier", "Importer", "Prêt"] as const;

export function SetupWizard({ onClose }: { onClose: () => void }) {
  const { patchSettings, prospects, clearAllData } = useAlpha();
  const existing = getN8nConfig();
  const [step, setStep] = useState(0);
  const [workflowReady, setWorkflowReady] = useState(false);
  const [url, setUrl] = useState(existing?.url ?? "");
  const [secret, setSecret] = useState(existing?.secret ?? "");
  const [testing, setTesting] = useState(false);
  const [testMsg, setTestMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [importing, setImporting] = useState(false);
  const [importMsg, setImportMsg] = useState("");

  const finish = () => {
    patchSettings({ onboarded: true });
    onClose();
  };

  const saveConn = () => setN8nConfig(url, secret);

  const runTest = async () => {
    saveConn();
    setTesting(true);
    setTestMsg(null);
    const r = await testN8n();
    setTestMsg({ ok: r.ok, text: r.message });
    setTesting(false);
  };

  const runImport = async () => {
    saveConn();
    setImporting(true);
    setImportMsg("");
    const r = await syncFromN8n();
    setImporting(false);
    setImportMsg(
      r.ok
        ? `✓ ${r.added ?? 0} prospect(s) importé(s), ${r.updated ?? 0} mis à jour depuis n8n.`
        : `Échec : ${r.error}`
    );
  };

  const next = () => setStep((s) => Math.min(s + 1, STEPS.length - 1));
  const back = () => setStep((s) => Math.max(s - 1, 0));

  return (
    <div className="fixed inset-0 z-[95] flex items-center justify-center bg-ink-950/92 p-4 backdrop-blur-sm">
      <div className="card relative flex w-full max-w-3xl flex-col overflow-hidden md:flex-row animate-fade-up" style={{ maxHeight: "92vh" }}>
        <button
          onClick={onClose}
          className="absolute right-3 top-3 z-10 grid h-8 w-8 place-items-center rounded-full text-paper-faint hover:bg-ink-800 hover:text-paper"
          aria-label="Fermer l'assistant"
        >
          <X size={16} />
        </button>

        {/* Rail d'étapes */}
        <div className="shrink-0 border-b border-ink-700 bg-ink-900/60 p-4 md:w-52 md:border-b-0 md:border-r md:p-5">
          <div className="mb-4 flex items-center gap-2">
            <span className="text-bronze-400"><Eagle size={26} glow /></span>
            <span className="font-display text-[13px] font-extrabold text-paper">Configuration</span>
          </div>
          <ol className="flex gap-3 overflow-x-auto md:flex-col md:gap-2.5">
            {STEPS.map((label, i) => (
              <li key={label} className="flex shrink-0 items-center gap-2">
                {i < step ? (
                  <CheckCircle2 size={16} className="text-signal-green" />
                ) : i === step ? (
                  <span className="grid h-4 w-4 place-items-center rounded-full bg-gold text-[10px] font-bold text-goldink">{i + 1}</span>
                ) : (
                  <Circle size={16} className="text-paper-faint" />
                )}
                <span className={cn("text-[12px]", i === step ? "font-medium text-paper" : "text-paper-faint")}>{label}</span>
              </li>
            ))}
          </ol>
        </div>

        {/* Contenu */}
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex-1 overflow-y-auto p-6">
            {step === 0 && (
              <div className="animate-fade-up">
                <h2 className="font-display text-xl font-extrabold text-paper">
                  Bienvenue dans ALPHA <span className="text-bronze-400">SALES OS</span>
                </h2>
                <p className="mt-2 text-sm text-paper-dim">Voici comment tout s&apos;emboîte — pas besoin d&apos;être technique.</p>
                <div className="mt-5 grid gap-3 sm:grid-cols-2">
                  <div className="rounded-xl border border-ink-700 bg-ink-850 p-4">
                    <Cpu size={20} className="text-bronze-400" />
                    <p className="mt-2 font-display text-sm font-bold text-paper">n8n = le cerveau</p>
                    <p className="mt-1 text-[12px] text-paper-faint">
                      Votre outil d&apos;automatisation. Il garde la <strong className="text-paper-dim">mémoire</strong> (vos prospects, l&apos;historique) et fait le travail en coulisses.
                    </p>
                  </div>
                  <div className="rounded-xl border border-bronze-700/60 bg-bronze-900/20 p-4">
                    <Sparkles size={20} className="text-bronze-400" />
                    <p className="mt-2 font-display text-sm font-bold text-paper">Cette app = le tableau de bord</p>
                    <p className="mt-1 text-[12px] text-paper-faint">
                      Elle <strong className="text-paper-dim">récupère</strong> les infos de n8n, fait les calculs et affiche vos métriques et la doctrine de vente.
                    </p>
                  </div>
                </div>
                <p className="mt-4 rounded-lg border border-ink-700 bg-ink-900 px-3 py-2.5 text-[12px] text-paper-dim">
                  On va relier les deux en <strong className="text-paper">4 étapes simples</strong>. Comptez 5 minutes.
                </p>
              </div>
            )}

            {step === 1 && (
              <div className="animate-fade-up">
                <h2 className="font-display text-lg font-bold text-paper">Étape 1 — Préparer n8n</h2>
                <p className="mt-1 text-sm text-paper-dim">n8n est un logiciel gratuit qui fait tourner vos automatisations.</p>
                <ol className="mt-4 space-y-3">
                  <Li n={1} title="Vous avez déjà n8n ?">
                    Parfait, passez au point 2. Sinon, installez-le en une commande
                    (<code className="code">npx n8n</code>) ou créez un compte sur leur cloud — c&apos;est gratuit pour commencer.
                  </Li>
                  <Li n={2} title="Importez le workflow tout prêt">
                    On a préparé un fichier dans <code className="code">integrations/n8n/</code>. Dans n8n :
                    <strong className="text-paper-dim"> Workflows → Import from File</strong>, puis choisissez le fichier.
                  </Li>
                  <Li n={3} title="Activez-le">
                    Ouvrez le nœud <strong className="text-paper-dim">Webhook</strong>, et pensez à autoriser votre app dans
                    « Allowed Origins (CORS) » (mettez <code className="code">*</code> pour commencer). Puis
                    <strong className="text-paper-dim"> activez</strong> le workflow (interrupteur en haut à droite).
                  </Li>
                </ol>
                <label className="mt-5 flex cursor-pointer items-center gap-2.5 rounded-lg border border-ink-700 bg-ink-850 px-3 py-2.5">
                  <input type="checkbox" className="accent-bronze-500" checked={workflowReady} onChange={(e) => setWorkflowReady(e.target.checked)} />
                  <span className="text-sm text-paper">Mon workflow n8n est importé et actif</span>
                </label>
              </div>
            )}

            {step === 2 && (
              <div className="animate-fade-up">
                <h2 className="font-display text-lg font-bold text-paper">Étape 2 — Coller le lien de connexion</h2>
                <p className="mt-1 text-sm text-paper-dim">
                  Dans n8n, ouvrez le nœud <strong className="text-paper-dim">Webhook</strong> et copiez l&apos;
                  <strong className="text-paper-dim">URL de Production</strong> (elle ressemble à
                  <code className="code"> https://…/webhook/alpha</code>).
                </p>
                <label className="label mt-4 flex items-center gap-1.5"><Link2 size={13} className="text-bronze-400" /> URL du webhook n8n</label>
                <input
                  className="input font-mono text-[12px]"
                  placeholder="https://mon-n8n.fr/webhook/alpha"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                />
                <label className="label mt-3">Mot de passe partagé (facultatif)</label>
                <input
                  className="input font-mono text-[12px]"
                  type="password"
                  placeholder="laissez vide si vous n'en avez pas mis"
                  value={secret}
                  onChange={(e) => setSecret(e.target.value)}
                />
                <p className="mt-2 text-[11px] text-paper-faint">
                  Ce lien reste sur <strong className="text-paper-dim">votre appareil</strong> (rien n&apos;est envoyé ailleurs).
                  Si vous avez protégé le webhook par un mot de passe, mettez-le ici — il partira dans l&apos;en-tête
                  <code className="code"> x-alpha-secret</code>.
                </p>
              </div>
            )}

            {step === 3 && (
              <div className="animate-fade-up">
                <h2 className="font-display text-lg font-bold text-paper">Étape 3 — Vérifier que ça marche</h2>
                <p className="mt-1 text-sm text-paper-dim">On envoie un petit signal à n8n pour confirmer que tout est bien branché.</p>
                <button className="btn-bronze mt-4" onClick={runTest} disabled={testing || !url.trim()}>
                  {testing ? <Loader2 size={15} className="animate-spin" /> : <PlugZap size={15} />}
                  {testing ? "Test en cours…" : "Tester la connexion"}
                </button>
                {testMsg && (
                  <p className={cn("mt-3 rounded-lg border px-3 py-2.5 text-[13px]", testMsg.ok ? "border-signal-green/40 bg-signal-green/5 text-signal-green" : "border-signal-red/40 bg-signal-red/5 text-signal-red")}>
                    {testMsg.text}
                  </p>
                )}
                {testMsg && !testMsg.ok && (
                  <ul className="mt-3 space-y-1 text-[12px] text-paper-faint">
                    <li>• L&apos;URL est-elle bien celle de <strong className="text-paper-dim">Production</strong> (pas « Test URL ») ?</li>
                    <li>• Le workflow est-il <strong className="text-paper-dim">activé</strong> dans n8n ?</li>
                    <li>• Avez-vous autorisé l&apos;origine (CORS = <code className="code">*</code>) dans le nœud Webhook ?</li>
                  </ul>
                )}
              </div>
            )}

            {step === 4 && (
              <div className="animate-fade-up">
                <h2 className="font-display text-lg font-bold text-paper">Étape 4 — Récupérer vos données</h2>
                <p className="mt-1 text-sm text-paper-dim">
                  On demande à n8n la liste de vos prospects. Le tableau de bord et toutes les métriques se remplissent avec vos vrais chiffres.
                </p>
                {prospects.length > 0 && (
                  <label className="mt-4 flex items-center gap-2 text-[12px] text-paper-faint">
                    <button className="btn-ghost px-2.5 py-1.5 text-[12px]" onClick={() => clearAllData()}>Vider la démo d&apos;abord</button>
                    <span>({prospects.length} fiche(s) de démo actuellement)</span>
                  </label>
                )}
                <button className="btn-bronze mt-4" onClick={runImport} disabled={importing}>
                  {importing ? <Loader2 size={15} className="animate-spin" /> : <Download size={15} />}
                  {importing ? "Import en cours…" : "Importer mes prospects depuis n8n"}
                </button>
                {importMsg && <p className="mt-3 rounded-lg border border-ink-700 bg-ink-850 px-3 py-2.5 text-[13px] text-paper-dim">{importMsg}</p>}
                <p className="mt-3 text-[11px] text-paper-faint">
                  Vous pourrez relancer cette synchro à tout moment depuis <strong className="text-paper-dim">Réglages → Connexion n8n</strong>.
                </p>
              </div>
            )}

            {step === 5 && (
              <div className="animate-fade-up text-center">
                <span className="mx-auto block animate-floaty text-bronze-400"><Eagle size={64} glow /></span>
                <h2 className="mt-4 font-display text-xl font-extrabold text-paper">Tout est branché 🦅</h2>
                <p className="mt-2 text-sm text-paper-dim">
                  n8n garde la mémoire, l&apos;app affiche les chiffres. Bienvenue à bord.
                </p>
                <div className="mt-4 rounded-lg border border-ink-700 bg-ink-850 p-4 text-left text-[12px] text-paper-dim">
                  <p className="font-medium text-paper">Pour aller plus loin (optionnel) :</p>
                  <ul className="mt-2 space-y-1 text-paper-faint">
                    <li>• <strong className="text-paper-dim">Réglages → État du système</strong> : voir ce qui est configuré (emails, IA…).</li>
                    <li>• Ajoutez vos identifiants d&apos;envoi email pour envoyer de beaux emails trackés.</li>
                    <li>• L&apos;assistant est relançable depuis <strong className="text-paper-dim">Réglages</strong>.</li>
                  </ul>
                </div>
              </div>
            )}
          </div>

          {/* Barre d'action */}
          <div className="flex items-center justify-between gap-2 border-t border-ink-700 p-4">
            {step === 0 ? (
              <button className="btn-ghost" onClick={finish}>Explorer la démo</button>
            ) : (
              <button className="btn-ghost" onClick={back}><ArrowLeft size={14} /> Retour</button>
            )}

            {step === 5 ? (
              <button className="btn-bronze" onClick={finish}>Entrer dans l&apos;OS</button>
            ) : (
              <button
                className="btn-bronze"
                onClick={next}
                disabled={(step === 1 && !workflowReady) || (step === 2 && !url.trim())}
              >
                {step === 0 ? "Configurer ma connexion" : "Suivant"} <ArrowRight size={14} />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function Li({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <li className="flex gap-3">
      <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full border border-bronze-700 bg-ink-900 font-mono text-[11px] text-bronze-400">{n}</span>
      <div>
        <p className="text-sm font-medium text-paper">{title}</p>
        <p className="text-[12px] text-paper-dim">{children}</p>
      </div>
    </li>
  );
}
