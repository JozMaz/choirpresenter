import fs from "fs";
import http from "http";
import os from "os";
import path from "path";

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".otf": "font/otf",
};

const HEARTBEAT_MS = 15000;

let server = null;
let activePort = null;
let heartbeat = null;
const clients = new Set();
const state = { html: "", blackout: true, config: { edgeFade: 0 } };

function addressRank(ip) {
  if (ip.startsWith("192.168.")) return 0;
  if (ip.startsWith("10.")) return 1;
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(ip)) return 2;
  return 3;
}

export function localAddresses() {
  const found = [];
  const seen = new Set();
  for (const [name, list] of Object.entries(os.networkInterfaces())) {
    for (const ni of list ?? []) {
      if (ni.family !== "IPv4" || ni.internal) continue;
      if (ni.address.startsWith("169.254.")) continue;
      if (seen.has(ni.address)) continue;
      seen.add(ni.address);
      found.push({ address: ni.address, name });
    }
  }
  return found.sort((a, b) => addressRank(a.address) - addressRank(b.address));
}

const frame = (event, data) =>
  `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;

function broadcast(event, data) {
  const payload = frame(event, data);
  for (const res of clients) {
    try {
      res.write(payload);
    } catch {
      clients.delete(res);
    }
  }
}

export function pushHtml(html) {
  if (html === state.html) return;
  state.html = html;
  broadcast("html", html);
}

export function pushBlackout(active) {
  if (active === state.blackout) return;
  state.blackout = active;
  broadcast("blackout", active);
}

export function pushConfig(config) {
  const next = { ...state.config, ...config };
  if (JSON.stringify(next) === JSON.stringify(state.config)) return;
  state.config = next;
  broadcast("config", next);
}

function serveFile(res, root, relPath) {
  const full = path.normalize(path.join(root, relPath));
  if (!full.startsWith(path.normalize(root))) {
    res.writeHead(403).end();
    return;
  }
  fs.readFile(full, (err, buf) => {
    if (err) {
      res.writeHead(404).end();
      return;
    }
    res.writeHead(200, {
      "Content-Type":
        MIME[path.extname(full).toLowerCase()] ?? "application/octet-stream",
      "Cache-Control": "no-store",
      "Access-Control-Allow-Origin": "*",
    });
    res.end(buf);
  });
}

function openStream(req, res) {
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-store",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
    "Access-Control-Allow-Origin": "*",
  });
  res.write("retry: 1000\n\n");
  res.write(frame("config", state.config));
  res.write(frame("html", state.html));
  res.write(frame("blackout", state.blackout));
  clients.add(res);
  req.on("close", () => clients.delete(res));
}

function listen(port, root) {
  return new Promise((resolve) => {
    const srv = http.createServer((req, res) => {
      const url = new URL(req.url ?? "/", "http://localhost");
      if (url.pathname === "/events") {
        openStream(req, res);
        return;
      }
      if (url.pathname === "/" || url.pathname === "/index.html") {
        serveFile(res, root, "hdmi-view.html");
        return;
      }
      serveFile(
        res,
        root,
        decodeURIComponent(url.pathname).replace(/^\/+/, ""),
      );
    });

    srv.requestTimeout = 0;
    srv.headersTimeout = 0;
    srv.keepAliveTimeout = 0;

    srv.once("error", (err) => resolve({ ok: false, error: err.code }));
    srv.listen(port, "0.0.0.0", () => resolve({ ok: true, server: srv }));
  });
}

export async function start(basePort, root) {
  if (server) return status();

  let lastError = "EADDRINUSE";
  for (let port = basePort; port < basePort + 5; port++) {
    const result = await listen(port, root);
    if (result.ok) {
      server = result.server;
      activePort = port;
      heartbeat = setInterval(() => {
        for (const res of clients) {
          try {
            res.write(": ping\n\n");
          } catch {
            clients.delete(res);
          }
        }
      }, HEARTBEAT_MS);
      return status();
    }
    lastError = result.error;
    if (lastError !== "EADDRINUSE") break;
  }
  return { ...status(), error: lastError };
}

export function stop() {
  if (heartbeat) clearInterval(heartbeat);
  heartbeat = null;
  for (const res of clients) {
    try {
      res.end();
    } catch {
      /* already gone */
    }
  }
  clients.clear();
  server?.close();
  server = null;
  activePort = null;
  return status();
}

export function status() {
  return {
    running: server !== null,
    port: activePort,
    addresses: localAddresses(),
  };
}
