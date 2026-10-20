import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { NextRequest } from "next/server";
import {
  PRESETS_EMAIL, adresseValide, classerErreurSmtp, domaineDe, lireCleIA, nettoyerSecret,
  presetParId, presetPourAdresse, presetPourMx, verifierBoite,
  type DepsSmtp, type TransportSmtp,
} from "../lib/identifiants-assistes";
import { GET as detect } from "../app/api/credentials/detect/route";

/**
 * ─────────────────────────────────────────────────────────────────────
 * BRANCHER SES COMPTES SANS RIEN SAVOIR.
 *
 * Ce qu'on protège :
 *  · une bonne clé refusée parce qu'elle arrive entre guillemets ou précédée de
 *    `export CLE=` ;
 *  · une clé qu'ALPHA ne sait pas servir qui part quinze secondes chez le
 *    mauvais fournisseur avant d'échouer ;
 *  · une boîte « branchée » sur la foi d'une table, sans connexion réelle ;
 *  · un mot de passe faux qui fait marteler le serveur sur tous les ports ;
 *  · un hébergeur deviné au lieu d'être demandé.
 * ─────────────────────────────────────────────────────────────────────
 */

// ── NETTOYER ────────────────────────────────────────────────────────────

test("⚠ une clé collée avec guillemets, saut de ligne ou `export CLE=` n'est pas refusée pour ça", () => {
  const cle = "sk-ant-api03-ABCDEFGH1234";
  for (const colle of [
    cle,
    `  ${cle}  `,
    `"${cle}"`,
    `'${cle}'\n`,
    `ANTHROPIC_API_KEY=${cle}`,
    `export ANTHROPIC_API_KEY="${cle}"`,
    `# ma clé\nOPENAI=non\nexport ANTHROPIC_API_KEY=${cle}\nAUTRE=1`,
    `${cle.slice(0, 10)}\n${cle.slice(10)}`,
    `${cle}​`,
  ]) {
    assert.equal(nettoyerSecret(colle), cle, JSON.stringify(colle));
  }
});

test("une valeur vide reste vide", () => {
  assert.equal(nettoyerSecret(""), "");
  assert.equal(nettoyerSecret("   \n "), "");
  assert.equal(lireCleIA(""), null);
});

// ── L'IA ────────────────────────────────────────────────────────────────

test("la clé se reconnaît à sa forme, et se range dans le BON champ", () => {
  const a = lireCleIA("sk-ant-api03-xyz")!;
  assert.deepEqual([a.fournisseur, a.champ, a.branchable], ["anthropic", "ANTHROPIC_API_KEY", true]);
  const n = lireCleIA("nvapi-abc123")!;
  assert.deepEqual([n.fournisseur, n.champ, n.branchable], ["nvidia", "NVIDIA_API_KEY", true]);
});

test("⚠ une clé qu'ALPHA ne sait pas servir est refusée TOUT DE SUITE, avec la phrase qui dit quoi faire", () => {
  for (const [cle, nom] of [["sk-proj-abcdef", "OpenAI"], ["AIzaSyABCDEF", "Gemini"], ["gsk_abcdef", "Groq"]] as const) {
    const l = lireCleIA(cle)!;
    assert.equal(l.branchable, false, cle);
    assert.equal(l.champ, null, "jamais rangée dans un champ qui ne la comprend pas");
    assert.match(l.message, new RegExp(nom));
    assert.match(l.message, /sk-ant-.*nvapi-/s, "elle dit ce qui marche");
    assert.ok(l.aide);
  }
  const inconnue = lireCleIA("quelquechose123")!;
  assert.equal(inconnue.branchable, false);
  assert.equal(inconnue.fournisseur, "inconnu");
});

test("« sk-ant- » n'est pas pris pour OpenAI (le préfixe générique vient APRÈS)", () => {
  assert.equal(lireCleIA("sk-ant-xyz")!.fournisseur, "anthropic");
  assert.equal(lireCleIA("sk-xyz")!.fournisseur, "openai");
});

// ── LES ADRESSES ET LES HÉBERGEURS ──────────────────────────────────────

test("le domaine d'une adresse, et rien d'autre", () => {
  assert.equal(domaineDe("Moi@Exemple.FR"), "exemple.fr");
  assert.equal(domaineDe(" moi@exemple.fr "), "exemple.fr");
  for (const mauvaise of ["", "moi", "moi@", "@exemple.fr", "moi@exemple", "moi @exemple.fr", "moi@exe mple.fr"]) {
    assert.equal(domaineDe(mauvaise), null, mauvaise);
    assert.equal(adresseValide(mauvaise), false);
  }
});

test("les grands fournisseurs se reconnaissent à l'adresse seule", () => {
  assert.equal(presetPourAdresse("a@gmail.com")?.id, "gmail");
  assert.equal(presetPourAdresse("a@hotmail.fr")?.id, "outlook");
  assert.equal(presetPourAdresse("a@orange.fr")?.id, "orange");
  assert.equal(presetPourAdresse("a@icloud.com")?.id, "icloud");
  assert.equal(presetPourAdresse("a@monentreprise.fr"), null, "un domaine perso ne dit rien sans son MX");
});

test("⚠ le MX se lit en SUFFIXE de nom d'hôte, jamais en « contient »", () => {
  assert.equal(presetPourMx(["aspmx.l.google.com", "alt1.aspmx.l.google.com"])?.id, "gmail");
  assert.equal(presetPourMx(["mx0.mail.ovh.net."])?.id, "ovh");
  assert.equal(presetPourMx(["monentreprise-fr.mail.protection.outlook.com"])?.id, "microsoft365");
  assert.equal(presetPourMx(["mx00.ionos.fr"])?.id, "ionos");
  // Un hôte qui CONTIENT « ovh.net » sans en être n'est pas OVH.
  assert.equal(presetPourMx(["mx.ovh.net.evil.test"]), null);
  assert.equal(presetPourMx(["notgoogle.com"]), null);
  assert.equal(presetPourMx([]), null);
});

test("chaque hébergeur a un serveur, au moins un essai, et un type de mot de passe", () => {
  assert.ok(PRESETS_EMAIL.length >= 10);
  const ids = new Set<string>();
  for (const p of PRESETS_EMAIL) {
    assert.ok(!ids.has(p.id), `doublon ${p.id}`);
    ids.add(p.id);
    assert.match(p.host, /^[a-z0-9.-]+\.[a-z]{2,}$/, p.id);
    assert.ok(p.essais.length >= 1, p.id);
    for (const e of p.essais) assert.equal(e.secure, e.port === 465, `${p.id} : seul 465 est en TLS d'emblée`);
    assert.ok(["application", "normal", "cle-smtp"].includes(p.motDePasse), p.id);
    if (p.motDePasse === "application") assert.ok(p.aide, `${p.id} : un mot de passe d'application sans lien pour le créer`);
  }
  assert.equal(presetParId("inexistant"), null);
  assert.equal(presetParId(null), null);
});

// ── LA VÉRIFICATION ─────────────────────────────────────────────────────

interface Appel {
  host: string; port: number; secure: boolean; user: string; pass: string;
}
/** Un faux transport : on dit pour chaque port ce qu'il répond. */
function faux(reponses: Record<number, "ok" | "auth" | "ferme" | "timeout">, mx: string[] = []): DepsSmtp & { appels: Appel[] } {
  const appels: Appel[] = [];
  return {
    appels,
    creer(o): TransportSmtp {
      appels.push(o);
      return {
        async verify() {
          const r = reponses[o.port] ?? "ferme";
          if (r === "ok") return true;
          if (r === "auth") throw Object.assign(new Error("Invalid login: 535 Authentication failed"), { code: "EAUTH", responseCode: 535 });
          if (r === "timeout") throw Object.assign(new Error("Connection timeout"), { code: "ETIMEDOUT" });
          throw Object.assign(new Error("connect ECONNREFUSED"), { code: "ECONNECTION" });
        },
      };
    },
    resoudreMx: async () => mx,
  };
}

test("⚠ Gmail : adresse + mot de passe, serveur et port DÉDUITS, et la connexion est RÉELLE", async () => {
  const deps = faux({ 587: "ok" });
  const r = await verifierBoite({ adresse: "Moi@Gmail.com", motDePasse: "abcd efgh ijkl mnop" }, deps);
  assert.ok(r.ok);
  assert.equal(r.reglages.host, "smtp.gmail.com");
  assert.equal(r.reglages.port, 587);
  assert.equal(r.reglages.user, "Moi@Gmail.com");
  assert.equal(r.reglages.from, "Moi@Gmail.com", "l'adresse d'expédition est celle de la boîte");
  assert.equal(r.reglages.presetId, "gmail");
  assert.equal(deps.appels.length, 1);
  assert.equal(deps.appels[0].pass, "abcd efgh ijkl mnop", "le mot de passe est transmis tel quel au transport");
});

test("⚠ le port se REPLIE : 587 fermé → 465, et on garde celui qui a authentifié", async () => {
  const deps = faux({ 587: "ferme", 465: "ok" });
  const r = await verifierBoite({ adresse: "moi@gmail.com", motDePasse: "x" }, deps);
  assert.ok(r.ok);
  assert.equal(r.reglages.port, 465);
  assert.equal(r.reglages.secure, true);
  assert.equal(r.reglages.essais, 2);
  assert.deepEqual(deps.appels.map((a) => a.port), [587, 465]);
});

test("⚠⚠ un mot de passe REFUSÉ arrête tout : le serveur est joint, un autre port n'y change rien", async () => {
  const deps = faux({ 587: "auth", 465: "ok" });
  const r = await verifierBoite({ adresse: "moi@gmail.com", motDePasse: "mauvais" }, deps);
  assert.equal(r.ok, false);
  assert.equal(r.ok === false && r.classe, "auth");
  assert.equal(deps.appels.length, 1, "on ne martèle pas un serveur qui a déjà dit non");
  // Et le conseil dit CE QU'IL FAUT FAIRE, avec le lien pour le faire.
  if (!r.ok) {
    assert.match(r.conseil, /mot de passe d'APPLICATION/);
    assert.match(r.aide?.url ?? "", /apppasswords/);
  }
});

test("un serveur injoignable sur tous les ports se dit, ports compris", async () => {
  const r = await verifierBoite({ adresse: "moi@gmail.com", motDePasse: "x" }, faux({ 587: "timeout", 465: "ferme" }));
  assert.equal(r.ok, false);
  if (!r.ok) {
    assert.equal(r.classe, "connexion");
    assert.match(r.conseil, /smtp\.gmail\.com/);
    assert.match(r.conseil, /587 puis 465/);
  }
});

test("⚠ un domaine perso passe par son MX : OVH reconnu, serveur et ports déduits", async () => {
  const deps = faux({ 465: "ok" }, ["mx3.mail.ovh.net."]);
  const r = await verifierBoite({ adresse: "contact@monentreprise.fr", motDePasse: "x" }, deps);
  assert.ok(r.ok);
  assert.equal(r.reglages.host, "ssl0.ovh.net");
  assert.equal(r.reglages.presetId, "ovh");
  assert.equal(deps.appels[0].port, 465, "OVH essaie 465 d'abord");
});

test("⚠⚠ hébergeur INCONNU : on le dit et on DEMANDE le serveur — on ne devine pas « smtp.<domaine> »", async () => {
  const deps = faux({ 587: "ok" }, ["mail.inconnu.test"]);
  const r = await verifierBoite({ adresse: "contact@monentreprise.fr", motDePasse: "x" }, deps);
  assert.equal(r.ok, false);
  if (!r.ok) {
    assert.equal(r.classe, "preset-inconnu");
    assert.match(r.conseil, /Renseigne le serveur/);
  }
  assert.equal(deps.appels.length, 0, "aucune connexion tentée sur un serveur inventé");
});

test("un DNS muet n'est pas une erreur de l'inscrit : on demande le serveur", async () => {
  const deps: DepsSmtp = { creer: () => ({ verify: async () => true }), resoudreMx: async () => { throw new Error("SERVFAIL"); } };
  const r = await verifierBoite({ adresse: "a@perso.fr", motDePasse: "x" }, deps);
  assert.equal(r.ok === false && r.classe, "preset-inconnu");
});

test("un serveur donné à la main est respecté, port compris ; sans port, les deux usuels", async () => {
  const d1 = faux({ 2525: "ok" });
  const r1 = await verifierBoite({ adresse: "a@perso.fr", motDePasse: "x", host: "smtp.exemple.fr", port: 2525 }, d1);
  assert.ok(r1.ok);
  assert.equal(r1.reglages.port, 2525);
  assert.equal(r1.reglages.presetId, null);
  const d2 = faux({ 465: "ok" });
  const r2 = await verifierBoite({ adresse: "a@perso.fr", motDePasse: "x", host: "smtp.exemple.fr" }, d2);
  assert.ok(r2.ok);
  assert.deepEqual(d2.appels.map((a) => a.port), [587, 465]);
});

test("l'identifiant peut différer de l'adresse (clé SMTP dédiée), l'adresse d'expédition reste la boîte", async () => {
  const deps = faux({ 587: "ok" });
  const r = await verifierBoite({ adresse: "contact@monentreprise.fr", identifiant: "login-brevo", motDePasse: "cle", host: "smtp-relay.brevo.com" }, deps);
  assert.ok(r.ok);
  assert.equal(r.reglages.user, "login-brevo");
  assert.equal(r.reglages.from, "contact@monentreprise.fr");
});

test("une adresse invalide ne déclenche AUCUNE connexion", async () => {
  const deps = faux({ 587: "ok" });
  const r = await verifierBoite({ adresse: "pas-une-adresse", motDePasse: "x" }, deps);
  assert.equal(r.ok === false && r.classe, "adresse");
  assert.equal(deps.appels.length, 0);
});

test("la classe d'une erreur : refus d'authentification ≠ échec de connexion", () => {
  assert.equal(classerErreurSmtp(Object.assign(new Error("x"), { code: "EAUTH" })), "auth");
  assert.equal(classerErreurSmtp(Object.assign(new Error("x"), { responseCode: 535 })), "auth");
  assert.equal(classerErreurSmtp(new Error("Invalid login: Username and Password not accepted")), "auth");
  assert.equal(classerErreurSmtp(new Error("Application-specific password required")), "auth");
  assert.equal(classerErreurSmtp(Object.assign(new Error("timeout"), { code: "ETIMEDOUT" })), "connexion");
  assert.equal(classerErreurSmtp(new Error("getaddrinfo ENOTFOUND smtp.nulle-part.test")), "connexion");
  assert.equal(classerErreurSmtp(null), "connexion");
});

// ── LE BRANCHEMENT ──────────────────────────────────────────────────────

const sansCommentaires = (src: string) => src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
const lire = (f: string) => sansCommentaires(readFileSync(join(process.cwd(), f), "utf8"));

test("⚠⚠ la route enregistre ce qui a été PROUVÉ — l'hôte et le port qui ont authentifié", () => {
  const route = lire("app/api/credentials/route.ts");
  assert.match(route, /verifierBoite\s*\(/);
  assert.match(route, /valeurs\.SMTP_HOST\s*=\s*verdict\.reglages\.host/);
  assert.match(route, /valeurs\.SMTP_PORT\s*=\s*String\(verdict\.reglages\.port\)/);
  assert.match(route, /lireCleIA\s*\(/);
  assert.match(route, /nettoyerSecret\s*\(/);
  // Et plus de vérification maison qui ferait foi à la place.
  assert.doesNotMatch(route, /\.verify\(\)/, "la vérification SMTP vit dans verifierBoite, une seule fois");
});

test("⚠ les panneaux utilisent la détection — un seul champ de clé, une adresse + un mot de passe", () => {
  const ecran = lire("components/settings/cle-ia.tsx");
  assert.match(ecran, /lireCleIA\s*\(/);
  assert.match(ecran, /presetPourAdresse\s*\(/);
  assert.match(ecran, /\/api\/credentials\/detect/);
  assert.doesNotMatch(ecran, /NVIDIA_API_KEY:\s*nvidia/, "plus de second champ de clé");
  assert.match(ecran, /onPaste/, "coller une clé reconnue la vérifie sans second clic");
  // La permission de coller n'est pas un détournement : le secret ne revient jamais.
  assert.doesNotMatch(ecran, /secret_chiffre|SMTP_PASS\s*[:=]\s*etat/);
});

test("⚠ la détection d'hébergeur exige une session — sinon c'est un résolveur DNS ouvert", async () => {
  const r = await detect(new NextRequest("https://alpha.exemple.test/api/credentials/detect?adresse=a@perso.fr"));
  assert.equal(r.status, 401);
});

test("le garde-fou du proxy : la route de détection ne rend jamais les hôtes MX bruts", () => {
  const route = lire("app/api/credentials/detect/route.ts");
  assert.doesNotMatch(route, /exchange\s*[,}]\s*\}/, "ne sort pas la liste des MX");
  assert.match(route, /presetId/);
});
