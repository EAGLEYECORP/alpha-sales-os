"use client";

import { useMemo, useState } from "react";
import { BRICKS, PACK_SETUP_HT, PACK_MONTHLY_HT, quoteBricks, OUTBOUND_TIERS, OUTBOUND_UNIT_HT } from "@/lib/bricks";

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
  const [picked, setPicked] = useState<string[]>([]);
  const quote = useMemo(() => quoteBricks(picked), [picked]);
  const toggle = (id: string) =>
    setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));

  return (
    <div style={{ background: CREAM, color: INK }} className="min-h-screen antialiased">
      {/* ── Navigation ── */}
      <header className="sticky top-0 z-10 border-b backdrop-blur-md" style={{ borderColor: LINE, background: `${CREAM}E6` }}>
        <nav className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <span className="text-[15px] font-semibold tracking-tight">EAGLEYE CORP</span>
          <div className="flex items-center gap-7 text-[14px]" style={{ color: MUTED }}>
            <a href="#produit" className="hidden hover:text-[#191919] sm:inline">Produit</a>
            <a href="#tarifs" className="hidden hover:text-[#191919] sm:inline">Tarifs</a>
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
          <div className="mt-10 flex flex-wrap items-center gap-4">
            <a
              href="#cadrage"
              className="rounded-full px-6 py-3 text-[15px] font-medium text-white transition-opacity hover:opacity-90"
              style={{ background: INK }}
            >
              Demander un cadrage
            </a>
            <a href="#tarifs" className="text-[15px] underline underline-offset-4" style={{ color: MUTED }}>
              Voir les tarifs
            </a>
          </div>
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

        {/* ── 4. LES TARIFS ── */}
        <section id="tarifs" className="py-20">
          <SectionLabel>Tarifs</SectionLabel>
          <h2 className="mt-4 font-serif text-[34px] leading-[1.15] tracking-[-0.02em] sm:text-[42px]">
            Deux façons de travailler ensemble
          </h2>

          <div className="mt-12 grid gap-10 sm:grid-cols-2">
            <div className="rounded-2xl p-8" style={{ background: "#FFFFFF", border: `1px solid ${LINE}` }}>
              <p className="text-[13px] uppercase tracking-[0.14em]" style={{ color: ACCENT }}>Pack complet</p>
              <p className="mt-4 font-serif text-[46px] leading-none tracking-[-0.02em]">
                10 000 <span className="text-[22px]" style={{ color: MUTED }}>€ HT</span>
              </p>
              <p className="mt-2 text-[15px]" style={{ color: MUTED }}>
                d&apos;installation, puis {PACK_MONTHLY_HT.toLocaleString("fr-FR")} € HT/mois
              </p>
              <p className="mt-5 text-[16px] leading-[1.6]" style={{ color: MUTED }}>
                Toutes les briques. Installées, paramétrées, vos équipes formées. C&apos;est
                l&apos;offre qui va le plus loin, et la seule où l&apos;on prend tout en charge.
              </p>
            </div>

            <div className="rounded-2xl p-8" style={{ border: `1px solid ${LINE}` }}>
              <p className="text-[13px] uppercase tracking-[0.14em]" style={{ color: MUTED }}>En partenariat</p>
              <p className="mt-4 font-serif text-[46px] leading-none tracking-[-0.02em]">
                30 <span className="text-[22px]" style={{ color: MUTED }}>%</span>
              </p>
              <p className="mt-2 text-[15px]" style={{ color: MUTED }}>
                + les frais d&apos;installation, sur devis
              </p>
              <p className="mt-5 text-[16px] leading-[1.6]" style={{ color: MUTED }}>
                On se rémunère sur ce que la machine vous rapporte. Installation locale ou cloud,
                chiffrée après le cadrage — jamais un forfait sorti d&apos;un catalogue.
              </p>
            </div>
          </div>

          {/* Alpha Voice sortant — au volume */}
          <div className="mt-16">
            <h3 className="font-serif text-[26px] tracking-[-0.01em]">
              Alpha Voice sortant — au volume, sans engagement
            </h3>
            <p className="mt-3 max-w-2xl text-[16px] leading-[1.6]" style={{ color: MUTED }}>
              Vous payez les appels passés, pas une licence. On commence petit, on prouve que ça
              convertit, et on monte seulement après.
            </p>
            <div className="mt-8 grid gap-px overflow-hidden rounded-xl sm:grid-cols-4" style={{ background: LINE }}>
              {OUTBOUND_TIERS.map((t) => {
                const deal = t.perThousandHT < OUTBOUND_UNIT_HT;
                return (
                  <div key={t.calls} className="p-6" style={{ background: deal ? "#FFFFFF" : CREAM }}>
                    <p className="text-[14px]" style={{ color: MUTED }}>
                      {t.calls.toLocaleString("fr-FR")} appels
                    </p>
                    <p className="mt-2 font-serif text-[30px] leading-none tracking-[-0.02em]">
                      {t.monthlyHT.toLocaleString("fr-FR")} €
                    </p>
                    <p className="mt-1 text-[13px]" style={{ color: MUTED }}>HT / mois</p>
                    {deal && (
                      <p className="mt-3 text-[13px] font-medium" style={{ color: ACCENT }}>
                        le 4ᵉ millier offert
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
            <p className="mt-6 max-w-2xl text-[16px] leading-[1.65]" style={{ color: MUTED }}>
              <strong style={{ color: INK }}>Le volume n&apos;a de valeur qu&apos;après le réglage.</strong>{" "}
              Tant que le ciblage et la conversation ne sont pas optimisés, multiplier les appels ne
              fait que brûler votre fichier plus vite. C&apos;est pour ça qu&apos;on ouvre le palier
              4 000 une fois que ça convertit — et pas avant.
            </p>
          </div>

          {/* À la carte */}
          <div className="mt-16">
            <h3 className="font-serif text-[26px] tracking-[-0.01em]">Ou seulement ce dont vous avez besoin</h3>
            <p className="mt-3 max-w-2xl text-[16px] leading-[1.6]" style={{ color: MUTED }}>
              Chaque brique se prend seule. Cochez ce qui vous parle — l&apos;addition se fait toute
              seule.
            </p>

            <div className="mt-8 grid gap-3 sm:grid-cols-2">
              {BRICKS.map((b) => {
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
                      <span className="shrink-0 text-[14px]" style={{ color: on ? ACCENT : MUTED }}>
                        {b.setupHT.toLocaleString("fr-FR")} €
                      </span>
                    </div>
                    <p className="mt-2 text-[14px] leading-[1.55]" style={{ color: MUTED }}>{b.what}</p>
                    <p className="mt-2 text-[13px]" style={{ color: MUTED }}>
                      puis {b.monthlyHT} € HT/mois
                    </p>
                  </button>
                );
              })}
            </div>

            {picked.length > 0 && (
              <div className="mt-8 rounded-xl p-6" style={{ background: "#FFFFFF", border: `1px solid ${LINE}` }}>
                <p className="font-serif text-[26px] tracking-[-0.01em]">
                  {quote.setupHT.toLocaleString("fr-FR")} € HT
                  <span className="text-[16px] font-sans" style={{ color: MUTED }}>
                    {" "}d&apos;installation, puis {quote.monthlyHT.toLocaleString("fr-FR")} € HT/mois
                  </span>
                </p>
                <p className="mt-3 text-[16px] leading-[1.6]" style={{ color: MUTED }}>{quote.recommendation}</p>
              </div>
            )}
          </div>
        </section>

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
