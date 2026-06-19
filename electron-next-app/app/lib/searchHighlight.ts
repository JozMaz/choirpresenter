export interface HighlightResult {
  prefix: string;
  segments: { text: string; hit: boolean }[];
  suffix: string;
  /**
   * Skóre relevance — celkový počet znaků matchnutých v textu.
   * Vyšší = víc/delší shod. Pro sortění výsledků desc.
   */
  score: number;
}

export interface HighlightOptions {
  /** Délka snippetu okolo prvního matche. Default 200, 0 = bez snippetu (vrátí celý text). */
  snippetLen?: number;
  /** Kolik znaků kontextu před prvním matchem. Default 60. */
  before?: number;
}

/**
 * Najde matchnuté tokeny v textu (case + diacritics + ł insensitive),
 * vrátí snippet okolo prvního matche s vyznačenými segmenty a skóre.
 *
 * Token bez mezer (např. "wiarajestsubstancja") matchne i text se mezerami
 * ("Wiara jest substancją") — výsledný highlight je rozsekaný po slovech,
 * takže každé slovo má vlastní "pill".
 */
export function highlightSnippet(
  text: string,
  tokens: string[],
  opts: HighlightOptions = {},
): HighlightResult {
  const SNIPPET_LEN = opts.snippetLen ?? 200;
  const BEFORE = opts.before ?? 60;

  // Position-preserving normalizace char-by-char.
  // Pravidla = normalizeSearch (kromě \s+ collapse).
  let normalized = "";
  const origIdx: number[] = [];
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/ł/g, "l")
      .replace(/Ł/g, "l")
      .replace(/[^a-z0-9\s]/g, " ");
    for (const c of ch) {
      normalized += c;
      origIdx.push(i);
    }
  }

  // Verze bez mezer s mapováním zpět — fallback pro tokeny psané spolu.
  let nospace = "";
  const nospaceOrigIdx: number[] = [];
  for (let i = 0; i < normalized.length; i++) {
    if (!/\s/.test(normalized[i])) {
      nospace += normalized[i];
      nospaceOrigIdx.push(origIdx[i]);
    }
  }

  // Najdi všechny matche
  const ranges: [number, number][] = [];
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
    if (foundAny) continue;

    // Fallback: nospace match — rozsekej na slova podle whitespace v originále,
    // aby zvýraznění vypadalo jako pills per slovo.
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

  // Merge overlapping
  const merged: [number, number][] = [];
  for (const r of ranges) {
    const last = merged[merged.length - 1];
    if (last && r[0] <= last[1]) last[1] = Math.max(last[1], r[1]);
    else merged.push([...r]);
  }

  // Skóre = počet matchnutých znaků (suma délek merged rozsahů).
  let score = 0;
  for (const [s, e] of merged) score += e - s;

  // Snippet okolo prvního matche (nebo celý text když snippetLen=0).
  let snipStart = 0;
  let snipEnd = text.length;
  let prefix = "";
  let suffix = "";
  if (SNIPPET_LEN > 0 && merged.length > 0) {
    snipStart = Math.max(0, merged[0][0] - BEFORE);
    snipEnd = Math.min(text.length, snipStart + SNIPPET_LEN);
    while (snipStart > 0 && /\S/.test(text[snipStart - 1])) snipStart--;
    while (snipEnd < text.length && /\S/.test(text[snipEnd])) snipEnd++;
    if (snipStart > 0) prefix = "… ";
    if (snipEnd < text.length) suffix = " …";
  } else if (SNIPPET_LEN > 0) {
    snipEnd = Math.min(text.length, SNIPPET_LEN);
    if (snipEnd < text.length) suffix = " …";
  }

  // Postav segmenty
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
