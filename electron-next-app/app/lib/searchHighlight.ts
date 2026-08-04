export interface HighlightResult {
  prefix: string;
  segments: { text: string; hit: boolean }[];
  suffix: string;
  score: number;
}

export interface HighlightOptions {
  snippetLen?: number;
  before?: number;
  exact?: boolean;
}

const CHAR_CACHE = new Map<string, string>();

function normChar(ch: string): string {
  let v = CHAR_CACHE.get(ch);
  if (v === undefined) {
    v = ch
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/ł/g, "l")
      .replace(/Ł/g, "l")
      .replace(/[^a-z0-9\s]/g, " ");
    CHAR_CACHE.set(ch, v);
  }
  return v;
}

export function highlightSnippet(
  text: string,
  rawTokens: string[],
  opts: HighlightOptions = {},
): HighlightResult {
  const SNIPPET_LEN = opts.snippetLen ?? 200;
  const BEFORE = opts.before ?? 60;
  const exact = opts.exact ?? false;
  const tokens = exact
    ? [rawTokens.filter(Boolean).join(" ")].filter(Boolean)
    : rawTokens;

  const parts: string[] = [];
  const origIdx: number[] = [];
  for (let i = 0; i < text.length; i++) {
    const ch = normChar(text[i]);
    for (let k = 0; k < ch.length; k++) {
      parts.push(ch[k]);
      origIdx.push(i);
    }
  }
  const normalized = parts.join("");

  const nospaceParts: string[] = [];
  const nospaceOrigIdx: number[] = [];
  if (!exact) {
    for (let i = 0; i < normalized.length; i++) {
      const c = normalized[i];
      if (c !== " " && c !== "\t" && c !== "\n" && c !== "\r") {
        nospaceParts.push(c);
        nospaceOrigIdx.push(origIdx[i]);
      }
    }
  }
  const nospace = nospaceParts.join("");

  let runRange: [number, number] | null = null;
  if (tokens.length > 1) {
    outer: for (let len = tokens.length; len >= 2; len--) {
      for (let start = 0; start + len <= tokens.length; start++) {
        const run = tokens.slice(start, start + len);
        const sp = run.join(" ");
        let p = normalized.indexOf(sp);
        if (p !== -1) {
          runRange = [
            origIdx[p] ?? 0,
            (origIdx[p + sp.length - 1] ?? text.length - 1) + 1,
          ];
          break outer;
        }
        const ns = run.join("");
        p = nospace.indexOf(ns);
        if (p !== -1) {
          runRange = [
            nospaceOrigIdx[p] ?? 0,
            (nospaceOrigIdx[p + ns.length - 1] ?? text.length - 1) + 1,
          ];
          break outer;
        }
      }
    }
  }

  const ranges: [number, number][] = [];
  if (runRange) ranges.push([runRange[0], runRange[1]]);
  for (const t of tokens) {
    let pos = 0;
    let foundAny = false;
    while ((pos = normalized.indexOf(t, pos)) !== -1) {
      foundAny = true;
      const start = origIdx[pos] ?? 0;
      const endIdx = pos + t.length - 1;
      const end = (origIdx[endIdx] ?? text.length - 1) + 1;
      ranges.push([start, end]);
      pos++;
    }
    if (foundAny || exact) continue;

    let nspos = 0;
    while ((nspos = nospace.indexOf(t, nspos)) !== -1) {
      const startO = nospaceOrigIdx[nspos] ?? 0;
      const endO =
        (nospaceOrigIdx[nspos + t.length - 1] ?? text.length - 1) + 1;
      let subStart = startO;
      for (let i = startO; i < endO; i++) {
        if (/\s/.test(text[i])) {
          if (i > subStart) ranges.push([subStart, i]);
          subStart = i + 1;
        }
      }
      if (endO > subStart) ranges.push([subStart, endO]);
      nspos++;
    }
  }
  ranges.sort((a, b) => a[0] - b[0]);

  const merged: [number, number][] = [];
  for (const r of ranges) {
    const last = merged[merged.length - 1];
    if (last && r[0] <= last[1]) last[1] = Math.max(last[1], r[1]);
    else merged.push([...r]);
  }

  let score = 0;
  for (const [s, e] of merged) score += e - s;

  let snipStart = 0;
  let snipEnd = text.length;
  let prefix = "";
  let suffix = "";
  if (SNIPPET_LEN > 0 && merged.length > 0) {
    const anchor = runRange ? runRange[0] : merged[0][0];
    snipStart = Math.max(0, anchor - BEFORE);
    snipEnd = Math.min(text.length, snipStart + SNIPPET_LEN);
    while (snipStart > 0 && /\S/.test(text[snipStart - 1])) snipStart--;
    while (snipEnd < text.length && /\S/.test(text[snipEnd])) snipEnd++;
    if (snipStart > 0) prefix = "… ";
    if (snipEnd < text.length) suffix = " …";
  } else if (SNIPPET_LEN > 0) {
    snipEnd = Math.min(text.length, SNIPPET_LEN);
    if (snipEnd < text.length) suffix = " …";
  }

  const segments: { text: string; hit: boolean }[] = [];
  let cursor = snipStart;
  for (const [rs, re] of merged) {
    if (re <= snipStart || rs >= snipEnd) continue;
    const s = Math.max(rs, snipStart);
    const e = Math.min(re, snipEnd);
    if (s > cursor) segments.push({ text: text.slice(cursor, s), hit: false });
    segments.push({ text: text.slice(s, e), hit: true });
    cursor = e;
  }
  if (cursor < snipEnd) {
    segments.push({ text: text.slice(cursor, snipEnd), hit: false });
  }

  return { prefix, segments, suffix, score };
}
