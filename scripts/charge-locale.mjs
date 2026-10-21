// ─────────────────────────────────────────────────────────────────────
// CHARGE LOCALE — N utilisateurs virtuels sur `next start`, sans dépendance.
//
//   npm run build && PORT=3111 node_modules/.bin/next start -p 3111 &
//   node scripts/charge-locale.mjs <vus> <secondes> <pause_ms> </route,/route,…>
//
// Chaque utilisateur virtuel a SA propre IP (`x-forwarded-for`) : le limiteur de
// débit de `middleware.ts` les voit comme N inconnus, pas comme un seul client.
//
// ⚠ Ce que ça mesure : UN processus Node (le serveur de production d'ici) sous
// N connexions simultanées, sur les routes publiques. Ce que ça NE mesure PAS :
// Supabase (hôtes bloqués d'ici), les ~17 appels REST de droits par page, Vercel
// (serverless : autre mécanique), le SMTP, l'inscription réelle. Le générateur et
// le serveur se partagent les mêmes cœurs : les chiffres de saturation sont un
// PLANCHER, pas une capacité.
// ─────────────────────────────────────────────────────────────────────
import http from "node:http";

const [vus, secondes, pauseMs, listeRoutes] = [
  Number(process.argv[2] ?? 1000),
  Number(process.argv[3] ?? 20),
  Number(process.argv[4] ?? 3000),
  (process.argv[5] ?? "/vitrine,/souscrire,/aujourdhui,/api/gate").split(","),
];

const agent = new http.Agent({ keepAlive: true, maxSockets: vus });
const lat = [];
const parRoute = new Map();
const statuts = new Map();
const erreurs = new Map();
let fini = false;

function requete(route, ip) {
  return new Promise((resolve) => {
    const t0 = performance.now();
    const req = http.request(
      { host: "127.0.0.1", port: Number(process.env.PORT ?? 3111), path: route, method: "GET", agent, headers: { "x-forwarded-for": ip }, timeout: 30000 },
      (res) => {
        res.resume();
        res.on("end", () => {
          const d = performance.now() - t0; lat.push(d);
          (parRoute.get(route) ?? parRoute.set(route, []).get(route)).push(d);
          statuts.set(res.statusCode, (statuts.get(res.statusCode) ?? 0) + 1);
          resolve();
        });
      }
    );
    req.on("timeout", () => req.destroy(new Error("timeout 30 s")));
    req.on("error", (e) => {
      const k = e.code || e.message;
      erreurs.set(k, (erreurs.get(k) ?? 0) + 1);
      resolve();
    });
    req.end();
  });
}

async function utilisateur(i) {
  const ip = `10.${(i >> 16) & 255}.${(i >> 8) & 255}.${i & 255}`;
  // départs étalés sur 2 s : 1 000 inconnus n'arrivent pas dans la même milliseconde
  await new Promise((r) => setTimeout(r, Math.random() * 2000));
  let k = i;
  while (!fini) {
    await requete(listeRoutes[k++ % listeRoutes.length], ip);
    if (pauseMs > 0) await new Promise((r) => setTimeout(r, pauseMs * (0.5 + Math.random())));
  }
}

const debut = performance.now();
const tous = Array.from({ length: vus }, (_, i) => utilisateur(i));
setTimeout(() => { fini = true; }, secondes * 1000);
await Promise.all(tous);
const duree = (performance.now() - debut) / 1000;

lat.sort((a, b) => a - b);
const p = (q) => (lat.length ? lat[Math.min(lat.length - 1, Math.floor(q * lat.length))].toFixed(0) : "—");
console.log(JSON.stringify({
  vus, secondes_visees: secondes, pause_ms: pauseMs, routes: listeRoutes,
  requetes: lat.length, duree_s: Number(duree.toFixed(1)), debit_req_s: Number((lat.length / duree).toFixed(0)),
  latence_ms: { p50: p(0.5), p95: p(0.95), p99: p(0.99), max: lat.length ? lat[lat.length - 1].toFixed(0) : "—" },
  statuts: Object.fromEntries(statuts), erreurs: Object.fromEntries(erreurs),
}, null, 2));
const q = (a, f) => { a.sort((x, y) => x - y); return a[Math.min(a.length - 1, Math.floor(f * a.length))].toFixed(0); };
console.log("par route (ms) :", JSON.stringify(Object.fromEntries([...parRoute].map(([r, a]) => [r, { n: a.length, p50: q(a, .5), p95: q(a, .95), max: q(a, 1) }]))));
agent.destroy();
