"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAlpha, useHydrated } from "@/lib/store";
import { authAvailable, getCurrentUser, onAuthChange, resetPassword, signIn, signUp, type AuthUser } from "@/lib/auth";
import { DUREE_ESSAI_JOURS } from "@/lib/essai";
import { Eagle } from "@/components/eagle";

/** Ouvre le formulaire de compte depuis n'importe quel écran (bandeau, `/compte`). */
const EVT_OUVRIR_CONNEXION = "alpha:ouvrir-connexion";
export function ouvrirConnexion(mode: "in" | "up" = "up"): void {
  window.dispatchEvent(new CustomEvent(EVT_OUVRIR_CONNEXION, { detail: mode }));
}

/**
 * ⚠ CE NAVIGATEUR A-T-IL PORTÉ UN COMPTE ? — la seule chose que le mur protège
 * désormais (27/10/2026).
 *
 * Le visiteur sans compte utilise l'app : son CRM est dans SON navigateur.
 * Mais un navigateur où un compte s'est connecté garde, après déconnexion,
 * les fiches de ce compte dans le même stockage. Là, et là seulement, le mur
 * se referme. Deux traces : notre marque, posée dès qu'une session est vue, et
 * la clé de session de Supabase (présente pour qui s'est connecté avant que la
 * marque n'existe). Un stockage illisible ne prouve rien : on ne mure pas.
 */
const CLE_COMPTE_VU = "alpha-compte-vu";
function compteDejaVu(): boolean {
  try {
    if (localStorage.getItem(CLE_COMPTE_VU) === "1") return true;
    for (let i = 0; i < localStorage.length; i++) {
      if (/^sb-.+-auth-token$/.test(localStorage.key(i) ?? "")) return true;
    }
  } catch {
    // Stockage refusé (navigation privée stricte) : rien n'y est gardé non plus.
  }
  return false;
}
function marquerCompteVu(): void {
  try {
    localStorage.setItem(CLE_COMPTE_VU, "1");
  } catch {
    // Sans stockage, aucune fiche ne survit à l'onglet : rien à protéger.
  }
}

/**
 * Mur de connexion multi-locataire (SaaS).
 *
 * L'app exige un compte email + mot de passe avant de rien afficher. Chaque
 * compte est isolé par la RLS (user_id) côté Supabase.
 *
 * ⚠ CE QUI DÉCLENCHE CE MUR A CHANGÉ, ET C'ÉTAIT LE DÉFAUT.
 *
 * Il ne se fermait que sur `settings.security.requireAuth` — un réglage stocké
 * dans le NAVIGATEUR. Conséquence : un navigateur neuf (celui d'un client à
 * qui on ouvre un accès, le tien en navigation privée, un autre appareil) ne
 * l'avait pas, donc ne voyait JAMAIS l'écran de connexion — quelle que soit
 * la configuration du serveur. Une serrure dont l'existence dépend du
 * trousseau de celui qui entre n'est pas une serrure.
 *
 * Il écoute maintenant le SERVEUR (`GET /api/gate` → `compteRequis`, dérivé de
 * `verrouDeComptesActif`). Le réglage local reste accepté : il permet à un
 * opérateur d'exiger la connexion sur SON poste avant même que le serveur
 * l'impose. Les deux ferment ; aucun des deux n'ouvre à la place de l'autre.
 *
 * Comme LockGate : on rend les enfants par défaut (le serveur n'a aucun état
 * client), puis on referme après hydratation si aucune session n'est ouverte.
 * Un script bloqué ne doit jamais blanchir l'app.
 *
 * ⚠⚠ ET CE MUR FERMAIT L'APP À TOUT LE MONDE (27/10/2026). Le serveur exige un
 * compte pour ses API, et l'écran en déduisait « personne n'entre sans
 * compte » : le visiteur venu d'un post voyait deux champs, puis attendait un
 * email de confirmation. Mesuré en production : six comptes en tout, aucun
 * depuis deux semaines. Désormais :
 *  · le VISITEUR (aucun compte n'a jamais porté ce navigateur) utilise l'app,
 *    un bandeau lui dit que ses fiches restent dans ce navigateur et ce
 *    qu'un compte ajoute — le middleware lui ouvre les écrans GRATUITS, les API
 *    lui restent fermées ;
 *  · le mur se referme sur un navigateur qui a PORTÉ un compte
 *    (`compteDejaVu`) ou si l'opérateur l'exige sur son poste — c'est là que
 *    des fiches d'un compte dorment dans le stockage ;
 *  · une panne de `/api/gate` ne rouvre pas ce navigateur-là : seul un
 *    « pas de compte requis » EXPLICITE du serveur lève le mur.
 *
 * ⚠ Non vérifié contre un vrai projet Supabase dans l'environnement de build.
 * À tester à deux comptes avant de facturer (voir docs/SECURITE.md).
 */
export function AuthGate({ children }: { children: React.ReactNode }) {
  const hydrated = useHydrated();
  const requireAuth = useAlpha((s) => s.settings.security?.requireAuth);
  const pathname = usePathname();
  const router = useRouter();

  // Ouvert par défaut : le SSR et le premier rendu client montrent le contenu.
  const [user, setUser] = useState<AuthUser | null>(null);
  const [checked, setChecked] = useState(false);
  const [dejaVu, setDejaVu] = useState(false);
  /** Le formulaire ouvert À LA DEMANDE d'un visiteur (bandeau, `/compte`, lien de la vitrine). */
  const [formOuvert, setFormOuvert] = useState(false);

  /**
   * Ce que le SERVEUR demande. `null` = pas encore répondu — et tant qu'on ne
   * sait pas, on ne conclut pas : voir `gateOn` plus bas.
   */
  const [serveur, setServeur] = useState<{ compteRequis: boolean; clientPeutSeConnecter: boolean } | null>(null);

  const [mode, setMode] = useState<"in" | "up">("in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  /**
   * ⚠ L'ADRESSE VENUE DE LA VITRINE — sans ça, la carte d'essai ne sert à rien.
   *
   * La page publique demande l'email, puis envoie ici. Si ce formulaire
   * s'ouvrait vide et en mode « se connecter », la personne devrait RETAPER
   * son adresse et comprendre toute seule qu'elle doit d'abord créer un
   * compte. C'est exactement le moment où l'on abandonne — et le champ de la
   * vitrine n'aurait été qu'une décoration.
   *
   * On lit l'URL une fois, au montage. On pré-remplit et on bascule en
   * création de compte : quelqu'un qui arrive par ce chemin n'en a pas.
   *
   * ⚠⚠ On ne SOUMET rien automatiquement. Un paramètre d'URL est fourni par
   * l'extérieur — n'importe qui peut forger un lien. Il pré-remplit un champ
   * que l'utilisateur voit et peut corriger ; il ne déclenche aucune action.
   */
  useEffect(() => {
    if (typeof window === "undefined") return;
    const venu = new URLSearchParams(window.location.search).get("email");
    if (!venu) return;
    // Une adresse plausible seulement : on ne recopie pas n'importe quelle
    // chaîne dans un champ que l'utilisateur croira validée.
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/.test(venu.trim())) return;
    setEmail(venu.trim());
    setMode("up");
    // Il est venu créer un compte : le formulaire s'ouvre, l'app reste derrière.
    setFormOuvert(true);
  }, []);

  useEffect(() => {
    setDejaVu(compteDejaVu());
    const ouvrir = (e: Event) => {
      const m = (e as CustomEvent<"in" | "up">).detail;
      setMode(m === "in" ? "in" : "up");
      setError(null);
      setInfo(null);
      setFormOuvert(true);
    };
    window.addEventListener(EVT_OUVRIR_CONNEXION, ouvrir);
    return () => window.removeEventListener(EVT_OUVRIR_CONNEXION, ouvrir);
  }, []);

  // Le serveur, une fois. Une panne réseau laisse `serveur` à null : on
  // retombe alors sur le réglage local, jamais sur « ouvert ».
  useEffect(() => {
    let vivant = true;
    fetch("/api/gate")
      .then((r) => r.json())
      .then((j) => vivant && setServeur({
        compteRequis: Boolean(j?.compteRequis),
        clientPeutSeConnecter: Boolean(j?.clientPeutSeConnecter),
      }))
      .catch(() => {});
    return () => {
      vivant = false;
    };
  }, []);

  /**
   * ⚠ OU, PAS ET — pour SAVOIR qui est là. Le serveur exige des comptes, ou
   * l'opérateur l'exige sur son poste, ou ce navigateur en a porté un : dans
   * les trois cas on lit la session. Un `&&` rendrait le serveur muet sur tout
   * navigateur qui n'a pas le réglage — le bug corrigé le 02/09.
   */
  const exige = Boolean(serveur?.compteRequis) || Boolean(requireAuth) || dejaVu;
  const gateOn = Boolean(hydrated && exige && authAvailable());

  useEffect(() => {
    if (!gateOn) {
      setChecked(true);
      return;
    }
    // Pendant la lecture, ni mur ni bandeau : on ne conclut pas avant de savoir.
    setChecked(false);
    let alive = true;
    getCurrentUser().then((u) => {
      if (alive) {
        setUser(u);
        setChecked(true);
      }
    });
    const off = onAuthChange((u) => alive && setUser(u));
    return () => {
      alive = false;
      off();
    };
  }, [gateOn]);

  // Une session vue marque le navigateur : après déconnexion, ses fiches sont gardées.
  useEffect(() => {
    if (!user) return;
    marquerCompteVu();
    setDejaVu(true);
    setFormOuvert(false);
  }, [user]);

  /**
   * LE MUR — fermé seulement là où dorment les fiches d'un compte. Le serveur
   * qui répond EXPLICITEMENT « pas de compte requis » le lève (usage solo) ;
   * son silence (panne, réponse pas arrivée) ne le lève pas.
   */
  const murFerme = Boolean(
    gateOn && checked && !user && (Boolean(requireAuth) || (dejaVu && serveur?.compteRequis !== false))
  );
  /** Le VISITEUR : le serveur a des comptes, ce navigateur n'en a jamais porté. */
  const visiteur = Boolean(gateOn && checked && !user && !murFerme && serveur?.compteRequis);

  // Envoyé sur `/compte` par un écran payant ou un lien : il vient pour le compte.
  useEffect(() => {
    if (visiteur && pathname?.startsWith("/compte")) setFormOuvert(true);
  }, [visiteur, pathname]);

  /**
   * ⚠ L'IMPASSE, DITE AU LIEU D'ÊTRE SUBIE.
   *
   * Le serveur exige un compte, et ce navigateur n'a pas de quoi en ouvrir un
   * (`NEXT_PUBLIC_SUPABASE_URL` / `ANON_KEY` absents du build). Sans ce cas,
   * `authAvailable()` étant faux, `gateOn` retombait à faux et on affichait
   * une coquille dont chaque appel répond 401 — l'utilisateur tourne en rond
   * sans jamais voir de formulaire. On refuse, et on dit pourquoi.
   */
  if (hydrated && serveur?.compteRequis && !serveur.clientPeutSeConnecter) {
    return (
      <div className="grid min-h-screen place-items-center bg-ink-950 px-4">
        <div className="card w-full max-w-sm p-6 text-center">
          <h1 className="font-display text-lg font-extrabold text-paper">Connexion impossible</h1>
          <p className="mt-2 text-[12px] text-paper-faint">
            Ce déploiement exige un compte, mais l&apos;application n&apos;a pas de quoi en ouvrir un.
          </p>
          <p className="mt-3 rounded-lg border border-signal-red/40 bg-signal-red/10 px-3 py-2 text-left font-mono text-[11px] text-paper">
            NEXT_PUBLIC_SUPABASE_URL et NEXT_PUBLIC_SUPABASE_ANON_KEY manquent au build.
          </p>
          <p className="mt-2 text-[11px] text-paper-faint">
            Pose-les côté serveur puis redéploie — elles doivent exister au moment du build.
          </p>
        </div>
      </div>
    );
  }

  // Le formulaire s'affiche si le mur est fermé, ou si le visiteur l'a demandé.
  if (!murFerme && !(formOuvert && !user && authAvailable())) {
    return (
      <>
        {visiteur && <BandeauVisiteur />}
        {children}
      </>
    );
  }

  /** Le visiteur referme le formulaire et retrouve l'app — jamais sur un mur fermé. */
  const continuerSansCompte = () => {
    setFormOuvert(false);
    setError(null);
    setInfo(null);
    // `/compte` n'a rien à montrer à quelqu'un qui n'a pas de compte.
    if (pathname?.startsWith("/compte")) router.push("/aujourdhui");
  };

  const submit = async () => {
    if (!email.trim() || !password) {
      setError("Email et mot de passe requis.");
      return;
    }
    setBusy(true);
    setError(null);
    setInfo(null);
    const res = mode === "up" ? await signUp(email, password) : await signIn(email, password);
    setBusy(false);
    if (!res.ok) {
      setError(res.error ?? "Échec.");
      return;
    }
    if (res.needsConfirm) {
      /**
       * ⚠ « Compte créé » ÉTAIT UN MENSONGE UNE FOIS SUR DEUX.
       *
       * Quand la confirmation d'email est active, Supabase répond à une
       * inscription sur une adresse DÉJÀ enregistrée exactement comme à une
       * inscription neuve : un utilisateur, pas de session, pas d'erreur.
       * C'est volontaire de leur part — ça empêche de deviner qui a un compte
       * chez nous en essayant des adresses. Mais aucun mail n'est envoyé.
       *
       * L'ancien texte affirmait donc « compte créé » à quelqu'un qui en avait
       * déjà un, et le laissait attendre un mail qui n'arriverait jamais. La
       * formulation conditionnelle est vraie dans les deux cas, et elle ne
       * révèle toujours pas si l'adresse existe.
       */
      setInfo(
        "Si cette adresse n'a pas déjà un compte, un email de confirmation vient de partir. Clique le lien, puis connecte-toi."
      );
      setMode("in");
      setPassword("");
    }
    // Sinon onAuthChange met à jour la session et la porte s'ouvre.
  };

  const forgot = async () => {
    if (!email.trim()) {
      setError("Entre ton email d'abord, puis « mot de passe oublié ».");
      return;
    }
    setBusy(true);
    setError(null);
    setInfo(null);
    const res = await resetPassword(email);
    setBusy(false);
    if (res.ok) setInfo("Email de réinitialisation envoyé — suis le lien pour choisir un nouveau mot de passe.");
    else setError(res.error ?? "Échec de l'envoi.");
  };

  return (
    <div className="grid min-h-screen place-items-center bg-ink-950 px-4">
      <div className="card w-full max-w-sm p-6 text-center">
        <span className="mx-auto block animate-floaty text-bronze-400">
          <Eagle size={64} glow />
        </span>
        <h1 className="mt-4 font-display text-lg font-extrabold text-paper">
          ALPHA <span className="text-bronze-400">SALES OS</span>
        </h1>
        <p className="mt-1 text-[12px] text-paper-faint">
          {mode === "in" ? "Connecte-toi à ton compte." : "Crée ton compte commercial."}
        </p>
        {!murFerme && mode === "up" && (
          <p className="mt-2 text-[11.5px] text-paper-dim">
            Le compte sert à brancher ta boîte d&apos;envoi et ta clé d&apos;IA, et ouvre {DUREE_ESSAI_JOURS} jours
            d&apos;essai. Les fiches déjà saisies dans ce navigateur restent là.
          </p>
        )}

        <input
          type="email"
          // Le curseur va au champ VIDE : sur une arrivée depuis la vitrine,
          // l'email est déjà là et c'est le mot de passe qu'on attend.
          autoFocus={!email}
          placeholder="Email"
          autoComplete="email"
          className="input mt-4 text-center"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <input
          type="password"
          placeholder="Mot de passe"
          autoComplete={mode === "in" ? "current-password" : "new-password"}
          autoFocus={Boolean(email)}
          className="input mt-2 text-center"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && !busy && submit()}
        />

        {error && <p className="mt-2 text-[12px] text-signal-red">{error}</p>}
        {info && <p className="mt-2 text-[12px] text-signal-green">{info}</p>}

        <button className="btn-bronze mt-4 w-full" onClick={submit} disabled={busy}>
          {busy ? "…" : mode === "in" ? "Se connecter" : "Créer le compte"}
        </button>

        <button
          className="mt-3 text-[12px] text-paper-faint hover:text-bronze-400"
          onClick={() => {
            setMode((m) => (m === "in" ? "up" : "in"));
            setError(null);
            setInfo(null);
          }}
        >
          {mode === "in" ? "Pas encore de compte ? Créer un compte" : "Déjà un compte ? Se connecter"}
        </button>

        {mode === "in" && (
          <div>
            <button
              className="mt-1.5 block w-full text-[11px] text-paper-faint hover:text-bronze-400"
              onClick={forgot}
              disabled={busy}
            >
              Mot de passe oublié ?
            </button>
          </div>
        )}

        {/*
          ⚠ IL N'Y AVAIT AUCUNE SORTIE VERS LA PRÉSENTATION DU PRODUIT.
          Quelqu'un qui arrive sur alphasalesos.eagleyecorp.fr voit une boîte
          de connexion et deux champs — sans une ligne pour dire ce que c'est,
          ni où l'apprendre. Sur un produit dont l'inscription est ouverte,
          c'est la porte d'entrée qui manquait : il faut déjà savoir ce qu'on
          vient chercher pour avoir envie de créer un compte.
        */}
        {!murFerme && (
          <button className="btn-ghost mt-4 w-full" onClick={continuerSansCompte}>
            Continuer sans compte
          </button>
        )}

        <p className="mt-4 text-[12px] text-paper-faint">
          Vous découvrez ?{" "}
          <a href="/vitrine" className="text-bronze-400 hover:underline">
            Voir ce que fait Alpha Sales OS
          </a>
        </p>
        <p className="mt-4 border-t border-ink-700 pt-3 font-mono text-[9px] uppercase tracking-[0.16em] text-paper-faint">
          Eagleye Corp — Lyon · données isolées par compte
        </p>
      </div>
    </div>
  );
}

/**
 * Le bandeau du VISITEUR : une ligne, deux gestes, aucun mur.
 *
 * ⚠ Il ne dit que ce qui est vrai sans compte : les fiches vivent dans ce
 * navigateur (le stockage local, rien côté serveur). Il ne promet pas de les
 * retrouver ailleurs — ce n'est pas ce qu'un compte gratuit fait.
 */
function BandeauVisiteur() {
  return (
    <div
      role="region"
      aria-label="Utilisation sans compte"
      className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 border-b border-bronze-700/50 bg-ink-900 px-4 py-2 text-center text-[12px] text-paper-dim"
    >
      <span>Sans compte : tes fiches restent dans ce navigateur.</span>
      <span className="flex items-center gap-3">
        <button className="font-semibold text-bronze-400 hover:underline" onClick={() => ouvrirConnexion("up")}>
          Créer un compte
        </button>
        <button className="text-paper-faint hover:text-bronze-400" onClick={() => ouvrirConnexion("in")}>
          Se connecter
        </button>
      </span>
    </div>
  );
}
