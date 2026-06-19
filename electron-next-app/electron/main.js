import { app, BrowserWindow, screen, ipcMain } from "electron";
import fs from "fs";
import path from "path";
import vm from "vm";
import { fileURLToPath } from "url";

/**
 * URL Cloudflare Workeru s cloud daty.
 * Endpoints:
 *   GET /manifest.json
 *   GET /data/{path}
 *   PUT /data/songs/{path}  (auth, Phase 2)
 *
 * Po prvním deployi Workeru sem dej skutečnou URL.
 * Nebo override přes env CHOIRPRESENTER_DATA_URL.
 */
const CLOUD_DATA_URL =
  process.env.CHOIRPRESENTER_DATA_URL ||
  "https://choirpresenter-data.joz-maz-work.workers.dev";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Base path k api/ folderu — různé v dev vs packed app.
 * V packed app jsou JSONs v `app.asar.unpacked/api/` (kvůli asarUnpack configu).
 * `__dirname` ukazuje do app.asar/electron/, takže relative path by mířil do asar
 * archive a fs.readFile by nemusel transparentně rozpoznat unpacked redirect
 * (zejména s non-ASCII chars v názvu jako "Uwspółcześniona").
 */
const API_BASE = app.isPackaged
  ? path.join(process.resourcesPath, "app.asar.unpacked", "api")
  : path.join(__dirname, "..", "api");

// ===== SONGBOOK FILE PATHS =====
// Bundle fallback (jen pro dev, kdy ještě nemusí být stažené cloud data).
// V produkci je bundle prázdný a vše čteme z userData cache (níže).
const SONGBOOK_BUNDLE_PATHS = {
  newSong: path.join(API_BASE, "SongBooks", "new-song-converted.json"),
  newSongPlGb: path.join(
    API_BASE,
    "SongBooks",
    "new-song-pl-gb-converted.json",
  ),
  pielgrzym: path.join(API_BASE, "SongBooks", "pielgrzym-converted.json"),
  roboczy: path.join(API_BASE, "SongBooks", "roboczy-converted.json"),
  children: path.join(API_BASE, "SongBooks", "children-converted.json"),
};

const SONGBOOK_CACHE_KEYS = {
  newSong: "data/songs/new-song-converted.json",
  newSongPlGb: "data/songs/new-song-pl-gb-converted.json",
  pielgrzym: "data/songs/pielgrzym-converted.json",
  roboczy: "data/songs/roboczy-converted.json",
  children: "data/songs/children-converted.json",
};

let hdmiWindow = null;
let hdmiWindow2 = null;

// Vypneme animace přechodů oken na macOS, aby HDMI okno nikdy „neproblesklo"
app.commandLine.appendSwitch("disable-features", "WindowsScrollingFromInactive");
// Zakážeme background throttling globálně – HDMI okno renderuje plynule i bez focusu
app.commandLine.appendSwitch("disable-renderer-backgrounding");
app.commandLine.appendSwitch("disable-background-timer-throttling");
app.commandLine.appendSwitch("disable-backgrounding-occluded-windows");

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
    },
  });

  if (app.isPackaged) {
    // Production: načte statický Next.js export z out/index.html
    win.loadFile(path.join(__dirname, "..", "out", "index.html"));
  } else {
    // Development: dev server běží na portu 3002
    win.loadURL("http://localhost:3002");
  }
}

/**
 * Vytvoří HDMI okno optimalizované pro prezentace:
 * - vždy nahoře nad VŠÍM (i nad fullscreen aplikacemi jako PowerPoint)
 * - viditelné na všech macOS Spaces (přechod mezi aplikacemi nezpůsobí blink)
 * - černé pozadí už od okamžiku vytvoření (žádný bílý záblesk)
 * - renderuje plynule bez ohledu na focus
 * - bez stínu, bez frame, bez animace zobrazení
 */
function createHdmiWindow(targetBounds) {
  const win = new BrowserWindow({
    x: targetBounds.x,
    y: targetBounds.y,
    width: targetBounds.width,
    height: targetBounds.height,
    frame: false,
    show: false, // zobrazíme až po načtení – žádný flash
    alwaysOnTop: true,
    backgroundColor: "#000000",
    hasShadow: false,
    resizable: false,
    movable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: true,
    skipTaskbar: true,
    focusable: false, // okno nikdy nezíská focus – přepínání aplikací ho ignoruje
    transparent: false,
    enableLargerThanScreen: true,
    type: process.platform === "darwin" ? "panel" : undefined,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      backgroundThrottling: false, // klíčové: render běží i bez focusu
      offscreen: false,
      disableHtmlFullscreenWindowResize: true,
    },
  });

  // Nejvyšší možná vrstva – nad PowerPoint slideshow, nad fullscreen aplikacemi
  win.setAlwaysOnTop(true, "screen-saver", 1);

  // Viditelné napříč všemi macOS Spaces (zabrání blackoutu při alt-tabu / fullscreen v PowerPointu)
  if (process.platform === "darwin") {
    win.setVisibleOnAllWorkspaces(true, {
      visibleOnFullScreen: true,
      skipTransformProcessType: true,
    });
  } else {
    win.setVisibleOnAllWorkspaces(true);
  }

  return win;
}

// ===== IPC HANDLERS =====

ipcMain.handle("get-displays", () => {
  const displays = screen.getAllDisplays();
  console.log("All displays:", JSON.stringify(displays.map(d => ({ id: d.id, label: d.label, bounds: d.bounds })), null, 2));
  return displays.map((d) => ({
    id: d.id,
    label: d.label || `Display ${d.id}`,
    bounds: d.bounds,
    primary: d.bounds.x === 0 && d.bounds.y === 0,
  }));
});

ipcMain.handle("open-hdmi", (_, displayId) => {
  if (hdmiWindow && !hdmiWindow.isDestroyed()) {
    hdmiWindow.close();
  }

  const displays = screen.getAllDisplays();
  const target = displays.find((d) => d.id === displayId);
  if (!target) return;

  hdmiWindow = createHdmiWindow(target.bounds);
  hdmiWindow.loadFile(path.join(__dirname, "hdmi.html"));

  hdmiWindow.once("ready-to-show", () => {
    hdmiWindow.showInactive(); // zobrazí, ale nepřevezme focus
    // simpleFullscreen = překryje displej, ALE nevytváří nový macOS Space (žádné animace přechodu)
    if (process.platform === "darwin") {
      hdmiWindow.setSimpleFullScreen(true);
    } else {
      hdmiWindow.setFullScreen(true);
    }
  });

  hdmiWindow.on("closed", () => {
    hdmiWindow = null;
  });
});

ipcMain.on("update-hdmi", (_, html) => {
  if (hdmiWindow && !hdmiWindow.isDestroyed()) {
    hdmiWindow.webContents.send("hdmi-update", html);
  }
});

ipcMain.on("close-hdmi", () => {
  if (hdmiWindow && !hdmiWindow.isDestroyed()) {
    hdmiWindow.close();
    hdmiWindow = null;
  }
});

ipcMain.on("hdmi-blackout", (_, active) => {
  if (hdmiWindow && !hdmiWindow.isDestroyed()) {
    hdmiWindow.webContents.send("hdmi-blackout", active);
  }
});

// ===== HDMI2 (Output 2) =====

ipcMain.handle("open-hdmi2", (_, displayId) => {
  if (hdmiWindow2 && !hdmiWindow2.isDestroyed()) {
    hdmiWindow2.close();
  }

  const displays = screen.getAllDisplays();
  const target = displays.find((d) => d.id === displayId);
  if (!target) return;

  hdmiWindow2 = createHdmiWindow(target.bounds);
  hdmiWindow2.loadFile(path.join(__dirname, "hdmi.html"));

  hdmiWindow2.once("ready-to-show", () => {
    hdmiWindow2.showInactive();
    if (process.platform === "darwin") {
      hdmiWindow2.setSimpleFullScreen(true);
    } else {
      hdmiWindow2.setFullScreen(true);
    }
  });

  hdmiWindow2.on("closed", () => {
    hdmiWindow2 = null;
  });
});

ipcMain.on("update-hdmi2", (_, html) => {
  if (hdmiWindow2 && !hdmiWindow2.isDestroyed()) {
    hdmiWindow2.webContents.send("hdmi-update", html);
  }
});

ipcMain.on("close-hdmi2", () => {
  if (hdmiWindow2 && !hdmiWindow2.isDestroyed()) {
    hdmiWindow2.close();
    hdmiWindow2 = null;
  }
});

ipcMain.on("hdmi2-blackout", (_, active) => {
  if (hdmiWindow2 && !hdmiWindow2.isDestroyed()) {
    hdmiWindow2.webContents.send("hdmi-blackout", active);
  }
});

// ===== SONGBOOK IPC =====

async function readSongbookFile(book) {
  // 1) Pokus se z userData cache (po cloud downloadu)
  const cacheKey = SONGBOOK_CACHE_KEYS[book];
  if (cacheKey) {
    try {
      const cached = path.join(dataCacheDir(), cacheKey);
      if (fs.existsSync(cached)) {
        const raw = await fs.promises.readFile(cached, "utf8");
        return JSON.parse(raw);
      }
    } catch (err) {
      console.warn(`Cache read failed for ${book}, falling back to bundle:`, err);
    }
  }
  // 2) Bundle fallback (dev / přechodné období)
  const target = SONGBOOK_BUNDLE_PATHS[book];
  if (!target || !fs.existsSync(target)) return null;
  const raw = await fs.promises.readFile(target, "utf8");
  return JSON.parse(raw);
}

ipcMain.handle("read-songbook", async (_, book) => {
  try {
    return await readSongbookFile(book);
  } catch (err) {
    console.error("Failed to read songbook", book, err);
    return null;
  }
});

const BIBLE_BUNDLE_PATHS = {
  warszawska: path.join(API_BASE, "Bibles", "Biblia Warszawska.json"),
  gdanska: path.join(
    API_BASE,
    "Bibles",
    "Uwspółcześniona Biblia Gdańska.json",
  ),
};

const BIBLE_CACHE_KEYS = {
  warszawska: "data/bibles/Biblia Warszawska.json",
  gdanska: "data/bibles/Uwspółcześniona Biblia Gdańska.json",
};

/**
 * Projde řetězec a uvnitř všech dvojitě uvozených stringů escapuje
 * raw newlines (\n, \r) na \\n. Mimo stringy nechá vše jak je.
 * Potřeba protože VideoPsalm bible JSONy mají literální newlines uvnitř
 * textů veršů, což JS nedovoluje v string literalech.
 */
function escapeNewlinesInStrings(src) {
  let out = "";
  let inStr = false;
  let escaped = false;
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (inStr) {
      if (escaped) {
        out += ch;
        escaped = false;
        continue;
      }
      if (ch === "\\") {
        out += ch;
        escaped = true;
        continue;
      }
      if (ch === '"') {
        out += ch;
        inStr = false;
        continue;
      }
      if (ch === "\n") {
        out += "\\n";
        continue;
      }
      if (ch === "\r") {
        out += "\\r";
        continue;
      }
      out += ch;
    } else {
      out += ch;
      if (ch === '"') inStr = true;
    }
  }
  return out;
}

async function loadBibleRaw(bible) {
  // 1) userData cache (cloud download)
  const cacheKey = BIBLE_CACHE_KEYS[bible];
  if (cacheKey) {
    const cached = path.join(dataCacheDir(), cacheKey);
    if (fs.existsSync(cached)) {
      return fs.promises.readFile(cached, "utf8");
    }
  }
  // 2) Bundle fallback
  const target = BIBLE_BUNDLE_PATHS[bible];
  if (target && fs.existsSync(target)) {
    return fs.promises.readFile(target, "utf8");
  }
  return null;
}

ipcMain.handle("read-bible", async (_, bible) => {
  try {
    let raw = await loadBibleRaw(bible);
    if (!raw) return null;
    raw = raw.replace(/^﻿/, ""); // strip BOM
    const preprocessed = escapeNewlinesInStrings(raw);
    const obj = vm.runInNewContext("(" + preprocessed + ")");
    return JSON.stringify(obj);
  } catch (err) {
    console.error("Failed to read/parse bible", bible, err);
    return null;
  }
});

/** Vrátí parsed JSON s message titles (titles.json) — z cache, jinak z bundle. */
ipcMain.handle("read-message-titles", async () => {
  try {
    const cached = path.join(dataCacheDir(), "data/messages/titles.json");
    if (fs.existsSync(cached)) {
      const raw = await fs.promises.readFile(cached, "utf8");
      return JSON.parse(raw);
    }
    // Bundle fallback (dev)
    const bundlePath = path.join(API_BASE, "Messages", "pl-titles.json");
    if (fs.existsSync(bundlePath)) {
      const raw = await fs.promises.readFile(bundlePath, "utf8");
      return JSON.parse(raw);
    }
    return null;
  } catch (err) {
    console.error("Failed to read message titles:", err);
    return null;
  }
});

/** Vrátí parsed JSON jednoho kázání podle date klíče. */
ipcMain.handle("read-message-text", async (_, dateKey) => {
  if (!/^[\w-]+$/.test(String(dateKey || ""))) return null;
  try {
    const cached = path.join(
      dataCacheDir(),
      "data/messages/texts",
      `${dateKey}.json`,
    );
    if (fs.existsSync(cached)) {
      const raw = await fs.promises.readFile(cached, "utf8");
      return JSON.parse(raw);
    }
    const bundlePath = path.join(
      API_BASE,
      "Messages",
      "pl-texts",
      `${dateKey}.json`,
    );
    if (fs.existsSync(bundlePath)) {
      const raw = await fs.promises.readFile(bundlePath, "utf8");
      return JSON.parse(raw);
    }
    return null;
  } catch (err) {
    console.error("Failed to read message text", dateKey, err);
    return null;
  }
});

/** Vrátí seznam date klíčů (např. ["47-0412", "49-1225"]) — pro pre-build indexu. */
ipcMain.handle("list-message-keys", async () => {
  const result = [];
  // 1) Cache
  const cacheDir = path.join(dataCacheDir(), "data/messages/texts");
  if (fs.existsSync(cacheDir)) {
    try {
      const names = await fs.promises.readdir(cacheDir);
      for (const n of names) {
        if (n.endsWith(".json")) result.push(n.slice(0, -5));
      }
      if (result.length > 0) return result.sort();
    } catch (err) {
      console.warn("list-message-keys cache scan failed:", err);
    }
  }
  // 2) Bundle fallback
  const bundleDir = path.join(API_BASE, "Messages", "pl-texts");
  if (fs.existsSync(bundleDir)) {
    try {
      const names = await fs.promises.readdir(bundleDir);
      for (const n of names) {
        if (n.endsWith(".json")) result.push(n.slice(0, -5));
      }
    } catch (err) {
      console.warn("list-message-keys bundle scan failed:", err);
    }
  }
  return result.sort();
});

ipcMain.handle("write-songbook", async (_, book, data) => {
  const target = SONGBOOK_PATHS[book];
  if (!target) return false;
  try {
    // Pretty-print s 2 mezerami pro lepší git diffy
    await fs.promises.writeFile(
      target,
      JSON.stringify(data, null, 2),
      "utf8",
    );
    return true;
  } catch (err) {
    console.error("Failed to write songbook", book, err);
    return false;
  }
});

// ===== CLOUD + LOCAL DATA IPC =====
// Veškerá data (písně/bible/kázání) jsou primárně v cloudu (Cloudflare R2).
// Při prvním spuštění Electron stáhne vše do `userData/data/` a od té doby
// čte z disku. Manifest poll detekuje nové verze → app nabídne Update.

/** Adresář s lokálním cache datem. Per-user, mimo app bundle. */
function dataCacheDir() {
  return path.join(app.getPath("userData"), "data");
}

function dataCachePath(relPath) {
  // Normalizace + bezpečnostní check — bez path traversal
  const clean = relPath.replace(/^[/\\]+/, "").replace(/\\/g, "/");
  if (clean.includes("..")) throw new Error("invalid path");
  return path.join(dataCacheDir(), clean);
}

ipcMain.handle("data-cache-dir", () => dataCacheDir());

ipcMain.handle("data-has-local", async () => {
  const dir = dataCacheDir();
  try {
    if (!fs.existsSync(dir)) return false;
    const stat = await fs.promises.stat(dir);
    if (!stat.isDirectory()) return false;
    // Příznak že stažení proběhlo do konce = existuje manifest.json
    return fs.existsSync(path.join(dir, "manifest.json"));
  } catch {
    return false;
  }
});

ipcMain.handle("data-read-local", async (_, relPath) => {
  try {
    const full = dataCachePath(relPath);
    return await fs.promises.readFile(full, "utf8");
  } catch {
    return null;
  }
});

ipcMain.handle("data-write-local", async (_, relPath, contents) => {
  try {
    const full = dataCachePath(relPath);
    await fs.promises.mkdir(path.dirname(full), { recursive: true });
    await fs.promises.writeFile(full, contents, "utf8");
    return true;
  } catch (err) {
    console.error("data-write-local failed:", err);
    return false;
  }
});

ipcMain.handle("data-fetch-cloud", async (_, relPath) => {
  // URL-encode po segmentech (kvůli mezerám / diakritice v názvech bible souborů).
  const safe = relPath
    .replace(/^[/\\]+/, "")
    .split("/")
    .map(encodeURIComponent)
    .join("/");
  const url = `${CLOUD_DATA_URL}/${safe}`;
  try {
    const res = await fetch(url);
    if (!res.ok) {
      console.error(`Cloud fetch ${url} failed: ${res.status}`);
      return null;
    }
    return await res.text();
  } catch (err) {
    console.error(`Cloud fetch ${url} threw:`, err);
    return null;
  }
});

ipcMain.handle("data-fetch-manifest", async () => {
  try {
    const res = await fetch(`${CLOUD_DATA_URL}/manifest.json`, {
      cache: "no-cache",
    });
    if (!res.ok) return null;
    return await res.text();
  } catch (err) {
    console.error("manifest fetch failed:", err);
    return null;
  }
});

/** Smaže celý lokální cache (pro "Re-download from scratch" funkci). */
ipcMain.handle("data-clear-local", async () => {
  try {
    await fs.promises.rm(dataCacheDir(), { recursive: true, force: true });
    return true;
  } catch (err) {
    console.error("data-clear-local failed:", err);
    return false;
  }
});

app.whenReady().then(createWindow);
