# Garde-fous structurels — le code

Ces tests protègent des bugs qu'aucune relecture ne voit. Ils sont écrits en
`node:test` sans dépendance, et lisent les sources depuis le disque.

**Avant de faire confiance à l'un d'eux : le casser volontairement et vérifier
qu'il échoue.** Un test de sécurité qu'on n'a pas vu échouer ne prouve rien.

---

## 1. Le walker de graphe d'imports

Le piège : un walker qui ne suit que les alias `@/` rate tout ce qui se passe
à l'intérieur de `lib/`, où les imports sont relatifs. C'est exactement par là
que la grille tarifaire est repartie dans le bundle de toutes les pages.

```ts
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const sansCommentaires = (src: string) =>
  src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

function grapheImports(entree: string): Set<string> {
  const vus = new Set<string>();

  const fichier = (chemin: string): string | null => {
    for (const ext of [".ts", ".tsx", "/index.ts", "/index.tsx"]) {
      try {
        const f = join(process.cwd(), chemin + ext);
        readFileSync(f, "utf8");
        return f;
      } catch { /* essai suivant */ }
    }
    return null;
  };

  const marche = (chemin: string) => {
    if (vus.has(chemin)) return;
    vus.add(chemin);
    const f = fichier(chemin);
    if (!f) return;
    const src = sansCommentaires(readFileSync(f, "utf8"));
    const dossier = chemin.split("/").slice(0, -1).join("/");

    // `import type` est effacé à la compilation : il ne pèse rien.
    for (const m of src.matchAll(
      /^\s*import\s+(type\s+)?[^;]*?from\s+"((?:@\/|\.\.?\/)[^"]+)"/gm
    )) {
      if (m[1]) continue;
      const spec = m[2];
      if (spec.startsWith("@/")) { marche(spec.slice(2)); continue; }
      // Résolution relative à la main, sans dépendance.
      const parts = dossier ? dossier.split("/") : [];
      for (const seg of spec.split("/")) {
        if (seg === "." || seg === "") continue;
        if (seg === "..") parts.pop();
        else parts.push(seg);
      }
      marche(parts.join("/"));
    }
  };

  marche(entree);
  return vus;
}

/** Tous les .ts/.tsx sous ces dossiers, récursivement. */
function sources(dossiers: string[]): string[] {
  const out: string[] = [];
  const visite = (rel: string) => {
    for (const e of readdirSync(join(process.cwd(), rel), { withFileTypes: true })) {
      const chemin = `${rel}/${e.name}`;
      if (e.isDirectory()) visite(chemin);
      else if (/\.tsx?$/.test(e.name)) out.push(chemin);
    }
  };
  for (const d of dossiers) visite(d);
  return out;
}
```

## 2. Aucun composant client n'atteint un module serveur

```ts
const MODULES_SERVEUR = [
  "lib/tarifs", "lib/patients", "lib/couts", "lib/secrets-partenaires",
];

test("bundle — aucun composant client n'atteint un module serveur", () => {
  const clients = sources(["app", "components"]).filter((f) =>
    /^\s*["']use client["']/.test(readFileSync(join(process.cwd(), f), "utf8"))
  );
  // Sans ce garde-fou, un balayage cassé rend le test vert pour rien.
  assert.ok(clients.length > 20, `seulement ${clients.length} fichiers client — balayage cassé`);

  const fautes: string[] = [];
  for (const f of clients) {
    const graphe = grapheImports(f.replace(/\.tsx?$/, ""));
    for (const m of MODULES_SERVEUR) if (graphe.has(m)) fautes.push(`${f} → ${m}`);
  }
  assert.deepEqual(fautes, [], fautes.join("\n"));
});
```

## 3. Une route qui sert un module serveur est forcément interne

Dérive l'invariant du code au lieu de le répéter. C'est ce qui rattrape la
route ajoutée à la va-vite qu'on a oublié de classer.

```ts
test("routes — celle qui sert un module serveur est INTERNE", () => {
  const mw = readFileSync(join(process.cwd(), "middleware.ts"), "utf8");
  const bloc = mw.slice(mw.indexOf("const INTERNAL"), mw.indexOf("const PUBLIC_PREFIXES"));
  const internes = [...bloc.matchAll(/"([^"]+)"/g)].map((m) => m[1]);

  const fautes: string[] = [];
  for (const f of sources(["app/api"]).filter((f) => /\/route\.tsx?$/.test(f))) {
    const graphe = grapheImports(f.replace(/\.tsx?$/, ""));
    const sert = MODULES_SERVEUR.filter((m) => graphe.has(m));
    if (!sert.length) continue;
    const url = "/" + f.replace(/^app\//, "").replace(/\/route\.tsx?$/, "");
    if (!internes.some((p) => url === p || url.startsWith(p + "/"))) {
      fautes.push(`${url} sert ${sert.join(", ")} sans être INTERNE`);
    }
  }
  assert.deepEqual(fautes, [], fautes.join("\n"));
});
```

## 4. Aucune donnée personnelle dans un bundle

Le test le plus important d'un produit de santé. À faire tourner **sur le
build**, pas sur les sources — c'est le build qui est servi.

```bash
npx next build
# Téléphones FR, emails, et tout identifiant patient
grep -rhoE '0[1-9]([ .-]?[0-9]{2}){4}' .next/static/chunks | sort -u
grep -rhoE '[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}' .next/static/chunks | sort -u
```

Attention aux **faux positifs** : les suites de chiffres qui ressemblent à des
numéros sont souvent des constantes mathématiques des libs de graphiques
(`ln(10)`, epsilon IEEE-754). Vérifier le contexte avant de crier au feu.

Le motif qui a réellement causé la fuite, à interdire par test :

```ts
test("aucun require() de chemin statique dans le store", () => {
  // `require()` RESSEMBLE à du chargement paresseux et ne l'est pas : le
  // module part dans le chunk même s'il n'est jamais appelé.
  const src = sansCommentaires(readFileSync(join(process.cwd(), "lib/store.ts"), "utf8"));
  assert.doesNotMatch(src, /require\(/);
});
```

## 5. Le piège du commentaire

Un test qui cherche une chaîne interdite dans une source la trouve dans le
commentaire qui explique pourquoi elle a été retirée. Ça s'est produit **deux
fois**. Toujours passer par `sansCommentaires()` pour l'analyse de *contenu* —
mais garder la source entière pour les assertions *structurelles* (un import
commenté n'existe pas).

## 6. Vérifier un plafond

```ts
test("le journal est plafonné, quel que soit le chemin d'écriture", () => {
  // Le plafond dépendait de PAR OÙ l'entrée arrivait : un chemin l'appliquait,
  // quatre autres empilaient sans borne. On interdit la signature du bug.
  const src = readFileSync(join(process.cwd(), "lib/store.ts"), "utf8");
  assert.doesNotMatch(src, /\.\.\.s\.activities,/, "un chemin empile sans plafond");
  assert.match(src, /const pousserActivite/, "le plafond vit à UN seul endroit");
});
```

Un plafond recopié à la main finit toujours par diverger. Un helper unique, et
un test qui interdit la forme brute.
