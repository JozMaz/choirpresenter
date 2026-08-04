const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("api", {
  ping: () => "pong",
  getDisplays: () => ipcRenderer.invoke("get-displays"),
  openHdmi: (displayId) => ipcRenderer.invoke("open-hdmi", displayId),
  updateHdmi: (html) => ipcRenderer.send("update-hdmi", html),
  closeHdmi: () => ipcRenderer.send("close-hdmi"),
  setHdmiBlackout: (active) => ipcRenderer.send("hdmi-blackout", active),
  openHdmi2: (displayId) => ipcRenderer.invoke("open-hdmi2", displayId),
  updateHdmi2: (html) => ipcRenderer.send("update-hdmi2", html),
  closeHdmi2: () => ipcRenderer.send("close-hdmi2"),
  setHdmi2Blackout: (active) => ipcRenderer.send("hdmi2-blackout", active),
  setHdmi2Config: (config) => ipcRenderer.send("hdmi2-config", config),

  netStart: (id) => ipcRenderer.invoke("net-start", id),
  netStop: (id) => ipcRenderer.invoke("net-stop", id),
  netStatus: (id) => ipcRenderer.invoke("net-status", id),
  netUpdate: (id, html) => ipcRenderer.send("net-update", id, html),
  netBlackout: (id, active) => ipcRenderer.send("net-blackout", id, active),
  netConfig: (id, config) => ipcRenderer.send("net-config", id, config),
  setOutputStyle: (style) => ipcRenderer.send("output-style", style),
  setHdmiConfig: (variant, config) =>
    ipcRenderer.send("hdmi-set-config", variant, config),

  getAppVersion: () => ipcRenderer.invoke("get-app-version"),

  readSongBook: (book) => ipcRenderer.invoke("read-songbook", book),
  writeSongBook: (book, data) =>
    ipcRenderer.invoke("write-songbook", book, data),
  readBible: (bible) => ipcRenderer.invoke("read-bible", bible),
  readMessageTitles: () => ipcRenderer.invoke("read-message-titles"),
  readMessageText: (dateKey) =>
    ipcRenderer.invoke("read-message-text", dateKey),
  listMessageKeys: () => ipcRenderer.invoke("list-message-keys"),

  dataLocalMode: () => ipcRenderer.invoke("data-local-mode"),
  dataCacheDir: () => ipcRenderer.invoke("data-cache-dir"),
  dataHasLocal: () => ipcRenderer.invoke("data-has-local"),
  dataReadLocal: (relPath) => ipcRenderer.invoke("data-read-local", relPath),
  dataWriteLocal: (relPath, contents) =>
    ipcRenderer.invoke("data-write-local", relPath, contents),
  dataFetchCloud: (relPath) => ipcRenderer.invoke("data-fetch-cloud", relPath),
  dataFetchManifest: () => ipcRenderer.invoke("data-fetch-manifest"),
  dataFetchCatalog: () => ipcRenderer.invoke("data-fetch-catalog"),
  dataHasFiles: (relPaths) => ipcRenderer.invoke("data-has-files", relPaths),
  authWhoami: (token) => ipcRenderer.invoke("auth-whoami", token),
  adminListOrgs: () => ipcRenderer.invoke("admin-list-orgs"),
  adminCreateOrg: (name, role) =>
    ipcRenderer.invoke("admin-create-org", name, role),
  adminPatchOrg: (orgId, patch) =>
    ipcRenderer.invoke("admin-patch-org", orgId, patch),
  adminRotateToken: (orgId) => ipcRenderer.invoke("admin-rotate-token", orgId),
  adminPatchCatalog: (catalog) =>
    ipcRenderer.invoke("admin-patch-catalog", catalog),
  pickJsonFile: () => ipcRenderer.invoke("pick-json-file"),
  dataClearLocal: () => ipcRenderer.invoke("data-clear-local"),
  exportData: (categories, customSongsJson) =>
    ipcRenderer.invoke("export-data", categories, customSongsJson),

  getWriteToken: () => ipcRenderer.invoke("get-write-token"),
  setWriteToken: (token) => ipcRenderer.invoke("set-write-token", token),
});
