/**
 * ChoirPresenter data worker.
 *
 * Routes:
 *   GET  /manifest.json       → veřejně, poslední verze + hash per soubor
 *   GET  /data/*              → veřejně, jeden datový JSON z R2
 *   PUT  /data/songs/*        → s Bearer tokenem (Phase 2), zapíše do R2
 *   OPTIONS *                 → CORS preflight
 *
 * R2 layout:
 *   manifest.json
 *   data/bibles/{key}.json
 *   data/messages/titles.json
 *   data/messages/texts/{date}.json
 *   data/songs/{book}-converted.json
 */

export interface Env {
  DATA_BUCKET: R2Bucket;
  /** Csv tokenů s write přístupem. Pokud není set, PUT je zablokovaný. */
  WRITE_TOKENS?: string;
  API_VERSION: string;
}

const ALLOWED_PUT_PREFIX = "data/songs/";
const ALLOWED_GET_PREFIX = "data/";
const MANIFEST_KEY = "manifest.json";

const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, PUT, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Max-Age": "86400",
};

function corsJson(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...CORS_HEADERS,
    },
  });
}

function corsText(body: string, status = 200): Response {
  return new Response(body, {
    status,
    headers: { "Content-Type": "text/plain", ...CORS_HEADERS },
  });
}

async function handleGetManifest(env: Env): Promise<Response> {
  const obj = await env.DATA_BUCKET.get(MANIFEST_KEY);
  if (!obj) return corsJson({ error: "manifest not uploaded yet" }, 404);
  const text = await obj.text();
  return new Response(text, {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-cache",
      "X-Api-Version": env.API_VERSION,
      ...CORS_HEADERS,
    },
  });
}

async function handleGetData(env: Env, path: string): Promise<Response> {
  if (!path.startsWith(ALLOWED_GET_PREFIX)) {
    return corsText("forbidden", 403);
  }
  const obj = await env.DATA_BUCKET.get(path);
  if (!obj) return corsText("not found", 404);

  const headers: Record<string, string> = {
    "Content-Type": obj.httpMetadata?.contentType ?? "application/json",
    // 1 hour edge cache + revalidation via etag. Client (Electron) ale stejně
    // už komparuje hash z manifestu, takže cache hit je bonus, ne závislost.
    "Cache-Control": "public, max-age=3600",
    ETag: obj.httpEtag,
    ...CORS_HEADERS,
  };
  return new Response(obj.body, { status: 200, headers });
}

function isAuthorized(req: Request, env: Env): boolean {
  if (!env.WRITE_TOKENS) return false;
  const header = req.headers.get("Authorization") || "";
  const m = header.match(/^Bearer\s+(\S+)$/);
  if (!m) return false;
  const provided = m[1];
  const allowed = env.WRITE_TOKENS.split(",").map((t) => t.trim()).filter(Boolean);
  return allowed.includes(provided);
}

async function handlePutData(
  env: Env,
  req: Request,
  path: string,
): Promise<Response> {
  if (!path.startsWith(ALLOWED_PUT_PREFIX)) {
    return corsText(`PUT only allowed under /${ALLOWED_PUT_PREFIX}`, 403);
  }
  if (!isAuthorized(req, env)) {
    return corsText("unauthorized", 401);
  }
  const contentType = req.headers.get("Content-Type") || "application/json";
  const body = await req.arrayBuffer();
  await env.DATA_BUCKET.put(path, body, {
    httpMetadata: { contentType },
  });
  return corsJson({ ok: true, path, size: body.byteLength });
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);
    const method = req.method.toUpperCase();

    if (method === "OPTIONS") {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    // /manifest.json
    if (url.pathname === "/manifest.json" && method === "GET") {
      return handleGetManifest(env);
    }

    // /data/*
    if (url.pathname.startsWith("/data/")) {
      // URL-decode pro názvy se mezerami / diakritikou (bible mají oba)
      const key = decodeURIComponent(url.pathname.slice(1));
      if (method === "GET") return handleGetData(env, key);
      if (method === "PUT") return handlePutData(env, req, key);
      return corsText("method not allowed", 405);
    }

    // Root health-check.
    if (url.pathname === "/" || url.pathname === "") {
      return corsJson({
        service: "choirpresenter-data",
        apiVersion: env.API_VERSION,
        endpoints: [
          "GET /manifest.json",
          "GET /data/{path}",
          "PUT /data/songs/{path}  (auth)",
        ],
      });
    }

    return corsText("not found", 404);
  },
} satisfies ExportedHandler<Env>;
