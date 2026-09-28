"use client";

import { useEffect, useState } from "react";
import { Check, KeyRound, Loader2, Mail, Trash2 } from "lucide-react";

/**
 * ─────────────────────────────────────────────────────────────────────
 * APPORTER SA CLÉ IA.
 *
 * Mesuré avant d'écrire ce panneau : un compte gratuit pouvait appeler 4
 * familles d'API sur 20. L'IA n'était pas fermée par choix commercial — elle
 * brûlait NOTRE clé, donc l'ouvrir revenait à donner notre carte bancaire à
 * des inconnus. Ce panneau est la porte de sortie : le locataire apporte sa
 * clé, la paie chez son fournisseur, et l'IA s'ouvre.
 *
 * ══ CE QUI EST DÉLIBÉRÉ ICI ══
 *
 * **La clé ne revient JAMAIS du serveur.** On affiche l'empreinte — quatre
 * derniers caractères — et la date de vérification. Le champ de saisie
 * repart vide à chaque chargement, et ce n'est pas un oubli : redescendre un
 * secret dans un navigateur l'expose à la première faille XSS, pour un
 * confort dont personne n'a besoin (il a déjà sa clé).
 *
 * **Rien n'est « enregistré » sans avoir répondu.** Le serveur fait un vrai
 * appel avant de marquer la clé vérifiée, et ça prend quelques secondes. Une
 * clé fautive est refusée ICI, pas devant un prospect.
 * ─────────────────────────────────────────────────────────────────────
 */

interface EtatCle {
  empreinte: string;
  verifieLe: string | null;
  dernierEchec: string | null;
}

export function CleIA() {
  const [etat, setEtat] = useState<EtatCle | null>(null);
  const [chargement, setChargement] = useState(true);
  const [anthropic, setAnthropic] = useState("");
  const [nvidia, setNvidia] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ton: "ok" | "erreur"; texte: string } | null>(null);

  const recharger = async () => {
    try {
      const r = await fetch("/api/credentials");
      const d = (await r.json()) as { cles?: Record<string, EtatCle> };
      setEtat(d.cles?.ia ?? null);
    } catch {
      setEtat(null);
    } finally {
      setChargement(false);
    }
  };

  useEffect(() => {
    void recharger();
  }, []);

  const enregistrer = async () => {
    setBusy(true);
    setMessage(null);
    try {
      const r = await fetch("/api/credentials", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          capacite: "ia",
          valeurs: { ANTHROPIC_API_KEY: anthropic, NVIDIA_API_KEY: nvidia },
        }),
      });
      const d = (await r.json()) as { ok?: boolean; error?: string };
      if (!r.ok || !d.ok) {
        setMessage({ ton: "erreur", texte: d.error ?? "Enregistrement refusé." });
      } else {
        // ⚠ On vide les champs : la clé est partie, elle ne doit pas rester
        // affichée dans un onglet ouvert toute la journée.
        setAnthropic("");
        setNvidia("");
        setMessage({ ton: "ok", texte: "Clé vérifiée et enregistrée. L'IA est ouverte." });
        await recharger();
      }
    } catch {
      setMessage({ ton: "erreur", texte: "Le serveur n'a pas répondu." });
    } finally {
      setBusy(false);
    }
  };

  const oublier = async () => {
    setBusy(true);
    try {
      await fetch("/api/credentials?capacite=ia", { method: "DELETE" });
      setMessage({ ton: "ok", texte: "Clé oubliée. L'IA se referme." });
      await recharger();
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="card p-4">
      <p className="flex items-center gap-2 text-sm font-medium text-paper">
        <KeyRound size={15} className="text-bronze-400" /> Ta clé IA
      </p>
      <p className="mt-1 text-[12px] leading-relaxed text-paper-dim">
        Colle ta propre clé et l&apos;IA s&apos;ouvre — rédaction, sparring, copilote. Tu la paies
        chez ton fournisseur, directement. Rien ne passe par notre compte.
      </p>

      {chargement ? (
        <p className="panel mt-3 p-3 text-[12px] text-paper-faint">
          <Loader2 size={13} className="inline animate-spin" /> Lecture de l&apos;état…
        </p>
      ) : etat?.verifieLe ? (
        <div className="panel mt-3 flex flex-wrap items-center justify-between gap-2 p-3">
          <span className="text-[12px] text-paper">
            <Check size={13} className="inline text-signal-green" /> Clé active{" "}
            <span className="font-mono text-paper-dim">{etat.empreinte}</span>
          </span>
          <button className="btn-ghost px-3 py-1.5 text-[12px]" onClick={() => void oublier()} disabled={busy}>
            <Trash2 size={13} /> Oublier
          </button>
        </div>
      ) : (
        <p className="panel mt-3 p-3 text-[11.5px] leading-snug text-paper-faint">
          Aucune clé enregistrée — l&apos;IA reste fermée sur ce compte.
        </p>
      )}

      <div className="mt-3 space-y-2">
        <label className="block">
          <span className="text-[11px] uppercase tracking-wider text-paper-faint">Clé Anthropic</span>
          <input
            type="password"
            autoComplete="off"
            value={anthropic}
            onChange={(e) => setAnthropic(e.target.value)}
            placeholder="sk-ant-…"
            className="panel mt-1 w-full px-3 py-2 font-mono text-[12px] text-paper"
          />
        </label>
        <label className="block">
          <span className="text-[11px] uppercase tracking-wider text-paper-faint">
            ou clé NVIDIA NIM
          </span>
          <input
            type="password"
            autoComplete="off"
            value={nvidia}
            onChange={(e) => setNvidia(e.target.value)}
            placeholder="nvapi-…"
            className="panel mt-1 w-full px-3 py-2 font-mono text-[12px] text-paper"
          />
        </label>
      </div>

      <button
        className="btn-ghost mt-3 px-3 py-1.5 text-[12px]"
        onClick={() => void enregistrer()}
        disabled={busy || (!anthropic.trim() && !nvidia.trim())}
      >
        {busy ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
        {busy ? "Vérification en cours…" : "Vérifier et enregistrer"}
      </button>

      {message && (
        <p
          className={`panel mt-3 p-3 text-[11.5px] leading-snug ${
            message.ton === "ok" ? "text-signal-green" : "text-signal-amber"
          }`}
        >
          {message.texte}
        </p>
      )}

      {/* ⚠⚠ LA PHRASE QUI EMPÊCHE CE PANNEAU DE MENTIR. Un champ de mot de
          passe vide, à côté d'une clé « active », se lit comme un bug ou comme
          une clé perdue. On dit ce qui se passe. */}
      <p className="mt-3 text-[11px] leading-snug text-paper-faint">
        On vérifie la clé par un vrai appel avant de l&apos;accepter — ça prend quelques secondes.
        Ensuite elle est chiffrée et <strong>ne ressort jamais</strong> : ces champs resteront vides,
        seule l&apos;empreinte s&apos;affiche. Pour en changer, colle simplement la nouvelle.
      </p>
    </section>
  );
}

/**
 * ─────────────────────────────────────────────────────────────────────
 * APPORTER SA BOÎTE D'ENVOI.
 *
 * ⚠⚠ CE QUI SE JOUE ICI EST PLUS LOURD QUE POUR L'IA. Une clé IA mal réglée
 * coûte un refus ; un SMTP mal réglé engage la **réputation d'un domaine**,
 * qui ne se répare pas en redéployant. C'est pour ça que le serveur
 * s'authentifie réellement avant d'accepter — pas seulement résoudre l'hôte.
 *
 * ⚠ L'adresse d'expédition doit correspondre à la boîte authentifiée. Une
 * autre fait rejeter le message, ou pire : il part et se fait classer en
 * usurpation à l'arrivée, sans aucune erreur visible. C'est écrit à l'écran,
 * parce que c'est la faute qui coûte une semaine avant qu'on la comprenne.
 * ─────────────────────────────────────────────────────────────────────
 */
export function BoiteEnvoi() {
  const [etat, setEtat] = useState<EtatCle | null>(null);
  const [chargement, setChargement] = useState(true);
  const [host, setHost] = useState("");
  const [port, setPort] = useState("587");
  const [user, setUser] = useState("");
  const [pass, setPass] = useState("");
  const [from, setFrom] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ton: "ok" | "erreur"; texte: string } | null>(null);

  const recharger = async () => {
    try {
      const r = await fetch("/api/credentials");
      const d = (await r.json()) as { cles?: Record<string, EtatCle> };
      setEtat(d.cles?.email ?? null);
    } catch {
      setEtat(null);
    } finally {
      setChargement(false);
    }
  };

  useEffect(() => {
    void recharger();
  }, []);

  const enregistrer = async () => {
    setBusy(true);
    setMessage(null);
    try {
      const r = await fetch("/api/credentials", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          capacite: "email",
          valeurs: {
            SMTP_HOST: host,
            SMTP_PORT: port,
            SMTP_USER: user,
            SMTP_PASS: pass,
            SMTP_FROM: from || user,
          },
        }),
      });
      const d = (await r.json()) as { ok?: boolean; error?: string };
      if (!r.ok || !d.ok) {
        setMessage({ ton: "erreur", texte: d.error ?? "Enregistrement refusé." });
      } else {
        // ⚠ Seul le mot de passe repart : réafficher l'hôte et l'identifiant
        // aide à relire ce qu'on a saisi, et ce ne sont pas des secrets.
        setPass("");
        setMessage({ ton: "ok", texte: "Connexion réussie. Tes envois partent de chez toi." });
        await recharger();
      }
    } catch {
      setMessage({ ton: "erreur", texte: "Le serveur n'a pas répondu." });
    } finally {
      setBusy(false);
    }
  };

  const oublier = async () => {
    setBusy(true);
    try {
      await fetch("/api/credentials?capacite=email", { method: "DELETE" });
      setMessage({ ton: "ok", texte: "Boîte oubliée. L'envoi se referme." });
      await recharger();
    } finally {
      setBusy(false);
    }
  };

  const champ = (
    label: string,
    valeur: string,
    set: (v: string) => void,
    opts: { type?: string; placeholder?: string } = {}
  ) => (
    <label className="block">
      <span className="text-[11px] uppercase tracking-wider text-paper-faint">{label}</span>
      <input
        type={opts.type ?? "text"}
        autoComplete="off"
        value={valeur}
        onChange={(e) => set(e.target.value)}
        placeholder={opts.placeholder}
        className="panel mt-1 w-full px-3 py-2 font-mono text-[12px] text-paper"
      />
    </label>
  );

  return (
    <section className="card p-4">
      <p className="flex items-center gap-2 text-sm font-medium text-paper">
        <Mail size={15} className="text-bronze-400" /> Ta boîte d&apos;envoi
      </p>
      <p className="mt-1 text-[12px] leading-relaxed text-paper-dim">
        Branche ton propre SMTP et tes emails partent de <strong>ton</strong> domaine, sous ta
        réputation. N&apos;importe quel fournisseur fait l&apos;affaire.
      </p>

      {chargement ? (
        <p className="panel mt-3 p-3 text-[12px] text-paper-faint">
          <Loader2 size={13} className="inline animate-spin" /> Lecture de l&apos;état…
        </p>
      ) : etat?.verifieLe ? (
        <div className="panel mt-3 flex flex-wrap items-center justify-between gap-2 p-3">
          <span className="text-[12px] text-paper">
            <Check size={13} className="inline text-signal-green" /> Boîte active{" "}
            <span className="font-mono text-paper-dim">{etat.empreinte}</span>
          </span>
          <button className="btn-ghost px-3 py-1.5 text-[12px]" onClick={() => void oublier()} disabled={busy}>
            <Trash2 size={13} /> Oublier
          </button>
        </div>
      ) : (
        <p className="panel mt-3 p-3 text-[11.5px] leading-snug text-paper-faint">
          Aucune boîte enregistrée — les envois restent fermés sur ce compte.
        </p>
      )}

      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        {champ("Serveur SMTP", host, setHost, { placeholder: "smtp.exemple.fr" })}
        {champ("Port", port, setPort, { placeholder: "587" })}
        {champ("Identifiant", user, setUser, { placeholder: "moi@exemple.fr" })}
        {champ("Mot de passe", pass, setPass, { type: "password" })}
      </div>
      <div className="mt-2">
        {champ("Adresse d'expédition (si différente)", from, setFrom, { placeholder: "moi@exemple.fr" })}
      </div>

      <button
        className="btn-ghost mt-3 px-3 py-1.5 text-[12px]"
        onClick={() => void enregistrer()}
        disabled={busy || !host.trim() || !user.trim() || !pass.trim()}
      >
        {busy ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
        {busy ? "Connexion en cours…" : "Tester et enregistrer"}
      </button>

      {message && (
        <p
          className={`panel mt-3 p-3 text-[11.5px] leading-snug ${
            message.ton === "ok" ? "text-signal-green" : "text-signal-amber"
          }`}
        >
          {message.texte}
        </p>
      )}

      <p className="mt-3 text-[11px] leading-snug text-paper-faint">
        On se <strong>connecte et on s&apos;authentifie</strong> avant d&apos;accepter — un mot de
        passe faux est refusé ici, pas devant un prospect. L&apos;adresse d&apos;expédition doit
        appartenir à la boîte : une autre se fait rejeter, ou pire, se fait classer en usurpation
        sans aucune erreur visible.
      </p>
    </section>
  );
}
