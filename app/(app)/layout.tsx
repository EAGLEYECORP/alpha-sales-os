import { AppShell } from "@/components/shell/app-shell";

/**
 * ─────────────────────────────────────────────────────────────────────
 * La coquille de l'APPLICATION — et seulement d'elle.
 *
 * ── POURQUOI CE GROUPE DE ROUTES EXISTE ──
 *
 * L'AppShell était importé par le layout RACINE, donc appliqué à tout, y
 * compris à `/vitrine`. Il s'en retirait par un `if (pathname === "/vitrine")
 * return children` — à l'EXÉCUTION. Or un test d'exécution ne retire rien du
 * bundle : la page de vente publique téléchargeait quand même tout le code
 * client de l'app, et avec lui la grille tarifaire complète, lisible en trois
 * secondes de devtools.
 *
 * Le groupe `(app)` règle ça à la COMPILATION. Les parenthèses n'apparaissent
 * pas dans les URLs : `/pipeline` reste `/pipeline`. Mais `/vitrine` et
 * `/gate`, qui vivent en dehors, ne chargent plus que leur propre code.
 *
 * Règle à tenir : une page publique ne va JAMAIS dans ce groupe.
 * ─────────────────────────────────────────────────────────────────────
 */
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return <AppShell>{children}</AppShell>;
}
