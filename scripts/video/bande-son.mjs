/**
 * Bande-son SYNTHÉTISÉE pour nos vidéos — aucun échantillon tiers, aucune licence à suivre.
 *
 *   node scripts/video/bande-son.mjs partition.json sortie.wav
 *
 * Une partition est un JSON :
 *   { "duree": 17.5,
 *     "accords":    [[0, [65.41, 130.81, 196, 246.94, 329.63]], [3.1, [...]]],
 *     "evenements": [{ "t": 2.95, "type": "souffle" }, { "t": 4.1, "type": "tic", "hz": 523.25, "pan": -0.5 }] }
 *
 * Types d'événement : souffle (transition) · appui (une carte se pose) · air
 * (une bouffée qui monte) · tic (un élément qui arrive, avec sa note) · tinte
 * (une note seule) · declic (mécanique, sans note) · impact (le logo) · pop
 * (l'appel à l'action) · brillance (quatre notes qui montent).
 *
 * ⚠ DÉTERMINISTE, et un test l'exige (`tests/bande-son.test.ts`) : le bruit
 * vient d'un générateur à graine, jamais de `Math.random`. La règle « seek-safe »
 * d'HyperFrames vaut pour le son : deux rendus du même montage doivent sortir
 * le même fichier, sinon on ne peut plus comparer deux versions.
 *
 * ⚠ LE MIXAGE EST LA RÈGLE, PAS UN RÉGLAGE (reprise de /brag) : les effets sont
 * dans la tonalité de la nappe et dans la même réverbération qu'elle — fondus
 * dedans, pas posés dessus. Les gains par défaut ci-dessous ont été réglés à
 * l'oreille sur cinq vidéos ; les monter fait « jeu vidéo ».
 */
import { readFileSync, writeFileSync } from "node:fs";

const [, , cheminPartition, sortie = "bande-son.wav"] = process.argv;
if (!cheminPartition) {
  console.error("usage : node scripts/video/bande-son.mjs partition.json sortie.wav");
  process.exit(2);
}
const P = JSON.parse(readFileSync(cheminPartition, "utf8"));
const SR = 48000, DUREE = Number(P.duree), N = Math.round(SR * DUREE);
if (!(DUREE > 0) || !Array.isArray(P.accords) || P.accords.length === 0) {
  console.error("partition invalide : il faut une durée > 0 et au moins un accord");
  process.exit(2);
}
const evenements = Array.isArray(P.evenements) ? P.evenements : [];
// La nappe se creuse sous l'impact, pour lui laisser la place.
const tImpact = evenements.find((e) => e.type === "impact")?.t ?? -10;

const L = new Float32Array(N), R = new Float32Array(N);       // sec
const RL = new Float32Array(N), RR = new Float32Array(N);     // envoi réverbération
let graine = 12345;
const rnd = () => ((graine = (graine * 16807) % 2147483647) / 2147483647) * 2 - 1;
const at = (t) => Math.max(0, Math.min(N - 1, Math.round(t * SR)));
const add = (i, v, pan = 0, rev = 0.25) => {
  if (i < 0 || i >= N) return;
  const g = Math.SQRT1_2, l = v * g * (1 - pan), r = v * g * (1 + pan);
  L[i] += l; R[i] += r; RL[i] += l * rev; RR[i] += r * rev;
};
const cl = (x) => Math.max(0, Math.min(1, x));

// ── Nappe : dents de scie à bande limitée (8 harmoniques), deux voix désaccordées par note, filtrées.
const XF = 0.7;
for (let a = 0; a < P.accords.length; a++) {
  const [debut, notes] = P.accords[a];
  const fin = a + 1 < P.accords.length ? P.accords[a + 1][0] : DUREE + 1;
  const i0 = at(debut - XF), i1 = at(fin + XF);
  notes.forEach((hz, v) => {
    const pan = notes.length > 1 ? (v / (notes.length - 1)) * 1.2 - 0.6 : 0;
    for (const det of [-0.0035, 0.0035]) {
      const w = (2 * Math.PI * hz * (1 + det)) / SR;
      let ph = rnd() * Math.PI, lp = 0;
      for (let i = i0; i < i1; i++) {
        const t = i / SR;
        let s = 0;
        for (let h = 1; h <= 8; h++) s += Math.sin(ph * h) / h;
        ph += w;
        // passe-bas à un pôle dont la coupure respire lentement
        const fc = 700 + 450 * Math.sin(t * 0.9 + v);
        lp += (1 - Math.exp((-2 * Math.PI * fc) / SR)) * (s - lp);
        const env = cl((t - (debut - XF)) / XF) * cl((fin + XF - t) / XF);
        const global = cl(t / 1.2) * cl((DUREE - t) / 1.4) * (1 - 0.55 * Math.exp(-((t - tImpact) ** 2) / 0.02));
        add(i, lp * env * global * 0.018, pan * (det > 0 ? 1 : 0.8), 0.6);
      }
    }
  });
}

// ── Briques sonores
const bruitFiltre = (i0, dur, f0, f1, q, gain, pan = 0, rev = 0.3, env = (x) => Math.sin(Math.PI * x)) => {
  let b1 = 0, b2 = 0;
  const n = Math.round(dur * SR);
  for (let k = 0; k < n; k++) {
    const x = k / n, fc = f0 * Math.pow(f1 / f0, x);
    const w = (2 * Math.PI * fc) / SR, al = Math.sin(w) / (2 * q);
    // passe-bande biquad (forme directe transposée), coefficients recalculés à chaque échantillon
    const a0 = 1 + al, bb0 = al / a0, a1 = (-2 * Math.cos(w)) / a0, a2 = (1 - al) / a0;
    const inp = rnd();
    const y = bb0 * inp + b1;
    b1 = -a1 * y + b2;
    b2 = -bb0 * inp - a2 * y;
    add(i0 + k, y * env(x) * gain, typeof pan === "function" ? pan(x) : pan, rev);
  }
};
const sinus = (i0, dur, f0, f1, decay, gain, pan = 0, rev = 0.3, att = 0.002) => {
  let ph = 0;
  const n = Math.round(dur * SR);
  for (let k = 0; k < n; k++) {
    const t = k / SR, fc = f0 + (f1 - f0) * (1 - Math.exp(-t / (dur * 0.35)));
    ph += (2 * Math.PI * fc) / SR;
    add(i0 + k, Math.sin(ph) * Math.min(1, t / att) * Math.exp(-t / decay) * gain, pan, rev);
  }
};
const clic = (t, gain, pan = 0) => bruitFiltre(at(t), 0.03, 3800, 5200, 1.4, gain, pan, 0.08, (x) => Math.exp(-x * 7) * Math.min(1, x * 40));
const tinte = (t, hz, gain, pan = 0, decay = 0.18) => {
  sinus(at(t), decay * 5, hz, hz, decay, gain, pan, 0.45);
  sinus(at(t), decay * 4, hz * 2.01, hz * 2.01, decay * 0.6, gain * 0.35, pan, 0.45);
};

const SONS = {
  souffle: (e) => bruitFiltre(at(e.t - 0.18), 0.6, 350, 2600, 0.9, 0.45 * (e.gain ?? 1), (x) => -0.7 + 1.4 * x, 0.35, (x) => Math.pow(Math.sin(Math.PI * x), 1.6)),
  appui: (e) => sinus(at(e.t), 0.5, 150, 70, 0.11, 0.38 * (e.gain ?? 1), e.pan ?? 0, 0.25, 0.003),
  air: (e) => bruitFiltre(at(e.t), 0.8, 1200, 3200, 1.4, 0.1 * (e.gain ?? 1), e.pan ?? 0.4, 0.5),
  tic: (e) => { clic(e.t, 0.1 * (e.gain ?? 1), e.pan ?? 0); if (e.hz) tinte(e.t + 0.02, e.hz, 0.05 * (e.gain ?? 1), e.pan ?? 0, 0.14); },
  tinte: (e) => tinte(e.t, e.hz ?? 523.25, 0.08 * (e.gain ?? 1), e.pan ?? 0, e.decay ?? 0.22),
  declic: (e) => clic(e.t, 0.16 * (e.gain ?? 1), e.pan ?? 0),
  impact: (e) => {
    bruitFiltre(at(e.t - 0.95), 0.95, 300, 4200, 1.2, 0.22, 0, 0.4, (x) => Math.pow(x, 2.2));
    sinus(at(e.t), 1.8, 87, 40, 0.55, 0.95 * (e.gain ?? 1), 0, 0.25, 0.004);
    bruitFiltre(at(e.t), 0.5, 1800, 300, 0.7, 0.35, 0, 0.6, (x) => Math.exp(-x * 6));
  },
  pop: (e) => sinus(at(e.t), 0.2, 600, 900, 0.05, 0.22 * (e.gain ?? 1), e.pan ?? 0, 0.3),
  brillance: (e) => [783.99, 1046.5, 1567.98, 2093.0].forEach((hz, k) => tinte(e.t + k * 0.06, hz, 0.075 * (e.gain ?? 1), -0.3 + 0.2 * k, 0.35)),
};
for (const e of evenements) {
  const son = SONS[e.type];
  if (!son) {
    console.error(`événement inconnu : « ${e.type} » (connus : ${Object.keys(SONS).join(", ")})`);
    process.exit(2);
  }
  son(e);
}

// ── Réverbération de Schroeder (4 peignes amortis + 2 passe-tout), un canal par côté
const reverb = (inp, decal) => {
  const out = new Float32Array(N);
  const peignes = [1557, 1617, 1491, 1422].map((d) => Math.round(((d + decal) * SR) / 44100));
  for (const d of peignes) {
    const buf = new Float32Array(d);
    let p = 0, lp = 0;
    for (let i = 0; i < N; i++) { const y = buf[p]; lp = y * 0.6 + lp * 0.4; buf[p] = inp[i] + lp * 0.84; p = (p + 1) % d; out[i] += y * 0.25; }
  }
  for (const d0 of [556, 441]) {
    const d = Math.round(((d0 + decal) * SR) / 44100), buf = new Float32Array(d);
    let p = 0;
    for (let i = 0; i < N; i++) { const b = buf[p], y = -out[i] + b; buf[p] = out[i] + b * 0.5; out[i] = y; p = (p + 1) % d; }
  }
  return out;
};
const wl = reverb(RL, 0), wr = reverb(RR, 23);

// ── Mixage, limiteur doux, normalisation à -1 dBFS, WAV 48 kHz 16 bits stéréo
const outL = new Float32Array(N), outR = new Float32Array(N);
let crete = 0;
for (let i = 0; i < N; i++) {
  outL[i] = Math.tanh((L[i] + wl[i] * 0.55) * 1.3);
  outR[i] = Math.tanh((R[i] + wr[i] * 0.55) * 1.3);
  crete = Math.max(crete, Math.abs(outL[i]), Math.abs(outR[i]));
}
const g = crete > 0 ? 0.891 / crete : 0;
const wav = Buffer.alloc(44 + N * 4);
wav.write("RIFF", 0); wav.writeUInt32LE(36 + N * 4, 4); wav.write("WAVE", 8); wav.write("fmt ", 12);
wav.writeUInt32LE(16, 16); wav.writeUInt16LE(1, 20); wav.writeUInt16LE(2, 22);
wav.writeUInt32LE(SR, 24); wav.writeUInt32LE(SR * 4, 28); wav.writeUInt16LE(4, 32); wav.writeUInt16LE(16, 34);
wav.write("data", 36); wav.writeUInt32LE(N * 4, 40);
for (let i = 0; i < N; i++) {
  wav.writeInt16LE(Math.round(outL[i] * g * 32767), 44 + i * 4);
  wav.writeInt16LE(Math.round(outR[i] * g * 32767), 46 + i * 4);
}
writeFileSync(sortie, wav);
console.log(`bande-son ${DUREE} s → ${sortie} (${evenements.length} événements, crête avant normalisation ${crete.toFixed(3)})`);
