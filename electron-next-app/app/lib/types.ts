export interface DisplayInfo {
  id: number;
  label: string;
  bounds: { x: number; y: number; width: number; height: number };
  primary: boolean;
  isCurrent: boolean;
}

export interface MessageTitleTranslator {
  translator: number;
  title: string;
}
export interface MessageTitlesEntry {
  date: string;
  titles: MessageTitleTranslator[];
}
export interface MessageTextEntry {
  title: string;
  location: string;
  chunks: { pnum: number; text: string }[];
}

export interface CloudManifestEntry {
  hash: string;
  size: number;
}
export interface CloudManifest {
  version: string;
  generatedAt: string;
  files: Record<string, CloudManifestEntry>;
}

declare global {
  interface Window {
    api?: {
      ping: () => string;
      getDisplays: () => Promise<DisplayInfo[]>;
      openHdmi: (displayId: number) => Promise<void>;
      updateHdmi: (html: string) => void;
      closeHdmi: () => void;
      setHdmiBlackout: (active: boolean) => void;
      openHdmi2: (displayId: number) => Promise<void>;
      updateHdmi2: (html: string) => void;
      closeHdmi2: () => void;
      setHdmi2Blackout: (active: boolean) => void;
      setHdmi2Config: (config: { bg: string }) => void;
      getAppVersion: () => Promise<string>;
      readSongBook: (book: SongBookKey) => Promise<Songbook | null>;
      writeSongBook: (
        book: SongBookKey,
        data: Songbook,
      ) => Promise<WriteResult>;
      getWriteToken: () => Promise<string | null>;
      setWriteToken: (token: string) => Promise<boolean>;
      readBible: (bible: "warszawska" | "gdanska") => Promise<string | null>;
      readMessageTitles: () => Promise<MessageTitlesEntry[] | null>;
      readMessageText: (dateKey: string) => Promise<MessageTextEntry | null>;
      listMessageKeys: () => Promise<string[]>;
      dataLocalMode: () => Promise<boolean>;
      dataCacheDir: () => Promise<string>;
      dataHasLocal: () => Promise<boolean>;
      dataReadLocal: (relPath: string) => Promise<string | null>;
      dataWriteLocal: (relPath: string, contents: string) => Promise<boolean>;
      dataFetchCloud: (relPath: string) => Promise<string | null>;
      dataFetchManifest: () => Promise<string | null>;
      dataClearLocal: () => Promise<boolean>;
      exportData: (
        categories: string[],
        customSongsJson?: string,
      ) => Promise<{
        ok?: boolean;
        canceled?: boolean;
        path?: string;
        files?: number;
        error?: string;
      }>;
    };
  }
}

export type SongBookKey =
  | "newSong"
  | "newSongPlGb"
  | "pielgrzym"
  | "roboczy"
  | "children";

export type SongSource = SongBookKey | "custom";

export interface WriteResult {
  localOk: boolean;
  cloudOk: boolean | null;
  refused?: boolean;
}

export type SectionType = "verse" | "chorus" | "bridge" | "ending";

export interface SectionEntry {
  order: number;
  type: SectionType;
  number: number;
  lines: string[];
  slides: string[][];
  slidesLocked?: true;
  isTranslation?: boolean;
}

export interface LangBlock {
  isTranslation: boolean;
  sections: SectionEntry[];
}

export interface SongEntry {
  id: string;
  number: number | null;
  key: string | null;
  title: string;
  sequence: string;
  text: LangBlock[];
}

export interface Songbook {
  name: string;
  songs: SongEntry[];
}

export interface BibleMeta {
  bookName: string;
  chapter: number;
  bibleName: string;
}

export interface MessageMeta {
  dateKey: string;
  title: string;
  location: string;
  pnums: number[];
}

export interface SlideText {
  primary: string[];
  secondary?: string[];
  isTranslation?: boolean;
}

export interface Slide extends SlideText {
  sectionIndex: number;
  label: string;
}

export interface Section extends SlideText {
  label: string;
  type: SectionType;
  number: number;
  slideStart: number;
  slideCount: number;
  secondaryIsTranslation?: boolean;
}

export interface EditorSlide {
  id: string;
  lines: string;
  altLines: string;
}

export interface ApiItem {
  id: string;
  number: number | null;
  title: string;
  key: string | null;
  sequence: string;
  source: SongSource;
  bookName: string;
  secondaryIsTranslation: boolean;
  translationLabel: string;
  sections: Section[];
  slides: Slide[];
  searchIndex: string;
  fullText: string;
  isBible?: boolean;
  bibleMeta?: BibleMeta;
  isMessage?: boolean;
  messageMeta?: MessageMeta;
}

export interface EditorSection {
  id: string;
  type: SectionType;
  number: number;
  lines: string;
  altLines: string;
  showAlt: boolean;
  isTranslation: boolean;
  slides: EditorSlide[];
  slidesLocked: boolean;
}

export interface SectionListItem {
  label: string;
  previewPrimary: string;
  previewPrimary2: string;
  previewSecondary: string;
  fullText: string;
}
