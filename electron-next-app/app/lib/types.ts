export interface DisplayInfo {
  id: number;
  label: string;
  bounds: { x: number; y: number; width: number; height: number };
  primary: boolean;
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
      readSongBook: (
        book: SongBookKey,
      ) => Promise<{ Songs?: Song[] } | null>;
      writeSongBook: (
        book: SongBookKey,
        data: { Songs: Song[] },
      ) => Promise<{ localOk: boolean; cloudOk: boolean | null }>;
      getWriteToken: () => Promise<string | null>;
      setWriteToken: (token: string) => Promise<boolean>;
      readBible: (bible: "warszawska" | "gdanska") => Promise<string | null>;
      readMessageTitles: () => Promise<MessageTitlesEntry[] | null>;
      readMessageText: (dateKey: string) => Promise<MessageTextEntry | null>;
      listMessageKeys: () => Promise<string[]>;
      dataCacheDir: () => Promise<string>;
      dataHasLocal: () => Promise<boolean>;
      dataReadLocal: (relPath: string) => Promise<string | null>;
      dataWriteLocal: (relPath: string, contents: string) => Promise<boolean>;
      dataFetchCloud: (relPath: string) => Promise<string | null>;
      dataFetchManifest: () => Promise<string | null>;
      dataClearLocal: () => Promise<boolean>;
    };
  }
}

/** Klíče songbooků – odpovídají jménům souborů v api/SongBooks/. */
export type SongBookKey =
  | "newSong"
  | "newSongPlGb"
  | "pielgrzym"
  | "roboczy"
  | "children";

export interface Verse {
  Tag?: number;
  ID?: number;
  Style?: unknown;
  Text?: string; // pro nowa-piesn
  TextPL?: string; // pro pl-en
  TextEN?: string; // pro pl-en
  /** True když EN je jen překlad (nejde zpívat) — render italic, na stream skip. */
  IsTranslation?: boolean;
}

export interface Song {
  ID: number;
  Guid: string;
  Verses: Verse[];
  VideoDuration?: number;
  Text?: string;
  TextPL?: string;
  TextEN?: string;
  Sequence?: string;
  Key?: string;
  Capo?: number;
  Style?: unknown;
}

export type SongSource = SongBookKey | "custom";

export interface BibleMeta {
  /** Krátká reference knihy ("Ks. Przysłów"). */
  bookName: string;
  /** Číslo kapitoly. */
  chapter: number;
  /** Plný název bible — zobrazí se ve spodním řádku previews/HDMI. */
  bibleName: string;
}

export interface MessageMeta {
  /** Date key, např. "47-0412" nebo "50-0813A". */
  dateKey: string;
  /** Plný název kázání. */
  title: string;
  /** Místo a stát (z HTML headeru). */
  location: string;
  /** Paragraph number per verse (paralelní pole k verses). */
  pnums: number[];
}

export interface ApiItem {
  id: number;
  text: string;
  title: string;
  fullText: string;
  selected: boolean;
  sequence: string;
  verses: Verse[];
  key: string;
  source: SongSource;
  searchIndex: string;
  /** True když item je bible kapitola → jiný layout. */
  isBible?: boolean;
  /** Metadata pro bible mód. */
  bibleMeta?: BibleMeta;
  /** True když item je sermon message → jiný layout. */
  isMessage?: boolean;
  /** Metadata pro message mód. */
  messageMeta?: MessageMeta;
}

export interface VerseParts {
  verseIndex: number;
  fullPL: string;
  fullEN: string;
  plParts: string[];
  enParts: string[];
  /** True když je tento verš jen translation pro čtení (EN render italic, na stream skip). */
  isTranslation?: boolean;
}

export type SectionType = "verse" | "chorus" | "bridge";

export interface EditorSection {
  id: string;
  type: SectionType;
  number: number;
  textPL: string;
  textEN: string;
  showEN: boolean;
}

export interface SectionListItem {
  label: string;
  previewPL: string;
  previewEN: string;
  fullText: string;
}
