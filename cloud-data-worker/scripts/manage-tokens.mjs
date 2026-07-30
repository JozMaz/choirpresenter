#!/usr/bin/env node

import { createHash, randomBytes } from "node:crypto";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const BINDING = "TOKENS";

function usage() {
  console.log(`Usage:
  node scripts/manage-tokens.mjs create-admin "Your name"
  node scripts/manage-tokens.mjs create-org "Organization name"
  node scripts/manage-tokens.mjs list
  node scripts/manage-tokens.mjs revoke <orgId>
  node scripts/manage-tokens.mjs restore <orgId>

Bootstrapping: create-admin writes straight into KV, so it works before any admin
token exists. Everything else can also be done from the app's admin panel.`);
}

function wrangler(args) {
  return execFileSync("npx", ["wrangler", ...args], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "inherit"],
  });
}

function kvPut(key, value) {
  const tmp = path.join(os.tmpdir(), `cp-token-${Date.now()}.json`);
  fs.writeFileSync(tmp, value);
  try {
    wrangler([
      "kv",
      "key",
      "put",
      key,
      "--path",
      tmp,
      "--binding",
      BINDING,
      "--remote",
    ]);
  } finally {
    fs.unlinkSync(tmp);
  }
}

function kvGet(key) {
  try {
    return wrangler([
      "kv",
      "key",
      "get",
      key,
      "--binding",
      BINDING,
      "--remote",
    ]);
  } catch {
    return null;
  }
}

function kvListOrgKeys() {
  const raw = wrangler([
    "kv",
    "key",
    "list",
    "--prefix",
    "org:",
    "--binding",
    BINDING,
    "--remote",
  ]);
  return JSON.parse(raw).map((k) => k.name);
}

const sha256 = (s) => createHash("sha256").update(s).digest("hex");

function createRecord(name, role) {
  const token = randomBytes(24).toString("hex");
  const record = {
    orgId: `org_${randomBytes(4).toString("hex")}`,
    name,
    role,
    tokenHash: sha256(token),
    createdAt: new Date().toISOString(),
    revokedAt: null,
  };
  const json = JSON.stringify(record);
  kvPut(`token:${record.tokenHash}`, json);
  kvPut(`org:${record.orgId}`, json);
  return { record, token };
}

function setRevoked(orgId, revoked) {
  const raw = kvGet(`org:${orgId}`);
  if (!raw) {
    console.error(`Unknown organization: ${orgId}`);
    process.exit(1);
  }
  const record = JSON.parse(raw);
  record.revokedAt = revoked ? new Date().toISOString() : null;
  const json = JSON.stringify(record);
  kvPut(`org:${orgId}`, json);
  if (record.tokenHash) kvPut(`token:${record.tokenHash}`, json);
  console.log(
    `${revoked ? "Revoked" : "Restored"} ${record.name} (${orgId}). Its devices ${
      revoked ? "lose" : "regain"
    } access on the next check.`,
  );
}

const [command, arg] = process.argv.slice(2);

switch (command) {
  case "create-admin":
  case "create-org": {
    if (!arg) {
      usage();
      process.exit(1);
    }
    const role = command === "create-admin" ? "admin" : "org";
    const { record, token } = createRecord(arg, role);
    console.log(`\nCreated ${role}: ${record.name} (${record.orgId})`);
    console.log(`\n  TOKEN: ${token}\n`);
    console.log(
      "Only the hash is stored, so this is the one time the token is shown.",
    );
    console.log(
      "The same token can be used on any number of devices — paste it into Settings on each.",
    );
    break;
  }
  case "list": {
    const keys = kvListOrgKeys();
    if (keys.length === 0) {
      console.log("No organizations yet.");
      break;
    }
    for (const key of keys) {
      const raw = kvGet(key);
      if (!raw) continue;
      const r = JSON.parse(raw);
      const state = r.revokedAt ? `revoked ${r.revokedAt.slice(0, 10)}` : "active";
      console.log(`${r.orgId}  ${r.role.padEnd(5)}  ${state.padEnd(20)}  ${r.name}`);
    }
    break;
  }
  case "revoke":
  case "restore": {
    if (!arg) {
      usage();
      process.exit(1);
    }
    setRevoked(arg, command === "revoke");
    break;
  }
  default:
    usage();
    process.exit(command ? 1 : 0);
}
