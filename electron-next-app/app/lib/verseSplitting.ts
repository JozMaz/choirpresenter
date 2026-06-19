/** Rozdělí verse na části podle počtu řádků (pro Nowa Pieśń) */
export const splitVerseIntoParts = (verseText: string): string[] => {
  const lines = verseText.split("\n").filter((line) => line.trim() !== "");
  const lineCount = lines.length;
  const parts: string[] = [];

  if (lineCount <= 4) return [verseText];

  if (lineCount === 5) {
    parts.push(lines.slice(0, 2).join("\n"));
    parts.push(lines.slice(2, 5).join("\n"));
  } else if (lineCount === 6) {
    parts.push(lines.slice(0, 3).join("\n"));
    parts.push(lines.slice(3, 6).join("\n"));
  } else if (lineCount === 7) {
    parts.push(lines.slice(0, 3).join("\n"));
    parts.push(lines.slice(3, 7).join("\n"));
  } else if (lineCount === 8) {
    parts.push(lines.slice(0, 2).join("\n"));
    parts.push(lines.slice(2, 5).join("\n"));
    parts.push(lines.slice(5, 8).join("\n"));
  } else if (lineCount === 9) {
    parts.push(lines.slice(0, 3).join("\n"));
    parts.push(lines.slice(3, 6).join("\n"));
    parts.push(lines.slice(6, 9).join("\n"));
  } else if (lineCount === 10) {
    parts.push(lines.slice(0, 3).join("\n"));
    parts.push(lines.slice(3, 6).join("\n"));
    parts.push(lines.slice(6, 10).join("\n"));
  } else {
    const partsCount = Math.ceil(lineCount / 4);
    const baseSize = Math.floor(lineCount / partsCount);
    const remainder = lineCount % partsCount;
    let start = 0;
    for (let i = 0; i < partsCount; i++) {
      const size = baseSize + (i < remainder ? 1 : 0);
      parts.push(lines.slice(start, start + size).join("\n"));
      start += size;
    }
  }

  return parts;
};

/** Rozdělí text na části pro PL/EN (max 3 řádky na část) */
export const splitVerseIntoPartsForPLEN = (lines: string[]): string[] => {
  const lineCount = lines.length;
  const parts: string[] = [];

  if (lineCount <= 3) return [lines.join("\n")];

  if (lineCount === 4) {
    parts.push(lines.slice(0, 2).join("\n"));
    parts.push(lines.slice(2, 4).join("\n"));
  } else if (lineCount === 5) {
    parts.push(lines.slice(0, 2).join("\n"));
    parts.push(lines.slice(2, 5).join("\n"));
  } else if (lineCount === 6) {
    parts.push(lines.slice(0, 3).join("\n"));
    parts.push(lines.slice(3, 6).join("\n"));
  } else if (lineCount === 7) {
    parts.push(lines.slice(0, 2).join("\n"));
    parts.push(lines.slice(2, 4).join("\n"));
    parts.push(lines.slice(4, 7).join("\n"));
  } else if (lineCount === 8) {
    parts.push(lines.slice(0, 3).join("\n"));
    parts.push(lines.slice(3, 5).join("\n"));
    parts.push(lines.slice(5, 8).join("\n"));
  } else if (lineCount === 9) {
    parts.push(lines.slice(0, 3).join("\n"));
    parts.push(lines.slice(3, 6).join("\n"));
    parts.push(lines.slice(6, 9).join("\n"));
  } else if (lineCount === 10) {
    parts.push(lines.slice(0, 3).join("\n"));
    parts.push(lines.slice(3, 6).join("\n"));
    parts.push(lines.slice(6, 8).join("\n"));
    parts.push(lines.slice(8, 10).join("\n"));
  } else {
    for (let i = 0; i < lineCount; i += 3) {
      parts.push(lines.slice(i, Math.min(i + 3, lineCount)).join("\n"));
    }
  }

  return parts;
};
