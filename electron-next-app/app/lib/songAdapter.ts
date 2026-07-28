import type { ApiItem, SectionListItem, SongEntry, SongSource } from "./types";
import { buildSectionsAndSlides } from "./songSchema";
import { buildSearchIndex } from "./textUtils";
import { formatKey } from "./musicKeys";
import { translationLabelFor } from "./language";
import { TRANSLATION_LABEL_DEFAULT } from "./constants";

export const SONGBOOK_NAMES: Record<string, string> = {
  newSong: "Nowa pieśń",
  newSongPlGb: "Śpiewnik polsko-angielski",
  pielgrzym: "Śpiewnik pielgrzyma",
  roboczy: "Śpiewnik roboczy",
  children: "Śpiewnik dziecięcy",
};

export function toApiItem(
  song: SongEntry,
  source: SongSource,
  bookName: string,
): ApiItem {
  const primary = song.text[0];
  const secondary = song.text[1];

  const { sections, slides } = buildSectionsAndSlides(
    primary.sections,
    secondary?.sections,
  );

  const fullText = sections.map((s) => s.primary.join("\n")).join("\n\n");
  const secondaryText = secondary
    ? secondary.sections.map((s) => s.lines.join("\n")).join("\n")
    : "";

  return {
    id: song.id,
    number: song.number,
    title: song.title,
    key: song.key,
    sequence: song.sequence,
    source,
    bookName,
    secondaryIsTranslation: secondary?.isTranslation ?? false,
    translationLabel: secondary?.isTranslation
      ? translationLabelFor(secondary.sections.flatMap((s) => s.lines))
      : TRANSLATION_LABEL_DEFAULT,
    sections,
    slides,
    fullText,
    searchIndex: buildSearchIndex(
      [song.title, String(song.number ?? ""), fullText, secondaryText].join(" "),
    ),
  };
}

export function getSongSections(item: ApiItem): SectionListItem[] {
  return item.sections.map((s) => ({
    label: item.isMessage ? "" : item.isBible ? `${s.number}.` : s.label,
    previewPrimary: s.primary[0] ?? "",
    previewPrimary2: s.secondary?.length ? "" : (s.primary[1] ?? ""),
    previewSecondary: s.secondary?.[0] ?? "",
    fullText: s.primary.join("\n"),
  }));
}

export function buildSongFooter(song: ApiItem): string {
  const parts: string[] = [];
  if (song.title) parts.push(song.title);
  const key = formatKey(song.key);
  if (key) parts.push(`(${key})`);
  if (song.number) parts.push(String(song.number));
  if (song.source !== "custom" && song.bookName) parts.push(`(${song.bookName})`);
  return parts.join("  ");
}
