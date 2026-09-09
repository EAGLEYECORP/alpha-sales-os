"use client";

import Link from "next/link";
import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { ArrowLeft, Lock, Wallet } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { useAlpha } from "@/lib/store";
import { useDroits } from "@/lib/use-droits";
import { briquesPayantes, offrePourBrique, POURQUOI_PAYANT } from "@/lib/verrous";
import { signalAbonnement } from "@/lib/peut-se-payer";
import { BRIQUES_GRATUITES } from "@/lib/entitlements";

/**
 * ─────────────────────────────────────────────────────────────────────
 * « POURQUOI JE NE PEUX PAS ENTRER ICI ? » — la réponse, en une page.
 *
 * ⚠ CETTE PAGE EXISTE PARCE QUE LE GRIS NE SUFFIT PAS. Griser une entrée
 * de menu dit « il te manque quelque chose » et s'arrête là. Sans cette
 * page, on aurait remplacé une porte invisible par une porte muette — un
 * progrès de dix pour cent sur un défaut qui en coûte cent.
 *
 * ⚠⚠ ELLE DIT LA VRAIE RAISON, PAS UN ARGUMENTAIRE. La ligne
 * gratuit/payant n'est pas un arbitrage commercial : elle est imposée par un
 * fait technique. Envoyer part de NOTRE serveur mail, appeler consomme NOS
 * minutes, l'agent brûle NOS jetons — il n'existe aucun chemin
 * d'identifiants par locataire. Dit comme ça, le gratuit devient crédible :
 * il est illimité dans le temps précisément parce qu'il ne nous coûte rien.
 * Un « passez au premium » sans motif se lit, lui, comme une rançon sur une
 * fonctionnalité retenue exprès.
 * ─────────────────────────────────────────────────────────────────────
 */
export default function OffreBriquePage() {
  return (
    <Suspense fallback={null}>
      <Contenu />
    </Suspense>
  );
}

function Contenu() {
  const params = useSearchParams();
  const brique = params.get("b") ?? "";
  const de = params.get("de") ?? "";
  const droits = useDroits();
  const prospects = useAlpha((s) => s.prospects);

  const payantes = briquesPayantes();
  const vise = payantes.find((p) => p.brique === brique) ?? null;
  const offre = brique ? offrePourBrique(brique) : null;
  const signal = signalAbonnement(prospects, droits.bricks, brique || "alpha-voice");

  return (
    <div className="page">
      <PageHeader
        eyebrow="Ton offre"
        title={vise ? `« ${brique} » n'est pas incluse` : "Ce que ton offre n'ouvre pas"}
        subtitle={
          vise
            ? "Voici pourquoi, et ce que ça coûte de l'ouvrir. Pas de mystère : la raison est technique, pas commerciale."
            : "Quatre briques sont gratuites sans limite de durée. Les autres consomment des ressources facturées à l'usage — voici lesquelles et pourquoi."
        }
        actions={
          de ? (
            <Link href="/" className="btn-ghost">
              <ArrowLeft size={14} /> Retour
            </Link>
          ) : undefined
        }
      />

      {/*
        ⚠ LE SIGNAL « TU PEUX TE LE PAYER » EST EN HAUT, ET IL NE S'AFFICHE
        QUE S'IL EST VRAI. Il vient de `signalAbonnement`, qui rend
        `proposer: false` tant qu'aucune fiche SIGNÉE ne porte de montant.
        Zéro donnée, zéro chiffre : afficher « 0 € signé » se lirait comme un
        constat d'échec alors que c'est un angle mort.
      */}
      {signal.proposer && (
        <section className="card border-signal-green/40 p-4">
          <p className="flex items-start gap-2 text-sm font-medium text-paper">
            <Wallet size={16} className="mt-0.5 shrink-0 text-signal-green" />
            Tu peux te le payer maintenant.
          </p>
          <p className="mt-1.5 text-[13px] leading-relaxed text-paper-dim">{signal.message}</p>
          {/*
            ⚠ « D'après tes fiches » est déjà dans le message, et cette ligne
            le redit autrement : le montant vient de ce que l'opérateur a TAPÉ.
            Nous n'avons vérifié aucun encaissement. Écrire « tu gagnes X » à
            quelqu'un dont deux clients n'ont pas payé, c'est perdre toute
            crédibilité sur la seule phrase où on lui demande de l'argent.
          */}
          <p className="mt-1 text-[11px] text-paper-faint">
            Chiffre calculé sur tes propres fiches, pas sur des encaissements vérifiés — c&apos;est toi qui sais.
          </p>
          {signal.offreId && (
            <Link href={`/souscrire?offre=${signal.offreId}`} className="btn-bronze mt-3 inline-flex">
              Voir l&apos;offre
            </Link>
          )}
        </section>
      )}

      {vise && (
        <section className="card p-5">
          <p className="flex items-center gap-2 text-sm font-medium text-paper">
            <Lock size={15} className="text-bronze-400" /> Pourquoi « {brique} » est payante
          </p>
          <p className="mt-2 text-[13px] leading-relaxed text-paper-dim">{vise.pourquoi}</p>
          <p className="mt-3 text-[12px] leading-relaxed text-paper-faint">
            Ce n&apos;est pas une fonctionnalité qu&apos;on retient : il n&apos;existe pas, aujourd&apos;hui, de
            moyen de faire passer ces appels par TES identifiants plutôt que les nôtres. Le jour où ce sera le cas,
            la ligne se rediscutera.
          </p>
          {offre && (
            <div className="panel mt-3 p-3">
              <p className="text-[12px] font-medium text-paper">
                {offre.nom}
                {offre.prixHT !== null && (
                  <span className="ml-2 font-mono text-bronze-400">
                    {offre.prixHT.toLocaleString("fr-FR")} € HT{offre.cadence === "mensuel" ? "/mois" : ""}
                  </span>
                )}
              </p>
              <p className="mt-1 text-[11.5px] text-paper-faint">{offre.sousTitre}</p>
              <Link href={`/souscrire?offre=${offre.id}`} className="btn-bronze mt-2.5 inline-flex">
                Ouvrir cette brique
              </Link>
            </div>
          )}
        </section>
      )}

      <section className="card p-5">
        <p className="text-sm font-medium text-paper">Ce qui est gratuit, sans limite de durée</p>
        <p className="mt-1.5 text-[13px] leading-relaxed text-paper-dim">
          <strong className="text-paper">{BRIQUES_GRATUITES.join(" · ")}</strong> — tes données, ton organisation.
          Elles ne nous coûtent rien à servir : c&apos;est pour ça qu&apos;elles sont gratuites pour de vrai, et
          pas quatorze jours.
        </p>
      </section>

      <section className="card p-5">
        <p className="text-sm font-medium text-paper">Ce qui se paie, et pourquoi</p>
        <ul className="mt-3 space-y-3">
          {payantes.map((b) => {
            const o = offrePourBrique(b.brique);
            const possede = droits.bricks.includes(b.brique) || droits.maitre || droits.solo;
            return (
              <li key={b.brique} className="panel p-3">
                <p className="flex flex-wrap items-center gap-2 text-[12px] font-medium text-paper">
                  {b.brique}
                  {possede ? (
                    <span className="font-mono text-[10px] uppercase tracking-wider text-signal-green">incluse</span>
                  ) : (
                    <Lock size={11} className="text-paper-faint" />
                  )}
                  {o && o.prixHT !== null && (
                    <span className="font-mono text-[11px] text-bronze-400">
                      dès {o.prixHT.toLocaleString("fr-FR")} € HT{o.cadence === "mensuel" ? "/mois" : ""}
                    </span>
                  )}
                </p>
                <p className="mt-1 text-[11.5px] leading-relaxed text-paper-faint">{POURQUOI_PAYANT[b.brique]}</p>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
