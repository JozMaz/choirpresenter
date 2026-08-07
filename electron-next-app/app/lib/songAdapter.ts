import type { ApiItem, SectionListItem, SongEntry, SongSource } from "./types";
import { footerFieldsFor, type FooterConfig } from "./footerConfig";
import { buildSectionsAndSlides, sectionLabel } from "./songSchema";
import type { SectionTypeLabels } from "./songSchema";
import { splitLines } from "./slideSplit";
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

  const altByOrder = secondary
    ? new Map(secondary.sections.map((s) => [s.order, s]))
    : undefined;
  const normalizedPrimary = primary.sections.map((sec) => {
    const alt = altByOrder?.get(sec.order);
    if (sec.slidesLocked || (alt?.lines.length ?? 0) > 0) return sec;
    return { ...sec, slides: splitLines(sec.lines) };
  });

  const { sections, slides } = buildSectionsAndSlides(
    normalizedPrimary,
    secondary?.sections,
    secondary?.isTranslation ?? false,
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
    translationLabel: secondary
      ? translationLabelFor(secondary.sections.flatMap((s) => s.lines))
      : TRANSLATION_LABEL_DEFAULT,
    customTranslationLabel: secondary?.translationLabel?.trim() || undefined,
    sections,
    slides,
    fullText,
    searchIndex: buildSearchIndex(
      [song.title, String(song.number ?? ""), fullText, secondaryText].join(
        " ",
      ),
    ),
  };
}

export function getSongSections(
  item: ApiItem,
  typeLabels: SectionTypeLabels,
): SectionListItem[] {
  return item.sections.map((s) => ({
    label: item.isMessage
      ? ""
      : item.isBible
        ? `${s.number}.`
        : sectionLabel(s.type, s.number, typeLabels),
    previewPrimary: s.primary[0] ?? "",
    previewPrimary2: s.secondary?.length ? "" : (s.primary[1] ?? ""),
    previewSecondary: s.secondary?.[0] ?? "",
    fullText: s.primary.join("\n"),
  }));
}

export function getSelectionTitle(
  song: ApiItem | null,
  fallbackTitle: string,
): {
  main: string;
  sub: string;
} {
  if (!song) return { main: fallbackTitle, sub: "" };
  if (song.isBible && song.bibleMeta) {
    const { bookName, chapter, bibleName } = song.bibleMeta;
    return { main: `${bookName} ${chapter}`, sub: bibleName };
  }
  if (song.isMessage && song.messageMeta) {
    const { title, dateKey, location } = song.messageMeta;
    return {
      main: title,
      sub: location ? `${dateKey} · ${location}` : dateKey,
    };
  }
  const key = formatKey(song.key);
  const numbered =
    song.number != null ? `${song.number}. ${song.title}` : song.title;
  return {
    main: key ? `${numbered} (${key})` : numbered,
    sub: song.source === "custom" ? "" : song.bookName,
  };
}

export function buildSongFooter(song: ApiItem, config?: FooterConfig): string {
  const fields = footerFieldsFor(song.source, config);
  const parts: string[] = [];
  if (song.title && fields.title) parts.push(song.title);
  const key = formatKey(song.key);
  if (key && fields.key) parts.push(`(${key})`);
  if (song.number && fields.number) parts.push(String(song.number));
  if (song.source !== "custom" && song.bookName)
    parts.push(`(${song.bookName})`);
  return parts.join("  ");
}
