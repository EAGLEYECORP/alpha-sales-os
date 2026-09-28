"use client";

import { useEffect, useState, type ReactNode } from "react";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Circle,
  ClipboardCopy,
  Cpu,
  Database,
  Download,
  Link2,
  Loader2,
  Mail,
  PlugZap,
  RefreshCw,
  Rocket,
  Sheet,
  Sparkles,
  X,
} from "lucide-react";
import { Eagle } from "@/components/eagle";
import { cn } from "@/lib/utils";
import { useAlpha } from "@/lib/store";
import { setN8nConfig, getN8nConfig, testN8n, syncFromN8n } from "@/lib/n8n";
import { getSupabaseConfig, supabaseConfigSource, setSupabaseConfig } from "@/lib/supabase";
import { ENV_TEMPLATE } from "@/components/settings/system-status";
import {
  chargerProgression,
  effacerProgression,
  enregistrerProgression,
} from "@/lib/wizard-progress";

/** Ouvre l'assistant depuis n'importe où (ex. bouton Réglages). */
export function openSetupWizard() {
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent("alpha:open-setup"));
}

const STEPS = [
  "Bienvenue",
  "Mémoire (Sheets)",
  "Cerveau (n8n)",
  "Connecter",
  "Vérifier",
  "Importer",
  "Envoi & IA",
  "Supabase",
  "Déployer",
  "Prêt",
] as const;

/**
 * L'installation complète prend ~1 h : on sauvegarde où en est l'utilisateur.
 * La clé, sa forme et la règle d'ouverture automatique vivent dans
 * `lib/wizard-progress.ts` — `Onboarding` lit exactement la même chose.
 */

const N8N_LAUNCH = `export ALPHA_APP_URL="http://localhost:3000"
export ALPHA_WEBHOOK_SECRET="choisis-un-secret"
export ALPHA_CRM_URL="URL_SHEETS (…/exec, étape précédente)"
export ALPHA_CRM_TOKEN="TOKEN_SHEETS"
export ALPHA_ALERT_EMAIL="ton@email.fr"
npx n8n`;

// Variables à coller sur Vercel (Settings → Environment Variables).
// Rôle du déploiement : réceptionniste de tracking 24/7 + porte d'accès +
// comptes (Supabase Auth). PAS de SMTP ni d'Ollama sur Vercel — l'envoi et
// l'IA locale restent sur ta machine.
const VERCEL_ENV = `# — Indispensables —
SITE_PASSWORD=choisis-un-mot-de-passe-FORT
TRACKING_BASE_URL=https://TON-APP.vercel.app
APP_BASE_URL=https://TON-APP.vercel.app
WEBHOOK_SECRET=le-même-que-local-et-n8n
# — Comptes multi-locataires (revente SaaS) + persistance tracking —
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ…
SUPABASE_SERVICE_ROLE_KEY=eyJ…
# — Enforcement serveur du JWT (API de données exigent un compte) —
REQUIRE_AUTH=1
SUPABASE_JWT_SECRET=le-JWT-Secret-du-projet
# — Optionnel : transcription serveur (débrief) + appels voix —
DEEPGRAM_API_KEY=
LIVEKIT_URL=
LIVEKIT_API_KEY=
LIVEKIT_API_SECRET=`;

const WORKFLOWS: { file: string; map: string; activate: boolean }[] = [
  { file: "alpha-dashboard-api", map: "Sheets (credential + ID du Sheet) · Webhook : CORS", activate: true },
  { file: "alpha-outreach", map: "Sheets ×2 · Ollama · Gmail · Calendar", activate: true },
  { file: "alpha-inbound", map: "Gmail trigger · Sheets", activate: true },
  { file: "alpha-crm-sync", map: "Supabase ×2 · Sheets (sautez-le sans Supabase)", activate: true },
  { file: "alpha-crm-agent", map: "Ollama", activate: true },
  { file: "alpha-deepdive", map: "Ollama + Sheets — recherche externe → audit CRM", activate: true },
  { file: "alpha-sourcing", map: "Sheets ×2 (clés Places/Pappers/Apollo en env)", activate: true },
  { file: "alpha-tracking-sync", map: "Supabase + Sheets — ouvertures/clics dans le CRM", activate: true },
  { file: "alpha-error-alert", map: "Gmail — puis Settings → Error Workflow sur les autres", activate: false },
  { file: "alpha-signature", map: "Documenso (optionnel) — contrat signé → notif app", activate: false },
  { file: "alpha-payment", map: "Stripe (optionnel) — paiement reçu → notif app", activate: false },
];

interface Health {
  capabilities?: {
    ai: { configured: boolean; model: string };
    email: { configured: boolean };
    inboundWebhook: { configured: boolean };
    tracking: { persistence: string };
  };
}

/**
 * ─────────────────────────────────────────────────────────────────────
 * « PASSER » DOIT SORTIR. PAS AVANCER D'UN ÉCRAN.
 *
 * ⚠ TROUVÉ EN SE SERVANT DU PRODUIT, PAS EN LE TESTANT.
 *
 * Le lien de l'étape 1 disait « je veux d'abord tester l'app sans Google
 * Sheets » et appelait `next`. Il déposait donc l'opérateur sur l'étape 2 —
 * Docker, n8n, onze workflows, Ollama — dont le « Suivant » est verrouillé par
 * une case à cocher et qui n'offrait, elle, AUCUNE sortie. Le seul moyen
 * d'entrer dans l'app était la croix en haut à droite, sans libellé.
 *
 * Un bouton qui promet « tester l'app » et livre un mur d'installation ne
 * coûte pas une gêne : c'est la troisième minute d'un opérateur neuf, et il
 * conclut que l'app ne s'ouvre pas sans une heure de plomberie. C'est faux —
 * l'assistant est entièrement optionnel, `differer` le repousse en gardant la
 * progression.
 *
 * Ce composant existe pour que la sortie ait UNE seule implémentation : le
 * jour où on ajoute une étape bloquante de plus, on copie une sortie qui
 * sort vraiment. `tests/assistant-sortie.test.ts` interdit qu'un lien
 * « Passer » soit recâblé sur `next`.
 * ─────────────────────────────────────────────────────────────────────
 */
function SortirDeLAssistant({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return (
    <button
      className="mt-2 block text-[11px] text-paper-faint underline-offset-2 hover:text-paper-dim hover:underline"
      onClick={onClick}
      title="Ferme l'assistant — la progression est gardée, il ne se rouvrira pas tout seul"
    >
      {children}
    </button>
  );
}

export function SetupWizard({ onClose }: { onClose: () => void }) {
  const { patchSettings, prospects, clearAllData } = useAlpha();
  const existing = getN8nConfig();
  const [step, setStep] = useState(0);
  const [sheetsReady, setSheetsReady] = useState(false);
  const [workflowReady, setWorkflowReady] = useState(false);
  const [url, setUrl] = useState(existing?.url ?? "");
  const [secret, setSecret] = useState(existing?.secret ?? "");
  const [testing, setTesting] = useState(false);
  const [testMsg, setTestMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [importing, setImporting] = useState(false);
  const [importMsg, setImportMsg] = useState("");
  const [copied, setCopied] = useState<string | null>(null);
  const [health, setHealth] = useState<Health | null>(null);
  const [healthLoading, setHealthLoading] = useState(false);
  const [sbUrl, setSbUrl] = useState("");
  const [sbKey, setSbKey] = useState("");
  const [sbMsg, setSbMsg] = useState("");
  const [sbLinked, setSbLinked] = useState(false);

  // Reprendre là où on s'était arrêté (l'installation complète prend ~1 h).
  useEffect(() => {
    const p = chargerProgression();
    setStep(Math.min(p.step, STEPS.length - 1));
    setSheetsReady(p.sheetsReady);
    setWorkflowReady(p.workflowReady);
    setSbLinked(supabaseConfigSource() !== null || getSupabaseConfig() !== null);
    const cfg = getSupabaseConfig();
    if (cfg) {
      setSbUrl(cfg.url);
      setSbKey(cfg.key);
    }
  }, []);

  useEffect(() => {
    // `differe` est préservé : avancer d'une étape ne doit pas réarmer
    // l'ouverture automatique que l'utilisateur a déjà repoussée.
    enregistrerProgression({ ...chargerProgression(), step, sheetsReady, workflowReady });
  }, [step, sheetsReady, workflowReady]);

  const finish = () => {
    patchSettings({ onboarded: true });
    effacerProgression();
    onClose();
  };

  /**
   * Fermer à la croix ≠ avoir configuré.
   *
   * On n'écrit donc PAS `onboarded: true` — ce serait mentir à tous les écrans
   * qui s'en servent pour croire la machine branchée. On note seulement que
   * l'assistant a été repoussé, ce qui suffit à tenir la promesse affichée
   * dans le rail : « fermez et revenez quand vous voulez ». Avant, la croix ne
   * posait rien et l'assistant revenait par-dessus l'app au chargement
   * suivant, en interceptant tous les clics.
   */
  const differer = () => {
    enregistrerProgression({ ...chargerProgression(), step, sheetsReady, workflowReady, differe: true });
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

  const copy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  };

  const loadHealth = async () => {
    setHealthLoading(true);
    try {
      const res = await fetch("/api/health");
      setHealth(await res.json());
    } catch {
      setHealth(null);
    } finally {
      setHealthLoading(false);
    }
  };

  const linkSupabase = () => {
    if (!/^https:\/\/.+\.supabase\.co\/?$/.test(sbUrl.trim())) {
      setSbMsg("URL attendue : https://xxxx.supabase.co (Réglages du projet → API).");
      return;
    }
    if (sbKey.trim().length < 20) {
      setSbMsg("Clé anon trop courte — copiez la clé « anon public » du projet.");
      return;
    }
    setSupabaseConfig(sbUrl, sbKey);
    setSbLinked(true);
    setSbMsg("Supabase lié ✓ — le tracking et la synchro deviennent durables.");
  };

  const next = () => setStep((s) => Math.min(s + 1, STEPS.length - 1));
  const back = () => setStep((s) => Math.max(s - 1, 0));

  const c = health?.capabilities;

  return (
    <div className="fixed inset-0 z-[95] flex items-center justify-center bg-ink-950/92 p-4 backdrop-blur-sm">
      <div className="card relative flex w-full max-w-3xl flex-col overflow-hidden md:flex-row animate-fade-up" style={{ maxHeight: "92vh" }}>
        <button
          onClick={differer}
          className="absolute right-3 top-3 z-10 grid h-8 w-8 place-items-center rounded-full text-paper-faint hover:bg-ink-800 hover:text-paper"
          aria-label="Fermer l'assistant"
          title="Fermer — la progression est gardée, l'assistant ne se rouvrira pas tout seul"
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
          <p className="mt-4 hidden text-[10px] text-paper-faint md:block">
            Votre progression est sauvegardée — fermez et revenez quand vous voulez.
          </p>
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
                  <div className="panel p-4">
                    <Sheet size={20} className="text-bronze-400" />
                    <p className="mt-2 font-display text-sm font-bold text-paper">Google Sheets = la mémoire</p>
                    <p className="mt-1 text-[12px] text-paper-faint">
                      Le CRM que vous (et vos employés) voyez : prospects, historique, étapes.
                    </p>
                  </div>
                  <div className="panel p-4">
                    <Cpu size={20} className="text-bronze-400" />
                    <p className="mt-2 font-display text-sm font-bold text-paper">n8n = le cerveau</p>
                    <p className="mt-1 text-[12px] text-paper-faint">
                      Vos automatisations : il lit le Sheet, rédige les brouillons (IA locale), route les réponses.
                    </p>
                  </div>
                  <div className="rounded-xl border border-bronze-700/60 bg-bronze-900/20 p-4">
                    <Sparkles size={20} className="text-bronze-400" />
                    <p className="mt-2 font-display text-sm font-bold text-paper">Cette app = le tableau de bord</p>
                    <p className="mt-1 text-[12px] text-paper-faint">
                      Elle affiche vos métriques, fait relire chaque message avant envoi, et envoie les emails trackés.
                    </p>
                  </div>
                  <div className="panel p-4">
                    <Database size={20} className="text-bronze-400" />
                    <p className="mt-2 font-display text-sm font-bold text-paper">Supabase = la mémoire durable</p>
                    <p className="mt-1 text-[12px] text-paper-faint">
                      Optionnel mais recommandé : tracking, anti-doublons et synchro qui survivent aux redémarrages.
                    </p>
                  </div>
                </div>
                <p className="mt-4 rounded-lg border border-ink-700 bg-ink-900 px-3 py-2.5 text-[12px] text-paper-dim">
                  On installe tout, <strong className="text-paper">dans l&apos;ordre, en vous tenant la main</strong>.
                  Comptez ~1 h la première fois. Chaque étape se vérifie avant de passer à la suivante —
                  et vous pouvez fermer : votre progression est retenue.
                </p>
              </div>
            )}

            {step === 1 && (
              <div className="animate-fade-up">
                <h2 className="font-display text-lg font-bold text-paper">Étape 1 — La mémoire : Google Sheets</h2>
                <p className="mt-1 text-sm text-paper-dim">
                  Le CRM vit dans un Google Sheets à vous. Guide détaillé avec captures :
                  <code className="code"> docs/INSTALLATION.md</code> (Phase 1). En résumé :
                </p>
                <ol className="mt-4 space-y-3">
                  <Li n={1} title="Créez un Google Sheets vierge">
                    Nommez-le (ex. « CRM EAGLEYE »).
                  </Li>
                  <Li n={2} title="Collez le script fourni">
                    <strong className="text-paper-dim">Extensions → Apps Script</strong>, collez tout le fichier
                    <code className="code"> integrations/google-apps-script/Code.gs</code> du projet, enregistrez,
                    rechargez le Sheet → menu <strong className="text-paper-dim">🦅</strong> → « ① Initialiser » (les colonnes se créent).
                  </Li>
                  <Li n={3} title="Posez le secret + déployez">
                    Apps Script → ⚙ Propriétés du script → <code className="code">API_TOKEN</code> = un secret long
                    (notez-le : <strong className="text-paper-dim">TOKEN_SHEETS</strong>). Puis Déployer → Application Web
                    (exécuter en tant que moi, accès tout le monde) → copiez l&apos;URL <code className="code">…/exec</code>
                    (<strong className="text-paper-dim">URL_SHEETS</strong>).
                  </Li>
                  <Li n={4} title="Vérifiez">
                    Ouvrez <code className="code">URL_SHEETS?token=TOKEN_SHEETS&amp;action=list</code> dans le navigateur
                    → vous devez voir du JSON (<code className="code">{"{"}&quot;ok&quot;:true…{"}"}</code>).
                  </Li>
                </ol>
                <label className="mt-5 flex cursor-pointer items-center gap-2.5 rounded-lg border border-ink-700 bg-ink-850 px-3 py-2.5">
                  <input type="checkbox" className="accent-bronze-500" checked={sheetsReady} onChange={(e) => setSheetsReady(e.target.checked)} />
                  <span className="text-sm text-paper">Mon Sheet répond au test (JSON ok)</span>
                </label>
                <SortirDeLAssistant onClick={differer}>
                  Passer — je veux d&apos;abord tester l&apos;app sans Google Sheets
                </SortirDeLAssistant>
              </div>
            )}

            {step === 2 && (
              <div className="animate-fade-up">
                <h2 className="font-display text-lg font-bold text-paper">Étape 2 — Le cerveau : n8n + les 11 workflows</h2>
                <ol className="mt-3 space-y-3">
                  <Li n={1} title="Lancez n8n avec ses variables">
                    Copiez-collez dans un terminal (remplacez les valeurs) — ou utilisez
                    <code className="code"> docker compose up -d</code> qui les injecte tout seul :
                    <CopyBlock id="launch" text={N8N_LAUNCH} copied={copied} onCopy={copy} />
                    Puis ouvrez <code className="code">http://localhost:5678</code> et créez votre compte local.
                  </Li>
                  <Li n={2} title="Créez les credentials (une fois)">
                    n8n → Credentials → Add : <strong className="text-paper-dim">Google Sheets</strong>,{" "}
                    <strong className="text-paper-dim">Gmail</strong>, <strong className="text-paper-dim">Google Calendar</strong>{" "}
                    (assistant Google), et <strong className="text-paper-dim">Ollama</strong> (base URL{" "}
                    <code className="code">http://localhost:11434</code>, après <code className="code">ollama pull qwen2.5:3b</code>).
                  </Li>
                  <Li n={3} title="Importez les 11 workflows (dossier integrations/n8n/)">
                    <span className="mt-1 block overflow-x-auto">
                      <table className="mt-1 w-full min-w-[380px] text-left text-[11px]">
                        <tbody>
                          {WORKFLOWS.map((w, i) => (
                            <tr key={w.file} className="border-t border-ink-700/60">
                              <td className="py-1 pr-2 font-mono text-bronze-400">{i + 1}. {w.file}</td>
                              <td className="py-1 pr-2 text-paper-faint">{w.map}</td>
                              <td className="py-1 whitespace-nowrap text-paper-dim">{w.activate ? "Activer ✓" : "Save"}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </span>
                  </Li>
                </ol>
                <label className="mt-4 flex cursor-pointer items-center gap-2.5 rounded-lg border border-ink-700 bg-ink-850 px-3 py-2.5">
                  <input type="checkbox" className="accent-bronze-500" checked={workflowReady} onChange={(e) => setWorkflowReady(e.target.checked)} />
                  <span className="text-sm text-paper">Mes workflows sont importés et activés</span>
                </label>
                <p className="mt-2 text-[11px] text-paper-faint">
                  Au minimum le n°1 (<code className="code">alpha-dashboard-api</code>) — c&apos;est lui que l&apos;app appelle.
                  Les autres peuvent attendre.
                </p>
                <SortirDeLAssistant onClick={differer}>
                  Passer — je veux d&apos;abord tester l&apos;app sans n8n
                </SortirDeLAssistant>
              </div>
            )}

            {step === 3 && (
              <div className="animate-fade-up">
                <h2 className="font-display text-lg font-bold text-paper">Étape 3 — Coller le lien de connexion</h2>
                <p className="mt-1 text-sm text-paper-dim">
                  Dans n8n, ouvrez le nœud <strong className="text-paper-dim">Webhook</strong> du workflow
                  <code className="code"> alpha-dashboard-api</code> et copiez l&apos;
                  <strong className="text-paper-dim">URL de Production</strong>. En local, elle ressemble à
                  <code className="code"> http://localhost:5678/webhook/alpha</code>.
                </p>
                <label className="label mt-4 flex items-center gap-1.5"><Link2 size={13} className="text-bronze-400" /> URL du webhook n8n</label>
                <input
                  className="input font-mono text-[12px]"
                  placeholder="http://localhost:5678/webhook/alpha"
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
                  n8n local (<code className="code">http://localhost:5678</code>) : ouvrez cette app aussi en local
                  (<code className="code">http://localhost:3000</code>) — un site en <code className="code">https://</code>
                  ne peut pas appeler <code className="code">http://localhost</code> (contenu mixte bloqué).
                  Si vous avez protégé le webhook par un mot de passe, mettez-le ici — il partira dans l&apos;en-tête
                  <code className="code"> x-alpha-secret</code>.
                </p>
              </div>
            )}

            {step === 4 && (
              <div className="animate-fade-up">
                <h2 className="font-display text-lg font-bold text-paper">Étape 4 — Vérifier que ça marche</h2>
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

            {step === 5 && (
              <div className="animate-fade-up">
                <h2 className="font-display text-lg font-bold text-paper">Étape 5 — Récupérer vos données</h2>
                <p className="mt-1 text-sm text-paper-dim">
                  On demande à n8n la liste de vos prospects. Le tableau de bord et toutes les métriques se remplissent avec vos vrais chiffres.
                </p>
                {prospects.length > 0 && (
                  <label className="mt-4 flex items-center gap-2 text-[12px] text-paper-faint">
                    {/**
                     * ⚠ CE BOUTON EFFAÇAIT TOUT EN UN CLIC, SANS RIEN DEMANDER.
                     *
                     * Il dit « vider la démo », mais `clearAllData()` ne fait
                     * aucune différence entre une fiche de démonstration et un
                     * vrai client : il vide prospects, campagnes, RDV et intel.
                     * Or l'assistant se ROUVRE tout seul tant que `onboarded`
                     * est faux — un opérateur qui a déjà saisi de vraies fiches
                     * peut très bien le retrouver devant lui.
                     *
                     * Le même appel, dans les réglages, demande confirmation en
                     * nommant ce qui part. Une fois sur deux ne protège rien :
                     * c'est le chemin NON gardé qu'on emprunte par accident.
                     */}
                    <button
                      className="btn-ghost px-2.5 py-1.5 text-[12px]"
                      onClick={() => {
                        if (
                          confirm(
                            `Effacer les ${prospects.length} fiche(s) actuelles ?\n\n` +
                              "Cela vide TOUT — prospects, campagnes, rendez-vous, intel — pas seulement la démo. " +
                              "Si certaines de ces fiches sont de vrais clients, elles seront perdues."
                          )
                        ) {
                          clearAllData();
                        }
                      }}
                    >
                      Vider la démo d&apos;abord
                    </button>
                    <span>({prospects.length} fiche(s) actuellement)</span>
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

            {step === 6 && (
              <div className="animate-fade-up">
                <h2 className="flex items-center gap-2 font-display text-lg font-bold text-paper">
                  <Mail size={16} className="text-bronze-400" /> Étape 6 — Envoi d&apos;emails &amp; IA locale
                </h2>
                <p className="mt-1 text-sm text-paper-dim">
                  Pour envoyer de vrais emails (trackés, beaux, anti-spam) et activer l&apos;IA locale, l&apos;app lit un fichier
                  <code className="code"> .env.local</code> à la racine du projet.
                </p>
                <ol className="mt-4 space-y-3">
                  <Li n={1} title="Copiez le modèle et remplissez-le">
                    <button className="btn-ghost mt-1 px-2.5 py-1.5 text-[12px]" onClick={() => copy("env", ENV_TEMPLATE)}>
                      <ClipboardCopy size={13} /> {copied === "env" ? "Copié ✓" : "Copier le modèle .env"}
                    </button>
                    <span className="mt-1 block">
                      Collez-le dans <code className="code">.env.local</code>. Les 2 essentiels :
                      <strong className="text-paper-dim"> SMTP_HOST/USER/PASS</strong> (n&apos;importe quel fournisseur — Gmail
                      app-password, Brevo, OVH…) et <strong className="text-paper-dim">WEBHOOK_SECRET</strong> (le même que
                      <code className="code"> ALPHA_WEBHOOK_SECRET</code> côté n8n). IA locale gratuite :
                      <code className="code"> OLLAMA_MODEL=qwen2.5:3b</code>.
                    </span>
                  </Li>
                  <Li n={2} title="Redémarrez l'app, puis vérifiez ici">
                    Arrêtez (<code className="code">Ctrl+C</code>) et relancez <code className="code">npm run dev</code>
                    (ou <code className="code">docker compose up -d --build</code>), revenez, et cliquez :
                  </Li>
                </ol>
                <button className="btn-bronze mt-3" onClick={loadHealth} disabled={healthLoading}>
                  {healthLoading ? <Loader2 size={15} className="animate-spin" /> : <RefreshCw size={15} />}
                  {healthLoading ? "Vérification…" : "Vérifier l'état du serveur"}
                </button>
                {c && (
                  <ul className="mt-3 space-y-1.5 rounded-lg border border-ink-700 bg-ink-850 p-3">
                    <StatusRow ok={c.email.configured} label="Envoi email (SMTP)" hint="requis pour envoyer" />
                    <StatusRow ok={c.ai.configured} label={c.ai.configured ? `IA connectée (${c.ai.model})` : "IA (Ollama ou Claude)"} hint="sinon moteur de templates hors-ligne" optional />
                    <StatusRow ok={c.inboundWebhook.configured} label="Secret webhook (réponses entrantes)" hint="requis pour recevoir les réponses" />
                    <StatusRow ok={c.tracking.persistence === "supabase"} label={`Persistance tracking : ${c.tracking.persistence === "supabase" ? "Supabase (durable)" : "mémoire"}`} hint="devient durable à l'étape suivante" optional />
                  </ul>
                )}
                <p className="mt-3 text-[11px] text-paper-faint">
                  Le détail complet vit dans <strong className="text-paper-dim">Réglages → État du système</strong>.
                  Cette étape est sautable — vous pourrez la faire plus tard.
                </p>
              </div>
            )}

            {step === 7 && (
              <div className="animate-fade-up">
                <h2 className="flex items-center gap-2 font-display text-lg font-bold text-paper">
                  <Database size={16} className="text-bronze-400" /> Étape 7 — Supabase (optionnel, recommandé)
                </h2>
                <p className="mt-1 text-sm text-paper-dim">
                  Rend le tracking, l&apos;anti-doublons et la synchro CRM <strong className="text-paper-dim">durables</strong>{" "}
                  (ils survivent aux redémarrages et se partagent entre machines). Gratuit.
                </p>
                <ol className="mt-4 space-y-3">
                  <Li n={1} title="Créez un projet sur supabase.com">
                    Puis SQL Editor → collez tout le fichier <code className="code">supabase/schema.sql</code> du projet → Run.
                  </Li>
                  <Li n={2} title="Copiez les 2 valeurs (Réglages du projet → API)">
                    L&apos;URL du projet et la clé <strong className="text-paper-dim">anon public</strong> :
                  </Li>
                </ol>
                <label className="label mt-3">URL du projet</label>
                <input className="input font-mono text-[12px]" placeholder="https://xxxx.supabase.co" value={sbUrl} onChange={(e) => setSbUrl(e.target.value)} />
                <label className="label mt-3">Clé anon public</label>
                <input className="input font-mono text-[12px]" type="password" placeholder="eyJhbGciOi…" value={sbKey} onChange={(e) => setSbKey(e.target.value)} />
                <button className="btn-bronze mt-3" onClick={linkSupabase} disabled={!sbUrl.trim() || !sbKey.trim()}>
                  <PlugZap size={15} /> Lier Supabase
                </button>
                {(sbMsg || sbLinked) && (
                  <p className={cn("mt-3 rounded-lg border px-3 py-2.5 text-[13px]", sbLinked ? "border-signal-green/40 bg-signal-green/5 text-signal-green" : "border-ink-700 bg-ink-850 text-paper-dim")}>
                    {sbMsg || "Supabase déjà lié ✓"}
                  </p>
                )}
                <p className="mt-3 text-[11px] text-paper-faint">
                  Pour la persistance <strong className="text-paper-dim">côté serveur</strong> (tracking, réponses entrantes),
                  ajoutez aussi <code className="code">SUPABASE_SERVICE_ROLE_KEY</code> dans le <code className="code">.env.local</code>{" "}
                  (clé <strong className="text-paper-dim">service_role</strong>, jamais dans le navigateur).
                </p>
                {sbLinked && (
                  <p className="mt-2 rounded-lg border border-bronze-700/50 bg-bronze-900/10 px-3 py-2 text-[11.5px] text-paper-dim">
                    🔐 <strong className="text-paper">Revente à d&apos;autres commerciaux ?</strong> Supabase lié, tu peux
                    activer les <strong className="text-paper-dim">comptes multi-locataires</strong> :{" "}
                    <strong className="text-paper-dim">Réglages → Sécurité → « Exiger un compte »</strong>. Chaque commercial
                    n&apos;aura accès qu&apos;à ses données (isolation RLS). À prouver à deux comptes avant de facturer.
                  </p>
                )}
              </div>
            )}

            {step === 8 && (
              <div className="animate-fade-up">
                <h2 className="flex items-center gap-2 font-display text-lg font-bold text-paper">
                  <Rocket size={16} className="text-bronze-400" /> Étape 8 — Déployer sur Vercel (optionnel, pour shipper)
                </h2>
                <p className="mt-1 text-[12px] text-paper-faint">
                  Le déploiement public joue UN rôle : <strong className="text-paper-dim">réceptionniste de tracking 24h/24</strong>{" "}
                  (le pixel doit être joignable même Mac éteint) — protégé par une <strong className="text-paper-dim">porte
                  d&apos;accès</strong>. L&apos;envoi (SMTP) et l&apos;IA (Ollama) restent sur votre machine.
                </p>
                <ol className="mt-4 space-y-3">
                  <Li n={1} title="Importez le repo sur vercel.com">
                    Sign up with GitHub → Import Project → sélectionnez le repo. Puis
                    <strong className="text-paper-dim"> Settings → Git → Production Branch</strong> = votre branche de travail
                    (chaque <code className="code">git push</code> redéploiera tout seul).
                  </Li>
                  <Li n={2} title="Collez les variables d'environnement">
                    Settings → Environment Variables — remplacez les valeurs puis Redeploy :
                    <CopyBlock id="vercel" text={VERCEL_ENV} copied={copied} onCopy={copy} />
                    <span className="mt-1 block">
                      <strong className="text-paper-dim">SITE_PASSWORD est OBLIGATOIRE</strong> : sans lui, n&apos;importe qui
                      voit votre CRM. Pas de SMTP ni d&apos;OLLAMA ici — ce n&apos;est pas leur maison.
                    </span>
                  </Li>
                  <Li n={3} title="Vérifiez en navigation privée">
                    <code className="code">https://votre-app.vercel.app</code> → l&apos;animation ALPHA puis
                    l&apos;<strong className="text-paper-dim">écran de connexion</strong> (pas le dashboard !).
                    Et <code className="code">/api/health</code> → du JSON avec <code className="code">&quot;gated&quot;: true</code>.
                  </Li>
                  <Li n={4} title="Pointez le tracking local dessus">
                    Sur votre machine, dans <code className="code">.env.local</code> :
                    <code className="code"> TRACKING_BASE_URL=https://votre-app.vercel.app</code> → redémarrez. Vos emails
                    embarquent alors des pixels joignables 24h/24 (comptés dans Supabase, lus par l&apos;app locale).
                  </Li>
                </ol>
                <p className="mt-3 rounded-lg border border-bronze-700/50 bg-bronze-900/10 px-3 py-2 text-[11.5px] text-paper-dim">
                  📱 <strong className="text-paper">Sur votre téléphone</strong> : ouvrez l&apos;URL dans Chrome →
                  menu ⋮ → <strong className="text-paper">« Ajouter à l&apos;écran d&apos;accueil »</strong> —
                  ALPHA OS s&apos;installe comme une app (icône aigle or, plein écran, raccourcis Pipeline/Campagnes).
                </p>
                <p className="mt-2 text-[11px] text-paper-faint">
                  Étape sautable — tant que vous testez en local avec un tunnel, tout marche. Détails :{" "}
                  <code className="code">docs/INSTALLATION.md</code> § Vercel.
                </p>
              </div>
            )}

            {step === 9 && (
              <div className="animate-fade-up">
                <div className="text-center">
                  <span className="mx-auto block animate-floaty text-bronze-400"><Eagle size={56} glow /></span>
                  <h2 className="mt-3 font-display text-xl font-extrabold text-paper">Tout est branché 🦅</h2>
                </div>
                <ul className="mt-4 space-y-1.5 rounded-lg border border-ink-700 bg-ink-850 p-3">
                  <StatusRow ok={sheetsReady} label="Google Sheets (la mémoire)" hint="Phase 1 du guide — faisable plus tard" optional />
                  <StatusRow ok={Boolean(testMsg?.ok || existing?.url || url)} label="n8n connecté (le cerveau)" hint="étapes 2–4" />
                  <StatusRow ok={Boolean(c?.email.configured)} label="Envoi email (SMTP)" hint="étape 6 — « Vérifier l'état du serveur »" optional />
                  <StatusRow ok={sbLinked} label="Supabase (mémoire durable)" hint="étape 7" optional />
                </ul>
                <a
                  href="/recette"
                  className="btn-bronze mt-4 flex w-full items-center justify-center gap-2"
                  onClick={finish}
                >
                  Lancer la recette guidée — prouver la boucle en live →
                </a>
                <p className="mt-1.5 text-center text-[11px] text-paper-faint">
                  Envoi réel vers une adresse test : ouverture, clic, réponse et STOP se vérifient tout seuls.
                </p>
                <div className="mt-4 rounded-lg border border-ink-700 bg-ink-850 p-4 text-left text-[12px] text-paper-dim">
                  <p className="font-medium text-paper">Vos 3 premiers gestes :</p>
                  <ul className="mt-2 space-y-1 text-paper-faint">
                    <li>• <strong className="text-paper-dim">Dashboard → Routines</strong> : votre to-do du jour, du haut vers le bas.</li>
                    <li>• <strong className="text-paper-dim">Campagnes → Réviser &amp; envoyer</strong> : relire CHAQUE message — l&apos;IA propose, vous disposez.</li>
                    <li>• Besoin de prospects ? Formulaire de sourcing n8n : <code className="code">…5678/form/alpha-sourcing</code>.</li>
                  </ul>
                  <p className="mt-3 text-[11px] text-paper-faint">
                    Guide complet pour former un employé : <code className="code">docs/INSTALLATION.md</code> ·
                    montée en volume : <code className="code">docs/RUNBOOK.md</code> ·
                    l&apos;assistant se relance depuis <strong className="text-paper-dim">Réglages</strong>.
                  </p>
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

            {step === STEPS.length - 1 ? (
              <button className="btn-bronze" onClick={finish}>Entrer dans l&apos;OS</button>
            ) : (
              <button
                className="btn-bronze"
                onClick={next}
                disabled={(step === 1 && !sheetsReady) || (step === 2 && !workflowReady) || (step === 3 && !url.trim())}
              >
                {step === 0 ? "C'est parti" : "Suivant"} <ArrowRight size={14} />
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
      <div className="min-w-0">
        <p className="text-sm font-medium text-paper">{title}</p>
        {/* div, pas p : le contenu peut contenir <pre> / <table> (interdits dans un p) */}
        <div className="text-[12px] text-paper-dim">{children}</div>
      </div>
    </li>
  );
}

function CopyBlock({ id, text, copied, onCopy }: { id: string; text: string; copied: string | null; onCopy: (id: string, text: string) => void }) {
  return (
    <span className="relative mt-2 block">
      <pre className="overflow-x-auto rounded-lg border border-ink-700 bg-ink-900 p-2.5 pr-10 font-mono text-[10.5px] leading-relaxed text-paper-dim">{text}</pre>
      <button
        className="absolute right-1.5 top-1.5 grid h-7 w-7 place-items-center rounded-md text-paper-faint hover:bg-ink-800 hover:text-paper"
        onClick={() => onCopy(id, text)}
        aria-label="Copier"
        title={copied === id ? "Copié ✓" : "Copier"}
      >
        {copied === id ? <CheckCircle2 size={14} className="text-signal-green" /> : <ClipboardCopy size={14} />}
      </button>
    </span>
  );
}

function StatusRow({ ok, label, hint, optional }: { ok: boolean; label: string; hint?: string; optional?: boolean }) {
  return (
    <li className="flex items-start gap-2">
      {ok ? (
        <CheckCircle2 size={15} className="mt-0.5 shrink-0 text-signal-green" />
      ) : (
        <Circle size={15} className={cn("mt-0.5 shrink-0", optional ? "text-paper-faint" : "text-bronze-400")} />
      )}
      <span className="min-w-0 text-[13px] text-paper">
        {label}
        {!ok && hint && <span className="ml-1.5 text-[11px] text-paper-faint">— {hint}</span>}
      </span>
    </li>
  );
}
