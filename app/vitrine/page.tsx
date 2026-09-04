"use client";

import { useState } from "react";
// ⚠ On n'importe RIEN de `lib/bricks` ici. Ce module contient le catalogue
// complet avec ses prix, et tout ce qu'une page publique importe part dans le
// navigateur — visible en trois secondes de devtools, même si rien ne
// l'affiche. Voir lib/public-catalogue.ts.
import {
  ALPHA_VOICE_PUBLIC,
  BUSINESS_PUBLIC,
  CAPACITES,
  FRONTIERE_PAYANT,
  GARANTIE,
  PALIERS_LABELS,
  LIFETIME_PUBLIC,
  PRIX_PUBLICS,
  SOCLE_GRATUIT,
} from "@/lib/public-catalogue";
import { HeroVideo } from "@/components/vitrine/hero-video";
import { MissionSection } from "@/components/vitrine/mission-section";

/**
 * ─────────────────────────────────────────────────────────────────────
 * VITRINE PUBLIQUE — eagleyecorp.fr
 *
 * Direction artistique : l'école OpenAI / Anthropic. Ce qui la définit,
 * et qu'on applique ici sans décoration inutile :
 *   · un fond crème chaud, pas de dark, pas de gradient, pas de glow ;
 *   · une typographie éditoriale : titres serif très larges, tracking serré ;
 *   · du BLANC, beaucoup — l'espace est le luxe, pas les effets ;
 *   · des filets fins au lieu de cartes ombrées ;
 *   · une seule couleur d'accent, utilisée avec parcimonie ;
 *   · le texte porte la démonstration, le design ne fait que le laisser lire.
 *
 * L'ordre de la page fait signer : liberté → est-ce qu'on matche → coût de
 * l'inaction → prix → cadrage obligatoire.
 *
 * Page publique (hors SITE_PASSWORD, hors AppShell). Aucune donnée client
 * n'y transite : pas de store, pas d'appel API.
 * ─────────────────────────────────────────────────────────────────────
 */

const INK = "#191919";
const CREAM = "#F5F3EE";
const ACCENT = "#B85A32";
const MUTED = "#6B6862";
const LINE = "#DEDAD1";

export default function VitrinePage() {
  // On ne calcule PLUS de total public : le chiffrage se fait au cadrage.
  // L'ancrage par l'addition ne fonctionne que dans une conversation, pas sur
  // une page où le prospect optimise seul.
  //
  // ⚠ Cette ligne renvoyait à `publicBricks()` dans lib/bricks.ts. Cette
  // fonction N'EXISTE PLUS — elle a été retirée parce qu'elle lisait `BRICKS`,
  // donc la page publique qui l'importait embarquait tout le catalogue, prix
  // compris, dans son bundle (le post-mortem est en bas de lib/bricks.ts).
  // Une consigne au présent qui désigne du code mort envoie le prochain
  // lecteur chercher une garde qui n'est pas là. Ce qui garde la vitrine
  // aujourd'hui : `lib/public-catalogue.ts`, recopié à la main, et
  // `tests/vitrine-fuite.test.ts`.
  const [picked, setPicked] = useState<string[]>([]);
  const toggle = (id: string) =>
    setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));

  /**
   * ─────────────────────────────────────────────────────────────────────
   * LA CARTE D'ESSAI — et ce qu'elle NE fait pas.
   *
   * ⚠ ELLE N'ENREGISTRE RIEN CHEZ NOUS. L'adresse saisie n'est ni stockée, ni
   * envoyée à une API, ni ajoutée à une liste : elle est passée au formulaire
   * d'inscription, qui est le SEUL endroit où un compte se crée.
   *
   * C'est un choix, pas une simplification. Une adresse captée sur une page
   * publique est une collecte de données personnelles avec sa propre finalité,
   * sa base légale, sa durée de conservation et son droit d'effacement — pour
   * une liste que personne n'exploiterait avant des semaines. On ne crée pas
   * une obligation RGPD pour un champ de commodité.
   *
   * Ce qu'elle règle, en revanche, est réel : sans elle, la personne clique
   * « Commencer seul », arrive sur un formulaire vide, et RETAPE son adresse.
   * C'est le moment exact où l'on abandonne.
   * ─────────────────────────────────────────────────────────────────────
   */
  const [email, setEmail] = useState("");
  const emailValide = /^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/.test(email.trim());
  /**
   * ⚠ `encodeURIComponent`, pas une concaténation. Une adresse contient des
   * caractères qui ont un sens dans une URL (`+` dans `nom+alpha@…` devient
   * une espace côté serveur) : sans encodage, l'adresse arrive déformée au
   * formulaire, et la personne ne comprend pas pourquoi son compte ne marche
   * pas. Vers `/` — l'application elle-même : c'est là que la porte de
   * connexion s'ouvre, et c'est ce qui a été demandé (« direct sur Alpha »).
   */
  const lienEssai = emailValide ? `/?email=${encodeURIComponent(email.trim())}` : "/";

  return (
    <div id="top" style={{ background: CREAM, color: INK }} className="min-h-screen antialiased">
      {/* ── Navigation ── */}
      <header className="sticky top-0 z-10 border-b backdrop-blur-md" style={{ borderColor: LINE, background: `${CREAM}E6` }}>
        <nav className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-x-4 gap-y-2 px-5 py-3 sm:px-6 sm:py-4">
          {/*
            ⚠ « EAGLEYE CORP » ÉTAIT UN <span>, DONC MORT.
            C'est le seul élément qu'on clique par réflexe sur n'importe quel
            site — il ramène en haut. Un titre de marque inerte donne
            l'impression d'une page figée, et sur mobile, où la navigation est
            masquée, c'était le SEUL retour possible : il n'y en avait aucun.
          */}
          <a href="#top" className="text-[15px] font-semibold tracking-tight transition-opacity hover:opacity-70">
            EAGLEYE CORP
          </a>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 text-[14px] sm:gap-x-7" style={{ color: MUTED }}>
            <a href="#gratuit" className="hidden hover:text-[#191919] sm:inline">Gratuit</a>
            <a href="#produit" className="hidden hover:text-[#191919] sm:inline">Produit</a>
            <a href="#ecrans" className="hidden hover:text-[#191919] sm:inline">Écrans</a>
            <a href="#tarifs" className="hidden hover:text-[#191919] sm:inline">Tarifs</a>
            <a href="/souscrire" className="hidden hover:text-[#191919] sm:inline">Souscrire</a>
            <a href="#mission" className="hidden hover:text-[#191919] sm:inline">Mission</a>
            <a
              href="#cadrage"
              className="rounded-full px-4 py-2 text-[14px] font-medium text-white transition-opacity hover:opacity-90"
              style={{ background: INK }}
            >
              Demander un cadrage
            </a>
          </div>
        </nav>
      </header>

      <main className="mx-auto max-w-5xl px-6">
        {/* ── 1. LA LIBERTÉ ── */}
        <section className="py-24 sm:py-32">
          <p className="mb-6 text-[13px] uppercase tracking-[0.16em]" style={{ color: ACCENT }}>
            Alpha Sales OS
          </p>
          <h1 className="max-w-3xl font-serif text-[44px] leading-[1.08] tracking-[-0.02em] sm:text-[64px]">
            Votre machine de vente tourne.
            <br />
            <span style={{ color: MUTED }}>Vous, vous vivez.</span>
          </h1>
          <p className="mt-8 max-w-2xl text-[18px] leading-[1.65]" style={{ color: MUTED }}>
            Pas un logiciel de plus à apprendre. Une machine qui trouve vos clients, les appelle, les
            relance et remplit votre agenda — pendant que vous êtes sur le terrain, en famille, ou en
            train de dormir. Vous ne récupérez pas du temps : vous récupérez le choix de ce que vous
            en faites.
          </p>

          {/*
            ── LA PORTE LA MOINS CHÈRE, EN HAUT DE PAGE ──

            Elle était en bas, dans une section « Commencer ». En haut, la page
            n'offrait que « Demander un cadrage » : un rendez-vous avec un
            inconnu, proposé à quelqu'un qui vient d'arriver. Entre les deux il
            y a un ordre de grandeur d'engagement, et c'est le moins engageant
            qui doit être le plus visible.
          */}
          <form
            className="mt-10 max-w-xl rounded-2xl p-6"
            style={{ background: "#FFFFFF", border: `1px solid ${LINE}` }}
            onSubmit={(e) => {
              // La navigation se fait par le lien : le formulaire n'existe que
              // pour que « Entrée » fonctionne au clavier, ce qui est la moitié
              // des saisies sur un champ email.
              e.preventDefault();
              if (emailValide) window.location.href = lienEssai;
            }}
          >
            <p className="font-serif text-[24px] leading-[1.25] tracking-[-0.01em]">
              Essayez-le maintenant, gratuitement.
            </p>
            <p className="mt-2 text-[15px] leading-[1.6]" style={{ color: MUTED }}>
              Votre email, un mot de passe, et vous êtes dans l&apos;outil. Le socle reste gratuit,
              sans limite de durée et sans carte bancaire.
            </p>

            <div className="mt-5 flex flex-col gap-3 sm:flex-row">
              <input
                type="email"
                inputMode="email"
                autoComplete="email"
                placeholder="vous@votre-entreprise.fr"
                aria-label="Votre adresse email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="min-w-0 flex-1 rounded-full px-5 py-3 text-[15px] outline-none"
                style={{ border: `1px solid ${LINE}`, background: CREAM, color: INK }}
              />
              <a
                href={lienEssai}
                aria-disabled={!emailValide}
                onClick={(e) => {
                  // Sans adresse valide, on n'envoie pas vers un formulaire
                  // qu'on ne peut pas pré-remplir : on ramène le curseur ici.
                  if (!emailValide) {
                    e.preventDefault();
                    (e.currentTarget.parentElement?.querySelector("input") as HTMLInputElement)?.focus();
                  }
                }}
                className="shrink-0 rounded-full px-6 py-3 text-center text-[15px] font-medium text-white transition-opacity"
                style={{ background: INK, opacity: emailValide ? 1 : 0.45 }}
              >
                Essayer maintenant
              </a>
            </div>

            {/*
              ⚠ Ce qu'on fait de l'adresse est dit SOUS le champ, pas dans une
              politique qu'il faut aller chercher. C'est la question qu'on se
              pose au moment exact où l'on tape.
            */}
            <p className="mt-3 text-[13px] leading-[1.5]" style={{ color: MUTED }}>
              Cette adresse ne part nulle part : elle sert à pré-remplir votre inscription. Aucune
              liste, aucun email de notre part tant que vous n&apos;avez pas de compte.
            </p>
          </form>

          {/*
            ⚠ CES DEUX LIENS ÉTAIENT AU-DESSUS DE LA CARTE, EN GROS BOUTONS.
            La page présentait donc trois appels à l'action d'affilée, et le
            MOINS engageant — le champ email — arrivait en dernier. Un
            rendez-vous avec un inconnu et une adresse email ne sont pas au même
            niveau d'engagement : c'est le moins cher qui doit être le plus
            visible, et le reste passe en second rôle.

            « Commencer seul » a disparu : il menait à /souscrire, que la carte
            fait mieux et plus tôt. Deux portes vers la même chose, dont une
            plus fade, ne doublent pas les entrées — elles font hésiter.
          */}
          <p className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-2 text-[15px]" style={{ color: MUTED }}>
            <span>Vous préférez en parler d&apos;abord ?</span>
            <a href="#cadrage" className="underline underline-offset-4" style={{ color: INK }}>
              Demander un cadrage
            </a>
            <a href="#tarifs" className="underline underline-offset-4">
              Voir les tarifs
            </a>
          </p>

          {/* La vidéo est le SEUL objet sombre de la page : sur un fond crème,
              le contraste fait le cadrage tout seul, sans décoration. */}
          <HeroVideo
            line="10 secondes — ce que l'OS fait pendant que vous êtes ailleurs."
            muted="Lecture automatique désactivée (mouvement réduit). Le film dure 10 secondes."
          />
        </section>

        <Rule />

        {/*
          ── LA PORTE GRATUITE ──

          ⚠ Elle n'existait NULLE PART sur cette page. Le socle est ouvert
          depuis le 02/09/2026 — le serveur l'applique, des tests le gardent —
          et la vitrine ne proposait qu'une seule porte : « demander un
          cadrage », c'est-à-dire un rendez-vous avec un inconnu, à quelqu'un
          qui n'a encore rien vu. La porte qui ne coûte que dix secondes
          existait dans le code et pas sur la page.
        */}
        <section id="gratuit" className="py-20">
          <SectionLabel>Commencer</SectionLabel>
          <h2 className="mt-4 max-w-2xl font-serif text-[34px] leading-[1.15] tracking-[-0.02em] sm:text-[42px]">
            Le socle est gratuit.
            <br />
            <span style={{ color: MUTED }}>Sans durée, sans carte bancaire.</span>
          </h2>
          <p className="mt-5 max-w-2xl text-[17px] leading-[1.65]" style={{ color: MUTED }}>
            Vous créez votre compte, vous entrez. Ce n&apos;est pas une version d&apos;essai qui
            s&apos;éteint dans quinze jours : c&apos;est le socle, et il reste ouvert.
          </p>

          <ul className="mt-10 grid gap-8 sm:grid-cols-2">
            {SOCLE_GRATUIT.map((b) => (
              <li key={b.id}>
                <p className="text-[15px] font-semibold">{b.label}</p>
                <p className="mt-2 text-[16px] leading-[1.6]" style={{ color: MUTED }}>{b.what}</p>
              </li>
            ))}
          </ul>

          <p className="mt-10 max-w-2xl text-[17px] leading-[1.65]">
            <strong>{FRONTIERE_PAYANT}</strong>
          </p>
          <p className="mt-3 max-w-2xl text-[16px] leading-[1.6]" style={{ color: MUTED }}>
            Ce n&apos;est pas une astuce commerciale : un appel passé, un email envoyé ou un texte
            écrit par un modèle consomme une ligne, un serveur et des crédits. Ce qui vous organise
            ne consomme rien — alors on ne le facture pas.
          </p>

          <a
            href="/souscrire"
            className="mt-10 inline-block rounded-full px-7 py-3.5 text-[15px] font-medium text-white transition-opacity hover:opacity-90"
            style={{ background: INK }}
          >
            Créer mon compte
          </a>
        </section>

        <Rule />

        {/* ── 2. EST-CE QU'ON MATCHE ? ── */}
        <section id="produit" className="py-20">
          <SectionLabel>Qualification</SectionLabel>
          <h2 className="mt-4 max-w-2xl font-serif text-[34px] leading-[1.15] tracking-[-0.02em] sm:text-[42px]">
            D&apos;abord : est-ce qu&apos;on matche ?
          </h2>
          <p className="mt-5 max-w-2xl text-[17px] leading-[1.65]" style={{ color: MUTED }}>
            On ne travaille pas avec tout le monde, et ce n&apos;est pas une posture. Si vous
            n&apos;êtes pas dans la colonne de gauche, on vous le dira au premier appel — ça
            évitera de vous faire perdre votre temps.
          </p>

          <div className="mt-12 grid gap-12 sm:grid-cols-2">
            <div>
              <h3 className="text-[15px] font-semibold">C&apos;est pour vous si</h3>
              <ul className="mt-4 space-y-3">
                {[
                  "Vous avez déjà des clients — on amplifie, on ne part pas de zéro.",
                  "Des demandes arrivent et vous n'arrivez pas à toutes les traiter.",
                  "Votre suivi tient sur votre tête, un carnet, ou rien.",
                  "Vous pouvez décider seul, ou avec une personne.",
                ].map((x) => (
                  <li key={x} className="flex gap-3 text-[16px] leading-[1.6]" style={{ color: MUTED }}>
                    <span style={{ color: ACCENT }}>—</span>
                    {x}
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h3 className="text-[15px] font-semibold">Ce n&apos;est pas pour vous si</h3>
              <ul className="mt-4 space-y-3">
                {[
                  "Vous cherchez le moins cher du marché — ce ne sera jamais nous.",
                  "Vous voulez « tester » sans changer votre façon de travailler.",
                  "Vous êtes déjà plein et vous refusez du monde.",
                  "Vous attendez des clients sans jamais décrocher le téléphone.",
                ].map((x) => (
                  <li key={x} className="flex gap-3 text-[16px] leading-[1.6]" style={{ color: MUTED }}>
                    <span style={{ color: LINE }}>—</span>
                    {x}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        <Rule />

        {/* ── 3. LE COÛT DE L'INACTION ── */}
        <section className="py-20">
          <SectionLabel>Le vrai coût</SectionLabel>
          <h2 className="mt-4 max-w-2xl font-serif text-[34px] leading-[1.15] tracking-[-0.02em] sm:text-[42px]">
            Ce que ça coûte de ne rien changer
          </h2>
          <p className="mt-5 max-w-2xl text-[17px] leading-[1.65]" style={{ color: MUTED }}>
            Un client qui n&apos;obtient pas de réponse appelle le suivant dans les cinq minutes. Il
            ne rappelle pas, il ne vous en veut pas, et vous ne saurez jamais qu&apos;il a existé.
            C&apos;est la perte la plus chère qui soit : celle qu&apos;on ne voit pas passer.
          </p>

          <div className="mt-12 grid gap-10 sm:grid-cols-3">
            {[
              { t: "Aujourd'hui", d: "Vous décrochez quand vous pouvez. Le reste part chez le concurrent." },
              { t: "Dans six mois", d: "Le même volume, la même fatigue — et un concurrent équipé qui répond 24/7." },
              { t: "Avec la machine", d: "Chaque demande est prise, qualifiée, relancée. Vous ne traitez que ce qui mérite votre voix." },
            ].map((x) => (
              <div key={x.t}>
                <p className="text-[15px] font-semibold">{x.t}</p>
                <p className="mt-2 text-[16px] leading-[1.6]" style={{ color: MUTED }}>{x.d}</p>
              </div>
            ))}
          </div>

          <p className="mt-12 max-w-2xl border-l-2 pl-5 text-[16px] leading-[1.65]" style={{ borderColor: ACCENT, color: MUTED }}>
            On ne vous promet pas un chiffre. On mesure le vôtre pendant le cadrage — et si la perte
            est négligeable, on vous le dira.
          </p>
        </section>

        <Rule />

        {/*
          ── DES CAPTURES DU VRAI PRODUIT ──

          La page décrivait le produit sans jamais le MONTRER. Sur un logiciel,
          c'est la première question qu'on se pose et la dernière à laquelle un
          paragraphe répond.

          ⚠ Ce sont des captures RÉELLES, prises sur l'application, aux quatre
          écrans du socle GRATUIT — pas des maquettes, et pas un écran payant :
          montrer ici ce qui n'est pas donné ferait promettre autre chose que
          ce qu'on ouvre.

          ⚠⚠ Le bandeau « Données de démo actives » reste VISIBLE sur les
          captures, volontairement. Le masquer donnerait à croire à un pipe
          réel ; le laisser dit exactement ce que c'est. C'est la même règle
          que partout ailleurs : on ne fabrique pas de preuve.
        */}
        <section id="ecrans" className="py-20">
          <SectionLabel>Les écrans</SectionLabel>
          <h2 className="mt-4 max-w-2xl font-serif text-[34px] leading-[1.15] tracking-[-0.02em] sm:text-[42px]">
            Voilà à quoi ça ressemble.
          </h2>
          <p className="mt-5 max-w-2xl text-[17px] leading-[1.65]" style={{ color: MUTED }}>
            Les quatre écrans du socle gratuit, tels quels. Le jeu de démonstration est affiché —
            c&apos;est ce que vous verrez en créant votre compte, avant d&apos;y mettre vos propres
            fiches.
          </p>

          <div className="mt-10 grid gap-8 sm:grid-cols-2">
            {[
              ["/produit/tableau-de-bord.jpg", "Le tableau de bord", "Ce qui bouge, en un écran : les routines du matin, le pipe pondéré, le prochain rendez-vous."],
              ["/produit/pipeline.jpg", "Le pipeline", "Chaque fiche avec son étape et sa prochaine action datée. Une fiche sans date est une décision qu'on n'a pas prise."],
              ["/produit/closer.jpg", "Le Closer OS", "La tournée du jour, priorisée — et le débrief à la voix en sortant de rendez-vous."],
              ["/produit/cerveau.jpg", "Le Cerveau", "Votre doctrine, vos scripts, vos objections. Cherchables en une phrase, pas rangés dans un dossier."],
            ].map(([src, titre, texte]) => (
              <figure key={src}>
                <div className="overflow-hidden rounded-xl" style={{ border: `1px solid ${LINE}` }}>
                  {/*
                    Pas de <Image> de Next ici : cette page est statique et sans
                    domaine d'images configuré. Un <img> natif avec ses
                    dimensions réelles réserve la place et évite le saut de
                    mise en page au chargement — c'est tout ce qu'on demande.
                  */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={src}
                    alt={`Alpha Sales OS — ${titre}`}
                    width={2040}
                    height={1275}
                    loading="lazy"
                    className="block h-auto w-full"
                  />
                </div>
                <figcaption className="mt-3">
                  <p className="text-[15px] font-semibold">{titre}</p>
                  <p className="mt-1 text-[15px] leading-[1.6]" style={{ color: MUTED }}>{texte}</p>
                </figcaption>
              </figure>
            ))}
          </div>

          <a
            href="/souscrire"
            className="mt-10 inline-block rounded-full px-7 py-3.5 text-[15px] font-medium text-white transition-opacity hover:opacity-90"
            style={{ background: INK }}
          >
            Créer mon compte et regarder
          </a>
        </section>

        {/* ── 4. LES TARIFS ── */}
        <section id="tarifs" className="py-20">
          <SectionLabel>Tarifs</SectionLabel>
          <h2 className="mt-4 font-serif text-[34px] leading-[1.15] tracking-[-0.02em] sm:text-[42px]">
            Un prix, annoncé après vous avoir écouté
          </h2>
          <p className="mt-5 max-w-2xl text-[17px] leading-[1.65]" style={{ color: MUTED }}>
            On ne vend pas un abonnement sorti d&apos;un catalogue. Le périmètre se décide au cadrage,
            et le chiffre tombe ensuite — c&apos;est la seule façon d&apos;annoncer un montant qu&apos;on
            tiendra.
          </p>

          <div className="mt-12 grid gap-10 sm:grid-cols-2">
            <div className="rounded-2xl p-8" style={{ background: "#FFFFFF", border: `1px solid ${ACCENT}` }}>
              <p className="text-[13px] uppercase tracking-[0.14em]" style={{ color: ACCENT }}>L&apos;installation complète</p>
              <p className="mt-4 font-serif text-[46px] leading-none tracking-[-0.02em]">
                10 000 <span className="text-[22px]" style={{ color: MUTED }}>€ HT</span>
              </p>
              <p className="mt-2 text-[15px]" style={{ color: MUTED }}>
                puis {PRIX_PUBLICS.packMensuelHT.toLocaleString("fr-FR")} € HT/mois
              </p>
              <p className="mt-5 text-[16px] leading-[1.6]" style={{ color: MUTED }}>
                Tout est posé, paramétré sur votre métier, vos équipes formées. C&apos;est l&apos;offre où
                l&apos;on prend tout en charge — et celle qui va le plus loin.
              </p>
              {/*
                ⚠ L'ÉTALEMENT SE DIT ICI, sous le prix, pas dans une note de bas
                de page. Le blocage n'a jamais été le montant : c'est de le
                signer d'un trait. Le cacher jusqu'au devis fait perdre la
                conversation avant qu'elle commence.
              */}
              <p className="mt-5 rounded-xl px-4 py-3 text-[15px] leading-[1.55]" style={{ background: CREAM, color: INK }}>
                <strong>Ou étalé :</strong> {BUSINESS_PUBLIC.acompteHT.toLocaleString("fr-FR")} € HT à la signature,
                puis {BUSINESS_PUBLIC.mensualites} × {BUSINESS_PUBLIC.mensualiteHT} € HT. L&apos;abonnement de{" "}
                {BUSINESS_PUBLIC.abonnementHT.toLocaleString("fr-FR")} € HT/mois ne démarre qu&apos;après.
              </p>
            </div>

            <div className="rounded-2xl p-8" style={{ border: `1px solid ${LINE}` }}>
              <p className="text-[13px] uppercase tracking-[0.14em]" style={{ color: MUTED }}>À la carte</p>
              <p className="mt-4 font-serif text-[46px] leading-none tracking-[-0.02em]">
                Sur mesure
              </p>
              <p className="mt-2 text-[15px]" style={{ color: MUTED }}>
                chiffré au cadrage
              </p>
              <p className="mt-5 text-[16px] leading-[1.6]" style={{ color: MUTED }}>
                Vous n&apos;avez besoin que d&apos;une partie ? On installe cette partie-là, et rien
                d&apos;autre. Beaucoup commencent comme ça.
              </p>
            </div>
          </div>

          {/*
            ── LIFETIME ──

            Ce qu'un lifetime est vraiment : on échange tout le revenu futur
            d'un client contre de l'argent maintenant. La page ne le dit pas au
            prospect — ce n'est pas son sujet — mais elle dit les deux choses
            qui l'engagent, LUI : ce qui est à vie (le logiciel) et ce qui ne
            l'est pas (la consommation). Une offre « à vie » dont le périmètre
            n'est pas écrit se discute au premier dépassement.
          */}
          <div className="mt-16 rounded-2xl p-8" style={{ border: `1px solid ${ACCENT}` }}>
            <p className="text-[13px] uppercase tracking-[0.14em]" style={{ color: ACCENT }}>
              Lifetime — {LIFETIME_PUBLIC.placesTotal} places, puis l&apos;offre ferme
            </p>
            <p className="mt-4 font-serif text-[46px] leading-none tracking-[-0.02em]">
              {LIFETIME_PUBLIC.paliers[0].prixHT.toLocaleString("fr-FR")}{" "}
              <span className="text-[22px]" style={{ color: MUTED }}>€ HT</span>
            </p>
            <p className="mt-2 text-[15px]" style={{ color: MUTED }}>
              pour les {LIFETIME_PUBLIC.paliers[0].places} premiers — le prix monte ensuite
            </p>
            <p className="mt-5 max-w-2xl text-[16px] leading-[1.6]" style={{ color: MUTED }}>
              Le <strong style={{ color: INK }}>logiciel à vie</strong>, payé une fois, mises à jour
              comprises, avec {LIFETIME_PUBLIC.appelsInclus.toLocaleString("fr-FR")} appels inclus.
              Ce qui se consomme ensuite — les appels, les envois — reste facturé à l&apos;usage :
              une minute coûte quelque chose à quelqu&apos;un, tous les mois, et prétendre le
              contraire finirait par se voir.
            </p>
            <ul className="mt-5 flex flex-wrap gap-x-8 gap-y-2 text-[15px]" style={{ color: MUTED }}>
              {LIFETIME_PUBLIC.paliers.map((t) => (
                <li key={t.rang}>
                  <span style={{ color: INK }}>{t.prixHT.toLocaleString("fr-FR")} € HT</span> — {t.places} places
                </li>
              ))}
            </ul>
            <p className="mt-5 text-[15px] leading-[1.55]" style={{ color: MUTED }}>
              Le nombre de places n&apos;est pas un argument : l&apos;installation se fait à la main,
              par une seule personne.
            </p>
          </div>

          {/*
            ── ALPHA VOICE, ACCUEIL TÉLÉPHONIQUE ──

            ⚠ La page n'affichait QUE le palier d'entrée du SORTANT (364 € le
            millier d'appels). La grille de l'accueil — celle qui est décidée,
            documentée et que nous annonçons par ailleurs — n'était nulle part.
            Un prospect lisait donc « 364 € » et repartait avec un ordre de
            grandeur qui n'est pas celui de l'offre qu'on lui vendra.

            Publier ces prix nets est une décision : ça qualifie les demandes
            et ça évite les rendez-vous hors budget.
          */}
          <div className="mt-16">
            <h3 className="font-serif text-[26px] tracking-[-0.01em]">
              Alpha Voice — l&apos;accueil qui décroche à votre place
            </h3>
            <p className="mt-3 max-w-2xl text-[16px] leading-[1.6]" style={{ color: MUTED }}>
              <strong style={{ color: INK }}>{ALPHA_VOICE_PUBLIC.setupHT} € HT d&apos;installation</strong>, puis
              un abonnement au volume :
            </p>
            <ul className="mt-5 grid gap-6 sm:grid-cols-2">
              {ALPHA_VOICE_PUBLIC.paliers.map((t) => (
                <li key={t.nom} className="rounded-xl p-5" style={{ border: `1px solid ${LINE}` }}>
                  <p className="text-[13px] uppercase tracking-[0.12em]" style={{ color: MUTED }}>{t.nom}</p>
                  <p className="mt-2 font-serif text-[34px] leading-none tracking-[-0.02em]">
                    {t.prixHT} € <span className="text-[16px]" style={{ color: MUTED }}>HT / mois</span>
                  </p>
                  <p className="mt-3 text-[15px] leading-[1.55]" style={{ color: MUTED }}>{t.ce}</p>
                </li>
              ))}
            </ul>
            <p className="mt-4 max-w-2xl text-[15px] leading-[1.6]" style={{ color: MUTED }}>
              Au-delà : {ALPHA_VOICE_PUBLIC.minuteSupHT.toFixed(2).replace(".", ",")} € HT la minute. Pas de coupure,
              pas de palier caché.
            </p>

            {/*
              LA GARANTIE, AVEC SES BORDS. Les taire n'est pas une
              simplification : c'est un litige à retardement. Une garantie sans
              durée s'active au bout de trois jours de ligne coupée.
            */}
            <div className="mt-8 rounded-xl p-6" style={{ background: "#FFFFFF", border: `1px solid ${ACCENT}` }}>
              <p className="font-serif text-[24px] leading-[1.25] tracking-[-0.01em]">{GARANTIE.promesse}</p>
              <ul className="mt-4 space-y-1.5">
                {GARANTIE.bords.map((b) => (
                  <li key={b} className="text-[15px] leading-[1.55]" style={{ color: MUTED }}>— {b}</li>
                ))}
              </ul>
            </div>

            {/*
              ── L'ARTICLE 50, SERVI COMME ARGUMENT ──

              La divulgation est prononcée par le CODE, hors du modèle, avant
              qu'il ait la parole, et sans interruption possible. C'est un fait
              vérifiable et daté — le seul de cette page qui ne demande aucune
              confiance. Le taire pour « ne pas faire peur » reviendrait à
              laisser un concurrent en faire un reproche.
            */}
            <div className="mt-10">
              <h4 className="text-[15px] font-semibold">L&apos;agent annonce qu&apos;il est une IA. Toujours.</h4>
              <p className="mt-2 max-w-2xl text-[16px] leading-[1.6]" style={{ color: MUTED }}>
                Première phrase de chaque appel : il dit qu&apos;il est une intelligence artificielle, pas
                une personne, et pour le compte de qui il appelle. Ce n&apos;est pas une consigne donnée au
                modèle — c&apos;est le code qui la prononce, avant que le modèle ait la parole, et elle ne
                peut pas être interrompue. Si le script ne la porte pas, l&apos;agent refuse de démarrer.
                L&apos;article 50 du règlement européen sur l&apos;IA s&apos;applique depuis le 2 août 2026.
              </p>
            </div>
          </div>

          {/* Alpha Voice sortant — l'entrée seulement, les paliers se disent au cadrage */}
          <div className="mt-16">
            <h3 className="font-serif text-[26px] tracking-[-0.01em]">
              Alpha Voice — au volume d&apos;appels, sans engagement
            </h3>
            <p className="mt-3 max-w-2xl text-[16px] leading-[1.6]" style={{ color: MUTED }}>
              Vous payez les appels passés, pas une licence. On commence à{" "}
              <strong style={{ color: INK }}>{PRIX_PUBLICS.sortantMensuelHT} € HT/mois pour {PRIX_PUBLICS.sortantAppels.toLocaleString("fr-FR")} appels</strong>,
              et on ne monte qu&apos;une fois que ça convertit.
            </p>
            <p className="mt-4 max-w-2xl text-[16px] leading-[1.65]" style={{ color: MUTED }}>
              <strong style={{ color: INK }}>Le volume n&apos;a de valeur qu&apos;après le réglage.</strong>{" "}
              Tant que le ciblage et la conversation ne sont pas au point, multiplier les appels ne fait
              que brûler votre fichier plus vite. Les paliers supérieurs existent — on les ouvre quand
              les chiffres le justifient, pas avant.
            </p>
          </div>

          {/* Les capacités — ce que ça FAIT, pas la grille tarifaire */}
          <div className="mt-16">
            <h3 className="font-serif text-[26px] tracking-[-0.01em]">Ce qu&apos;on peut installer</h3>
            <p className="mt-3 max-w-2xl text-[16px] leading-[1.6]" style={{ color: MUTED }}>
              Chaque capacité se prend seule ou avec les autres. Cochez ce qui vous parle : on part de là
              au cadrage, et le chiffre suit.
            </p>

            <div className="mt-8 grid gap-3 sm:grid-cols-2">
              {CAPACITES.map((b) => {
                const on = picked.includes(b.id);
                return (
                  <button
                    key={b.id}
                    onClick={() => toggle(b.id)}
                    className="rounded-xl p-5 text-left transition-colors"
                    style={{
                      background: on ? "#FFFFFF" : "transparent",
                      border: `1px solid ${on ? ACCENT : LINE}`,
                    }}
                  >
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="text-[15px] font-semibold">{b.label}</span>
                      <span className="shrink-0 text-[12px] uppercase tracking-[0.1em]" style={{ color: on ? ACCENT : MUTED }}>
                        {PALIERS_LABELS[b.palier]}
                      </span>
                    </div>
                    <p className="mt-2 text-[14px] leading-[1.55]" style={{ color: MUTED }}>{b.what}</p>
                  </button>
                );
              })}
            </div>

            {picked.length > 0 && (
              <div className="mt-8 rounded-xl p-6" style={{ background: "#FFFFFF", border: `1px solid ${ACCENT}` }}>
                <p className="font-serif text-[24px] leading-[1.25] tracking-[-0.01em]">
                  {picked.length === 1
                    ? "Une capacité — on peut commencer par là."
                    : `${picked.length} capacités — c'est un périmètre qui se tient.`}
                </p>
                <p className="mt-3 text-[16px] leading-[1.6]" style={{ color: MUTED }}>
                  {picked.length >= 4
                    ? "À ce niveau, l'installation complète revient presque toujours moins cher que la somme des parties. On vous le dira au cadrage, chiffres à l'appui — y compris si c'est en votre faveur de prendre moins."
                    : "Le chiffrage se fait après vingt minutes d'échange : on regarde votre cas, et on annonce un montant qu'on tient."}
                </p>
                <a
                  href="#cadrage"
                  className="mt-5 inline-block rounded-full px-6 py-3 text-[15px] font-medium text-white transition-opacity hover:opacity-90"
                  style={{ background: INK }}
                >
                  Chiffrer ce périmètre
                </a>
              </div>
            )}
          </div>
        </section>

        <Rule />
        <MissionSection />
        <Rule />

        {/* ── 5. LE CADRAGE ── */}
        <section id="cadrage" className="py-20">
          <SectionLabel>Avant tout devis</SectionLabel>
          <h2 className="mt-4 max-w-2xl font-serif text-[34px] leading-[1.15] tracking-[-0.02em] sm:text-[42px]">
            Le cadrage est obligatoire
          </h2>
          <p className="mt-5 max-w-2xl text-[17px] leading-[1.65]" style={{ color: MUTED }}>
            On ne vend pas un devis à l&apos;aveugle. Avant tout chiffrage, on regarde votre
            situation réelle : combien de demandes vous perdez, comment vous les traitez
            aujourd&apos;hui, et ce qu&apos;une machine changerait vraiment chez vous. Visio, appel
            ou SMS — vous choisissez.
          </p>

          <ul className="mt-10 grid gap-8 sm:grid-cols-3">
            {[
              ["Une date décidée", "Un créneau fixé ensemble, pas un « on se rappelle »."],
              ["Le canal qui vous arrange", "Visio, téléphone ou SMS. On s'adapte, pas l'inverse."],
              ["Une réponse franche", "À la fin, on vous dit si c'est pertinent. Y compris quand ça ne l'est pas."],
            ].map(([t, d]) => (
              <li key={t}>
                <p className="text-[15px] font-semibold">{t}</p>
                <p className="mt-2 text-[16px] leading-[1.6]" style={{ color: MUTED }}>{d}</p>
              </li>
            ))}
          </ul>

          <a
            href="mailto:contact@eagleyecorp.fr?subject=Cadrage%20Alpha%20Sales%20OS&body=Bonjour%2C%0A%0AJe%20souhaite%20caler%20un%20cadrage.%0A%0AMon%20activit%C3%A9%20%3A%0AMa%20ville%20%3A%0ACe%20qui%20me%20fait%20perdre%20le%20plus%20de%20clients%20aujourd%27hui%20%3A%0AMes%20disponibilit%C3%A9s%20%3A%0A%0AMerci."
            className="mt-12 inline-block rounded-full px-7 py-3.5 text-[15px] font-medium text-white transition-opacity hover:opacity-90"
            style={{ background: INK }}
          >
            Demander un cadrage
          </a>
          <p className="mt-4 text-[14px]" style={{ color: MUTED }}>
            contact@eagleyecorp.fr — réponse sous 24 h ouvrées.
          </p>
        </section>
      </main>

      <footer className="border-t" style={{ borderColor: LINE }}>
        <div className="mx-auto max-w-5xl px-6 py-12">
          <p className="text-[15px] font-semibold">EAGLEYE CORP</p>
          <p className="mt-2 max-w-2xl text-[14px] leading-[1.6]" style={{ color: MUTED }}>
            Lyon, France. Tous les prix sont indiqués hors taxes. Les estimations de gain ne sont
            jamais des garanties : elles sont calculées sur vos propres chiffres, pendant le cadrage.
          </p>
          <p className="mt-4 text-[14px]" style={{ color: MUTED }}>
            contact@eagleyecorp.fr
          </p>
          {/*
            ⚠ LA SORTIE VERS LA SOCIÉTÉ N'EXISTAIT NULLE PART.
            Depuis que eagleyecorp.fr présente EAGLEYE CORP et que cette page
            présente le produit, le lien devait exister DANS LES DEUX SENS. Il
            n'allait que dans un : quelqu'un qui arrive ici par le post
            LinkedIn ne pouvait pas savoir qui est derrière, ni le vérifier.
            Sur une page qui demande une adresse email, c'est exactement la
            question qu'on se pose avant de la donner.
          */}
          <p className="mt-6 border-t pt-6 text-[14px]" style={{ borderColor: LINE, color: MUTED }}>
            Alpha Sales OS est édité par EAGLEYE CORP —{" "}
            <a
              href="https://eagleyecorp.fr"
              className="underline underline-offset-4 hover:opacity-70"
              style={{ color: INK }}
            >
              voir la société et ses autres chantiers
            </a>
          </p>
        </div>
      </footer>
    </div>
  );
}

function Rule() {
  return <hr style={{ borderColor: LINE }} />;
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[13px] uppercase tracking-[0.16em]" style={{ color: ACCENT }}>
      {children}
    </p>
  );
}
