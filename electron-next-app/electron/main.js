import {
  app,
  BrowserWindow,
  dialog,
  safeStorage,
  screen,
  shell,
  ipcMain,
} from "electron";
import fs from "fs";
import path from "path";
import vm from "vm";
import { fileURLToPath } from "url";

const CLOUD_DATA_URL =
  process.env.CHOIRPRESENTER_DATA_URL ||
  "https://choirpresenter-data.joz-maz-work.workers.dev";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const HDMI_VIEW = () =>
  app.isPackaged
    ? path.join(__dirname, "..", "out", "hdmi-view.html")
    : path.join(__dirname, "..", "public", "hdmi-view.html");

const API_BASE = path.join(__dirname, "..", "api");

const SONGBOOK_BUNDLE_PATHS = {
  newSong: path.join(API_BASE, "SongBooks", "new-song.json"),
  newSongPlGb: path.join(API_BASE, "SongBooks", "new-song-pl-gb.json"),
  pielgrzym: path.join(API_BASE, "SongBooks", "pielgrzym.json"),
  roboczy: path.join(API_BASE, "SongBooks", "roboczy.json"),
  children: path.join(API_BASE, "SongBooks", "children.json"),
};

const SONGBOOK_CACHE_KEYS = {
  newSong: "data/songs/new-song.json",
  newSongPlGb: "data/songs/new-song-pl-gb.json",
  pielgrzym: "data/songs/pielgrzym.json",
  roboczy: "data/songs/roboczy.json",
  children: "data/songs/children.json",
};

const DATA_EPOCH = 2;

const LOCAL_DATA_MODE =
  process.env.CHOIRPRESENTER_LOCAL_DATA === "1"
    ? true
    : process.env.CHOIRPRESENTER_LOCAL_DATA === "0"
      ? false
      : !app.isPackaged &&
        fs.existsSync(path.join(API_BASE, "SongBooks", "new-song.json"));

let mainWindow = null;
let hdmiWindow = null;
let hdmiWindow2 = null;

const hdmiState = {
  1: { html: null, blackout: true },
  2: { html: null, blackout: true, bg: null },
};

app.setName("ChoirPresenter");

process.on("uncaughtException", (err) => {
  console.error("[uncaught]", err);
});
process.on("unhandledRejection", (reason) => {
  console.error("[unhandled-rejection]", reason);
});

const FETCH_TIMEOUT_MS = 20000;
const PUT_TIMEOUT_MS = 30000;

app.commandLine.appendSwitch("disable-features", "WindowsScrollingFromInactive");
app.commandLine.appendSwitch("disable-renderer-backgrounding");
app.commandLine.appendSwitch("disable-background-timer-throttling");
app.commandLine.appendSwitch("disable-backgrounding-occluded-windows");

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    title: "ChoirPresenter",
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
    },
  });
  mainWindow = win;
  win.on("closed", () => {
    mainWindow = null;
    closeOutputWindows();
  });
  win.webContents.on("render-process-gone", (_, details) => {
    console.error("[main-window] renderer gone:", details.reason);
    if (details.reason !== "clean-exit" && !win.isDestroyed()) {
      win.webContents.reload();
    }
  });

  if (app.isPackaged) {
    win.loadFile(path.join(__dirname, "..", "out", "index.html"));
  } else {
    win.loadURL("http://localhost:3002");
  }
}

function createHdmiWindow(targetBounds) {
  const win = new BrowserWindow({
    x: targetBounds.x,
    y: targetBounds.y,
    width: targetBounds.width,
    height: targetBounds.height,
    frame: false,
    show: false,
    alwaysOnTop: true,
    backgroundColor: "#000000",
    hasShadow: false,
    resizable: false,
    movable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: true,
    skipTaskbar: true,
    focusable: false,
    transparent: false,
    enableLargerThanScreen: true,
    type: process.platform === "darwin" ? "panel" : undefined,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      backgroundThrottling: false,
      offscreen: false,
      disableHtmlFullscreenWindowResize: true,
    },
  });

  win.setAlwaysOnTop(true, "screen-saver", 1);

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

ipcMain.handle("get-displays", () => {
  const displays = screen.getAllDisplays();
  let currentId = null;
  if (mainWindow && !mainWindow.isDestroyed()) {
    currentId = screen.getDisplayMatching(mainWindow.getBounds()).id;
  }
  return displays.map((d) => ({
    id: d.id,
    label: d.label || `Display ${d.id}`,
    bounds: d.bounds,
    primary: d.bounds.x === 0 && d.bounds.y === 0,
    isCurrent: d.id === currentId,
  }));
});

function getHdmiWindow(variant) {
  const win = variant === 2 ? hdmiWindow2 : hdmiWindow;
  return win && !win.isDestroyed() ? win : null;
}

function setHdmiWindow(variant, win) {
  if (variant === 2) hdmiWindow2 = win;
  else hdmiWindow = win;
}

function syncHdmiWindow(variant) {
  const win = getHdmiWindow(variant);
  if (!win) return;
  const state = hdmiState[variant];
  if (state.bg) win.webContents.send("hdmi-config", { bg: state.bg });
  if (state.html !== null) win.webContents.send("hdmi-update", state.html);
  win.webContents.send("hdmi-blackout", state.blackout);
}

function openHdmi(variant, displayId) {
  const existing = getHdmiWindow(variant);
  if (existing) existing.close();

  const displays = screen.getAllDisplays();
  const target = displays.find((d) => d.id === displayId);
  if (!target) return;

  const win = createHdmiWindow(target.bounds);
  setHdmiWindow(variant, win);
  win.loadFile(HDMI_VIEW());

  win.once("ready-to-show", () => {
    win.showInactive();
    if (process.platform === "darwin") {
      win.setSimpleFullScreen(true);
    } else {
      win.setFullScreen(true);
    }
    syncHdmiWindow(variant);
  });

  win.webContents.on("render-process-gone", (_, details) => {
    console.error(`[hdmi${variant}] renderer gone:`, details.reason);
    if (details.reason !== "clean-exit" && !win.isDestroyed()) {
      win.webContents.reload();
    }
  });
  win.webContents.on("did-finish-load", () => syncHdmiWindow(variant));

  win.on("closed", () => {
    if ((variant === 2 ? hdmiWindow2 : hdmiWindow) === win) {
      setHdmiWindow(variant, null);
    }
  });
}

function updateHdmi(variant, html) {
  hdmiState[variant].html = html;
  getHdmiWindow(variant)?.webContents.send("hdmi-update", html);
}

function blackoutHdmi(variant, active) {
  hdmiState[variant].blackout = active;
  getHdmiWindow(variant)?.webContents.send("hdmi-blackout", active);
}

function closeHdmi(variant) {
  getHdmiWindow(variant)?.close();
  setHdmiWindow(variant, null);
}

ipcMain.handle("open-hdmi", (_, displayId) => openHdmi(1, displayId));
ipcMain.on("update-hdmi", (_, html) => updateHdmi(1, html));
ipcMain.on("close-hdmi", () => closeHdmi(1));
ipcMain.on("hdmi-blackout", (_, active) => blackoutHdmi(1, active));

ipcMain.handle("open-hdmi2", (_, displayId) => openHdmi(2, displayId));
ipcMain.on("update-hdmi2", (_, html) => updateHdmi(2, html));
ipcMain.on("close-hdmi2", () => closeHdmi(2));
ipcMain.on("hdmi2-blackout", (_, active) => blackoutHdmi(2, active));

ipcMain.on("hdmi2-config", (_, config) => {
  if (config && typeof config.bg === "string") {
    hdmiState[2].bg = config.bg;
    getHdmiWindow(2)?.webContents.send("hdmi-config", { bg: config.bg });
  }
});

async function readSongbookFile(book) {
  if (LOCAL_DATA_MODE) {
    const target = SONGBOOK_BUNDLE_PATHS[book];
    if (!target || !fs.existsSync(target)) return null;
    return JSON.parse(await fs.promises.readFile(target, "utf8"));
  }
  const cacheKey = SONGBOOK_CACHE_KEYS[book];
  if (cacheKey) {
    try {
      const cached = dataCachePath(cacheKey);
      if (fs.existsSync(cached)) {
        const raw = await fs.promises.readFile(cached, "utf8");
        return JSON.parse(raw);
      }
    } catch (err) {
      console.warn(`Cache read failed for ${book}, falling back to bundle:`, err);
    }
  }
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
  const cacheKey = BIBLE_CACHE_KEYS[bible];
  if (cacheKey) {
    const cached = dataCachePath(cacheKey);
    if (fs.existsSync(cached)) {
      return fs.promises.readFile(cached, "utf8");
    }
  }
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

ipcMain.handle("read-message-titles", async () => {
  try {
    const cached = dataCachePath("data/messages/titles.json");
    if (fs.existsSync(cached)) {
      const raw = await fs.promises.readFile(cached, "utf8");
      return JSON.parse(raw);
    }
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

ipcMain.handle("read-message-text", async (_, dateKey) => {
  if (!/^[\w-]+$/.test(String(dateKey || ""))) return null;
  try {
    const cached = dataCachePath(`data/messages/texts/${dateKey}.json`);
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

ipcMain.handle("list-message-keys", async () => {
  const result = [];
  const cacheDir = dataCachePath("data/messages/texts");
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
  const cacheKey = SONGBOOK_CACHE_KEYS[book];
  if (!cacheKey) return { localOk: false, cloudOk: null };

  const body = JSON.stringify(data, null, 2);
  const newCount = Array.isArray(data?.songs) ? data.songs.length : 0;

  if (LOCAL_DATA_MODE) {
    const target = SONGBOOK_BUNDLE_PATHS[book];
    try {
      if (fs.existsSync(target)) {
        const existing = JSON.parse(await fs.promises.readFile(target, "utf8"));
        const existingCount = Array.isArray(existing?.songs)
          ? existing.songs.length
          : 0;
        if (existingCount >= 10 && newCount * 10 <= existingCount) {
          console.error(
            `[write-songbook] REFUSED (local mode): existing ${existingCount}, new ${newCount}`,
          );
          return { localOk: false, cloudOk: null, refused: true };
        }
      }
      await fs.promises.writeFile(target, body + "\n", "utf8");
      console.log(`[write-songbook] local mode → ${target}`);
      return { localOk: true, cloudOk: null };
    } catch (err) {
      console.error("Local-mode write failed:", err);
      return { localOk: false, cloudOk: null };
    }
  }

  let localOk = false;
  try {
    const localPath = dataCachePath(cacheKey);
    if (fs.existsSync(localPath)) {
      try {
        const existingRaw = await fs.promises.readFile(localPath, "utf8");
        const existing = JSON.parse(existingRaw);
        const existingCount = Array.isArray(existing?.songs)
          ? existing.songs.length
          : 0;
        if (existingCount >= 10 && newCount * 10 <= existingCount) {
          console.error(
            `[write-songbook] REFUSED: existing has ${existingCount} songs, new has only ${newCount}. Likely a bug — keeping existing file untouched. Backup created.`,
          );
          const backupPath = `${localPath}.attempted-${Date.now()}.json`;
          await fs.promises.writeFile(backupPath, body, "utf8");
          return { localOk: false, cloudOk: null, refused: true };
        }
      } catch {
      }
    }
    await fs.promises.mkdir(path.dirname(localPath), { recursive: true });
    await fs.promises.writeFile(localPath, body, "utf8");
    localOk = true;
  } catch (err) {
    console.error("Local write failed:", err);
  }

  let cloudOk = null;
  const token = await readWriteTokenFromDisk();
  if (token) {
    try {
      const safe = cacheKey.split("/").map(encodeURIComponent).join("/");
      const res = await fetch(`${CLOUD_DATA_URL}/${safe}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body,
        signal: AbortSignal.timeout(PUT_TIMEOUT_MS),
      });
      cloudOk = res.ok;
      if (!res.ok) {
        console.error(`Cloud PUT failed: ${res.status} ${await res.text()}`);
      }
    } catch (err) {
      console.error("Cloud PUT threw:", err);
      cloudOk = false;
    }
  }

  return { localOk, cloudOk };
});

const CONFIG_PATH = () => path.join(app.getPath("userData"), "config.json");

async function readConfig() {
  try {
    if (!fs.existsSync(CONFIG_PATH())) return {};
    return JSON.parse(await fs.promises.readFile(CONFIG_PATH(), "utf8"));
  } catch {
    return {};
  }
}

async function writeConfig(cfg) {
  await fs.promises.writeFile(
    CONFIG_PATH(),
    JSON.stringify(cfg, null, 2),
    "utf8",
  );
}

function canEncrypt() {
  try {
    return safeStorage.isEncryptionAvailable();
  } catch {
    return false;
  }
}

async function readWriteTokenFromDisk() {
  const cfg = await readConfig();

  if (typeof cfg.tokenEnc === "string" && cfg.tokenEnc && canEncrypt()) {
    try {
      return safeStorage.decryptString(Buffer.from(cfg.tokenEnc, "base64"));
    } catch (err) {
      console.error("Token decryption failed:", err);
      return null;
    }
  }

  if (typeof cfg.writeToken === "string" && cfg.writeToken) {
    await writeWriteTokenToDisk(cfg.writeToken);
    return cfg.writeToken;
  }

  return null;
}

async function writeWriteTokenToDisk(token) {
  const cfg = await readConfig();
  delete cfg.writeToken;
  delete cfg.tokenEnc;

  if (token) {
    if (canEncrypt()) {
      cfg.tokenEnc = safeStorage.encryptString(token).toString("base64");
    } else {
      cfg.writeToken = token;
    }
  }
  await writeConfig(cfg);
}

ipcMain.handle("get-write-token", async () => {
  return await readWriteTokenFromDisk();
});

ipcMain.handle("set-write-token", async (_, token) => {
  try {
    await writeWriteTokenToDisk(token || "");
    return true;
  } catch (err) {
    console.error("set-write-token failed:", err);
    return false;
  }
});

ipcMain.handle("auth-whoami", async (_, candidate) => {
  const token = candidate || (await readWriteTokenFromDisk());
  if (!token) return { ok: false, status: 401 };
  try {
    const res = await fetch(`${CLOUD_DATA_URL}/auth/whoami`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!res.ok) return { ok: false, status: res.status };
    return { ok: true, identity: await res.json() };
  } catch (err) {
    console.error("whoami failed:", err);
    return { ok: false, status: 0, offline: true };
  }
});

async function adminRequest(pathname, method = "GET", body = null) {
  const token = await readWriteTokenFromDisk();
  if (!token) return { ok: false, status: 401, error: "No token stored" };
  try {
    const res = await fetch(`${CLOUD_DATA_URL}${pathname}`, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        ...(body ? { "Content-Type": "application/json" } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
      cache: "no-store",
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    const text = await res.text();
    if (!res.ok) return { ok: false, status: res.status, error: text };
    return { ok: true, data: text ? JSON.parse(text) : null };
  } catch (err) {
    console.error(`admin ${method} ${pathname} failed:`, err);
    return { ok: false, status: 0, error: String(err?.message || err) };
  }
}

ipcMain.handle("admin-list-orgs", () => adminRequest("/admin/orgs"));

ipcMain.handle("admin-create-org", (_, name, role) =>
  adminRequest("/admin/orgs", "POST", { name, role: role || "org" }),
);

ipcMain.handle("admin-patch-org", (_, orgId, patch) =>
  adminRequest(`/admin/orgs/${encodeURIComponent(orgId)}`, "PATCH", patch || {}),
);

ipcMain.handle("admin-rotate-token", (_, orgId) =>
  adminRequest(`/admin/orgs/${encodeURIComponent(orgId)}/token`, "POST", {}),
);

ipcMain.handle("admin-patch-catalog", (_, catalog) =>
  adminRequest("/admin/catalog", "PATCH", catalog),
);

ipcMain.handle("pick-json-file", async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: "Pick a songbook JSON",
    properties: ["openFile"],
    filters: [{ name: "JSON", extensions: ["json"] }],
  });
  if (result.canceled || result.filePaths.length === 0) return null;
  try {
    const file = result.filePaths[0];
    return {
      name: path.basename(file),
      contents: await fs.promises.readFile(file, "utf8"),
    };
  } catch (err) {
    console.error("pick-json-file failed:", err);
    return null;
  }
});

ipcMain.handle("data-fetch-catalog", async () => {
  try {
    const res = await fetch(`${CLOUD_DATA_URL}/catalog.json?_t=${Date.now()}`, {
      cache: "no-store",
      headers: { "Cache-Control": "no-cache", Pragma: "no-cache" },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!res.ok) return null;
    return await res.text();
  } catch (err) {
    console.error("catalog fetch failed:", err);
    return null;
  }
});

function dataCacheDir() {
  return path.join(app.getPath("userData"), "data");
}

function dataCachePath(relPath) {
  const clean = String(relPath)
    .replace(/^[/\\]+/, "")
    .replace(/\\/g, "/")
    .normalize("NFC");
  if (clean.includes("..")) throw new Error("invalid path");
  return path.join(dataCacheDir(), clean);
}

ipcMain.handle("get-app-version", () => app.getVersion());

ipcMain.handle("data-local-mode", () => LOCAL_DATA_MODE);
ipcMain.handle("data-cache-dir", () => dataCacheDir());

ipcMain.handle("data-has-local", async () => {
  const dir = dataCacheDir();
  try {
    if (!fs.existsSync(dir)) return false;
    const stat = await fs.promises.stat(dir);
    if (!stat.isDirectory()) return false;
    const manifestPath = path.join(dir, "manifest.json");
    if (!fs.existsSync(manifestPath)) return false;

    const manifest = JSON.parse(await fs.promises.readFile(manifestPath, "utf8"));
    const keys = Object.keys(manifest?.files || {});
    if (keys.length === 0) return false;
    const missing = keys.filter((k) => !fs.existsSync(dataCachePath(k)));
    if (missing.length > 0) {
      console.warn(
        `[data-cache] ${missing.length}/${keys.length} files missing (e.g. ${missing[0]}) — re-downloading`,
      );
      return false;
    }
    return true;
  } catch (err) {
    console.error("[data-cache] integrity check failed:", err);
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

ipcMain.handle("data-has-files", async (_, relPaths) => {
  const list = Array.isArray(relPaths) ? relPaths : [];
  return list.map((relPath) => {
    try {
      return fs.existsSync(dataCachePath(relPath));
    } catch {
      return false;
    }
  });
});

ipcMain.handle("data-fetch-cloud", async (_, relPath) => {
  const safe = relPath
    .replace(/^[/\\]+/, "")
    .split("/")
    .map(encodeURIComponent)
    .join("/");
  const url = `${CLOUD_DATA_URL}/${safe}?_t=${Date.now()}`;
  try {
    const res = await fetch(url, {
      cache: "no-store",
      headers: { "Cache-Control": "no-cache", Pragma: "no-cache" },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
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
    const url = `${CLOUD_DATA_URL}/manifest.json?_t=${Date.now()}`;
    const res = await fetch(url, {
      cache: "no-store",
      headers: { "Cache-Control": "no-cache", Pragma: "no-cache" },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!res.ok) return null;
    return await res.text();
  } catch (err) {
    console.error("manifest fetch failed:", err);
    return null;
  }
});

const EXPORT_CATEGORIES = {
  songs: "data/songs",
  bibles: "data/bibles",
  messages: "data/messages",
};

async function countFilesRecursive(dir) {
  let count = 0;
  const entries = await fs.promises.readdir(dir, { withFileTypes: true });
  for (const e of entries) {
    if (e.isDirectory()) {
      count += await countFilesRecursive(path.join(dir, e.name));
    } else {
      count++;
    }
  }
  return count;
}

ipcMain.handle("export-data", async (_, categories, customSongsJson) => {
  const cats = (Array.isArray(categories) ? categories : []).filter(
    (c) => EXPORT_CATEGORIES[c],
  );
  if (cats.length === 0) return { ok: false, error: "Nothing selected." };

  const cacheDir = dataCacheDir();
  const available = cats.filter((c) =>
    fs.existsSync(path.join(cacheDir, EXPORT_CATEGORIES[c])),
  );
  if (available.length === 0) {
    return { ok: false, error: "No local data to export yet." };
  }

  const res = await dialog.showOpenDialog(mainWindow ?? undefined, {
    title: "Choose backup destination",
    defaultPath: app.getPath("downloads"),
    buttonLabel: "Export here",
    properties: ["openDirectory", "createDirectory"],
  });
  if (res.canceled || !res.filePaths[0]) return { canceled: true };

  const now = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  const stamp = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}`;
  const suffix = available.length === 3 ? "all" : available.join("-");
  const target = path.join(
    res.filePaths[0],
    `ChoirPresenter-backup-${stamp}-${suffix}`,
  );

  try {
    let files = 0;
    for (const c of available) {
      const src = path.join(cacheDir, EXPORT_CATEGORIES[c]);
      const dst = path.join(target, EXPORT_CATEGORIES[c]);
      await fs.promises.cp(src, dst, { recursive: true });
      files += await countFilesRecursive(dst);
    }
    if (available.length === 3) {
      const manifest = path.join(cacheDir, "manifest.json");
      if (fs.existsSync(manifest)) {
        await fs.promises.copyFile(
          manifest,
          path.join(target, "manifest.json"),
        );
        files++;
      }
    }
    if (available.includes("songs") && typeof customSongsJson === "string") {
      await fs.promises.writeFile(
        path.join(target, "my-songs.json"),
        customSongsJson,
        "utf8",
      );
      files++;
    }
    shell.showItemInFolder(target);
    return { ok: true, path: target, files };
  } catch (err) {
    console.error("export-data failed:", err);
    return { ok: false, error: String(err?.message || err) };
  }
});

ipcMain.handle("data-clear-local", async () => {
  try {
    await fs.promises.rm(dataCacheDir(), { recursive: true, force: true });
    return true;
  } catch (err) {
    console.error("data-clear-local failed:", err);
    return false;
  }
});

function outputWindows() {
  return [hdmiWindow, hdmiWindow2].filter((w) => w && !w.isDestroyed());
}

function pinOutputs(pinned) {
  for (const w of outputWindows()) {
    if (pinned) {
      w.setAlwaysOnTop(true, "screen-saver", 1);
      w.moveTop();
    } else {
      w.setAlwaysOnTop(false);
    }
  }
}

let unpinTimer = null;

app.on("browser-window-focus", () => {
  if (unpinTimer) {
    clearTimeout(unpinTimer);
    unpinTimer = null;
  }
  pinOutputs(true);
});

app.on("browser-window-blur", () => {
  if (unpinTimer) clearTimeout(unpinTimer);
  unpinTimer = setTimeout(() => {
    unpinTimer = null;
    const ours = BrowserWindow.getAllWindows().some(
      (w) => !w.isDestroyed() && w.isFocused(),
    );
    if (!ours) pinOutputs(false);
  }, 250);
});

function closeOutputWindows() {
  if (unpinTimer) {
    clearTimeout(unpinTimer);
    unpinTimer = null;
  }
  for (const w of [hdmiWindow, hdmiWindow2]) {
    if (w && !w.isDestroyed()) w.destroy();
  }
  hdmiWindow = null;
  hdmiWindow2 = null;
}

app.on("before-quit", closeOutputWindows);

app.on("window-all-closed", () => {
  app.quit();
});

async function migrateDataEpoch() {
  let cfg = {};
  try {
    if (fs.existsSync(CONFIG_PATH())) {
      cfg = JSON.parse(await fs.promises.readFile(CONFIG_PATH(), "utf8"));
    }
  } catch {
    cfg = {};
  }
  if (cfg.dataEpoch === DATA_EPOCH) return;
  if (LOCAL_DATA_MODE) {
    console.log("[data-epoch] local data mode — cache left untouched");
    return;
  }

  try {
    await fs.promises.rm(dataCachePath("manifest.json"), {
      force: true,
    });
  } catch (err) {
    console.error("[data-epoch] manifest removal failed:", err);
    return;
  }

  let wiped = true;
  try {
    await fs.promises.rm(dataCacheDir(), { recursive: true, force: true });
    console.log(
      `[data-epoch] cache wiped (${cfg.dataEpoch ?? "none"} -> ${DATA_EPOCH})`,
    );
  } catch (err) {
    wiped = false;
    console.error("[data-epoch] cache wipe failed, will retry on next start:", err);
  }

  if (!wiped) return;

  try {
    await fs.promises.writeFile(
      CONFIG_PATH(),
      JSON.stringify({ ...cfg, dataEpoch: DATA_EPOCH }, null, 2),
      "utf8",
    );
  } catch (err) {
    console.error("[data-epoch] config write failed:", err);
  }
}

app.whenReady().then(async () => {
  await migrateDataEpoch();
  createWindow();
});
