// Alpha Live — habillage desktop (overlay transparent « type Cluely »).
//
// Une fenêtre transparente, sans cadre, toujours au-dessus, qui charge la route
// /overlay de l'app déployée. C'est CE que le navigateur ne peut pas faire : une
// vraie fenêtre see-through par-dessus Zoom/Meet/Teams pendant un RDV visio.
//
// Lancer :  ALPHA_URL="https://ton-app.vercel.app" npm start
// (défaut : http://localhost:3000)

const { app, BrowserWindow, globalShortcut } = require("electron");

const BASE = process.env.ALPHA_URL || "http://localhost:3000";
const OVERLAY_URL = `${BASE.replace(/\/$/, "")}/overlay`;

let win = null;
let clickThrough = false;

function createWindow() {
  win = new BrowserWindow({
    width: 420,
    height: 640,
    transparent: true,
    frame: false,
    alwaysOnTop: true,
    hasShadow: false,
    resizable: true,
    skipTaskbar: true,
    // Sur macOS, garde le fond réellement transparent.
    backgroundColor: "#00000000",
    webPreferences: { contextIsolation: true },
  });

  // Au-dessus MÊME des applications plein écran (les visios).
  win.setAlwaysOnTop(true, "screen-saver");
  win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  win.loadURL(OVERLAY_URL);

  // Ctrl/Cmd+Alt+O : basculer « traversable » (click-through) — l'overlay
  // laisse alors passer les clics vers la visio en dessous.
  globalShortcut.register("CommandOrControl+Alt+O", () => {
    if (!win) return;
    clickThrough = !clickThrough;
    win.setIgnoreMouseEvents(clickThrough, { forward: true });
  });

  // Ctrl/Cmd+Alt+H : masquer / afficher l'overlay.
  globalShortcut.register("CommandOrControl+Alt+H", () => {
    if (!win) return;
    if (win.isVisible()) win.hide();
    else win.show();
  });

  win.on("closed", () => { win = null; });
}

app.whenReady().then(createWindow);
app.on("will-quit", () => globalShortcut.unregisterAll());
app.on("window-all-closed", () => app.quit());
app.on("activate", () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
