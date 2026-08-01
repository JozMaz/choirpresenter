export const DEFAULT_MAX_LINES = 3;

export function evenSplit(lines: string[], parts: number): string[][] {
  if (parts <= 1) return [lines];
  const base = Math.floor(lines.length / parts);
  const remainder = lines.length % parts;
  const out: string[][] = [];
  let start = 0;
  for (let i = 0; i < parts; i++) {
    const size = base + (i >= parts - remainder ? 1 : 0);
    out.push(lines.slice(start, start + size));
    start += size;
  }
  return out;
}

export function partsForMax(lineCount: number, maxLines: number): number {
  if (lineCount <= 0) return 1;
  return Math.max(1, Math.ceil(lineCount / Math.max(1, maxLines)));
}

export function splitLines(lines: string[]): string[][] {
  return evenSplit(lines, partsForMax(lines.length, DEFAULT_MAX_LINES));
}
