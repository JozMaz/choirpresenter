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
