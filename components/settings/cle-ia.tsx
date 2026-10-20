"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, Check, ExternalLink, KeyRound, Loader2, Mail, Trash2 } from "lucide-react";
import {
  adresseValide,
  lireCleIA,
  presetPourAdresse,
  presetParId,
  type PresetEmail,
} from "@/lib/identifiants-assistes";

/**
 * ─────────────────────────────────────────────────────────────────────
 * BRANCHER SES COMPTES — le moins de friction possible.
 *
 * Décidé le 20/10/2026. Avant : l'IA demandait de choisir entre deux champs de
 * clé, la boîte d'envoi quatre champs techniques (serveur, port, identifiant,
 * mot de passe) à quelqu'un qui ne sait pas ce qu'est un SMTP. Maintenant :
 *
 *   · IA     → UN champ. On colle la clé, on la reconnaît à sa forme, et si elle
 *              est valide on la vérifie sans qu'il ait à cliquer.
 *   · Envoi  → UNE adresse + UN mot de passe. L'hébergeur, le serveur et le port
 *              se déduisent (adresse, puis enregistrement MX), et le bouton dit
 *              AVANT l'essai ce qui rate chez cet hébergeur.
 *
 * Toute la décision vit dans `lib/identifiants-assistes.ts`, où un test
 * l'atteint. Ces composants ne font que poser des chaînes.
 *
 * ══ CE QUI RESTE DÉLIBÉRÉ ══
 *
 * **Le secret ne revient JAMAIS du serveur** : on affiche l'empreinte (quatre
 * derniers caractères) et la date de vérification. Redescendre un secret dans
 * un navigateur l'exposerait à la première faille XSS, pour un confort dont
 * personne n'a besoin — il l'a déjà.
 *
 * **Rien n'est « enregistré » sans avoir répondu** : le serveur fait un vrai
 * appel (modèle) ou une vraie connexion authentifiée (SMTP) avant de marquer la
 * capacité vérifiée. Une faute de frappe est refusée ICI, pas devant un
 * prospect.
 * ─────────────────────────────────────────────────────────────────────
 */

interface EtatCle {
  empreinte: string;
  verifieLe: string | null;
  dernierEchec: string | null;
}

interface Retour {
  ton: "ok" | "erreur";
  texte: string;
  aide?: { url: string; libelle: string } | null;
}

function Lien({ aide }: { aide: { url: string; libelle: string } }) {
  return (
    <a
      href={aide.url}
      target="_blank"
      rel="noreferrer noopener"
      className="mt-1.5 flex w-fit items-center gap-1 text-bronze-400 underline decoration-dotted underline-offset-2 hover:text-bronze-300"
    >
      {aide.libelle} <ExternalLink size={11} />
    </a>
  );
}

function Message({ m }: { m: Retour }) {
  return (
    <div className={`panel mt-3 p-3 text-[11.5px] leading-snug ${m.ton === "ok" ? "text-signal-green" : "text-signal-amber"}`}>
      <p>{m.texte}</p>
      {m.aide && <Lien aide={m.aide} />}
    </div>
  );
}

/** Lit l'état d'une capacité — partagé par les deux panneaux, un seul `fetch`. */
function useEtatCle(capacite: "ia" | "email") {
  const [etat, setEtat] = useState<EtatCle | null>(null);
  const [chargement, setChargement] = useState(true);
  const recharger = async () => {
    try {
      const r = await fetch("/api/credentials");
      const d = (await r.json()) as { cles?: Record<string, EtatCle> };
      setEtat(d.cles?.[capacite] ?? null);
    } catch {
      setEtat(null);
    } finally {
      setChargement(false);
    }
  };
  useEffect(() => {
    void recharger();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return { etat, chargement, recharger };
}

export function CleIA({ surConnecte }: { surConnecte?: () => void } = {}) {
  const { etat, chargement, recharger } = useEtatCle("ia");
  const [valeur, setValeur] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<Retour | null>(null);

  const lecture = useMemo(() => lireCleIA(valeur), [valeur]);

  const enregistrer = async (brut: string) => {
    const l = lireCleIA(brut);
    if (!l?.branchable || !l.champ) return;
    setBusy(true);
    setMessage(null);
    try {
      const r = await fetch("/api/credentials", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ capacite: "ia", valeurs: { [l.champ]: l.valeur } }),
      });
      const d = (await r.json()) as { ok?: boolean; error?: string; aide?: Retour["aide"] };
      if (!r.ok || !d.ok) {
        setMessage({ ton: "erreur", texte: d.error ?? "Enregistrement refusé.", aide: d.aide });
      } else {
        // ⚠ Le champ se vide : la clé est partie, elle ne doit pas rester
        // affichée dans un onglet ouvert toute la journée.
        setValeur("");
        setMessage({ ton: "ok", texte: "Clé vérifiée et enregistrée. L'IA est ouverte." });
        await recharger();
        surConnecte?.();
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
    <section id="cle-ia" className="card scroll-mt-20 p-4">
      <p className="flex items-center gap-2 text-sm font-medium text-paper">
        <KeyRound size={15} className="text-bronze-400" /> Ta clé IA
      </p>
      <p className="mt-1 text-[12px] leading-relaxed text-paper-dim">
        Colle ta clé, c&apos;est tout : on reconnaît le fournisseur et on la vérifie. Tu la paies chez
        lui, directement — rien ne passe par notre compte.
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
      ) : null}

      <label className="mt-3 block">
        <span className="text-[11px] uppercase tracking-wider text-paper-faint">
          {etat?.verifieLe ? "Remplacer par une autre clé" : "Colle ta clé (Anthropic ou NVIDIA)"}
        </span>
        <input
          type="password"
          autoComplete="off"
          spellCheck={false}
          value={valeur}
          onChange={(e) => setValeur(e.target.value)}
          // Coller est un geste délibéré : si la clé est reconnue, on la vérifie
          // sans exiger un second clic. Taper ne déclenche rien tout seul.
          onPaste={(e) => {
            const colle = e.clipboardData.getData("text");
            if (lireCleIA(colle)?.branchable) {
              e.preventDefault();
              setValeur(colle);
              void enregistrer(colle);
            }
          }}
          placeholder="sk-ant-…  ou  nvapi-…"
          className="panel mt-1 w-full px-3 py-2 font-mono text-[12px] text-paper"
        />
      </label>

      {lecture && (
        <p className={`mt-2 flex items-start gap-1.5 text-[11.5px] leading-snug ${lecture.branchable ? "text-signal-green" : "text-signal-amber"}`}>
          {lecture.branchable ? <Check size={13} className="mt-0.5 shrink-0" /> : <AlertTriangle size={13} className="mt-0.5 shrink-0" />}
          <span>
            {lecture.message}
            {lecture.aide && !lecture.branchable && <Lien aide={lecture.aide} />}
          </span>
        </p>
      )}

      {!valeur.trim() && !etat?.verifieLe && (
        <a
          href="https://console.anthropic.com/settings/keys"
          target="_blank"
          rel="noreferrer noopener"
          className="mt-2 inline-flex items-center gap-1 text-[11.5px] text-bronze-400 underline decoration-dotted underline-offset-2"
        >
          Pas encore de clé ? En créer une chez Anthropic <ExternalLink size={11} />
        </a>
      )}

      <button
        className="btn-ghost mt-3 px-3 py-1.5 text-[12px]"
        onClick={() => void enregistrer(valeur)}
        disabled={busy || !lecture?.branchable}
      >
        {busy ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
        {busy ? "Vérification en cours…" : "Vérifier et enregistrer"}
      </button>

      {message && <Message m={message} />}

      {/* ⚠⚠ LA PHRASE QUI EMPÊCHE CE PANNEAU DE MENTIR. Un champ vide, à côté
          d'une clé « active », se lit comme un bug ou comme une clé perdue. */}
      <p className="mt-3 text-[11px] leading-snug text-paper-faint">
        On vérifie la clé par un vrai appel avant de l&apos;accepter — quelques secondes. Ensuite elle
        est chiffrée et <strong>ne ressort jamais</strong> : ce champ restera vide, seule
        l&apos;empreinte s&apos;affiche. Pour en changer, colle simplement la nouvelle.
      </p>
    </section>
  );
}

/**
 * ─────────────────────────────────────────────────────────────────────
 * BRANCHER SA BOÎTE D'ENVOI — une adresse, un mot de passe.
 *
 * ⚠⚠ CE QUI SE JOUE ICI EST PLUS LOURD QUE POUR L'IA. Une clé IA mal réglée
 * coûte un refus ; un SMTP mal réglé engage la **réputation d'un domaine**,
 * qui ne se répare pas en redéployant. C'est pour ça que le serveur
 * s'authentifie réellement avant d'accepter — pas seulement résoudre l'hôte.
 *
 * ⚠ L'adresse d'expédition est celle de la boîte. Une autre fait rejeter le
 * message, ou pire : il part et se fait classer en usurpation à l'arrivée,
 * sans aucune erreur visible. L'écran n'en demande donc plus une seconde.
 * ─────────────────────────────────────────────────────────────────────
 */
const LIBELLE_MDP = { application: "Mot de passe d'application", "cle-smtp": "Clé SMTP", normal: "Mot de passe" } as const;

export function BoiteEnvoi({ surConnecte }: { surConnecte?: () => void } = {}) {
  const { etat, chargement, recharger } = useEtatCle("email");
  const [adresse, setAdresse] = useState("");
  const [pass, setPass] = useState("");
  const [host, setHost] = useState("");
  const [port, setPort] = useState("");
  const [avance, setAvance] = useState(false);
  /** Hébergeur trouvé par le MX (pour un domaine perso) — `undefined` tant qu'on cherche. */
  const [presetMx, setPresetMx] = useState<PresetEmail | null | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<Retour | null>(null);

  const valide = adresseValide(adresse);
  const presetAdresse = useMemo(() => presetPourAdresse(adresse), [adresse]);
  const preset = presetAdresse ?? (presetMx ?? null);
  const enRecherche = valide && !presetAdresse && presetMx === undefined;

  // Domaine perso : on lit son MX (une seule requête, après une pause de frappe).
  const derniere = useRef("");
  useEffect(() => {
    setPresetMx(undefined);
    if (!valide || presetAdresse) return;
    const t = setTimeout(() => {
      derniere.current = adresse;
      fetch(`/api/credentials/detect?adresse=${encodeURIComponent(adresse)}`)
        .then((r) => (r.ok ? r.json() : null))
        .then((d: { presetId?: string | null } | null) => {
          if (derniere.current === adresse) setPresetMx(presetParId(d?.presetId) ?? null);
        })
        .catch(() => setPresetMx(null));
    }, 600);
    return () => clearTimeout(t);
  }, [adresse, valide, presetAdresse]);

  // Hébergeur introuvable : on ne devine pas, on demande le serveur.
  const demandeLeServeur = valide && !preset && presetMx !== undefined;
  const afficherAvance = avance || demandeLeServeur;
  const pret = valide && pass.trim() && (preset || host.trim());

  const enregistrer = async () => {
    setBusy(true);
    setMessage(null);
    try {
      const valeurs: Record<string, string> = { SMTP_USER: adresse.trim(), SMTP_PASS: pass, SMTP_FROM: adresse.trim() };
      if (host.trim()) valeurs.SMTP_HOST = host.trim();
      if (port.trim()) valeurs.SMTP_PORT = port.trim();
      const r = await fetch("/api/credentials", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ capacite: "email", valeurs }),
      });
      const d = (await r.json()) as { ok?: boolean; error?: string; aide?: Retour["aide"] };
      if (!r.ok || !d.ok) {
        setMessage({ ton: "erreur", texte: d.error ?? "Enregistrement refusé.", aide: d.aide });
      } else {
        // ⚠ Seul le mot de passe repart : l'adresse n'est pas un secret.
        setPass("");
        setMessage({ ton: "ok", texte: `Boîte branchée : tes envois partent de ${adresse.trim()}.` });
        await recharger();
        surConnecte?.();
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

  return (
    <section id="boite-envoi" className="card scroll-mt-20 p-4">
      <p className="flex items-center gap-2 text-sm font-medium text-paper">
        <Mail size={15} className="text-bronze-400" /> Ta boîte d&apos;envoi
      </p>
      <p className="mt-1 text-[12px] leading-relaxed text-paper-dim">
        Tes emails partent de <strong>ton</strong> adresse, sous ta réputation. Donne ton adresse et
        son mot de passe : on trouve le reste.
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
      ) : null}

      <div className="mt-3 space-y-2">
        <label className="block">
          <span className="text-[11px] uppercase tracking-wider text-paper-faint">Ton adresse d&apos;envoi</span>
          <input
            type="email"
            inputMode="email"
            autoComplete="off"
            value={adresse}
            onChange={(e) => setAdresse(e.target.value)}
            placeholder="prenom@tonentreprise.fr"
            className="panel mt-1 w-full px-3 py-2 font-mono text-[12px] text-paper"
          />
        </label>

        {/* Ce que l'hébergeur exige, DIT AVANT l'essai : un mot de passe
            d'application est la première cause d'échec chez Gmail. */}
        {valide && preset && (
          <div className="panel p-3 text-[11.5px] leading-snug text-paper-dim">
            <p className="text-paper">
              <Check size={12} className="mr-1 inline text-signal-green" />
              {preset.nom} reconnu — je règle le serveur tout seul.
            </p>
            {preset.avertissement && <p className="mt-1.5">{preset.avertissement}</p>}
            {preset.aide && <Lien aide={preset.aide} />}
          </div>
        )}
        {enRecherche && (
          <p className="text-[11.5px] text-paper-faint">
            <Loader2 size={12} className="mr-1 inline animate-spin" /> Je cherche où est hébergée cette adresse…
          </p>
        )}
        {demandeLeServeur && (
          <p className="flex items-start gap-1.5 text-[11.5px] leading-snug text-signal-amber">
            <AlertTriangle size={13} className="mt-0.5 shrink-0" />
            <span>
              Je ne reconnais pas l&apos;hébergeur de cette adresse : indique son serveur d&apos;envoi ci-dessous
              (cherche « SMTP » dans l&apos;aide de ton hébergeur mail).
            </span>
          </p>
        )}

        <label className="block">
          <span className="text-[11px] uppercase tracking-wider text-paper-faint">
            {preset ? LIBELLE_MDP[preset.motDePasse] : "Mot de passe"}
          </span>
          <input
            type="password"
            autoComplete="off"
            value={pass}
            onChange={(e) => setPass(e.target.value)}
            className="panel mt-1 w-full px-3 py-2 font-mono text-[12px] text-paper"
          />
        </label>

        {afficherAvance && (
          <div className="grid gap-2 sm:grid-cols-2">
            <label className="block">
              <span className="text-[11px] uppercase tracking-wider text-paper-faint">Serveur d&apos;envoi (SMTP)</span>
              <input
                value={host}
                onChange={(e) => setHost(e.target.value)}
                placeholder={preset?.host ?? "smtp.exemple.fr"}
                className="panel mt-1 w-full px-3 py-2 font-mono text-[12px] text-paper"
              />
            </label>
            <label className="block">
              <span className="text-[11px] uppercase tracking-wider text-paper-faint">Port (facultatif)</span>
              <input
                value={port}
                onChange={(e) => setPort(e.target.value)}
                placeholder="587 ou 465, essayés tous les deux"
                className="panel mt-1 w-full px-3 py-2 font-mono text-[12px] text-paper"
              />
            </label>
          </div>
        )}
        {!afficherAvance && (
          <button
            type="button"
            className="text-[11px] text-paper-faint underline decoration-dotted underline-offset-2 hover:text-paper"
            onClick={() => setAvance(true)}
          >
            Régler le serveur à la main
          </button>
        )}
      </div>

      <button className="btn-ghost mt-3 px-3 py-1.5 text-[12px]" onClick={() => void enregistrer()} disabled={busy || !pret}>
        {busy ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
        {busy ? "Connexion en cours…" : "Tester et brancher"}
      </button>

      {message && <Message m={message} />}

      <p className="mt-3 text-[11px] leading-snug text-paper-faint">
        On se <strong>connecte et on s&apos;authentifie</strong> avant d&apos;accepter, en essayant les
        deux ports usuels — un mot de passe faux est refusé ici, pas devant un prospect. Pas de boîte
        professionnelle ? Un SMTP dédié (Brevo en propose un gratuit) fait aussi l&apos;affaire.
      </p>
    </section>
  );
}
