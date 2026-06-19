const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("api", {
  ping: () => "pong",
  // ===== Display / HDMI =====
  getDisplays: () => ipcRenderer.invoke("get-displays"),
  openHdmi: (displayId) => ipcRenderer.invoke("open-hdmi", displayId),
  updateHdmi: (html) => ipcRenderer.send("update-hdmi", html),
  closeHdmi: () => ipcRenderer.send("close-hdmi"),
  setHdmiBlackout: (active) => ipcRenderer.send("hdmi-blackout", active),
  openHdmi2: (displayId) => ipcRenderer.invoke("open-hdmi2", displayId),
  updateHdmi2: (html) => ipcRenderer.send("update-hdmi2", html),
  closeHdmi2: () => ipcRenderer.send("close-hdmi2"),
  setHdmi2Blackout: (active) => ipcRenderer.send("hdmi2-blackout", active),

  // ===== Data čtené z lokální cache (nebo bundle fallback) =====
  readSongBook: (book) => ipcRenderer.invoke("read-songbook", book),
  writeSongBook: (book, data) =>
    ipcRenderer.invoke("write-songbook", book, data),
  readBible: (bible) => ipcRenderer.invoke("read-bible", bible),
  readMessageTitles: () => ipcRenderer.invoke("read-message-titles"),
  readMessageText: (dateKey) =>
    ipcRenderer.invoke("read-message-text", dateKey),
  listMessageKeys: () => ipcRenderer.invoke("list-message-keys"),

  // ===== Cloud + local cache management =====
  dataCacheDir: () => ipcRenderer.invoke("data-cache-dir"),
  dataHasLocal: () => ipcRenderer.invoke("data-has-local"),
  dataReadLocal: (relPath) => ipcRenderer.invoke("data-read-local", relPath),
  dataWriteLocal: (relPath, contents) =>
    ipcRenderer.invoke("data-write-local", relPath, contents),
  dataFetchCloud: (relPath) => ipcRenderer.invoke("data-fetch-cloud", relPath),
  dataFetchManifest: () => ipcRenderer.invoke("data-fetch-manifest"),
  dataClearLocal: () => ipcRenderer.invoke("data-clear-local"),
});
