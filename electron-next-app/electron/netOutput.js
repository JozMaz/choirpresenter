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

const PORT_STRIDE = 10;

const instances = new Map();

function instanceFor(id) {
  let inst = instances.get(id);
  if (!inst) {
    inst = {
      server: null,
      activePort: null,
      heartbeat: null,
      clients: new Set(),
      state: { html: "", blackout: true, config: { edgeFade: 0 } },
    };
    instances.set(id, inst);
  }
  return inst;
}

function portOffset(id) {
  const index = Number(String(id).replace(/\D/g, "")) - 1;
  return Number.isFinite(index) && index > 0 ? index * PORT_STRIDE : 0;
}

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

function broadcast(inst, event, data) {
  const payload = frame(event, data);
  for (const res of inst.clients) {
    try {
      res.write(payload);
    } catch {
      inst.clients.delete(res);
    }
  }
}

export function pushHtml(id, html) {
  const inst = instanceFor(id);
  if (html === inst.state.html) return;
  inst.state.html = html;
  broadcast(inst, "html", html);
}

export function pushBlackout(id, active) {
  const inst = instanceFor(id);
  if (active === inst.state.blackout) return;
  inst.state.blackout = active;
  broadcast(inst, "blackout", active);
}

export function pushConfig(id, config) {
  const inst = instanceFor(id);
  const next = { ...inst.state.config, ...config };
  if (JSON.stringify(next) === JSON.stringify(inst.state.config)) return;
  inst.state.config = next;
  broadcast(inst, "config", next);
}

export function pushConfigAll(config) {
  for (const id of instances.keys()) pushConfig(id, config);
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

function openStream(inst, req, res) {
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-store",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
    "Access-Control-Allow-Origin": "*",
  });
  res.write("retry: 1000\n\n");
  res.write(frame("config", inst.state.config));
  res.write(frame("html", inst.state.html));
  res.write(frame("blackout", inst.state.blackout));
  inst.clients.add(res);
  req.on("close", () => inst.clients.delete(res));
}

function listen(inst, port, root) {
  return new Promise((resolve) => {
    const srv = http.createServer((req, res) => {
      const url = new URL(req.url ?? "/", "http://localhost");
      if (url.pathname === "/events") {
        openStream(inst, req, res);
        return;
      }
      if (url.pathname === "/" || url.pathname === "/index.html") {
        serveFile(res, root, "hdmi-view.html");
        return;
      }
      serveFile(res, root, decodeURIComponent(url.pathname).replace(/^\/+/, ""));
    });

    srv.requestTimeout = 0;
    srv.headersTimeout = 0;
    srv.keepAliveTimeout = 0;

    srv.once("error", (err) => resolve({ ok: false, error: err.code }));
    srv.listen(port, "0.0.0.0", () => resolve({ ok: true, server: srv }));
  });
}

export async function start(id, basePort, root) {
  const inst = instanceFor(id);
  if (inst.server) return status(id);

  const taken = new Set(
    [...instances.values()].map((i) => i.activePort).filter(Boolean),
  );
  const from = basePort + portOffset(id);

  let lastError = "EADDRINUSE";
  for (let port = from; port < from + 5; port++) {
    if (taken.has(port)) continue;
    const result = await listen(inst, port, root);
    if (result.ok) {
      inst.server = result.server;
      inst.activePort = port;
      inst.heartbeat = setInterval(() => {
        for (const res of inst.clients) {
          try {
            res.write(": ping\n\n");
          } catch {
            inst.clients.delete(res);
          }
        }
      }, HEARTBEAT_MS);
      return status(id);
    }
    lastError = result.error;
    if (lastError !== "EADDRINUSE") break;
  }
  return { ...status(id), error: lastError };
}

export function stop(id) {
  const inst = instanceFor(id);
  if (inst.heartbeat) clearInterval(inst.heartbeat);
  inst.heartbeat = null;
  for (const res of inst.clients) {
    try {
      res.end();
    } catch {
      /* already gone */
    }
  }
  inst.clients.clear();
  inst.server?.close();
  inst.server = null;
  inst.activePort = null;
  return status(id);
}

export function stopAll() {
  for (const id of instances.keys()) stop(id);
}

export function status(id) {
  const inst = instanceFor(id);
  return {
    running: inst.server !== null,
    port: inst.activePort,
    addresses: localAddresses(),
  };
}
