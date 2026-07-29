
export interface Env {
  DATA_BUCKET: R2Bucket;
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
    "Cache-Control": "public, max-age=60, must-revalidate",
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
  await rebuildManifest(env);
  return corsJson({ ok: true, path, size: body.byteLength });
}

async function rebuildManifest(env: Env): Promise<void> {
  const files: Record<string, { hash: string; size: number }> = {};
  let cursor: string | undefined;
  do {
    const listed = await env.DATA_BUCKET.list({
      prefix: "data/",
      cursor,
      limit: 1000,
    });
    for (const obj of listed.objects) {
      files[obj.key] = {
        hash: obj.etag.replace(/^"|"$/g, ""),
        size: obj.size,
      };
    }
    cursor = listed.truncated ? listed.cursor : undefined;
  } while (cursor);

  const version = new Date()
    .toISOString()
    .slice(0, 19)
    .replace(/[T:]/g, "-");
  const manifest = {
    version,
    generatedAt: new Date().toISOString(),
    files,
  };
  await env.DATA_BUCKET.put(MANIFEST_KEY, JSON.stringify(manifest, null, 2), {
    httpMetadata: { contentType: "application/json" },
  });
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);
    const method = req.method.toUpperCase();

    if (method === "OPTIONS") {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    if (url.pathname === "/manifest.json" && method === "GET") {
      return handleGetManifest(env);
    }

    if (url.pathname.startsWith("/data/")) {
      const key = decodeURIComponent(url.pathname.slice(1));
      if (method === "GET") return handleGetData(env, key);
      if (method === "PUT") return handlePutData(env, req, key);
      return corsText("method not allowed", 405);
    }

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
