#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────
// PREUVE d'isolation multi-locataire (RLS) — ALPHA SALES OS®
//
// Prouve, contre TON vrai projet Supabase, qu'un commercial ne peut jamais
// lire / modifier / supprimer les données d'un autre. C'est LA condition
// avant de facturer un client (docs/SECURITE.md, docs/PREUVE-RLS.md).
//
// Ce script n'utilise QUE la clé anon publique + deux comptes de test — aucun
// secret n'est écrit dans le dépôt. Tout vient des variables d'environnement.
//
// Prérequis : avoir appliqué supabase/schema.sql et créé DEUX comptes de test
// (emails confirmés). Puis :
//
//   export SB_URL="https://xxxx.supabase.co"
//   export SB_ANON_KEY="eyJ…"          # clé anon public (Project Settings → API)
//   export A_EMAIL="testA@exemple.fr"  export A_PASS="…"
//   export B_EMAIL="testB@exemple.fr"  export B_PASS="…"
//   node supabase/verify-isolation.mjs
//
// Sortie : une liste de contrôles VERT/ROUGE et un code de sortie 0 (tout
// isolé) ou 1 (fuite détectée — NE FACTURE PAS).
// ─────────────────────────────────────────────────────────────────────

import { createClient } from "@supabase/supabase-js";

const {
  SB_URL,
  SB_ANON_KEY,
  A_EMAIL,
  A_PASS,
  B_EMAIL,
  B_PASS,
} = process.env;

const missing = Object.entries({ SB_URL, SB_ANON_KEY, A_EMAIL, A_PASS, B_EMAIL, B_PASS })
  .filter(([, v]) => !v)
  .map(([k]) => k);
if (missing.length) {
  console.error(`✗ Variables manquantes : ${missing.join(", ")}`);
  console.error("  Voir l'en-tête de ce fichier pour l'export à faire.");
  process.exit(2);
}

const GREEN = "\x1b[32m";
const RED = "\x1b[31m";
const DIM = "\x1b[2m";
const RESET = "\x1b[0m";

let failures = 0;
function check(ok, label, detail = "") {
  const mark = ok ? `${GREEN}✓ VERT${RESET}` : `${RED}✗ ROUGE${RESET}`;
  console.log(`  ${mark}  ${label}${detail ? `  ${DIM}${detail}${RESET}` : ""}`);
  if (!ok) failures += 1;
}

// Un client par compte : chacun ne persiste rien sur disque (test isolé).
function clientFor() {
  return createClient(SB_URL, SB_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function signIn(label, email, password) {
  const sb = clientFor();
  const { data, error } = await sb.auth.signInWithPassword({ email, password });
  if (error || !data.user) {
    console.error(`✗ Connexion ${label} (${email}) impossible : ${error?.message ?? "aucun user"}`);
    console.error("  Vérifie l'email/mot de passe et que le compte est confirmé.");
    process.exit(2);
  }
  return { sb, uid: data.user.id };
}

const TABLES = ["prospects", "campaigns", "meetings", "activities"];

async function main() {
  console.log(`\nPREUVE RLS — projet ${SB_URL}\n`);

  const A = await signIn("A", A_EMAIL, A_PASS);
  const B = await signIn("B", B_EMAIL, B_PASS);
  check(A.uid !== B.uid, "Deux comptes distincts", `A=${A.uid.slice(0, 8)}… B=${B.uid.slice(0, 8)}…`);

  const rowId = `rls-proof-${Date.now()}`;
  const secret = `secret-de-A-${Math.random().toString(36).slice(2)}`;

  // 1. A crée une fiche bien à lui.
  const ins = await A.sb.from("prospects").insert({
    id: rowId,
    user_id: A.uid,
    data: { company: secret, stage: "prospect", sector: "autre" },
  }).select();
  check(!ins.error && ins.data?.length === 1, "A peut créer SA fiche", ins.error?.message ?? "");

  // 2. A se relit lui-même (contrôle positif : l'isolation ne casse pas l'app).
  const selfRead = await A.sb.from("prospects").select("data").eq("id", rowId);
  check(
    !selfRead.error && selfRead.data?.[0]?.data?.company === secret,
    "A relit bien SA fiche",
    selfRead.error?.message ?? ""
  );

  // 3. B NE VOIT PAS la fiche de A (SELECT).
  const bRead = await B.sb.from("prospects").select("*").eq("id", rowId);
  check(!bRead.error && (bRead.data?.length ?? 0) === 0, "B ne PEUT PAS lire la fiche de A", `${bRead.data?.length ?? "?"} ligne(s) vue(s)`);

  // 4. B ne voit rien de A même en listant tout.
  const bList = await B.sb.from("prospects").select("id");
  const leaked = (bList.data ?? []).some((r) => r.id === rowId);
  check(!leaked, "La fiche de A n'apparaît pas dans la liste de B");

  // 5. B NE PEUT PAS modifier la fiche de A (UPDATE → 0 ligne touchée).
  const bUpd = await B.sb.from("prospects").update({ data: { company: "pirate", stage: "signe", sector: "autre" } }).eq("id", rowId).select();
  check(!bUpd.error && (bUpd.data?.length ?? 0) === 0, "B ne PEUT PAS modifier la fiche de A", `${bUpd.data?.length ?? "?"} ligne(s) modifiée(s)`);

  // 6. B NE PEUT PAS supprimer la fiche de A (DELETE → 0 ligne).
  const bDel = await B.sb.from("prospects").delete().eq("id", rowId).select();
  check(!bDel.error && (bDel.data?.length ?? 0) === 0, "B ne PEUT PAS supprimer la fiche de A", `${bDel.data?.length ?? "?"} ligne(s) supprimée(s)`);

  // 7. B NE PEUT PAS injecter une ligne au nom de A (with check sur INSERT).
  const bInject = await B.sb.from("prospects").insert({
    id: `${rowId}-inject`,
    user_id: A.uid, // usurpation
    data: { company: "usurpation", stage: "prospect", sector: "autre" },
  }).select();
  check(!!bInject.error, "B ne PEUT PAS créer une fiche au nom de A", bInject.error ? "refus RLS ✓" : "INSERT accepté !");
  if (!bInject.error) {
    // Nettoyage si la faille existe.
    await A.sb.from("prospects").delete().eq("id", `${rowId}-inject`);
  }

  // 8. Après les attaques de B, la fiche de A est INTACTE.
  const finalRead = await A.sb.from("prospects").select("data").eq("id", rowId);
  check(
    finalRead.data?.[0]?.data?.company === secret,
    "La fiche de A est intacte après les tentatives de B",
    finalRead.data?.[0]?.data?.company === secret ? "" : "ALTÉRÉE"
  );

  // 9. Contrôle transverse rapide sur les autres tables : B ne lit rien de A.
  for (const t of TABLES.filter((t) => t !== "prospects")) {
    const probeId = `rls-proof-${t}-${Date.now()}`;
    await A.sb.from(t).insert({ id: probeId, user_id: A.uid, data: { k: secret } });
    const bt = await B.sb.from(t).select("id").eq("id", probeId);
    check(!bt.error && (bt.data?.length ?? 0) === 0, `Table ${t} : B ne lit pas la donnée de A`);
    await A.sb.from(t).delete().eq("id", probeId);
  }

  // Nettoyage.
  await A.sb.from("prospects").delete().eq("id", rowId);

  console.log("");
  if (failures === 0) {
    console.log(`${GREEN}✓ ISOLATION PROUVÉE — aucun accès croisé. Tu peux facturer en confiance côté RLS.${RESET}`);
    console.log(`${DIM}  Rappel : les tables service-role (tracking/inbound/crm) restent à scoper avant multi-locataire — voir docs/PREUVE-RLS.md.${RESET}\n`);
    process.exit(0);
  } else {
    console.log(`${RED}✗ ${failures} FUITE(S) DÉTECTÉE(S) — NE FACTURE PAS. Corrige la RLS et relance.${RESET}\n`);
    process.exit(1);
  }
}

main().catch((e) => {
  console.error("Erreur inattendue :", e);
  process.exit(2);
});
