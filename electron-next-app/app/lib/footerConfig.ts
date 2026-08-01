import type { SongSource } from "./types";

export interface FooterFields {
  number: boolean;
  title: boolean;
  key: boolean;
}

export type FooterConfig = Record<SongSource, FooterFields>;

const ALL: FooterFields = { number: true, title: true, key: true };
const NO_TITLE: FooterFields = { number: true, title: false, key: true };

export const DEFAULT_FOOTER_CONFIG: FooterConfig = {
  custom: ALL,
  newSong: ALL,
  newSongPlGb: ALL,
  pielgrzym: ALL,
  roboczy: NO_TITLE,
  children: NO_TITLE,
};

export const FOOTER_SOURCE_ORDER: SongSource[] = [
  "newSong",
  "newSongPlGb",
  "pielgrzym",
  "roboczy",
  "children",
  "custom",
];

export function footerFieldsFor(
  source: SongSource,
  config?: FooterConfig,
): FooterFields {
  return config?.[source] ?? DEFAULT_FOOTER_CONFIG[source] ?? ALL;
}

export type TranslationLabelConfig = Partial<Record<SongSource, string>>;

export const DEFAULT_TRANSLATION_LABELS: TranslationLabelConfig = {};

export function translationLabelOverride(
  source: SongSource,
  config?: TranslationLabelConfig,
): string {
  return config?.[source]?.trim() ?? "";
}
