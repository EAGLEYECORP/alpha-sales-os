"use client";

import { useRef, useState } from "react";
import { Cloud, CloudOff, Download, Eraser, FileSpreadsheet, KeyRound, Lock, Plus, RotateCcw, ShieldCheck, Table2, Trash2, Upload, Webhook } from "lucide-react";
import { useAlpha } from "@/lib/store";
import { supabaseEnabled, pushSnapshot, pullSnapshot } from "@/lib/supabase";
import { sha256, uid } from "@/lib/utils";
import { lockNow } from "@/components/security/lock-gate";
import { csvToProspects, CSV_TEMPLATE_HEADER } from "@/lib/csv";

export default function SettingsPage() {
  const { settings, patchSettings, exportData, importData, importProspects, clearAllData, resetToSeed, prospects } = useAlpha();
  const importRef = useRef<HTMLInputElement>(null);
  const csvRef = useRef<HTMLInputElement>(null);
  const [sheetUrl, setSheetUrl] = useState("");
  const [importMsg, setImportMsg] = useState("");
  const [syncMsg, setSyncMsg] = useState("");
  const [newKeyName, setNewKeyName] = useState("");
  const [newKeyValue, setNewKeyValue] = useState("");
  const [newPin, setNewPin] = useState("");

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

  const applyCsv = (text: string) => {
    const { prospects: parsed, skipped, headersFound } = csvToProspects(text);
    if (parsed.length === 0) {
      setImportMsg(
        `Aucun prospect reconnu (${skipped} ligne(s) ignorée(s)). Colonnes détectées : ${headersFound.join(", ") || "aucune"}. Il faut au minimum une colonne « company / commerce ».`
      );
      return;
    }
    const { added, updated } = importProspects(parsed);
    setImportMsg(`✓ Import réussi : ${added} nouveau(x), ${updated} mis à jour, ${skipped} ligne(s) ignorée(s).`);
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

  const doImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const res = importData(String(reader.result));
      alert(res.ok ? "Import réussi ✓" : `Erreur : ${res.error}`);
    };
    reader.readAsText(file);
    e.target.value = "";
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
        </section>

        {/* Supabase */}
        <section className="card p-4">
          <h2 className="flex items-center gap-2 font-display text-sm font-semibold text-paper">
            {supabaseEnabled() ? <Cloud size={15} className="text-signal-green" /> : <CloudOff size={15} className="text-paper-faint" />}
            Supabase
          </h2>
          {supabaseEnabled() ? (
            <>
              <p className="mt-1 text-[11px] text-paper-faint">Connecté. Synchronise le snapshot local (nécessite une session auth).</p>
              <div className="mt-3 flex gap-2">
                <button className="btn-bronze" onClick={() => sync("push")}>Pousser</button>
                <button className="btn-ghost" onClick={() => sync("pull")}>Récupérer</button>
              </div>
              {syncMsg && <p className="mt-2 text-[12px] text-paper-dim">{syncMsg}</p>}
            </>
          ) : (
            <p className="mt-1 text-[12px] text-paper-faint">
              Non configuré — l&apos;app tourne en 100 % local. Renseigne <code className="font-mono text-bronze-400">NEXT_PUBLIC_SUPABASE_URL</code> et{" "}
              <code className="font-mono text-bronze-400">NEXT_PUBLIC_SUPABASE_ANON_KEY</code>, applique <code className="font-mono text-bronze-400">supabase/schema.sql</code>, redémarre.
            </p>
          )}
        </section>
      </div>
    </div>
  );
}
