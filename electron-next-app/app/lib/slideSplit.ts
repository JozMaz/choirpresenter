export function alignSecondary(lines: string[], partCount: number): string[][] {
  if (partCount <= 1) return [lines];
  const total = lines.length;
  const out: string[][] = [];
  for (let i = 0; i < partCount; i++) {
    const start = Math.floor((i * total) / partCount);
    const end = Math.floor(((i + 1) * total) / partCount);
    out.push(lines.slice(start, end));
  }
  return out;
}

export function splitLines(lines: string[]): string[][] {
  const n = lines.length;
  if (n <= 3) return [lines];

  const slice = (...ranges: [number, number][]) =>
    ranges.map(([a, b]) => lines.slice(a, b));

  if (n === 4) return slice([0, 2], [2, 4]);
  if (n === 5) return slice([0, 2], [2, 5]);
  if (n === 6) return slice([0, 3], [3, 6]);
  if (n === 7) return slice([0, 2], [2, 4], [4, 7]);
  if (n === 8) return slice([0, 3], [3, 5], [5, 8]);
  if (n === 9) return slice([0, 3], [3, 6], [6, 9]);
  if (n === 10) return slice([0, 3], [3, 6], [6, 8], [8, 10]);

  const out: string[][] = [];
  for (let i = 0; i < n; i += 3) out.push(lines.slice(i, Math.min(i + 3, n)));
  return out;
}
