export interface Env {
  DATA_BUCKET: R2Bucket;
  TOKENS: KVNamespace;
  WRITE_TOKENS?: string;
  API_VERSION: string;
}

export type Role = "admin" | "org";

export interface TokenRecord {
  orgId: string;
  name: string;
  role: Role;
  tokenHash: string;
  createdAt: string;
  revokedAt: string | null;
}

const ALLOWED_PUT_PREFIX = "data/songs/";
const ALLOWED_GET_PREFIX = "data/";
const MANIFEST_KEY = "manifest.json";
const CATALOG_KEY = "catalog.json";

const EMPTY_CATALOG = {
  version: "0",
  songbooks: [] as unknown[],
  bibles: [] as unknown[],
  messages: { count: 0, sizeMb: 0 },
};

const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, PUT, POST, PATCH, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Max-Age": "86400",
};

function corsJson(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...CORS_HEADERS },
  });
}

function corsText(body: string, status = 200): Response {
  return new Response(body, {
    status,
    headers: { "Content-Type": "text/plain", ...CORS_HEADERS },
  });
}

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value),
  );
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function bearerToken(req: Request): string | null {
  const m = (req.headers.get("Authorization") || "").match(/^Bearer\s+(\S+)$/);
  return m ? m[1] : null;
}

function legacyAdmin(token: string, env: Env): TokenRecord | null {
  if (!env.WRITE_TOKENS) return null;
  const allowed = env.WRITE_TOKENS.split(",")
    .map((t) => t.trim())
    .filter(Boolean);
  if (!allowed.includes(token)) return null;
  return {
    orgId: "legacy",
    name: "Legacy write token",
    role: "admin",
    tokenHash: "",
    createdAt: "",
    revokedAt: null,
  };
}

async function identify(req: Request, env: Env): Promise<TokenRecord | null> {
  const token = bearerToken(req);
  if (!token) return null;

  if (env.TOKENS) {
    const raw = await env.TOKENS.get(`token:${await sha256Hex(token)}`);
    if (raw) {
      const record = JSON.parse(raw) as TokenRecord;
      return record.revokedAt ? null : record;
    }
  }
  return legacyAdmin(token, env);
}

async function handleGetManifest(env: Env): Promise<Response> {
  const obj = await env.DATA_BUCKET.get(MANIFEST_KEY);
  if (!obj) return corsJson({ error: "manifest not uploaded yet" }, 404);
  return new Response(obj.body, {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-cache",
      "X-Api-Version": env.API_VERSION,
      ...CORS_HEADERS,
    },
  });
}

async function handleGetCatalog(env: Env): Promise<Response> {
  const obj = await env.DATA_BUCKET.get(CATALOG_KEY);
  if (!obj) return corsJson(EMPTY_CATALOG);
  return new Response(obj.body, {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-cache",
      ...CORS_HEADERS,
    },
  });
}

async function handleGetData(env: Env, path: string): Promise<Response> {
  if (!path.startsWith(ALLOWED_GET_PREFIX)) return corsText("forbidden", 403);
  const obj = await env.DATA_BUCKET.get(path);
  if (!obj) return corsText("not found", 404);
  return new Response(obj.body, {
    status: 200,
    headers: {
      "Content-Type": obj.httpMetadata?.contentType ?? "application/json",
      "Cache-Control": "public, max-age=60, must-revalidate",
      ETag: obj.httpEtag,
      ...CORS_HEADERS,
    },
  });
}

async function handlePutData(
  env: Env,
  req: Request,
  path: string,
): Promise<Response> {
  if (!path.startsWith(ALLOWED_PUT_PREFIX)) {
    return corsText(`PUT only allowed under /${ALLOWED_PUT_PREFIX}`, 403);
  }
  const caller = await identify(req, env);
  if (!caller) return corsText("unauthorized", 401);
  if (caller.role !== "admin") {
    return corsText("only the admin may publish songbooks", 403);
  }

  const contentType = req.headers.get("Content-Type") || "application/json";
  const body = await req.arrayBuffer();
  await env.DATA_BUCKET.put(path, body, { httpMetadata: { contentType } });
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
      files[obj.key] = { hash: obj.etag.replace(/^"|"$/g, ""), size: obj.size };
    }
    cursor = listed.truncated ? listed.cursor : undefined;
  } while (cursor);

  const version = new Date().toISOString().slice(0, 19).replace(/[T:]/g, "-");
  await env.DATA_BUCKET.put(
    MANIFEST_KEY,
    JSON.stringify({ version, generatedAt: new Date().toISOString(), files }, null, 2),
    { httpMetadata: { contentType: "application/json" } },
  );
}

async function requireAdmin(
  req: Request,
  env: Env,
): Promise<{ caller: TokenRecord } | Response> {
  const caller = await identify(req, env);
  if (!caller) return corsText("unauthorized", 401);
  if (caller.role !== "admin") return corsText("forbidden", 403);
  if (!env.TOKENS) return corsText("token registry not configured", 503);
  return { caller };
}

async function listOrgs(env: Env): Promise<TokenRecord[]> {
  const orgs: TokenRecord[] = [];
  let cursor: string | undefined;
  for (;;) {
    const page = await env.TOKENS.list({ prefix: "org:", cursor });
    for (const key of page.keys) {
      const raw = await env.TOKENS.get(key.name);
      if (raw) orgs.push(JSON.parse(raw) as TokenRecord);
    }
    if (page.list_complete) break;
    cursor = page.cursor;
  }
  return orgs.sort((a, b) => a.name.localeCompare(b.name));
}

function publicOrg(record: TokenRecord) {
  return {
    orgId: record.orgId,
    name: record.name,
    role: record.role,
    createdAt: record.createdAt,
    revokedAt: record.revokedAt,
  };
}

function randomToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(24));
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function handleCreateOrg(env: Env, req: Request): Promise<Response> {
  const body = (await req.json().catch(() => null)) as {
    name?: string;
    role?: Role;
  } | null;
  const name = body?.name?.trim();
  if (!name) return corsJson({ error: "name is required" }, 400);
  const role: Role = body?.role === "admin" ? "admin" : "org";

  const token = randomToken();
  const tokenHash = await sha256Hex(token);
  const record: TokenRecord = {
    orgId: `org_${randomToken().slice(0, 8)}`,
    name,
    role,
    tokenHash,
    createdAt: new Date().toISOString(),
    revokedAt: null,
  };

  await env.TOKENS.put(`token:${tokenHash}`, JSON.stringify(record));
  await env.TOKENS.put(`org:${record.orgId}`, JSON.stringify(record));

  return corsJson({ org: publicOrg(record), token });
}

async function handlePatchOrg(
  env: Env,
  req: Request,
  orgId: string,
): Promise<Response> {
  const raw = await env.TOKENS.get(`org:${orgId}`);
  if (!raw) return corsJson({ error: "unknown organization" }, 404);
  const record = JSON.parse(raw) as TokenRecord;

  const body = (await req.json().catch(() => null)) as {
    name?: string;
    revoked?: boolean;
  } | null;
  if (!body) return corsJson({ error: "invalid body" }, 400);

  if (typeof body.name === "string" && body.name.trim()) {
    record.name = body.name.trim();
  }
  if (typeof body.revoked === "boolean") {
    record.revokedAt = body.revoked ? new Date().toISOString() : null;
  }

  await env.TOKENS.put(`org:${orgId}`, JSON.stringify(record));
  if (record.tokenHash) {
    await env.TOKENS.put(`token:${record.tokenHash}`, JSON.stringify(record));
  }
  return corsJson({ org: publicOrg(record) });
}

async function handlePatchCatalog(env: Env, req: Request): Promise<Response> {
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return corsJson({ error: "invalid catalog" }, 400);
  }
  const catalog = {
    ...(body as Record<string, unknown>),
    version: new Date().toISOString().slice(0, 19).replace(/[T:]/g, "-"),
  };
  await env.DATA_BUCKET.put(CATALOG_KEY, JSON.stringify(catalog, null, 2), {
    httpMetadata: { contentType: "application/json" },
  });
  return corsJson({ ok: true, catalog });
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

    if (url.pathname === "/catalog.json" && method === "GET") {
      return handleGetCatalog(env);
    }

    if (url.pathname === "/auth/whoami" && method === "GET") {
      const caller = await identify(req, env);
      if (!caller) return corsJson({ error: "unauthorized" }, 401);
      return corsJson({
        role: caller.role,
        orgId: caller.orgId,
        name: caller.name,
      });
    }

    if (url.pathname.startsWith("/admin/")) {
      const gate = await requireAdmin(req, env);
      if (gate instanceof Response) return gate;

      if (url.pathname === "/admin/orgs") {
        if (method === "GET") {
          return corsJson({ orgs: (await listOrgs(env)).map(publicOrg) });
        }
        if (method === "POST") return handleCreateOrg(env, req);
        return corsText("method not allowed", 405);
      }

      const orgMatch = url.pathname.match(/^\/admin\/orgs\/([^/]+)$/);
      if (orgMatch && method === "PATCH") {
        return handlePatchOrg(env, req, decodeURIComponent(orgMatch[1]));
      }

      if (url.pathname === "/admin/catalog" && method === "PATCH") {
        return handlePatchCatalog(env, req);
      }

      return corsText("not found", 404);
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
          "GET /catalog.json",
          "GET /data/{path}",
          "PUT /data/songs/{path}  (admin)",
          "GET /auth/whoami  (auth)",
          "GET /admin/orgs  (admin)",
          "POST /admin/orgs  (admin)",
          "PATCH /admin/orgs/{orgId}  (admin)",
          "PATCH /admin/catalog  (admin)",
        ],
      });
    }

    return corsText("not found", 404);
  },
} satisfies ExportedHandler<Env>;
