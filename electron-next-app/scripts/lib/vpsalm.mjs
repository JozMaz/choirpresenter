import vm from "node:vm";

export function escapeNewlinesInStrings(src) {
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
      if (ch === "\t") {
        out += "\\t";
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

export function parseVideoPsalmJson(rawFile) {
  const raw = escapeNewlinesInStrings(rawFile.replace(/^﻿/, ""));
  return vm.runInNewContext("(" + raw + ")");
}
