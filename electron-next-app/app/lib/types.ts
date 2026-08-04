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

export interface OrgRecord {
  orgId: string;
  name: string;
  role: "admin" | "org";
  createdAt: string;
  revokedAt: string | null;
}

export interface AdminResult<T> {
  ok: boolean;
  status?: number;
  error?: string;
  data?: T;
}

export interface WhoamiResult {
  ok: boolean;
  status?: number;
  offline?: boolean;
  identity?: { role: "admin" | "org"; orgId: string; name: string };
}

export type BoxMode = "padding" | "size";

export type BoxAlign = "start" | "center" | "end";

export type NetGroup = "songs" | "bible" | "messages";

export interface OverlayConfig {
  edgeFade: number;
  boxModeX: BoxMode;
  boxModeY: BoxMode;
  boxAlignX: BoxAlign;
  boxAlignY: BoxAlign;
  boxPadX: number;
  boxPadY: number;
  boxWidth: number;
  boxHeight: number;
  boxScale: number;
  boxRadius: number;
  boxAlpha: number;
  boxOffsetX: number;
  boxOffsetY: number;
  fadeMs: number;
  bibleScale: number;
  messageScale: number;
  tightLabels: boolean;
}

export interface OutputStyle {
  dividerWidth: number;
}

export interface NetAddress {
  address: string;
  name: string;
}

export interface NetStatus {
  running: boolean;
  port: number | null;
  addresses: NetAddress[];
  error?: string;
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
      netStart: (id: string) => Promise<NetStatus>;
      netStop: (id: string) => Promise<NetStatus>;
      netStatus: (id: string) => Promise<NetStatus>;
      netUpdate: (id: string, html: string) => void;
      netBlackout: (id: string, active: boolean) => void;
      netConfig: (id: string, config: Partial<OverlayConfig>) => void;
      setOutputStyle: (style: Partial<OutputStyle>) => void;
      setHdmiConfig: (
        variant: 1 | 2,
        config: {
          fadeMs?: number;
          bibleScale?: number;
          messageScale?: number;
          tightLabels?: boolean;
          bg?: string;
          boxed?: boolean;
          boxScale?: number;
          boxAlignX?: BoxAlign;
          boxAlignY?: BoxAlign;
          boxOffsetX?: number;
          boxOffsetY?: number;
        },
      ) => void;
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
      dataFetchCatalog: () => Promise<string | null>;
      dataHasFiles: (relPaths: string[]) => Promise<boolean[]>;
      authWhoami: (token?: string) => Promise<WhoamiResult>;
      adminListOrgs: () => Promise<AdminResult<{ orgs: OrgRecord[] }>>;
      adminCreateOrg: (
        name: string,
        role?: "admin" | "org",
      ) => Promise<AdminResult<{ org: OrgRecord; token: string }>>;
      adminPatchOrg: (
        orgId: string,
        patch: { name?: string; revoked?: boolean },
      ) => Promise<AdminResult<{ org: OrgRecord }>>;
      adminRotateToken: (
        orgId: string,
      ) => Promise<AdminResult<{ org: OrgRecord; token: string }>>;
      adminPatchCatalog: (catalog: unknown) => Promise<AdminResult<unknown>>;
      pickJsonFile: () => Promise<{ name: string; contents: string } | null>;
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
  "newSong" | "newSongPlGb" | "pielgrzym" | "roboczy" | "children";

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
  translationLabel?: string;
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
  customTranslationLabel?: string;
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
