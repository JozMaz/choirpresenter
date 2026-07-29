import type { SectionType, Section, SectionEntry, Slide } from "./types";

const TOKEN_PREFIX: Record<SectionType, string> = {
  verse: "V",
  chorus: "C",
  bridge: "B",
  ending: "E",
};

const TYPE_LABEL: Record<SectionType, string> = {
  verse: "Verse",
  chorus: "Chorus",
  bridge: "Bridge",
  ending: "Ending",
};

export function sequenceToken(type: SectionType, number: number): string {
  if (type === "verse") return `V${number}`;
  const prefix = TOKEN_PREFIX[type];
  return number === 1 ? prefix : `${prefix}${number}`;
}

export function deriveSequence(
  sections: Pick<SectionEntry, "type" | "number">[],
): string {
  const tokens: string[] = [];
  let prevType: SectionType | null = null;
  let prevNumber: number | null = null;
  for (const s of sections) {
    if (s.type === prevType && s.number === prevNumber) continue;
    tokens.push(sequenceToken(s.type, s.number));
    prevType = s.type;
    prevNumber = s.number;
  }
  return tokens.join(" ");
}

export function sectionLabel(type: SectionType, number: number): string {
  if (type === "verse") return `${TYPE_LABEL.verse} ${number}`;
  return number === 1 ? TYPE_LABEL[type] : `${TYPE_LABEL[type]} ${number}`;
}

export function buildSectionsAndSlides(
  primary: SectionEntry[],
  secondary?: SectionEntry[],
  defaultSecondaryIsTranslation = false,
): { sections: Section[]; slides: Slide[] } {
  const secondaryByOrder = secondary
    ? new Map(secondary.map((s) => [s.order, s]))
    : undefined;

  const sections: Section[] = [];
  const slides: Slide[] = [];

  for (const sec of primary) {
    const alt = secondaryByOrder?.get(sec.order);
    const label = sectionLabel(sec.type, sec.number);

    sections.push({
      label,
      type: sec.type,
      number: sec.number,
      primary: sec.lines,
      secondary: alt?.lines.length ? alt.lines : undefined,
      slideStart: slides.length,
      slideCount: sec.slides.length,
      secondaryIsTranslation: alt
        ? (alt.isTranslation ?? defaultSecondaryIsTranslation)
        : false,
    });

    const sectionIndex = sections.length - 1;
    sec.slides.forEach((slide, i) => {
      const altSlide = alt?.slides[i];
      slides.push({
        sectionIndex,
        label,
        primary: slide,
        secondary: altSlide?.length ? altSlide : undefined,
      });
    });
  }

  return { sections, slides };
}
