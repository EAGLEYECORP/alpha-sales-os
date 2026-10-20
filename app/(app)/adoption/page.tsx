"use client";

import { useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import type { Adoption } from "@/lib/adoption";
import { PageHeader } from "@/components/ui/page-header";
import { TableauAdoption } from "@/components/adoption/tableau-adoption";

/**
 * ─────────────────────────────────────────────────────────────────────
 * ADOPTION — le tableau de bord des PROPRIÉTAIRES d'ALPHA SALES OS.
 *
 * Maître seul (`"/adoption": []`), masqué et non grisé chez tout autre compte,
 * et absent des installations client : c'est NOTRE tableau d'acquisition, il
 * ne se livre pas. Il a quitté `/ceo` — console qu'on livre — pour cette
 * raison.
 *
 * ⚠ Il compte des COMPTES, jamais ce que les gens font dans l'app : le serveur
 * ne voit rien de leurs fiches, et c'est la promesse (`lib/adoption.ts`).
 * ─────────────────────────────────────────────────────────────────────
 */
export default function AdoptionPage() {
  const [adoption, setAdoption] = useState<Adoption | null>(null);
  const [chargement, setChargement] = useState(true);
  const [lueA, setLueA] = useState<Date>(() => new Date());

  const lire = () => {
    setChargement(true);
    fetch("/api/adoption")
      .then((r) => (r.ok ? r.json() : null))
      // Un échec rend `null` — « je n'ai pas regardé » —, jamais un objet vide
      // qui se lirait « personne ».
      .then((j: Adoption | null) => setAdoption(j))
      .catch(() => setAdoption(null))
      .finally(() => {
        setLueA(new Date());
        setChargement(false);
      });
  };

  useEffect(lire, []);

  return (
    <div className="page">
      <PageHeader
        eyebrow="Propriétaires d'ALPHA SALES OS"
        title="Adoption"
        subtitle="Combien de personnes se servent d'ALPHA, et si le mur des emails de confirmation approche. Des comptes, jamais ce qu'ils font : le serveur ne voit pas leurs fiches."
        actions={
          <button className="btn-ghost" onClick={lire} disabled={chargement}>
            <RefreshCw size={14} className={chargement ? "animate-spin" : undefined} /> Relire
          </button>
        }
      />
      <TableauAdoption adoption={adoption} maintenant={lueA} />
    </div>
  );
}
