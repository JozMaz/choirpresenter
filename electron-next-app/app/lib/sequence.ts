import type { EditorSection, SectionType, Verse } from "./types";

export const formatSequencePart = (
  type: SectionType,
  number: number,
): string => {
  switch (type) {
    case "verse":
      return `V${number}`;
    case "chorus":
      return number === 1 ? "C" : `C${number}`;
    case "bridge":
      return number === 1 ? "B" : `B${number}`;
    default:
      return "";
  }
};

export const generateSequence = (sections: EditorSection[]): string => {
  return sections
    .map((s) => formatSequencePart(s.type, s.number))
    .join(", ");
};

/**
 * Auto-detekce Sequence z Verses, když píseň pole Sequence nemá.
 * Tag === 1 → Chorus, Tag === 2 → Bridge, jinak Verse.
 */
export const autoDetectSequence = (verses: Verse[]): string => {
  let verseCounter = 0;
  let bridgeCounter = 0;
  const parts: string[] = [];

  verses.forEach((verse) => {
    if (verse.Tag === 1) {
      const id = verse.ID;
      parts.push(!id || id === 0 ? "C" : `C${id}`);
    } else if (verse.Tag === 2) {
      const id = verse.ID;
      if (!id || id === 0) {
        bridgeCounter++;
        parts.push(bridgeCounter === 1 ? "B" : `B${bridgeCounter}`);
      } else {
        parts.push(id === 1 ? "B" : `B${id}`);
      }
    } else {
      if (verse.ID && verse.ID > 0) {
        parts.push(`V${verse.ID}`);
        verseCounter = Math.max(verseCounter, verse.ID);
      } else {
        verseCounter++;
        parts.push(`V${verseCounter}`);
      }
    }
  });

  return parts.join(" ");
};
