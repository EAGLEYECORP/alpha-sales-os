"use client";

import { useEffect, useRef, useState } from "react";
import { Cable, Cloud, CloudOff, Compass, Download, Eraser, FileSpreadsheet, KeyRound, Link2, Link2Off, Lock, PlugZap, Plus, RefreshCw, RotateCcw, ShieldCheck, Table2, Trash2, Upload, UserCog, Users, Wand2, Webhook } from "lucide-react";
import Link from "next/link";
import { useAlpha } from "@/lib/store";
import { SyncProspects } from "@/components/sync-prospects";
import { ValidationPartenairePanel } from "@/components/settings/validation-partenaire-panel";
import { importerFiches, ressembleAuTerrain } from "@/lib/sourcing-terrain-import";
import {
  pushSnapshot,
  pullSnapshot,
  getSupabaseConfig,
  supabaseConfigSource,
  setSupabaseConfig,
  clearSupabaseConfig,
  supabaseEnabled,
} from "@/lib/supabase";
import { cn, sha256, uid } from "@/lib/utils";
import { lockNow } from "@/components/security/lock-gate";
import { csvToProspects, CSV_TEMPLATE_HEADER } from "@/lib/csv";
import { projeterImport, readStorageHealth } from "@/lib/storage-health";
import { SystemStatus } from "@/components/settings/system-status";
import { PushToggle } from "@/components/settings/push-toggle";
import { NotionPush } from "@/components/settings/notion-push";
import { Deliverability } from "@/components/settings/deliverability";
import { CrmDictionary } from "@/components/settings/crm-dictionary";
import { PricingEditor } from "@/components/settings/pricing-editor";
import { OffresEditor } from "@/components/settings/offres-editor";
import { IcpGenerator } from "@/components/settings/icp-generator";
import { AccountSwitcher } from "@/components/settings/account-switcher";
import { ImportTriagePanel } from "@/components/settings/import-triage";
import { triageImport, type ImportTriage } from "@/lib/import-triage";
import { PanneauOperateur } from "@/components/settings/panneau-operateur";
import { openSetupWizard } from "@/components/setup-wizard";
import { openOperatorTour } from "@/components/tour/operator-tour";
import { getN8nConfig, setN8nConfig, clearN8nConfig, testN8n, syncFromN8n } from "@/lib/n8n";

export default function SettingsPage() {
  const { settings, patchSettings, exportData, importData, importProspects, clearAllData, resetToSeed, loadPipelineJuillet, loadProspectsICP, prospects } = useAlpha();
  const importRef = useRef<HTMLInputElement>(null);
  const csvRef = useRef<HTMLInputElement>(null);
  const [sheetUrl, setSheetUrl] = useState("");
  const [importMsg, setImportMsg] = useState("");
  const [triage, setTriage] = useState<ImportTriage | null>(null);
  const [syncMsg, setSyncMsg] = useState("");
  const [newKeyName, setNewKeyName] = useState("");
  const [newKeyValue, setNewKeyValue] = useState("");
  const [newPin, setNewPin] = useState("");

  // Supabase — linkable from the UI (client-only to avoid hydration mismatch)
  const [sbSource, setSbSource] = useState<"runtime" | "env" | null>(null);
  const [sbUrl, setSbUrl] = useState("");
  const [sbKey, setSbKey] = useState("");
  const [sbMsg, setSbMsg] = useState("");

  useEffect(() => {
    setSbSource(supabaseConfigSource());
    const cfg = getSupabaseConfig();
    if (cfg) {
      setSbUrl(cfg.url);
      setSbKey(cfg.key);
    }
  }, []);

  const linkSupabase = () => {
    if (!/^https:\/\/[a-z0-9-]+\.supabase\.(co|in|net)/i.test(sbUrl.trim())) {
      setSbMsg("URL invalide — attendu https://xxxx.supabase.co");
      return;
    }
    if (sbKey.trim().length < 20) {
      setSbMsg("Clé anon trop courte — copie la clé « anon public » du projet.");
      return;
    }
    setSupabaseConfig(sbUrl, sbKey);
    setSbSource(supabaseConfigSource());
    setSbMsg("Supabase lié ✓ — connecte-toi via /login, puis « Pousser ».");
  };

  const unlinkSupabase = () => {
    clearSupabaseConfig();
    setSbSource(supabaseConfigSource());
    setSbMsg("Configuration retirée.");
  };

  // Connexion n8n (le tableau de bord parle au webhook n8n)
  const [n8nUrl, setN8nUrl] = useState("");
  const [n8nSecret, setN8nSecret] = useState("");
  const [n8nConnected, setN8nConnectedState] = useState(false);
  const [n8nBusy, setN8nBusy] = useState(false);
  const [n8nMsg, setN8nMsg] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    const cfg = getN8nConfig();
    if (cfg) {
      setN8nUrl(cfg.url);
      setN8nSecret(cfg.secret ?? "");
      setN8nConnectedState(true);
    }
  }, []);

  const saveN8n = () => {
    setN8nConfig(n8nUrl, n8nSecret);
    setN8nConnectedState(Boolean(n8nUrl.trim()));
  };
  const testN8nConn = async () => {
    saveN8n();
    setN8nBusy(true);
    setN8nMsg(null);
    const r = await testN8n();
    setN8nMsg({ ok: r.ok, text: r.message });
    setN8nBusy(false);
  };
  const pullN8n = async () => {
    saveN8n();
    setN8nBusy(true);
    setN8nMsg(null);
    const r = await syncFromN8n();
    setN8nMsg(
      r.ok
        ? { ok: true, text: `✓ ${r.added ?? 0} prospect(s) importé(s), ${r.updated ?? 0} mis à jour depuis n8n.` }
        : { ok: false, text: `Échec : ${r.error}` }
    );
    setN8nBusy(false);
  };
  const disconnectN8n = () => {
    clearN8nConfig();
    setN8nUrl("");
    setN8nSecret("");
    setN8nConnectedState(false);
    setN8nMsg({ ok: true, text: "Déconnecté." });
  };

  const setPin = async () => {
    if (newPin.length < 4) {
      alert("PIN de 4 chiffres minimum.");
      return;
    }
    patchSettings({ security: { ...settings.security, pinHash: await sha256(newPin), autoLock: true } });
    setNewPin("");
  };

  const doExportJson = () => {
    const blob = new Blob([exportData()], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `alpha-sales-os-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
  };

  const doExportCsv = () => {
    const header = "company;name;sector;city;stage;trust;probability;monthlyValue;setupValue;ignoranceTax;nextStepDate;nextStepAction";
    const rows = prospects.map((p) =>
      [p.company, p.name, p.sector, p.city, p.stage, p.trust, p.probability, p.monthlyValue, p.setupValue, p.ignoranceTax, p.nextStep?.date ?? "", p.nextStep?.action ?? ""]
        .map((v) => `"${String(v).replace(/"/g, '""')}"`)
        .join(";")
    );
    const blob = new Blob(["﻿" + [header, ...rows].join("\n")], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `prospects-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
  };

  /**
   * ── LE MUR DE STOCKAGE, SUR LE CHEMIN QUI N'EN AVAIT PAS ──
   *
   * ⚠ `projeterImport` existait, était testé, et n'était branché que sur le
   * panneau de sourcing terrain. Ici — l'import CSV, celui par lequel arrivent
   * les gros lots — rien n'avertissait.
   *
   * Une écriture localStorage qui échoue ne ressemble pas à une panne :
   * l'écran affiche les fiches, elles disparaissent en fermant l'onglet.
   * `StorageAlert` finit par le dire, mais après.
   *
   * Ce chemin-ci n'a pas d'étape de prévisualisation où poser l'avertissement
   * (choisir le fichier suffit à importer). On DEMANDE donc, et seulement
   * quand la projection est en alerte : un import qui passe large ne doit rien
   * demander du tout, sinon la question devient un réflexe et se clique sans
   * être lue.
   */
  const passeLeMurDuStockage = (fiches: unknown[]): boolean => {
    if (!fiches.length) return true;
    const p = projeterImport(
      readStorageHealth(),
      fiches,
      Math.round(JSON.stringify(fiches).length / Math.max(1, fiches.length))
    );
    if (!p.alerte) return true;
    return confirm(`${p.phrase}\n\nImporter quand même ?`);
  };

  const applyCsv = (text: string) => {
    /**
     * ⚠ Un relevé TERRAIN ne passe pas par l'import CRM générique.
     *
     * Le flux réel est : relevé sur une carte → Google Sheet → ici. Or
     * `csvToProspects` ignore les colonnes qui portent tout le tri (avis,
     * extraits d'avis, code APE) : les fiches entraient et la plainte
     * d'injoignabilité, la verticale confirmée et le plan d'appels ne
     * sortaient jamais. L'import annonçait quand même « ✓ 200 nouveaux ».
     */
    if (ressembleAuTerrain(text)) {
      const r = importerFiches(text);
      if (r.retenus.length || r.ecartes.length) {
        const fiches = r.retenus.map((x) => x.prospect);
        if (!passeLeMurDuStockage(fiches)) {
          setImportMsg("Import annulé — rien n'a été écrit.");
          return;
        }
        const { added, updated } = importProspects(fiches);
        setImportMsg(
          `✓ Relevé terrain : ${added} nouveau(x), ${updated} mis à jour, ${r.ecartes.length} écartée(s). ${r.resume.join(" ")}`
        );
        setTriage(triageImport(fiches, settings.accountId));
        return;
      }
    }

    const { prospects: parsed, skipped, headersFound } = csvToProspects(text);
    if (parsed.length === 0) {
      setImportMsg(
        `Aucun prospect reconnu (${skipped} ligne(s) ignorée(s)). Colonnes détectées : ${headersFound.join(", ") || "aucune"}. Il faut au minimum une colonne « company / commerce ».`
      );
      return;
    }
    if (!passeLeMurDuStockage(parsed)) {
      setImportMsg("Import annulé — rien n'a été écrit.");
      return;
    }
    const { added, updated } = importProspects(parsed);
    setImportMsg(`✓ Import réussi : ${added} nouveau(x), ${updated} mis à jour, ${skipped} ligne(s) ignorée(s).`);
    // Deep-dive immédiat : le verdict du lot AVANT de lancer quoi que ce soit.
    setTriage(triageImport(parsed, settings.accountId));
  };

  const doImportCsvFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => applyCsv(String(reader.result));
    reader.readAsText(file);
    e.target.value = "";
  };

  const doImportSheet = async () => {
    if (!sheetUrl.trim()) return;
    setImportMsg("Récupération de la feuille…");
    try {
      const res = await fetch(`/api/import/sheet?url=${encodeURIComponent(sheetUrl.trim())}`);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setImportMsg(`Échec : ${data.error ?? res.status}`);
        return;
      }
      applyCsv(await res.text());
      setSheetUrl("");
    } catch {
      setImportMsg("Échec réseau — réessaie.");
    }
  };

  /**
   * ⚠ RESTAURER UNE SAUVEGARDE REMPLACE TOUT, ET NE DEMANDAIT RIEN.
   *
   * `importData` ne fusionne pas : il réécrit l'état entier — prospects,
   * campagnes, rendez-vous, intel. Choisir le fichier suffisait à l'appliquer.
   * Un export d'il y a trois semaines sélectionné par erreur dans le sélecteur
   * de fichiers effaçait trois semaines de travail, sans un mot.
   *
   * Les deux autres actions destructrices de cet écran (tout effacer, revenir
   * à la démo) demandent confirmation depuis toujours. Celle-ci est la plus
   * facile à déclencher par accident — c'est un clic dans une liste de
   * fichiers — et c'était la seule à ne rien demander.
   *
   * On confirme AVANT de lire le fichier : rien ne sert de charger ce qu'on
   * ne va pas appliquer, et le compteur de fiches actuelles donne à
   * l'opérateur la seule information qui décide vraiment.
   */
  const doImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (
      !confirm(
        `Restaurer « ${file.name} » ?\n\n` +
          `Cela REMPLACE tout l'état actuel (${prospects.length} fiche(s), campagnes, rendez-vous, intel) ` +
          "par le contenu de la sauvegarde. Ce qui n'est pas dans le fichier sera perdu."
      )
    ) {
      setImportMsg("Restauration annulée — rien n'a été touché.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const res = importData(String(reader.result));
      alert(res.ok ? "Import réussi ✓" : `Erreur : ${res.error}`);
    };
    reader.readAsText(file);
  };

  const sync = async (dir: "push" | "pull") => {
    setSyncMsg("Synchronisation…");
    const state = useAlpha.getState();
    const res =
      dir === "push"
        ? await pushSnapshot({
            prospects: state.prospects,
            campaigns: state.campaigns,
            meetings: state.meetings,
            activities: state.activities,
          })
        : await pullSnapshot();
    if (!res.ok) {
      setSyncMsg(`Échec : ${res.error}`);
      return;
    }
    if (dir === "pull" && "data" in res) {
      const d = res.data as Record<string, never[]>;
      useAlpha.setState((s) => ({
        prospects: (d.prospects as typeof s.prospects) ?? s.prospects,
        campaigns: (d.campaigns as typeof s.campaigns) ?? s.campaigns,
        meetings: (d.meetings as typeof s.meetings) ?? s.meetings,
        activities: (d.activities as typeof s.activities) ?? s.activities,
      }));
    }
    setSyncMsg(dir === "push" ? "Poussé vers Supabase ✓" : "Récupéré depuis Supabase ✓");
  };

  return (
    <div className="space-y-5 animate-fade-up">
      <header>
        <h1 className="font-display text-2xl font-bold text-paper">Réglages</h1>
        <p className="text-sm text-paper-faint">Règles business, clés API, données, rôles.</p>
      </header>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* ── OPÉRATEUR. Le gabarit d'environnement et l'état de NOTRE
            infrastructure : noms de variables, secrets attendus, sondes.
            Rien là-dedans n'appartient au client. ── */}
        <PanneauOperateur titre="Infrastructure">
          <SystemStatus />
        </PanneauOperateur>

        {/* Délivrabilité — DNS du domaine d'envoi (SPF / DKIM / DMARC) */}
        <Deliverability />

        {/* ── OPÉRATEUR. La connexion n8n porte l'URL et le SECRET partagé de
            notre orchestrateur. Le client ne branche pas notre cerveau. ── */}
        <PanneauOperateur titre="Orchestrateur n8n">
        {/* n8n — the app is a dashboard onto the n8n memory */}
        <section className="card p-4 lg:col-span-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="flex items-center gap-2 font-display text-sm font-semibold text-paper">
              <Cable size={15} className="text-bronze-400" /> Connexion n8n
              <span className={n8nConnected ? "chip border-signal-green/50 text-signal-green" : "chip border-ink-600 text-paper-faint"}>
                {n8nConnected ? "connecté" : "non connecté"}
              </span>
            </h2>
            <div className="flex gap-2">
              <button className="btn-ghost px-2.5 py-1.5 text-[12px]" onClick={openSetupWizard}>
                <Wand2 size={13} /> Relancer l&apos;assistant
              </button>
              <button className="btn-ghost px-2.5 py-1.5 text-[12px]" onClick={openOperatorTour}>
                <Compass size={13} /> Visite guidée
              </button>
            </div>
          </div>
          <p className="mt-1 text-[11px] text-paper-faint">
            L&apos;app est un <strong className="text-paper-dim">tableau de bord</strong> : la mémoire et les automatisations vivent dans n8n.
            Colle l&apos;URL de ton webhook n8n (nœud Webhook → URL de Production), teste, puis récupère tes prospects.
            Le lien reste dans ce navigateur. Pense à autoriser l&apos;origine (CORS) dans le nœud Webhook.
            n8n local ? URL <code className="font-mono text-bronze-400">http://localhost:5678/webhook/alpha</code> — ouvre alors cette app en <code className="font-mono text-bronze-400">http://localhost:3000</code> (un site https ne peut pas appeler http://localhost).
          </p>

          <div className="mt-3 grid gap-3 md:grid-cols-2">
            <div>
              <label className="label">URL du webhook</label>
              <input
                className="input font-mono text-[12px]"
                placeholder="http://localhost:5678/webhook/alpha"
                value={n8nUrl}
                onChange={(e) => setN8nUrl(e.target.value)}
              />
            </div>
            <div>
              <label className="label">Mot de passe partagé (facultatif)</label>
              <input
                className="input font-mono text-[12px]"
                type="password"
                placeholder="en-tête x-alpha-secret"
                value={n8nSecret}
                onChange={(e) => setN8nSecret(e.target.value)}
              />
            </div>
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            <button className="btn-bronze" onClick={testN8nConn} disabled={n8nBusy || !n8nUrl.trim()}>
              <PlugZap size={14} /> Tester la connexion
            </button>
            <button className="btn-ghost" onClick={pullN8n} disabled={n8nBusy || !n8nUrl.trim()}>
              <RefreshCw size={14} className={n8nBusy ? "animate-spin" : ""} /> Récupérer mes prospects
            </button>
            {n8nConnected && (
              <button className="btn-ghost" onClick={disconnectN8n}>Déconnecter</button>
            )}
          </div>
          {n8nMsg && (
            <p className={cn("mt-2 text-[12px]", n8nMsg.ok ? "text-signal-green" : "text-signal-red")}>{n8nMsg.text}</p>
          )}
        </section>
        </PanneauOperateur>

        {/* Dictionnaire CRM — toutes les variables suivies par Google Sheets */}
        <CrmDictionary />

        {/* ── OPÉRATEUR. Le portefeuille : EAGLEYE, Nuwacom. Ce sont
            NOS identités commerciales et NOS taux de reversement. Un client
            n'a rien à basculer là-dedans — et n'a pas à savoir que ça existe. ── */}
        <PanneauOperateur titre="Portefeuille de comptes">
          <AccountSwitcher />
        </PanneauOperateur>

        {/* Agency */}
        <section className="card space-y-3 p-4">
          <h2 className="font-display text-sm font-semibold text-paper">Agence</h2>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Nom</label>
              <input className="input" value={settings.agencyName} onChange={(e) => patchSettings({ agencyName: e.target.value })} />
            </div>
            <div>
              <label className="label">Closer</label>
              <input className="input" value={settings.closerName} onChange={(e) => patchSettings({ closerName: e.target.value })} />
            </div>
            <div>
              <label className="label">Objectif MRR (€)</label>
              <input type="number" className="input" value={settings.targetMRR} onChange={(e) => patchSettings({ targetMRR: +e.target.value })} />
            </div>
            <div>
              <label className="label">Commission sur CA (%)</label>
              <input type="number" className="input" value={settings.commissionPct} onChange={(e) => patchSettings({ commissionPct: +e.target.value })} />
            </div>
          </div>
          <div>
            <label className="label">Lien de réservation (Cal.com, Calendly…)</label>
            <input
              className="input"
              placeholder="https://cal.com/eagleye/audit-15min"
              value={settings.bookingUrl ?? ""}
              onChange={(e) => patchSettings({ bookingUrl: e.target.value.trim() })}
            />
            <p className="mt-1 text-[11.5px] text-paper-faint">
              C&apos;est la pièce qui te donne des <strong className="text-paper-dim">RDV en autonomie</strong> : elle
              ajoute un bouton « Réserver un créneau » dans tes emails, tes messages LinkedIn et l&apos;audit cadeau.
              Le prospect pose le rendez-vous lui-même, pendant que tu es sur le terrain.
            </p>
          </div>

          {/* Mon offre — white-label : ce que CE compte vend (docs + branding) */}
          <div className="rounded-xl border border-bronze-700/40 bg-bronze-900/10 p-3">
            <p className="text-[12px] font-medium text-paper">Mon offre — ce que je vends</p>
            <p className="mt-0.5 text-[11px] text-paper-faint">
              Le nom d&apos;agence ci-dessus + ces champs personnalisent tes documents (audit, projection). Chez EAGLEYE,
              tu vends Alpha Sales OS ; un autre commercial met la sienne.
            </p>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              <div>
                <label className="label">Ville (sur les documents)</label>
                <input
                  className="input"
                  placeholder="Lyon"
                  value={settings.offer?.city ?? ""}
                  onChange={(e) => patchSettings({ offer: { city: e.target.value, whatYouSell: settings.offer?.whatYouSell ?? "", valueProp: settings.offer?.valueProp ?? "" } })}
                />
              </div>
              <div>
                <label className="label">Ce que tu vends (une ligne)</label>
                <input
                  className="input"
                  placeholder="Alpha Sales OS — l'OS de vente terrain"
                  value={settings.offer?.whatYouSell ?? ""}
                  onChange={(e) => patchSettings({ offer: { city: settings.offer?.city ?? "", whatYouSell: e.target.value, valueProp: settings.offer?.valueProp ?? "" } })}
                />
              </div>
            </div>
            <div className="mt-2">
              <label className="label">Ta proposition de valeur (une phrase)</label>
              <input
                className="input"
                placeholder="Zéro lead perdu, la machine tourne 24/7."
                value={settings.offer?.valueProp ?? ""}
                onChange={(e) => patchSettings({ offer: { city: settings.offer?.city ?? "", whatYouSell: settings.offer?.whatYouSell ?? "", valueProp: e.target.value } })}
              />
            </div>
          </div>

          <div>
            <label className="label">Mode</label>
            <div className="flex gap-2">
              {(["solo", "team"] as const).map((r) => (
                <button
                  key={r}
                  className={settings.role === r ? "btn-bronze" : "btn-ghost"}
                  onClick={() => patchSettings({ role: r })}
                >
                  {r === "solo" ? "Solo" : "Équipe (journal d'audit)"}
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* ICP par offre — Alpha Sales OS sort le client parfait de l'offre du compte */}
        <IcpGenerator />

        {/* Tarifs — white-label : chaque compte définit ses prix (pilote /offre) */}
        {/* Ce que TU vends — editable sans redeployer. Placé avant la grille
            tarifaire : on définit l'offre, puis on la chiffre. */}
        {/* Ce que le TITULAIRE du compte vend à SES prospects : ça lui
            appartient, white-label oblige. Reste côté client. */}
        <OffresEditor />

        {/* ── OPÉRATEUR. La grille tarifaire d'Alpha Sales OS — nos prix, nos
            paliers. Le client achète l'outil ; il n'édite pas son prix. ── */}
        <PanneauOperateur titre="Grille tarifaire Alpha">
          <PricingEditor />
        </PanneauOperateur>

        <PushToggle />

        <NotionPush />

        {/* API keys vault */}
        <section className="card p-4">
          <h2 className="flex items-center gap-2 font-display text-sm font-semibold text-paper">
            <KeyRound size={15} className="text-bronze-400" /> Coffre à clés API
          </h2>
          <p className="mt-1 text-[11px] text-paper-faint">
            Stockage local masqué. En production : variables d&apos;environnement Vercel + Supabase Vault (jamais dans le navigateur).
          </p>
          <ul className="mt-3 space-y-2">
            {settings.apiKeys.map((k) => (
              <li key={k.id} className="flex items-center justify-between rounded-lg border border-ink-700 bg-ink-850 px-3 py-2 text-sm">
                <span className="text-paper">{k.name}</span>
                <span className="flex items-center gap-3">
                  <code className="font-mono text-[11px] text-paper-faint">{k.masked}</code>
                  <button
                    className="text-paper-faint hover:text-signal-red"
                    onClick={() => patchSettings({ apiKeys: settings.apiKeys.filter((x) => x.id !== k.id) })}
                  >
                    <Trash2 size={13} />
                  </button>
                </span>
              </li>
            ))}
          </ul>
          <div className="mt-3 flex gap-2">
            <input className="input flex-1" placeholder="Nom (ex : ANTHROPIC_API_KEY)" value={newKeyName} onChange={(e) => setNewKeyName(e.target.value)} />
            <input className="input flex-1" type="password" placeholder="Valeur" value={newKeyValue} onChange={(e) => setNewKeyValue(e.target.value)} />
            <button
              className="btn-ghost"
              onClick={() => {
                if (!newKeyName.trim() || !newKeyValue.trim()) return;
                patchSettings({
                  apiKeys: [
                    ...settings.apiKeys,
                    { id: uid(), name: newKeyName, masked: `${newKeyValue.slice(0, 4)}…${newKeyValue.slice(-3)}` },
                  ],
                });
                setNewKeyName("");
                setNewKeyValue("");
              }}
            >
              <Plus size={14} />
            </button>
          </div>
        </section>

        {/* Business rules */}
        <section className="card p-4 lg:col-span-2">
          <h2 className="font-display text-sm font-semibold text-paper">Règles business (injectées dans l&apos;IA)</h2>
          <p className="mt-1 text-[11px] text-paper-faint">
            Chaque génération de script, recadrage d&apos;objection et résumé lit ces règles. C&apos;est ta doctrine, mot pour mot.
          </p>
          <textarea
            className="input mt-3 min-h-56 font-mono text-[12px] leading-relaxed"
            value={settings.businessRules}
            onChange={(e) => patchSettings({ businessRules: e.target.value })}
          />
        </section>

        {/* Data — real data first */}
        <section className="card p-4 lg:col-span-2">
          <h2 className="flex items-center gap-2 font-display text-sm font-semibold text-paper">
            <Table2 size={15} className="text-bronze-400" /> Données réelles — import & export
          </h2>
          <div className="mt-3 grid gap-4 md:grid-cols-2">
            <div>
              <label className="label">Importer depuis Google Sheets</label>
              <p className="mb-2 text-[11px] text-paper-faint">
                Colle un lien de partage (« tous ceux qui ont le lien ») ou de publication CSV. Les prospects sont fusionnés par email/commerce — jamais dupliqués.
              </p>
              <div className="flex gap-2">
                <input
                  className="input flex-1"
                  placeholder="https://docs.google.com/spreadsheets/d/…"
                  value={sheetUrl}
                  onChange={(e) => setSheetUrl(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && doImportSheet()}
                />
                <button className="btn-bronze" onClick={doImportSheet}>
                  <FileSpreadsheet size={14} /> Importer
                </button>
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                <button className="btn-ghost" onClick={() => csvRef.current?.click()}>
                  <Upload size={14} /> Fichier CSV
                </button>
                <input ref={csvRef} type="file" accept=".csv,text/csv" className="hidden" onChange={doImportCsvFile} />
                <button
                  className="btn-ghost"
                  onClick={() => {
                    navigator.clipboard.writeText(CSV_TEMPLATE_HEADER.replace(/;/g, "\t"));
                    setImportMsg("✓ En-têtes copiés — colle-les dans la 1re ligne de ta feuille (colonnes séparées par tabulation).");
                  }}
                >
                  Copier le modèle de colonnes
                </button>
              </div>
              <p className="mt-2 text-[11px] text-paper-faint">
                Colonnes reconnues : commerce, nom, secteur, ville, téléphone, email, étape, abonnement, setup, taxe, note Google, avis, appels ratés, panier moyen, conversion, site, réseaux, concurrence, process, problèmes (séparés par |), notes.
              </p>
              {importMsg && <p className="mt-2 rounded-lg border border-ink-700 bg-ink-850 px-3 py-2 text-[12px] text-paper-dim">{importMsg}</p>}
              {triage && <ImportTriagePanel t={triage} />}
            </div>
            <div>
              <label className="label">Exports & remise à zéro</label>
              <div className="flex flex-wrap gap-2">
                <button className="btn-ghost" onClick={doExportJson}>
                  <Download size={14} /> Export JSON
                </button>
                <button className="btn-ghost" onClick={doExportCsv}>
                  <Download size={14} /> Export CSV
                </button>
                <button className="btn-ghost" onClick={() => importRef.current?.click()}>
                  <Upload size={14} /> Import JSON
                </button>
                <input ref={importRef} type="file" accept=".json" className="hidden" onChange={doImport} />
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  className="btn-danger"
                  onClick={() =>
                    confirm("Effacer TOUTES les données (prospects, campagnes, RDV, intel) pour démarrer avec tes vraies données ?") && clearAllData()
                  }
                >
                  <Eraser size={14} /> Tout vider — mode données réelles
                </button>
                <button
                  className="btn-ghost"
                  onClick={() => confirm("Restaurer les données de démo Lyon ? Les données actuelles seront perdues.") && resetToSeed()}
                >
                  <RotateCcw size={14} /> Restaurer la démo
                </button>
                {/* ── OPÉRATEUR. Ces deux boutons chargent NOS fiches
                    réelles : noms, téléphones et adresses d'entreprises
                    lyonnaises existantes. C'est notre actif commercial ET des
                    données personnelles de tiers — un client n'a aucun titre
                    à les charger dans son propre CRM.

                    ⚠ Masquer ne suffit pas : la route `/api/pipeline` qui les
                    sert est désormais réservée au compte maître dans le
                    middleware (`MAITRE_SEULEMENT`). Ici on évite seulement
                    d'afficher un bouton qui rendrait 403. ── */}
                <PanneauOperateur>
                  <div className="flex flex-wrap gap-2">
                <button
                  className="btn-bronze px-2.5 py-1.5 text-[12px]"
                  title="Charge les 16 fiches réelles de juillet 2026 (Scintia · Lyon) avec leurs rendez-vous datés. Remplace les données actuelles."
                  /**
                   * ⚠ CETTE BOÎTE NOMMAIT TROIS VRAIS PROSPECTS ET LEURS DATES
                   * DE RENDEZ-VOUS. Mesuré dans le build : la chaîne
                   * « ***NOM-RETIRE*** 3/08, Vauban 3/08, ***NOM-RETIRE*** 5/08 » se trouvait dans
                   * un chunk de `_next/static/**`, chemin exclu du middleware —
                   * donc lisible sans mot de passe, par un concurrent comme par
                   * n'importe qui.
                   *
                   * C'est exactement la fuite dont `lib/pipeline-juillet` porte
                   * déjà le post-mortem. La garde existait, et elle protégeait
                   * le MODULE : les noms avaient simplement été retapés à la
                   * main dans une page client, où plus rien ne les surveillait.
                   *
                   * La confirmation n'a besoin d'aucun nom pour être claire :
                   * ce que l'opérateur décide, c'est d'écraser ses données.
                   */
                  onClick={() =>
                    confirm(
                      "Charger le pipeline RÉEL de juillet 2026 ?\n\n16 fiches, 6 rendez-vous datés, closings de septembre.\n\nLes données actuelles seront remplacées."
                    ) &&
                    // Les fiches viennent du serveur (elles portent des
                    // coordonnées réelles) : l'échec doit se voir, sinon
                    // l'opérateur croit avoir chargé un pipeline vide.
                    void loadPipelineJuillet().catch((e: Error) => setImportMsg(`⚠ ${e.message}`))
                  }
                >
                  <Download size={13} /> Charger mon pipeline juillet
                </button>
                <button
                  className="btn-bronze px-2.5 py-1.5 text-[12px]"
                  title="Ajoute 20 prospects ICP Alpha Voice tirés de tes feuilles réelles (Lyon 6 & 7 : garages, artisans, immobilier, auto-école, spa…). Fusionne — n'efface rien."
                  onClick={() => {
                    void loadProspectsICP()
                      .then(({ added, updated }) =>
                        setImportMsg(
                          `✓ Prospects ICP Alpha Voice chargés : ${added} nouveau(x), ${updated} mis à jour. Cible d'abord ceux avec un email (Boîte d'envoi) et appelle les autres.`
                        )
                      )
                      .catch((e: Error) => setImportMsg(`⚠ ${e.message}`));
                  }}
                >
                  <Download size={13} /> Prospects ICP (Alpha Voice)
                </button>
                  </div>
                </PanneauOperateur>
              </div>
              <label className="label mt-4 flex items-center gap-1.5"><Webhook size={13} className="text-bronze-400" /> Webhook entrant (réponses)</label>
              <code className="block rounded-lg border border-ink-700 bg-ink-850 px-3 py-2 font-mono text-[11px] text-paper-dim">
                POST {typeof window !== "undefined" ? window.location.origin : ""}/api/webhooks/inbound<br />
                Header x-webhook-secret: $WEBHOOK_SECRET<br />
                {"{"} &quot;type&quot;: &quot;email.reply&quot;, &quot;email&quot;: &quot;…&quot;, &quot;message&quot;: &quot;…&quot; {"}"}
              </code>
              <p className="mt-1.5 text-[11px] text-paper-faint">
                Branche Instantly / Smartlead / Zapier / Make dessus. Les réponses arrivent dans Campagnes → Réponses entrantes. Définis <code className="font-mono text-bronze-400">WEBHOOK_SECRET</code> (+ <code className="font-mono text-bronze-400">SUPABASE_SERVICE_ROLE_KEY</code> en prod serverless).
              </p>
            </div>
          </div>
        </section>

        {/* Security */}
        <section className="card p-4 lg:col-span-2">
          <h2 className="flex items-center gap-2 font-display text-sm font-semibold text-paper">
            <ShieldCheck size={15} className="text-bronze-400" /> Sécurité
          </h2>
          <div className="mt-3 grid gap-4 md:grid-cols-2">
            <div>
              <label className="label">Verrou d&apos;application (PIN)</label>
              {settings.security.pinHash ? (
                <div className="space-y-2">
                  <p className="text-sm text-signal-green">PIN actif ✓ — demandé à chaque nouvelle session navigateur.</p>
                  <label className="flex items-center gap-2 text-sm text-paper-dim">
                    <input
                      type="checkbox"
                      className="accent-bronze-500"
                      checked={settings.security.autoLock}
                      onChange={(e) => patchSettings({ security: { ...settings.security, autoLock: e.target.checked } })}
                    />
                    Verrouillage automatique à l&apos;ouverture
                  </label>
                  <div className="flex gap-2">
                    <button className="btn-ghost" onClick={lockNow}>
                      <Lock size={14} /> Verrouiller maintenant
                    </button>
                    <button
                      className="btn-danger"
                      onClick={() =>
                        confirm("Supprimer le PIN ?") &&
                        patchSettings({ security: { pinHash: null, autoLock: false } })
                      }
                    >
                      Supprimer le PIN
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex gap-2">
                  <input
                    type="password"
                    inputMode="numeric"
                    className="input w-40 font-mono"
                    placeholder="Nouveau PIN"
                    value={newPin}
                    onChange={(e) => setNewPin(e.target.value)}
                  />
                  <button className="btn-bronze" onClick={setPin}>Activer</button>
                </div>
              )}
              <p className="mt-2 text-[11px] text-paper-faint">
                Défense en profondeur pour un poste laissé ouvert — le PIN est haché (SHA-256), jamais stocké en clair. En mode équipe, l&apos;authentification réelle passe par Supabase (lien magique + RLS).
              </p>
            </div>
            <div>
              <label className="label">Défenses actives</label>
              <ul className="space-y-1.5 text-[12px] text-paper-dim">
                <li>✓ Clé Anthropic <strong className="text-paper">côté serveur uniquement</strong> (jamais exposée au navigateur)</li>
                <li>✓ En-têtes durcis : CSP, X-Frame-Options DENY, nosniff, Referrer-Policy stricte</li>
                <li>✓ Supabase : Row Level Security par utilisateur, journal d&apos;audit append-only, bucket privé</li>
                <li>✓ Sortie IA échappée avant rendu (anti-XSS) · aucune dépendance CDN tierce au runtime</li>
                <li>✓ Export chiffrable : les données restent locales tant que la sync n&apos;est pas activée</li>
              </ul>
            </div>
          </div>

          {/* Compte multi-locataire (SaaS) — exiger une connexion Supabase */}
          <div className="mt-4 rounded-xl border border-ink-700 bg-ink-900/40 p-3.5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="flex items-center gap-2 text-sm font-medium text-paper">
                  <Users size={14} className="text-bronze-400" /> Compte multi-locataire (SaaS)
                </p>
                <p className="mt-1 text-[11px] text-paper-faint">
                  Exige un compte (email + mot de passe) pour ouvrir l&apos;app. Chaque commercial ne voit que ses
                  données — isolation par compte (RLS Supabase). Nécessaire pour revendre l&apos;OS à d&apos;autres
                  commerciaux.
                </p>
              </div>
              <Link href="/compte" className="btn-ghost shrink-0">
                <UserCog size={14} /> Gérer le compte
              </Link>
            </div>

            {supabaseEnabled() ? (
              <label className="mt-3 flex items-center gap-2 text-sm text-paper-dim">
                <input
                  type="checkbox"
                  className="accent-bronze-500"
                  checked={Boolean(settings.security.requireAuth)}
                  onChange={(e) =>
                    patchSettings({ security: { ...settings.security, requireAuth: e.target.checked } })
                  }
                />
                Exiger un compte pour ouvrir l&apos;app
              </label>
            ) : (
              <p className="mt-3 text-[11px] text-signal-amber">
                Lie d&apos;abord Supabase (section ci-dessous) pour activer les comptes. Sans lien, ce réglage reste
                sans effet.
              </p>
            )}
            <p className="mt-2 text-[10.5px] italic text-paper-faint">
              ⚠ À prouver à deux comptes avant de facturer un client — l&apos;isolation RLS se vérifie, elle ne se
              suppose pas (docs/SECURITE.md).
            </p>
          </div>
        </section>

        {/* La synchro du pipe — juste au-dessus de la config Supabase dont
            elle dépend, pour qu'on ne cherche pas l'interrupteur ailleurs. */}
        <div className="lg:col-span-2">
          <SyncProspects />
          {/* Ce qui sort au nom d'un partenaire passe devant lui d'abord. */}
          <ValidationPartenairePanel />
        </div>

        {/* Supabase — linkable from the UI */}
        {/* ── OPÉRATEUR. Clés d'infrastructure Supabase. ── */}
        <PanneauOperateur titre="Supabase">
        <section className="card p-4 lg:col-span-2">
          <h2 className="flex items-center gap-2 font-display text-sm font-semibold text-paper">
            {sbSource ? <Cloud size={15} className="text-signal-green" /> : <CloudOff size={15} className="text-paper-faint" />}
            Supabase
            {sbSource && (
              <span className={sbSource === "runtime" ? "chip border-signal-green/50 text-signal-green" : "chip border-bronze-700 text-bronze-400"}>
                {sbSource === "runtime" ? "lié (cette machine)" : "via variables d'env"}
              </span>
            )}
          </h2>
          <p className="mt-1 text-[11px] text-paper-faint">
            Colle l&apos;URL du projet et la clé <strong>anon public</strong> (Supabase → Project Settings → API). La config est
            stockée dans ce navigateur et prend le pas sur les variables d&apos;environnement. Applique d&apos;abord{" "}
            <code className="font-mono text-bronze-400">supabase/schema.sql</code> (SQL Editor).
          </p>

          <div className="mt-3 grid gap-3 md:grid-cols-2">
            <div>
              <label className="label">URL du projet</label>
              <input
                className="input font-mono text-[12px]"
                placeholder="https://xxxx.supabase.co"
                value={sbUrl}
                onChange={(e) => setSbUrl(e.target.value)}
              />
            </div>
            <div>
              <label className="label">Clé anon public</label>
              <input
                className="input font-mono text-[12px]"
                type="password"
                placeholder="eyJhbGciOi…"
                value={sbKey}
                onChange={(e) => setSbKey(e.target.value)}
              />
            </div>
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            <button className="btn-bronze" onClick={linkSupabase}>
              <Link2 size={14} /> {sbSource === "runtime" ? "Mettre à jour le lien" : "Lier Supabase"}
            </button>
            {sbSource === "runtime" && (
              <button className="btn-ghost" onClick={unlinkSupabase}>
                <Link2Off size={14} /> Délier
              </button>
            )}
            {sbSource && (
              <>
                <span className="mx-1 self-center text-ink-600">|</span>
                <button className="btn-bronze" onClick={() => sync("push")}>Pousser</button>
                <button className="btn-ghost" onClick={() => sync("pull")}>Récupérer</button>
              </>
            )}
          </div>
          {sbMsg && <p className="mt-2 text-[12px] text-paper-dim">{sbMsg}</p>}
          {syncMsg && <p className="mt-1 text-[12px] text-paper-dim">{syncMsg}</p>}

          <p className="mt-3 border-t border-ink-700 pt-3 text-[11px] text-paper-faint">
            La synchronisation prospects/campagnes/RDV exige une session auth (lien magique via <code className="font-mono text-bronze-400">/login</code>) — RLS isole chaque utilisateur.
            Pour <strong className="text-paper-dim">persister le tracking email</strong> (ouvertures/clics) côté serveur, définis aussi{" "}
            <code className="font-mono text-bronze-400">SUPABASE_SERVICE_ROLE_KEY</code> en variable d&apos;environnement serveur (table <code className="font-mono text-bronze-400">tracking_messages</code>, service role uniquement).
          </p>
        </section>
        </PanneauOperateur>
      </div>
    </div>
  );
}
