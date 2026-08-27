"use client";

import { useEffect, useState } from "react";
// ⚠ `lib/offres-publiques` n'importe RIEN — c'est ce qui le rend sûr ici.
// Tout ce qu'une page publique importe part dans le bundle du navigateur,
// même si rien ne l'affiche (voir tests/vitrine-fuite.test.ts). N'importer
// depuis cette page aucun module qui touche aux coûts ou aux marges.
import { OFFRES, offreParId, type OffrePublique } from "@/lib/offres-publiques";
import { parcours, ESSAI_JOURS } from "@/lib/client-onboarding";
import { authAvailable, getCurrentUser, onAuthChange, signIn, signUp, type AuthUser } from "@/lib/auth";

/**
 * ─────────────────────────────────────────────────────────────────────
 * SOUSCRIRE — la porte d'entrée qui manquait.
 *
 * L'ordre est celui d'un achat, pas celui d'un catalogue :
 *   1. l'offre qu'on a choisie (ou la liste, si on arrive sans rien) ;
 *   2. le compte — email + mot de passe, rien d'autre ;
 *   3. le paiement, chez Stripe.
 *
 * ⚠ CE QUI SE PASSE QUAND RIEN N'EST CONFIGURÉ. Sans Supabase, sans Stripe,
 * la page ne doit pas afficher un bouton mort. Elle dit ce qui manque et
 * bascule sur le cadrage — c'est la même règle que partout ailleurs ici :
 * « pas configuré » est une ÉTAPE, pas une panne, et surtout pas un écran
 * qui laisse un acheteur cliquer dans le vide.
 * ─────────────────────────────────────────────────────────────────────
 */

const INK = "#191919";
const MUTED = "#6B6560";
const LINE = "#E5DFD6";
const ACCENT = "#B45309";
const PAPER = "#FBF8F3";

/** Les offres qu'on peut réellement encaisser en ligne. */
const PAYABLES = OFFRES.filter((o) => o.cadence !== "devis" && o.priceEnv);
/** Celles qui passent par le cadrage — la doctrine l'impose avant tout devis. */
const SUR_DEVIS = OFFRES.filter((o) => o.cadence === "devis" || !o.priceEnv);

const prix = (o: OffrePublique) =>
  o.prixHT === null
    ? "Sur devis"
    : `${o.prixHT.toLocaleString("fr-FR")} € HT${o.cadence === "mensuel" ? "/mois" : ""}`;

/** Date lisible sans dépendre d'un module de l'app. */
const jourFr = (iso: string) =>
  new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "long" });

/**
 * ── LE RETOUR DE PAIEMENT ──
 *
 * ⚠ NE JAMAIS ÉCRIRE QUE LE PAIEMENT EST ENCAISSÉ. L'URL de retour est une
 * redirection navigateur, pas une preuve : seul le webhook Stripe confirme.
 * On dit « commande envoyée », et on enchaîne sur la mise en route — parce
 * que les dix minutes qui suivent un paiement décident si le client ouvre
 * l'app demain ou s'il attend qu'on le rappelle.
 */
function RetourPaiement({ achat, offre }: { achat: string; offre: OffrePublique }) {
  const plan =
    achat === "ok"
      ? parcours(new Date().toISOString(), offre.capacites, [], { essai: offre.id === "essai" })
      : null;

  if (achat === "annule") {
    return (
      <div className="mt-10 rounded-2xl p-7" style={{ border: `1px solid ${LINE}`, background: "#FFFFFF" }}>
        <p className="font-serif text-[24px] tracking-[-0.01em]">Paiement interrompu</p>
        <p className="mt-3 text-[16px] leading-[1.6]" style={{ color: MUTED }}>
          Rien n&apos;a été débité. L&apos;offre « {offre.nom} » reste disponible. Si quelque chose vous a
          arrêté, dites-le —{" "}
          <a
            href="mailto:contact@eagleyecorp.fr?subject=Question%20avant%20de%20payer"
            className="underline underline-offset-4"
            style={{ color: ACCENT }}
          >
            c&apos;est plus utile qu&apos;un abandon silencieux
          </a>
          .
        </p>
      </div>
    );
  }

  const premieres = plan?.etapes.slice(0, 4) ?? [];
  return (
    <div className="mt-10 rounded-2xl p-7" style={{ border: `1px solid ${ACCENT}`, background: "#FFFFFF" }}>
      <p className="font-serif text-[28px] tracking-[-0.01em]">Commande envoyée — {offre.nom}</p>
      <p className="mt-3 text-[16px] leading-[1.6]" style={{ color: MUTED }}>
        Stripe traite le paiement ; la confirmation arrive par email. Pendant ce temps, voilà la mise en
        route — elle commence maintenant, pas à la confirmation.
      </p>

      {offre.appelsInclus !== null && offre.auDela && (
        <p className="mt-4 rounded-lg px-4 py-3 text-[15px] leading-[1.55]" style={{ background: PAPER, color: MUTED }}>
          <strong style={{ color: INK }}>{offre.appelsInclus} appels inclus.</strong> {offre.auDela}
        </p>
      )}

      {premieres.length > 0 && (
        <>
          <p className="mt-6 text-[13px] uppercase tracking-[0.14em]" style={{ color: MUTED }}>
            Les premières étapes — qui fait quoi
          </p>
          <ul className="mt-3 space-y-2">
            {premieres.map((e) => (
              <li key={e.id} className="rounded-lg px-4 py-3" style={{ background: PAPER }}>
                <p className="text-[15px] font-medium">
                  {e.titre}
                  <span className="ml-2 text-[13px]" style={{ color: e.cote === "nous" ? ACCENT : MUTED }}>
                    · {e.cote === "nous" ? "nous" : "vous"}
                  </span>
                </p>
                <p className="mt-0.5 text-[13px]" style={{ color: MUTED }}>
                  visé le {jourFr(e.date)}
                </p>
              </li>
            ))}
          </ul>
          {plan && plan.etapes.length > premieres.length && (
            <p className="mt-2 text-[13px]" style={{ color: MUTED }}>
              … et {plan.etapes.length - premieres.length} autres étapes, filtrées sur ce que vous venez de
              prendre.
            </p>
          )}
        </>
      )}

      {offre.id === "essai" && (
        <p className="mt-5 text-[15px] leading-[1.55]" style={{ color: ACCENT }}>
          L&apos;essai a une fin : il faut qu&apos;un résultat existe sous {ESSAI_JOURS} jours. C&apos;est
          court, et c&apos;est le but — un essai qui traîne ne prouve rien.
        </p>
      )}

      <p className="mt-6 text-[15px] leading-[1.6]" style={{ color: MUTED }}>
        Vos accès arrivent par email dès la confirmation. Une question d&apos;ici là :{" "}
        <a
          href="mailto:contact@eagleyecorp.fr?subject=Mise%20en%20route"
          className="underline underline-offset-4"
          style={{ color: ACCENT }}
        >
          contact@eagleyecorp.fr
        </a>
      </p>
    </div>
  );
}

export default function SouscrirePage() {
  const [achat, setAchat] = useState<string | null>(null);
  const [choisie, setChoisie] = useState<OffrePublique | null>(null);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [pret, setPret] = useState(false);
  const [mode, setMode] = useState<"up" | "in">("up");
  const [email, setEmail] = useState("");
  const [motDePasse, setMotDePasse] = useState("");
  const [occupe, setOccupe] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  // L'offre peut arriver dans l'URL (?offre=solo) depuis la vitrine, et
  // `achat` au RETOUR de Stripe (?achat=ok&offre=solo).
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const id = q.get("offre");
    if (id) setChoisie(offreParId(id) ?? null);
    setAchat(q.get("achat"));
  }, []);

  useEffect(() => {
    if (!authAvailable()) {
      setPret(true);
      return;
    }
    void getCurrentUser().then((u) => {
      setUser(u);
      setPret(true);
    });
    return onAuthChange(setUser);
  }, []);

  const compte = async () => {
    if (!email.trim() || !motDePasse) {
      setErreur("Email et mot de passe requis.");
      return;
    }
    setOccupe(true);
    setErreur(null);
    setInfo(null);
    const res = mode === "up" ? await signUp(email, motDePasse) : await signIn(email, motDePasse);
    setOccupe(false);
    if (!res.ok) {
      setErreur(res.error ?? "Échec.");
      return;
    }
    if (res.needsConfirm) {
      // ⚠ Ne PAS enchaîner sur le paiement : la session n'existe pas encore,
      // le checkout rendrait 401 et l'acheteur croirait que sa carte a été
      // refusée. On le dit, et on l'attend.
      setInfo("Compte créé. Confirme l'email reçu, puis reviens ici pour payer.");
      setMode("in");
      setMotDePasse("");
    }
  };

  const payer = async () => {
    if (!choisie) return;
    setOccupe(true);
    setErreur(null);
    try {
      const r = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ offre: choisie.id }),
      });
      const j = (await r.json().catch(() => ({}))) as { url?: string; error?: string };
      if (!r.ok || !j.url) {
        setErreur(j.error ?? "Le paiement n'a pas pu démarrer.");
        setOccupe(false);
        return;
      }
      window.location.href = j.url;
    } catch {
      setErreur("Le serveur n'a pas répondu. Réessaie dans un instant.");
      setOccupe(false);
    }
  };

  return (
    <main style={{ background: PAPER, color: INK, minHeight: "100vh" }} className="font-sans">
      <div className="mx-auto max-w-4xl px-6 py-16">
        <a href="/vitrine" className="text-[14px] underline underline-offset-4" style={{ color: MUTED }}>
          ← Retour
        </a>

        <h1 className="mt-8 font-serif text-[38px] leading-[1.12] tracking-[-0.02em] sm:text-[46px]">
          {/* « Merci — on prend la suite » au-dessus de « Paiement
              interrompu » : constaté au navigateur, et c'est exactement le
              genre de contresens qui fait douter au pire moment. */}
          {achat === "ok" ? "Merci" : achat ? "Rien n'a été débité" : choisie ? choisie.nom : "Par où vous voulez commencer"}
        </h1>
        <p className="mt-4 max-w-2xl text-[17px] leading-[1.65]" style={{ color: MUTED }}>
          {achat === "ok"
            ? "On prend la suite."
            : achat
            ? "Vous pouvez reprendre où vous en étiez."
            : choisie
            ? choisie.sousTitre
            : "La démo est gratuite. Le lancement, non — il y a de la téléphonie et du temps derrière. Prix affichés, sans engagement."}
        </p>

        {achat && choisie && <RetourPaiement achat={achat} offre={choisie} />}

        {/* ── 1. L'offre ── */}
        {!achat && !choisie && (
          <div className="mt-12 grid gap-4 sm:grid-cols-2">
            {PAYABLES.map((o) => (
              <button
                key={o.id}
                onClick={() => setChoisie(o)}
                className="rounded-2xl p-6 text-left transition-colors"
                style={{ border: `1px solid ${LINE}`, background: "#FFFFFF" }}
              >
                <p className="text-[13px] uppercase tracking-[0.14em]" style={{ color: ACCENT }}>
                  {o.cadence === "unique" ? "Une fois" : "Mensuel"}
                </p>
                <p className="mt-3 font-serif text-[30px] leading-none tracking-[-0.02em]">{prix(o)}</p>
                <p className="mt-3 text-[16px] font-medium">{o.nom}</p>
                <p className="mt-1 text-[15px] leading-[1.55]" style={{ color: MUTED }}>
                  {o.sousTitre}
                </p>
                <ul className="mt-4 space-y-1.5 text-[14px]" style={{ color: MUTED }}>
                  {o.inclus.map((i) => (
                    <li key={i}>· {i}</li>
                  ))}
                </ul>
                {o.auDela && (
                  <p className="mt-3 text-[13px] leading-[1.5]" style={{ color: MUTED }}>
                    {o.auDela}
                  </p>
                )}
                <p className="mt-5 text-[15px] underline underline-offset-4" style={{ color: ACCENT }}>
                  {o.cta.label} →
                </p>
              </button>
            ))}
          </div>
        )}

        {!achat && choisie && (
          <div className="mt-10 rounded-2xl p-7" style={{ border: `1px solid ${ACCENT}`, background: "#FFFFFF" }}>
            <div className="flex flex-wrap items-baseline justify-between gap-3">
              <p className="font-serif text-[34px] leading-none tracking-[-0.02em]">{prix(choisie)}</p>
              <button
                onClick={() => setChoisie(null)}
                className="text-[14px] underline underline-offset-4"
                style={{ color: MUTED }}
              >
                changer d&apos;offre
              </button>
            </div>
            <ul className="mt-5 space-y-1.5 text-[15px]" style={{ color: MUTED }}>
              {choisie.inclus.map((i) => (
                <li key={i}>· {i}</li>
              ))}
            </ul>
            {choisie.auDela && (
              <p className="mt-4 text-[14px] leading-[1.55]" style={{ color: MUTED }}>
                {choisie.auDela}
              </p>
            )}

            {/* ── 2. Le compte, puis 3. le paiement ── */}
            <div className="mt-7 border-t pt-6" style={{ borderColor: LINE }}>
              {!authAvailable() ? (
                /**
                 * Supabase absent : aucun compte n'est créable, donc aucun
                 * paiement rattachable. Un bouton « Payer » ici mènerait à un
                 * 401 que l'acheteur lirait comme un refus de sa carte.
                 */
                <p className="text-[15px] leading-[1.6]" style={{ color: MUTED }}>
                  La souscription en ligne n&apos;est pas encore ouverte.{" "}
                  <a
                    href="mailto:contact@eagleyecorp.fr?subject=Souscrire%20ALPHA%20SALES%20OS"
                    className="underline underline-offset-4"
                    style={{ color: ACCENT }}
                  >
                    Écrivez-nous
                  </a>{" "}
                  — on vous met en route à la main, c&apos;est plus rapide que ça n&apos;en a l&apos;air.
                </p>
              ) : !pret ? (
                <p className="text-[15px]" style={{ color: MUTED }}>
                  Un instant…
                </p>
              ) : user ? (
                <>
                  <p className="text-[15px]" style={{ color: MUTED }}>
                    Connecté en tant que <strong style={{ color: INK }}>{user.email}</strong>.
                  </p>
                  <button
                    onClick={payer}
                    disabled={occupe}
                    className="mt-4 rounded-full px-6 py-3 text-[15px] font-medium disabled:opacity-60"
                    style={{ background: INK, color: PAPER }}
                  >
                    {occupe ? "Redirection…" : `Payer ${prix(choisie)}`}
                  </button>
                  <p className="mt-3 text-[13px]" style={{ color: MUTED }}>
                    Paiement chez Stripe. Aucune donnée de carte ne passe par nous.
                  </p>
                </>
              ) : (
                <>
                  <p className="text-[15px] font-medium">
                    {mode === "up" ? "Créez votre compte" : "Connectez-vous"}
                  </p>
                  <div className="mt-4 grid gap-3 sm:max-w-md">
                    <input
                      type="email"
                      autoComplete="email"
                      placeholder="vous@entreprise.fr"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="rounded-lg px-4 py-3 text-[15px]"
                      style={{ border: `1px solid ${LINE}`, background: PAPER }}
                    />
                    <input
                      type="password"
                      autoComplete={mode === "up" ? "new-password" : "current-password"}
                      placeholder="Mot de passe"
                      value={motDePasse}
                      onChange={(e) => setMotDePasse(e.target.value)}
                      className="rounded-lg px-4 py-3 text-[15px]"
                      style={{ border: `1px solid ${LINE}`, background: PAPER }}
                    />
                  </div>
                  <button
                    onClick={compte}
                    disabled={occupe}
                    className="mt-4 rounded-full px-6 py-3 text-[15px] font-medium disabled:opacity-60"
                    style={{ background: INK, color: PAPER }}
                  >
                    {occupe ? "…" : mode === "up" ? "Créer le compte" : "Se connecter"}
                  </button>
                  <button
                    onClick={() => {
                      setMode(mode === "up" ? "in" : "up");
                      setErreur(null);
                    }}
                    className="ml-4 text-[14px] underline underline-offset-4"
                    style={{ color: MUTED }}
                  >
                    {mode === "up" ? "J'ai déjà un compte" : "Créer un compte"}
                  </button>
                </>
              )}

              {erreur && (
                <p className="mt-4 text-[14px]" style={{ color: "#B42318" }}>
                  {erreur}
                </p>
              )}
              {info && (
                <p className="mt-4 text-[14px]" style={{ color: ACCENT }}>
                  {info}
                </p>
              )}
            </div>
          </div>
        )}

        {/* ── Ce qui ne s'achète pas en ligne, et pourquoi ── */}
        {!achat && SUR_DEVIS.length > 0 && (
          <div className="mt-16 border-t pt-10" style={{ borderColor: LINE }}>
            <h2 className="font-serif text-[26px] tracking-[-0.01em]">L&apos;installation complète</h2>
            <p className="mt-3 max-w-2xl text-[16px] leading-[1.65]" style={{ color: MUTED }}>
              Elle ne se prend pas en ligne, et ce n&apos;est pas une manœuvre commerciale : le périmètre
              se décide au cadrage. Annoncer un montant sans avoir regardé votre cas, c&apos;est annoncer
              un montant qu&apos;on ne tiendra pas.
            </p>
            <div className="mt-6 flex flex-wrap gap-4">
              {SUR_DEVIS.map((o) => (
                <a
                  key={o.id}
                  href={o.cta.href}
                  className="rounded-full px-5 py-2.5 text-[15px]"
                  style={{ border: `1px solid ${LINE}` }}
                >
                  {o.nom} — {o.cta.label} →
                </a>
              ))}
            </div>
          </div>
        )}

        <p className="mt-16 text-[13px] leading-[1.6]" style={{ color: MUTED }}>
          Tous les prix sont hors taxes. Sans engagement : un abonnement mensuel s&apos;arrête quand vous
          le décidez.{" "}
          <a href="/cgv.html" className="underline underline-offset-4">
            CGV
          </a>{" "}
          ·{" "}
          <a href="/confidentialite.html" className="underline underline-offset-4">
            Confidentialité
          </a>
        </p>
      </div>
    </main>
  );
}
