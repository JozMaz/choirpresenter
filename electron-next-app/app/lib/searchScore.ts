/**
 * Skóre relevance: pro každý token spočítá počet jeho výskytů v indexu,
 * vážený délkou tokenu. Vyšší = víc/delších shod = relevantnější.
 *
 * Použití: sort výsledků desc podle skóre.
 */
export function scoreTokens(idx: string, tokens: string[]): number {
  let s = 0;
  for (const t of tokens) {
    if (!t) continue;
    let pos = 0;
    while ((pos = idx.indexOf(t, pos)) !== -1) {
      s += t.length;
      pos += t.length;
    }
  }
  return s;
}
