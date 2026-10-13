"use client";

import Link from "next/link";
import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { ArrowLeft, ArrowRight, KeyRound, Lock, Sparkles, Wallet } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { useAlpha } from "@/lib/store";
import { useDroits } from "@/lib/use-droits";
import {
  ALTERNATIVE_GRATUITE,
  briquesPayantes,
  clesQuiOuvrent,
  libelleBrique,
  offrePourBrique,
  POURQUOI_PAYANT,
} from "@/lib/verrous";
import { SOCLE_GRATUIT } from "@/lib/public-catalogue";
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
 * minutes, l'agent brûle NOS jetons. (« Aucun chemin d'identifiants par
 * locataire » était écrit ici : faux depuis le BYOK, et l'écran le servait
 * au client — `clesQuiOuvrent` le dit maintenant brique par brique.) Dit
 * comme ça, le gratuit devient crédible :
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
  const alternative = vise ? ALTERNATIVE_GRATUITE[vise.brique] : undefined;
  const cles = vise ? clesQuiOuvrent(vise.brique) : [];
  /**
   * ⚠ Le socle s'affiche par ses LIBELLÉS et dans l'ordre de
   * `BRIQUES_GRATUITES`. La page disait « Quatre briques sont gratuites » en
   * dur — il y en a cinq depuis le 12/09 — et listait les identifiants
   * (`crm · closer · alpha-live`) : un chiffre faux et une liste illisible,
   * sur la page qui sert à rendre le gratuit crédible.
   */
  const socle = BRIQUES_GRATUITES.map((id) => SOCLE_GRATUIT.find((s) => s.id === id) ?? { id, label: id, what: "" });

  return (
    <div className="page">
      <PageHeader
        eyebrow={vise ? "Pas dans ton offre" : "Ton offre"}
        title={vise ? libelleBrique(vise.brique) : "Ce qui est gratuit, ce qui se paie"}
        subtitle={
          vise
            ? "Pourquoi c'est payant, ce que tu peux faire à la place sans payer, et ce que ça coûte de l'ouvrir."
            : "Tout ce qui tourne chez toi est gratuit, sans limite de durée. Ce qui se paie dépense chez nous — voici quoi, et pourquoi."
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
            <Lock size={15} className="text-bronze-400" /> Pourquoi c&apos;est payant
          </p>
          <p className="mt-2 text-[13px] leading-relaxed text-paper-dim">{vise.pourquoi}</p>
          <p className="mt-2 text-[12px] leading-relaxed text-paper-faint">
            Ce n&apos;est pas une fonctionnalité qu&apos;on retient : c&apos;est une dépense qui tombe chez nous à
            chaque usage. Tout ce qui ne nous coûte rien est gratuit, sans limite de durée.
          </p>
        </section>
      )}

      {/*
        ⚠⚠ L'ISSUE AVANT LE PRIX. Un refus qui enchaîne sur « voici l'offre »
        se lit comme une rançon ; un refus qui enchaîne sur « voici comment
        faire sans payer » se lit comme une explication. Et c'est vrai : le
        travail existe, gratuit, fait à la main — ce qui se paie, c'est que la
        machine le fasse.
      */}
      {vise && (alternative || cles.length > 0) && (
        <section className="card p-5">
          <p className="flex items-center gap-2 text-sm font-medium text-paper">
            <Sparkles size={15} className="text-signal-green" /> Sans payer, tout de suite
          </p>
          {alternative && (
            <div className="mt-2">
              <p className="text-[13px] leading-relaxed text-paper-dim">{alternative.texte}</p>
              <Link href={alternative.href} className="btn-ghost mt-2.5 inline-flex">
                {alternative.lien} <ArrowRight size={14} />
              </Link>
            </div>
          )}
          {cles.map((c) => (
            <div key={c.capacite} className="panel mt-3 p-3">
              <p className="flex items-center gap-2 text-[12.5px] font-medium text-paper">
                <KeyRound size={13} className="text-bronze-400" /> Ou branche {c.libelle}
              </p>
              <p className="mt-1 text-[12px] leading-relaxed text-paper-faint">
                Tu paies ton fournisseur directement, pas nous — et la brique s&apos;ouvre pour toi, gratuitement de
                notre côté.
              </p>
              <Link href={c.href} className="btn-ghost mt-2 inline-flex">
                Brancher {c.libelle} <ArrowRight size={14} />
              </Link>
            </div>
          ))}
        </section>
      )}

      {vise && offre && (
        <section className="card p-5">
          <p className="text-sm font-medium text-paper">La faire tourner par Alpha</p>
          <div className="panel mt-2 p-3">
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
        </section>
      )}

      <section className="card p-5">
        <p className="text-sm font-medium text-paper">Gratuit, sans limite de durée</p>
        <p className="mt-1 text-[12px] leading-relaxed text-paper-faint">
          Tes données, ton organisation. Ça ne nous coûte rien à servir — c&apos;est pour ça que c&apos;est gratuit
          pour de vrai, et pas quatorze jours.
        </p>
        <ul className="mt-3 space-y-2">
          {socle.map((b) => (
            <li key={b.id} className="panel p-3">
              <p className="text-[12.5px] font-medium text-paper">{b.label}</p>
              {b.what && <p className="mt-0.5 text-[11.5px] leading-relaxed text-paper-faint">{b.what}</p>}
            </li>
          ))}
        </ul>
      </section>

      <section className="card p-5">
        <p className="text-sm font-medium text-paper">Ce qui se paie, et pourquoi</p>
        <ul className="mt-3 space-y-3">
          {payantes.map((b) => {
            const o = offrePourBrique(b.brique);
            const possede = droits.bricks.includes(b.brique) || droits.maitre || droits.solo;
            const parCle = clesQuiOuvrent(b.brique);
            return (
              <li key={b.brique} className="panel p-3">
                <p className="flex flex-wrap items-center gap-2 text-[12px] font-medium text-paper">
                  {libelleBrique(b.brique)}
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
                {!possede && parCle.length > 0 && (
                  <p className="mt-1 text-[11.5px] text-signal-green">
                    Gratuit avec {parCle.map((c) => c.libelle).join(" ou ")}.
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
