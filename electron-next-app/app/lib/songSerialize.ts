import type {
  EditorSection,
  EditorSlide,
  SectionEntry,
  SongEntry,
} from "./types";
import { deriveSequence } from "./songSchema";
import { splitLines, alignSecondary } from "./slideSplit";

export interface BuildSongArgs {
  songName: string;
  key: string | null;
  number: number | null;
  sections: EditorSection[];
  existingId?: string;
}

export const toLines = (text: string): string[] =>
  text
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l !== "");

export function generateSlides(
  section: Pick<EditorSection, "lines" | "altLines" | "showAlt">,
): EditorSlide[] {
  const lines = toLines(section.lines);
  if (lines.length === 0) return [];

  const parts = splitLines(lines);
  const alt = section.showAlt ? toLines(section.altLines) : [];
  const altParts = alt.length ? alignSecondary(alt, parts.length) : [];

  return parts.map((part, i) => ({
    id: crypto.randomUUID(),
    lines: part.join("\n"),
    altLines: (altParts[i] ?? []).join("\n"),
  }));
}

export function buildSongFromEditor(args: BuildSongArgs): SongEntry {
  const { songName, key, number, sections, existingId } = args;

  const live = sections.filter((s) => toLines(s.lines).length > 0);

  const primarySections: SectionEntry[] = [];
  const secondarySections: SectionEntry[] = [];

  live.forEach((s, i) => {
    const order = i + 1;
    const slides = s.slidesLocked && s.slides.length > 0
      ? s.slides
      : generateSlides(s);

    const primarySlides = slides
      .map((sl) => toLines(sl.lines))
      .filter((l) => l.length > 0);

    const entry: SectionEntry = {
      order,
      type: s.type,
      number: s.number,
      lines: primarySlides.flat(),
      slides: primarySlides,
    };
    if (s.slidesLocked) entry.slidesLocked = true;
    primarySections.push(entry);

    const altSlides = slides.map((sl) => toLines(sl.altLines));
    const altLines = altSlides.flat();
    if (s.showAlt && altLines.length > 0) {
      secondarySections.push({
        order,
        type: s.type,
        number: s.number,
        lines: altLines,
        slides: altSlides.slice(0, primarySlides.length),
        isTranslation: s.isTranslation === true,
      });
    }
  });

  const text = [{ isTranslation: false, sections: primarySections }];
  if (secondarySections.length > 0) {
    text.push({
      isTranslation: secondarySections.some((e) => e.isTranslation === true),
      sections: secondarySections,
    });
  }

  return {
    id: existingId ?? crypto.randomUUID(),
    number,
    key: key || null,
    title: songName.trim(),
    sequence: deriveSequence(primarySections),
    text,
  };
}

export function songToEditorSections(song: SongEntry): EditorSection[] {
  const secondary = song.text[1];
  const byOrder = secondary
    ? new Map(secondary.sections.map((s) => [s.order, s]))
    : undefined;

  return song.text[0].sections.map((sec) => {
    const alt = byOrder?.get(sec.order);
    return {
      id: crypto.randomUUID(),
      type: sec.type,
      number: sec.number,
      lines: sec.lines.join("\n"),
      altLines: alt?.lines.join("\n") ?? "",
      showAlt: (alt?.lines.length ?? 0) > 0,
      isTranslation: alt
        ? (alt.isTranslation ?? secondary?.isTranslation ?? false)
        : false,
      slidesLocked: sec.slidesLocked === true,
      slides: sec.slides.map((slide, i) => ({
        id: crypto.randomUUID(),
        lines: slide.join("\n"),
        altLines: (alt?.slides[i] ?? []).join("\n"),
      })),
    };
  });
}
