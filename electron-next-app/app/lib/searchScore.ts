const PHRASE_BONUS = 1_000_000;
const RUN_BONUS = 10_000;
const COVERAGE_BONUS = 100;
const WORD_START_BONUS = 5;

function hasRun(idx: string, run: string[]): boolean {
  return idx.includes(run.join(" ")) || idx.includes(run.join(""));
}

function longestRun(idx: string, tokens: string[]): number {
  for (let len = tokens.length; len >= 2; len--) {
    for (let start = 0; start + len <= tokens.length; start++) {
      if (hasRun(idx, tokens.slice(start, start + len))) return len;
    }
  }
  return 0;
}

export function exactPhrase(tokens: string[]): string {
  return tokens.filter(Boolean).join(" ");
}

function scoreExact(idx: string, tokens: string[]): number {
  const phrase = exactPhrase(tokens);
  if (!phrase) return 0;
  const nl = idx.indexOf("\n");
  const limit = nl === -1 ? idx.length : nl;
  let score = 0;
  let pos = 0;
  while ((pos = idx.indexOf(phrase, pos)) !== -1) {
    if (pos + phrase.length > limit) break;
    score += phrase.length;
    const prev = pos === 0 ? " " : idx[pos - 1];
    if (prev === " ") score += WORD_START_BONUS;
    pos += phrase.length;
  }
  return score;
}

export function scoreMatch(
  idx: string,
  tokens: string[],
  exact = false,
): number {
  if (exact) return scoreExact(idx, tokens);
  let occ = 0;
  let present = 0;
  let total = 0;
  for (const t of tokens) {
    if (!t) continue;
    total++;
    let pos = 0;
    let found = false;
    while ((pos = idx.indexOf(t, pos)) !== -1) {
      found = true;
      occ += t.length;
      const prev = pos === 0 ? " " : idx[pos - 1];
      if (prev === " " || prev === "\n") occ += WORD_START_BONUS;
      pos += t.length;
    }
    if (found) present++;
  }
  if (total === 0 || present < total) return 0;
  const run = total > 1 ? longestRun(idx, tokens) : 0;
  let s = occ + present * COVERAGE_BONUS;
  if (total > 1 && run === total) s += PHRASE_BONUS;
  else s += run * RUN_BONUS;
  return s;
}
