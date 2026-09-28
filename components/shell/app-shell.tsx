"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  Activity,
  AudioLines,
  BadgeEuro,
  BarChart3,
  Brain,
  Bot,
  CalendarCheck,
  CalendarDays,
  ClipboardCheck,
  Coins,
  Cpu,
  FileText,
  Footprints,
  Gauge,
  Gem,
  Handshake,
  Kanban,
  ListChecks,
  Linkedin,
  Mail,
  Megaphone,
  Mic,
  Newspaper,
  Navigation,
  PanelLeftClose,
  PanelLeftOpen,
  PhoneCall,
  ScrollText,
  Search,
  Send,
  Settings,
  Stethoscope,
  Lock,
  Sparkles,
  Radio,
  RadioTower,
  Sprout,
  TrendingUp,
  Swords,
  Trophy,
  UserCog,
  ChevronRight,
  LayoutGrid,
} from "lucide-react";
import { Eagle } from "@/components/eagle";
import { cn } from "@/lib/utils";
import { useAlpha } from "@/lib/store";
import { eur, relativeFr } from "@/lib/utils";
import { weightedValue } from "@/lib/hormozi";
import { LockGate } from "@/components/security/lock-gate";
import { AuthGate } from "@/components/security/auth-gate";
import { AuthSync } from "@/components/security/auth-sync";
import { SessionCompte } from "@/components/security/session-compte";
import { RetourLien } from "@/components/security/retour-lien";
import { Onboarding } from "@/components/onboarding";
import { OperatorTour } from "@/components/tour/operator-tour";
import { PageGuide } from "@/components/page-guide";
import { CommandPalette } from "@/components/command-palette";
import { ThemeToggle } from "@/components/theme-toggle";
import { N8nAutoSync } from "@/components/n8n-autosync";
import { StorageAlert } from "@/components/security/storage-alert";
import { PipeServeur } from "@/components/pipe-serveur";
import { SyncMoteur } from "@/components/sync-moteur";
import { KnowledgeSeedLoader } from "@/components/cerveau/seed-loader";
import { useDroits } from "@/lib/use-droits";
import { etatChemin } from "@/lib/verrous";
import { CLE_MODE, modeActif, modesVisibles, type ModeMobile } from "@/lib/modes-mobile";

/**
 * ─────────────────────────────────────────────────────────────────────
 * NAVIGATION — hiérarchisée, pas listée.
 *
 * Avant : 34 entrées à plat, toutes du même poids visuel. Un opérateur qui
 * ouvre l'app le matin ne cherche pas « Newsletter » ni « Concurrents » : il
 * veut savoir quoi faire aujourd'hui. Une liste plate lui impose de relire
 * 34 lignes pour retrouver les trois qu'il utilise vraiment, à chaque fois.
 *
 * Le principe : ce qui sert TOUS LES JOURS reste toujours visible ; le reste
 * est rangé par MOMENT DU MÉTIER et se replie. Un groupe qui contient la page
 * courante s'ouvre tout seul — on ne se perd jamais, et on ne clique pas pour
 * retrouver où on est. Le repli est mémorisé par navigateur.
 *
 * Rien n'est supprimé : tout reste atteignable en un clic, et la palette
 * (⌘K) va n'importe où en tapant trois lettres.
 * ─────────────────────────────────────────────────────────────────────
 */

/** Les quatre écrans du quotidien — jamais repliés, toujours en tête. */
const NAV_QUOTIDIEN = [
  { href: "/aujourdhui", label: "Aujourd'hui", icon: CalendarCheck },
  { href: "/pipeline", label: "Pipeline", icon: Kanban },
  { href: "/decisions", label: "À décider", icon: ListChecks },
  { href: "/controle", label: "Salle de contrôle", icon: RadioTower },
];

interface NavGroup {
  id: string;
  label: string;
  items: { href: string; label: string; icon: typeof BarChart3 }[];
}

const NAV_GROUPES: NavGroup[] = [
  {
    id: "parler",
    label: "Parler aux prospects",
    items: [
      { href: "/voice", label: "Alpha Voice", icon: AudioLines },
      { href: "/appels", label: "Appels", icon: PhoneCall },
      { href: "/closer", label: "Closer OS", icon: Navigation },
      { href: "/debrief", label: "Débrief terrain", icon: Mic },
      { href: "/meetings", label: "Rendez-vous", icon: CalendarDays },
    ],
  },
  {
    id: "ecrire",
    label: "Écrire & envoyer",
    items: [
      { href: "/templates", label: "Templates", icon: ScrollText },
      { href: "/campaigns", label: "Campagnes", icon: Mail },
      { href: "/outbox", label: "Boîte d'envoi", icon: Send },
      { href: "/nurture", label: "Relances", icon: Sprout },
      { href: "/audits", label: "Audits", icon: FileText },
    ],
  },
  {
    id: "savoir",
    label: "Savoir quoi dire",
    items: [
      { href: "/agent", label: "Agent ALPHA", icon: Bot },
      { href: "/cerveau", label: "Cerveau", icon: Brain },
      { href: "/offre", label: "Offre & Tarifs", icon: BadgeEuro },
      { href: "/intel", label: "Concurrents", icon: Swords },
      { href: "/preuves", label: "Preuves", icon: Gem },
    ],
  },
  {
    id: "attirer",
    label: "Se faire connaître",
    items: [
      { href: "/linkedin", label: "LinkedIn", icon: Linkedin },
      { href: "/social", label: "Studio social", icon: Megaphone },
      { href: "/newsletter", label: "Newsletter", icon: Newspaper },
      { href: "/prescripteurs", label: "Prescripteurs", icon: Handshake },
    ],
  },
  {
    id: "mesurer",
    label: "Mesurer & piloter",
    items: [
      { href: "/", label: "Dashboard", icon: BarChart3 },
      { href: "/kpis", label: "KPIs", icon: Gauge },
      { href: "/trajectoire", label: "Trajectoire", icon: TrendingUp },
      { href: "/milestones", label: "Jalons", icon: Trophy },
      { href: "/payouts", label: "Payouts", icon: Coins },
      { href: "/activity", label: "Activité", icon: Activity },
    ],
  },
  /**
   * ⚠ CE GROUPE A ÉTÉ SÉPARÉ DE « Régler la machine », ET LA DISTINCTION EST
   * RÉELLE : régler, c'est choisir ; vérifier, c'est constater. Alpha CEO,
   * le pilote et la recette répondent tous les trois à « est-ce que ça tourne
   * VRAIMENT ? » — question qu'on se pose à un autre moment que « comment je
   * veux que ça marche ». Les mélanger enterrait le diagnostic entre deux
   * écrans de préférences.
   */
  {
    id: "verifier",
    label: "Vérifier que ça tourne",
    items: [
      { href: "/moniteur", label: "Moniteur", icon: Radio },
      { href: "/ceo", label: "Alpha CEO", icon: Stethoscope },
      { href: "/pilote", label: "Pilote", icon: Cpu },
      { href: "/recette", label: "Recette", icon: ClipboardCheck },
    ],
  },
  {
    id: "regler",
    label: "Régler la machine",
    items: [
      { href: "/demarrage", label: "Prise en main", icon: Footprints },
      { href: "/prompts", label: "Prompts", icon: Sparkles },
      { href: "/compte", label: "Compte", icon: UserCog },
      { href: "/settings", label: "Réglages", icon: Settings },
    ],
  },
];

/** Toutes les entrées, à plat — sert au mode replié et aux vérifications. */
const NAV = [...NAV_QUOTIDIEN, ...NAV_GROUPES.flatMap((g) => g.items)];

/**
 * ⚠ `/settings` A CÉDÉ SA PLACE AU MONITEUR, ET C'EST UN ARBITRAGE, PAS UN
 * OUBLI. Une barre de pouce tient cinq entrées ; à six, on vise mal et on
 * ouvre le mauvais écran.
 *
 * On règle depuis un ordinateur, une fois. On regarde ce que la machine a fait
 * depuis un téléphone, vingt fois par jour — surtout depuis que l'autopilote
 * tourne sur le serveur et n'a plus besoin qu'on soit devant.
 *
 * Les réglages ne disparaissent pas : la palette de l'en-tête mobile y va en
 * trois lettres, et un test refuse qu'une page devienne inatteignable.
 */
/**
 * ⚠⚠ CETTE LISTE FIGÉE A ÉTÉ REMPLACÉE PAR DES MODES (`lib/modes-mobile.ts`).
 *
 * Le raisonnement ci-dessus reste juste sur un point — une barre de pouce tient
 * CINQ entrées — et faux sur l'autre. « On règle depuis un ordinateur, on
 * regarde depuis un téléphone » était vrai quand l'autopilote avait besoin
 * d'une machine allumée. Il tourne sur le serveur depuis le 09/09 : le
 * téléphone n'est plus un écran de consultation, c'est le poste de travail.
 *
 * Conséquence mesurée : depuis la barre, on n'atteignait NI le pipeline, NI les
 * campagnes, NI Alpha CEO. Trois des écrans les plus utilisés imposaient
 * d'ouvrir la palette et de taper.
 *
 * On garde donc cinq entrées, et on change ce qu'elles DÉSIGNENT. Le mode
 * « terrain » reprend cette liste à l'identique : personne ne perd ce qu'il
 * savait déjà faire.
 */
const barreDuMode = (mode: ModeMobile) =>
  mode.routes
    .map((href) => NAV.find((n) => n.href === href))
    .filter((n): n is (typeof NAV)[number] => Boolean(n));

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const prospects = useAlpha((s) => s.prospects);
  const meetings = useAlpha((s) => s.meetings);
  const pipeValue = prospects.reduce((sum, p) => sum + weightedValue(p), 0);
  const nextMeeting = meetings
    .filter((m) => !m.done && new Date(m.date) > new Date(Date.now() - 36e5))
    .sort((a, b) => a.date.localeCompare(b.date))[0];

  const [paletteOpen, setPaletteOpen] = useState(false);

  // Collapsible sidebar — persisted per browser. Lazy-init from localStorage
  // (client only; the shell renders splash on the server so no hydration risk).
  const [collapsed, setCollapsed] = useState<boolean>(
    () => typeof window !== "undefined" && localStorage.getItem("alpha_sidebar_collapsed") === "1"
  );
  const toggleCollapsed = () =>
    setCollapsed((c) => {
      const next = !c;
      if (typeof window !== "undefined")
        localStorage.setItem("alpha_sidebar_collapsed", next ? "1" : "0");
      return next;
    });

  // Repli des groupes de navigation — mémorisé par navigateur. Une valeur
  // absente signifie « laisse le groupe décider » : il s'ouvre s'il contient
  // la page courante. On n'écrit donc que les choix EXPLICITES de l'opérateur.
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() => {
    if (typeof window === "undefined") return {};
    try {
      return JSON.parse(localStorage.getItem("alpha_nav_groups") ?? "{}") as Record<string, boolean>;
    } catch {
      return {};
    }
  });
  const toggleGroup = (id: string, ouvert: boolean) =>
    setOpenGroups((s) => {
      const next = { ...s, [id]: ouvert };
      try {
        localStorage.setItem("alpha_nav_groups", JSON.stringify(next));
      } catch {
        /* navigation privée / stockage plein — le repli reste juste éphémère */
      }
      return next;
    });

  // Mounted gate: all content is driven by localStorage (local-first), which
  // the server can't know. Server and first client paint both render the
  // splash — identical markup, zero hydration mismatch — then real data.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // Raccourcis : ⌘/Ctrl+K (recherche) · ⌘/Ctrl+B (replier la sidebar)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((o) => !o);
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "b") {
        e.preventDefault();
        toggleCollapsed();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  // Ce que ce compte a le droit de VOIR dans le menu. La barrière réelle est
  // le middleware ; ici on évite seulement les culs-de-sac.
  const droits = useDroits();
  /**
   * ⚠ ON NE MASQUE PLUS CE QUI EST À VENDRE — ON LE GRISE.
   *
   * Le rail filtrait avec `afficherChemin`, donc un inscrit gratuit voyait
   * une application plus petite que la vraie sans jamais apprendre ce qui
   * manquait. On ne peut pas vouloir ce qu'on ne voit pas, et on ne peut
   * surtout pas comprendre un refus dont la porte était invisible.
   *
   * `etatChemin` distingue les deux cas, et la distinction est la règle
   * entière : on GRISE ce qui est à vendre, on MASQUE ce qui est à nous
   * (`/payouts`, `/offre` — griser reviendrait à annoncer notre économie à
   * un client, et à l'inviter à demander notre part).
   */
  const etat = (href: string) => etatChemin(href, droits.bricks, droits.maitre, droits.solo, droits.session);
  const visible = (href: string) => etat(href).type !== "masque";
  const verrouDe = (href: string) => {
    const e = etat(href);
    return e.type === "verrouille" ? e.brique : undefined;
  };

  /**
   * Un mode est OUVERT dès qu'une de ses routes l'est. Exiger les cinq
   * marquerait « non inclus » un mode dont quatre écrans sur cinq
   * fonctionnent — et ce serait un mensonge dans le sens qui décourage.
   */
  const peutOuvrirMode = (m: ModeMobile) => m.routes.some((r) => etat(r).type === "ouvert");

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  /**
   * ── LE MODE DU TÉLÉPHONE ──
   *
   * Mémorisé par navigateur, comme le repli du rail. Initialisé en LAZY : le
   * shell rend un écran d'attente côté serveur, donc pas de risque
   * d'hydratation — c'est le même schéma que `collapsed`, juste au-dessus.
   *
   * ⚠ `modeActif` REPLIE sur le mode par défaut si le mode mémorisé n'est plus
   * visible. Le cas est réel : le propriétaire choisit « Alpha CEO », puis
   * ouvre l'app avec un compte client dans le même navigateur. Sans repli, la
   * barre du bas serait VIDE — et une barre vide ne ressemble pas à un droit
   * manquant, elle ressemble à une panne.
   */
  const [modeMemorise, setModeMemorise] = useState<string | null>(
    () => (typeof window === "undefined" ? null : localStorage.getItem(CLE_MODE))
  );
  const mode = modeActif(modeMemorise, droits.maitre);
  const choisirMode = (id: string) => {
    setModeMemorise(id);
    if (typeof window !== "undefined") localStorage.setItem(CLE_MODE, id);
    setSelecteurOuvert(false);
  };
  const [selecteurOuvert, setSelecteurOuvert] = useState(false);

  // L'écran de connexion (/gate) vit HORS du shell : pas de sidebar, pas
  // d'assistant, pas de visite guidée par-dessus le mot de passe.
  // La vitrine publique aussi : un prospect ne doit JAMAIS voir la navigation
  // interne ni deviner qu'il existe un outil derrière.
  if (pathname === "/gate" || pathname === "/vitrine") return <>{children}</>;

  if (!mounted) {
    return (
      <div className="grid min-h-screen place-items-center bg-ink-950">
        <div className="animate-floaty text-center">
          <span className="mx-auto block text-bronze-400">
            <Eagle size={96} glow />
          </span>
          <p className="mt-4 font-display text-lg font-extrabold tracking-[0.1em] text-bronze-400">
            ALPHA SALES OS<sup>®</sup>
          </p>
          <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-paper-faint">Eagleye Corp — Lyon</p>
        </div>
      </div>
    );
  }

  return (
    <>
    <AuthSync />
    <AuthGate>
    <LockGate>
    {/* ⚠ Le moteur de synchro est monté ICI, pas dans Réglages. En mode pipe
        serveur les fiches ne sont plus écrites sur le disque : un opérateur
        qui n'ouvre jamais Réglages ne pousserait rien, et perdrait sa journée
        en fermant l'onglet. Réglages n'en garde que la vue. */}
    <SyncMoteur>
    <Onboarding />
    <OperatorTour />
    <PageGuide />
    <N8nAutoSync />
    <div className="flex min-h-screen">
      {/* Sidebar — desktop (repliable : ⌘B ou le bouton) */}
      <aside
        className={cn(
          // ⚠ Les trois surfaces de chrome (ce rail, l'en-tête mobile, la barre
          // du bas) portaient CHACUNE leur propre recette de verre : trois
          // opacités (60 / 90 / 95 %) et deux flous différents. Elles encadrent
          // pourtant le même contenu et doivent lire comme une seule fenêtre.
          // `glass-chrome` est cette recette, une fois.
          "glass-chrome hidden md:flex flex-col border-r border-ink-700 sticky top-0 h-screen transition-[width] duration-200 ease-out",
          collapsed ? "w-16" : "w-60"
        )}
      >
        <div className={cn("border-b border-ink-700", collapsed ? "px-2 py-4" : "px-5 py-6")}>
          <Link
            href="/"
            className={cn("flex items-center gap-3 group", collapsed && "justify-center")}
            title="ALPHA SALES OS — Dashboard"
          >
            <span className="text-bronze-400 transition-transform group-hover:scale-105">
              <Eagle size={collapsed ? 30 : 38} glow />
            </span>
            {!collapsed && (
              <span>
                <span className="block font-display text-sm font-extrabold tracking-[0.04em] text-paper">
                  ALPHA <span className="text-bronze-400">SALES OS</span>
                </span>
                <span className="block font-mono text-[9px] uppercase tracking-[0.22em] text-paper-faint">
                  Eagleye Corp — Lyon
                </span>
              </span>
            )}
          </Link>
        </div>

        <div className={cn("pt-3", collapsed ? "px-2" : "px-3")}>
          <button
            onClick={() => setPaletteOpen(true)}
            aria-label="Rechercher (⌘K)"
            title="Rechercher (⌘K)"
            className={cn(
              "flex w-full items-center rounded-xl border border-ink-600 text-paper-faint transition-colors hover:border-bronze-700 hover:text-paper",
              collapsed ? "justify-center py-2" : "gap-2.5 px-3 py-2 text-left text-sm"
            )}
          >
            <Search size={14} />
            {!collapsed && (
              <>
                Rechercher…
                <kbd className="ml-auto rounded border border-ink-600 px-1.5 py-0.5 font-mono text-[9px] uppercase">⌘K</kbd>
              </>
            )}
          </button>
        </div>

        <nav className={cn("flex-1 overflow-y-auto py-3 space-y-0.5", collapsed ? "px-2" : "px-3")}>
          {/* Replié : tout à plat, en icônes — la hiérarchie ne se lit pas
              sans libellés, autant ne pas la simuler. */}
          {collapsed
            ? NAV.filter((i) => visible(i.href)).map(({ href, label, icon: Icon }) => (
                <NavLink key={href} href={href} label={label} Icon={Icon} active={isActive(href)} collapsed verrou={verrouDe(href)} />
              ))
            : (
              <>
                {NAV_QUOTIDIEN.filter((i) => visible(i.href)).map(({ href, label, icon: Icon }) => (
                  <NavLink key={href} href={href} label={label} Icon={Icon} active={isActive(href)} verrou={verrouDe(href)} />
                ))}

                {NAV_GROUPES.map((g) => {
                  // On masque ce que le compte ne possède pas — confort, pas
                  // sécurité : le serveur refuse de toute façon. Un groupe
                  // entièrement masqué disparaît, sinon on affiche un titre
                  // qui n'ouvre rien.
                  const items = g.items.filter((i) => visible(i.href));
                  if (!items.length) return null;
                  // Le groupe qui contient la page courante s'ouvre tout seul :
                  // on ne doit jamais avoir à chercher où on se trouve.
                  const contientPage = items.some((i) => isActive(i.href));
                  const ouvert = openGroups[g.id] ?? contientPage;
                  return (
                    <div key={g.id} className="pt-2">
                      <button
                        onClick={() => toggleGroup(g.id, !ouvert)}
                        aria-expanded={ouvert}
                        className="flex w-full items-center gap-1.5 rounded-lg px-3 py-1.5 text-left font-mono text-[9px] uppercase tracking-[0.18em] text-paper-faint transition-colors hover:text-paper"
                      >
                        <ChevronRight size={11} className={cn("transition-transform", ouvert && "rotate-90")} />
                        {g.label}
                      </button>
                      {ouvert &&
                        items.map(({ href, label, icon: Icon }) => (
                          <NavLink key={href} href={href} label={label} Icon={Icon} active={isActive(href)} verrou={verrouDe(href)} />
                        ))}
                    </div>
                  );
                })}
              </>
            )}
        </nav>

        {!collapsed && (
          <div className="space-y-2.5 border-t border-ink-700 p-4">
            {nextMeeting && (
              <Link href="/meetings" className="block">
                <p className="font-mono text-[9px] uppercase tracking-[0.18em] text-paper-faint">Prochain RDV</p>
                <p className="truncate text-[12px] font-medium text-paper">
                  {nextMeeting.title}{" "}
                  <span className="font-mono text-bronze-400">{relativeFr(nextMeeting.date)}</span>
                </p>
              </Link>
            )}
            <div>
              <p className="font-mono text-[9px] uppercase tracking-[0.18em] text-paper-faint">Pipe pondéré</p>
              <p className="font-display text-xl font-extrabold text-bronze-400">{eur(pipeValue)}</p>
            </div>
            <p className="text-[10px] italic text-paper-faint">« La décision EST le produit. »</p>
          </div>
        )}

        {/* Thème + repli */}
        <div className={cn("space-y-1 border-t border-ink-700", collapsed ? "px-2 py-2" : "px-3 py-2")}>
          {/* Sous quel compte on travaille, et par où on sort. En rail replié,
              l'initiale suffit — l'adresse reste dans le libellé accessible. */}
          <SessionCompte variant={collapsed ? "icon" : "rail"} className={collapsed ? "mx-auto" : ""} />
          <ThemeToggle variant={collapsed ? "icon" : "rail"} className={collapsed ? "mx-auto h-9 w-9" : ""} />
          <button
            onClick={toggleCollapsed}
            aria-label={collapsed ? "Déplier la barre latérale (⌘B)" : "Replier la barre latérale (⌘B)"}
            title={collapsed ? "Déplier (⌘B)" : "Replier (⌘B)"}
            className={cn(
              "flex w-full items-center rounded-lg text-paper-faint transition-colors hover:text-paper hover:bg-ink-800",
              collapsed ? "justify-center py-2" : "gap-2.5 px-3 py-2 text-[12px]"
            )}
          >
            {collapsed ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}
            {!collapsed && "Replier"}
          </button>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 min-w-0 pb-20 md:pb-0">
        {/* Header mobile — logo + recherche */}
        <div className="glass-chrome sticky top-0 z-40 flex items-center justify-between border-b border-ink-700 px-4 py-2.5 md:hidden">
          <Link href="/" className="flex items-center gap-2">
            <span className="text-bronze-400"><Eagle size={26} glow /></span>
            <span className="font-display text-[13px] font-extrabold tracking-[0.04em] text-paper">
              ALPHA <span className="text-bronze-400">SALES OS</span>
            </span>
          </Link>
          <div className="flex items-center gap-2">
            {/* ⚠ LE SÉLECTEUR DE MODE EST DANS L'EN-TÊTE, PAS DANS LA BARRE DU
                BAS. Lui donner une des cinq places l'aurait payé avec un écran :
                on aurait rendu le pipeline atteignable en retirant le débrief.
                En haut, il ne coûte aucune destination. */}
            <button
              onClick={() => setSelecteurOuvert((v) => !v)}
              className="flex h-9 items-center gap-1.5 rounded-full border border-ink-600 px-3 text-[11px] font-semibold text-paper-dim"
              aria-haspopup="menu"
              aria-expanded={selecteurOuvert}
              aria-label={`Mode ${mode.label} — changer de mode`}
            >
              <LayoutGrid size={14} className="text-bronze-400" />
              {mode.label}
              <ChevronRight size={12} className={cn("transition-transform", selecteurOuvert && "rotate-90")} />
            </button>
            <SessionCompte variant="icon" />
            <ThemeToggle variant="icon" className="h-9 w-9" />
            <button
              onClick={() => setPaletteOpen(true)}
              className="grid h-9 w-9 place-items-center rounded-full border border-ink-600 text-paper-faint"
              aria-label="Rechercher"
            >
              <Search size={16} />
            </button>
          </div>
        </div>

        {/* Le choix du mode — une liste, pas une grille d'icônes : chaque mode
            dit CE QU'IL SERT, et un intitulé seul ne le dit pas. */}
        {selecteurOuvert && (
          <div className="glass-chrome sticky top-[52px] z-40 border-b border-ink-700 p-2 md:hidden" role="menu">
            {modesVisibles(droits.maitre).map((m) => (
              <button
                key={m.id}
                role="menuitemradio"
                aria-checked={m.id === mode.id}
                onClick={() => choisirMode(m.id)}
                className={cn(
                  "flex w-full flex-col items-start gap-0.5 rounded-lg px-3 py-2.5 text-left",
                  m.id === mode.id ? "bg-bronze-900/70" : "hover:bg-ink-800"
                )}
              >
                <span className={cn("text-sm font-semibold", m.id === mode.id ? "text-bronze-300" : "text-paper")}>
                  {m.label}
                  {/* Un mode payant se GRISE et le dit — il ne disparaît pas. */}
                  {m.brique && !peutOuvrirMode(m) && (
                    <span className="ml-2 inline-flex items-center gap-1 text-[10px] font-normal text-paper-faint">
                      <Lock size={10} /> non inclus
                    </span>
                  )}
                </span>
                <span className="text-[11px] leading-snug text-paper-faint">{m.quoi}</span>
              </button>
            ))}
          </div>
        )}
        {/* Avant tout le reste : quelqu'un qui arrive d'un email de
            confirmation doit savoir si ça a marché. En cas d'échec, Supabase
            redirige vers une app d'apparence normale et ne dit rien — c'est
            le silence le plus cher du tunnel, il tombe pile au moment de la
            conversion. */}
        <RetourLien />
        {/* Puis : si le stockage local n'enregistre plus, aucune autre
            information n'a d'importance tant que ce n'est pas réglé. */}
        <StorageAlert />
        {/* Et juste en dessous : si le pipe vit sur le serveur, dire s'il est
            chargé. Une liste vide en cours de chargement ressemble trait pour
            trait à un pipe perdu — c'est la confusion qui fait réimporter. */}
        <PipeServeur />
        {/* Le socle du Cerveau arrive du serveur : il ne peut plus être compilé
            dans le bundle, où il était lisible sans mot de passe. */}
        <KnowledgeSeedLoader />
        <div className="mx-auto max-w-7xl px-4 py-6 md:px-8 md:py-8">{children}</div>
      </main>

      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />

      {/* Bottom nav — mobile (safe-area : barre gestuelle Android/iOS en PWA) */}
      <nav
        className="glass-chrome fixed bottom-0 inset-x-0 z-40 flex border-t border-ink-700 md:hidden pb-[env(safe-area-inset-bottom)]"
        aria-label={`Navigation — mode ${mode.label}`}
      >
        {barreDuMode(mode).map(({ href, label, icon: Icon }) => {
          /**
           * ⚠ UNE ENTRÉE VERROUILLÉE RESTE UN LIEN, comme dans le rail : elle
           * mène à l'explication, pas nulle part. Un `<button disabled>` aurait
           * rendu la porte visible ET muette — et inatteignable au clavier au
           * moment précis où elle a quelque chose à dire.
           */
          const verrou = verrouDe(href);
          const cible = verrou
            ? `/offre-brique?b=${encodeURIComponent(verrou)}&de=${encodeURIComponent(href)}`
            : href;
          return (
            <Link
              key={href}
              href={cible}
              aria-label={verrou ? `${label} — non inclus dans ton offre` : label}
              aria-current={isActive(href) ? "page" : undefined}
              className={cn(
                "flex flex-1 flex-col items-center gap-1 py-2.5 text-[10px]",
                isActive(href) ? "text-bronze-400" : verrou ? "text-paper-faint/60" : "text-paper-faint"
              )}
            >
              <Icon size={19} strokeWidth={isActive(href) ? 2.4 : 1.8} />
              {label}
            </Link>
          );
        })}
      </nav>
    </div>
    </SyncMoteur>
    </LockGate>
    </AuthGate>
    </>
  );
}

/** Une entrée de navigation — un seul rendu, pour que replié et déplié ne divergent jamais. */
/**
 * ⚠ UNE ENTRÉE VERROUILLÉE RESTE UN LIEN, ELLE N'EST PAS DÉSACTIVÉE.
 *
 * La tentation est d'en faire un `<button disabled>`. Ce serait le pire des
 * deux mondes : la porte devient visible ET impossible à interroger, donc
 * l'inscrit apprend qu'il lui manque quelque chose sans jamais apprendre
 * QUOI. Un élément désactivé n'est en plus pas atteignable au clavier — on
 * le retirerait des lecteurs d'écran au moment où il a le plus à dire.
 *
 * Le lien mène donc à `/offre-brique`, qui explique la brique, dit pourquoi
 * elle est payante et propose l'offre. C'est le lien qui PORTE
 * l'explication ; le gris ne fait qu'annoncer qu'il y en a une.
 */
function NavLink({
  href,
  label,
  Icon,
  active,
  collapsed,
  verrou,
}: {
  href: string;
  label: string;
  Icon: typeof BarChart3;
  active: boolean;
  collapsed?: boolean;
  /** La brique manquante, si l'entrée est verrouillée. */
  verrou?: string;
}) {
  const cible = verrou ? `/offre-brique?b=${encodeURIComponent(verrou)}&de=${encodeURIComponent(href)}` : href;
  return (
    <Link
      href={cible}
      // L'état se dit au lecteur d'écran, il ne se devine pas à la couleur.
      aria-label={verrou ? `${label} — non inclus dans ton offre` : label}
      aria-current={active ? "page" : undefined}
      title={collapsed ? (verrou ? `${label} — non inclus` : label) : undefined}
      className={cn(
        "flex items-center rounded-lg text-sm transition-colors",
        collapsed ? "justify-center px-2 py-2.5" : "gap-3 px-3 py-2.5",
        active
          ? "bg-bronze-900/70 text-bronze-300 font-medium"
          : verrou
            ? "text-paper-faint hover:text-paper-dim hover:bg-ink-800"
            : "text-paper-dim hover:text-paper hover:bg-ink-800"
      )}
    >
      <Icon size={17} strokeWidth={active ? 2.4 : 1.8} />
      {!collapsed && <span className="flex-1 truncate">{label}</span>}
      {!collapsed && verrou && <Lock size={12} className="shrink-0 opacity-60" />}
    </Link>
  );
}
