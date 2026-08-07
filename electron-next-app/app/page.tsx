"use client";

import { Allotment } from "allotment";
import "allotment/dist/style.css";
import { useEffect, useEffectEvent, useMemo, useState } from "react";

import { getMessageText } from "./lib/messageIndex";

import type {
  ApiItem,
  DisplayInfo,
  NetStatus,
  SongBookKey,
  SongEntry,
  SongSource,
} from "./lib/types";
import { LS_KEYS, TRANSLATION_LABEL_DEFAULT } from "./lib/constants";
import {
  DEFAULT_FOOTER_CONFIG,
  DEFAULT_TRANSLATION_LABELS,
  translationLabelOverride,
  type FooterConfig,
  type TranslationLabelConfig,
} from "./lib/footerConfig";
import {
  ALL_SONGBOOK_KEYS,
  EMPTY_SELECTION,
  newlyOffered,
  normalizeSelection,
  parseCatalog,
  type Catalog,
  type ContentSelection,
  type Identity,
} from "./lib/access";
import {
  isMessageChunkIndexReady,
  prebuildMessageChunkIndex,
} from "./lib/messageIndex";
import { prebuildBibleVerseIndexes } from "./lib/bibleIndex";
import { buildOutputHtml } from "./lib/hdmiHtml";
import {
  DEFAULT_OUTPUT_CONFIG,
  outputSettingsFor,
  readOutputConfig,
  type OutputConfig,
} from "./lib/outputConfig";
import {
  DEFAULT_OUTPUTS,
  OUTPUT_IDS,
  outputName,
  readOutputs,
  type OutputId,
  type OutputsConfig,
} from "./lib/outputs";
import { displayGroupFor, migrateProfiles } from "./lib/outputProfiles";
import { buildSongFromEditor, songToEditorSections } from "./lib/songSerialize";
import { toApiItem, SONGBOOK_NAMES } from "./lib/songAdapter";
import { splitVerseIntoParts } from "./lib/bibleSlides";
import {
  BIBLE_LABELS,
  getBookByFlatIndex,
  type BibleKey,
} from "./lib/bibleData";
import {
  entryFor,
  entryKeyFor,
  moveEntry,
  readSelectedEntries,
  songEntryKey,
  type BibleChapterRef,
  type SelectedEntry,
} from "./lib/selection";
import { buildSectionsAndSlides } from "./lib/songSchema";

import { usePersistedState } from "./hooks/usePersistedState";
import { useI18n } from "./lib/i18n/context";
import {
  recallOpened,
  rememberOpened,
  TAB_KIND,
  useLibraryState,
} from "./lib/libraryState";
import { watchSystemTheme } from "./lib/theme";
import { useSongPlayer } from "./hooks/useSongPlayer";
import { useHdmiSync } from "./hooks/useHdmiSync";
import { useSongbooks } from "./hooks/useSongbooks";
import { useBibles } from "./hooks/useBibles";

import ActionBar from "./components/ActionBar";
import ContentPicker from "./components/ContentPicker";
import Icon from "./components/Icon";
import SelectionHeader from "./components/SelectionHeader";
import TokenGate from "./components/TokenGate";
import Library from "./components/Library";
import TopBar from "./components/TopBar";
import LoadingScreen from "./components/LoadingScreen";
import SelectedPanel from "./components/SelectedPanel";
import SongbooksTree from "./components/SongbooksTree";
import OutputPreview from "./components/OutputPreview";
import SectionsList from "./components/SectionsList";
import SettingsModal from "./components/SettingsModal";
import SongChunks from "./components/SongChunks";
import SongEditor, {
  type EditorState,
  type TargetBook,
} from "./components/SongEditor";

const LEGACY_PREVIEW_KEYS: Record<string, OutputId> = {
  local: "out1",
  stream: "out2",
  network: "out2",
};

const readVisiblePreviews = (raw: string | null): OutputId[] => {
  if (raw === null) return [...OUTPUT_IDS];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [...OUTPUT_IDS];
    const wanted = new Set(
      parsed.map((k: string) => LEGACY_PREVIEW_KEYS[k] ?? k),
    );
    const visible = OUTPUT_IDS.filter((id) => wanted.has(id));
    return visible.length > 0 ? visible : [...OUTPUT_IDS];
  } catch {
    return [...OUTPUT_IDS];
  }
};

const callNet = async (
  method: "netStart" | "netStop" | "netStatus",
  id: OutputId,
): Promise<NetStatus | null> => {
  try {
    return (await window.api?.[method]?.(id)) ?? null;
  } catch (err) {
    console.error(`Network output ${id}: ${method} failed`, err);
    return null;
  }
};

const readPaneSizes = (key: string, count: number): number[] | undefined => {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return undefined;
    const v = JSON.parse(raw);
    return Array.isArray(v) &&
      v.length === count &&
      v.every((n) => typeof n === "number" && n >= 0)
      ? v
      : undefined;
  } catch {
    return undefined;
  }
};

const savePaneSizes = (key: string) => (sizes: number[]) => {
  try {
    localStorage.setItem(key, JSON.stringify(sizes));
  } catch (err) {
    console.error(`Failed to persist ${key}`, err);
  }
};

interface EditorContext {
  initial?: EditorState;
  editing?: { source: SongSource; id: string };
  lockTargetBook?: boolean;
}

interface HomeContentProps {
  identity: Identity | null;
  selection: ContentSelection;
  onChangeSelection: (selection: ContentSelection) => void;
}

function HomeContent({
  identity,
  selection,
  onChangeSelection,
}: HomeContentProps) {
  const { t } = useI18n();
  const [selectedItems, setSelectedItems] = usePersistedState<SelectedEntry[]>(
    LS_KEYS.selectedItems,
    [],
    readSelectedEntries,
  );
  const selectedKeys = useMemo(
    () => new Set(selectedItems.map((entry) => entry.key)),
    [selectedItems],
  );
  const [customSongEntries, setCustomSongEntries] = usePersistedState<
    SongEntry[]
  >(LS_KEYS.customSongs, []);
  const customSongs = useMemo(
    () => customSongEntries.map((s) => toApiItem(s, "custom", "")),
    [customSongEntries],
  );
  const {
    dataByBook,
    bookNames,
    findSongById,
    upsertSong,
    deleteSongById,
    loaded: songbooksLoaded,
  } = useSongbooks();

  const { bibles, loaded: biblesLoaded } = useBibles();

  const [outputConfig, setOutputConfig] = usePersistedState<OutputConfig>(
    LS_KEYS.outputConfig,
    DEFAULT_OUTPUT_CONFIG,
    readOutputConfig,
  );
  const [songFooter, setSongFooter] = usePersistedState<FooterConfig>(
    LS_KEYS.songFooter,
    DEFAULT_FOOTER_CONFIG,
  );
  const [translationLabels, setTranslationLabels] =
    usePersistedState<TranslationLabelConfig>(
      LS_KEYS.translationLabels,
      DEFAULT_TRANSLATION_LABELS,
    );
  const [outputs, setOutputs] = usePersistedState<OutputsConfig>(
    LS_KEYS.outputs,
    DEFAULT_OUTPUTS,
    readOutputs,
  );
  const [visiblePreviews, setVisiblePreviews] = usePersistedState<OutputId[]>(
    LS_KEYS.visiblePreviews,
    [...OUTPUT_IDS],
    readVisiblePreviews,
  );
  const shownOutputs = OUTPUT_IDS.filter(
    (id) => outputs[id].enabled && visiblePreviews.includes(id),
  );
  const previewSlot = (id: OutputId) => {
    const index = shownOutputs.indexOf(id);
    const paired = shownOutputs.length > 1;
    return {
      className:
        index === -1
          ? "hidden"
          : `w-full max-w-[64vh] ${
              paired
                ? "@min-[620px]:w-[calc(50%-0.25rem)] @min-[620px]:max-w-[42.6vh]"
                : ""
            }`,
      style: { order: index === -1 ? OUTPUT_IDS.length : index },
    };
  };
  const [dividerWidth, setDividerWidth] = usePersistedState<number>(
    LS_KEYS.dividerWidth,
    3,
    (raw) => {
      const parsed = raw?.trim() ? Number(raw) : NaN;
      return Number.isFinite(parsed) ? parsed : 3;
    },
  );
  const [netStatus, setNetStatus] = useState<Record<OutputId, NetStatus | null>>(
    { out1: null, out2: null },
  );
  const [netBusy, setNetBusy] = useState(false);

  useEffect(() => migrateProfiles(), []);

  const player = useSongPlayer(outputConfig);
  const { sectionLabel, positionText, activeSectionIndex } = player;

  const [editorContext, setEditorContext] = useState<EditorContext | null>(
    null,
  );
  const editorMode = editorContext !== null;

  const [displays, setDisplays] = useState<DisplayInfo[]>([]);
  const [selectedDisplayId, setSelectedDisplayId] = useState<number | null>(
    null,
  );
  const [selectedDisplayId2, setSelectedDisplayId2] = useState<number | null>(
    null,
  );
  const [hdmiActive, setHdmiActive] = useState(false);
  const [hdmi2Active, setHdmi2Active] = useState(false);
  const [blackoutActive, setBlackoutActive] = useState(true);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [contentPickerOpen, setContentPickerOpen] = useState(false);
  const [catalog, setCatalog] = useState<Catalog | null>(null);

  const [freshOffers, setFreshOffers] = useState<string[]>([]);

  useEffect(() => {
    if (!contentPickerOpen || catalog) return;
    (async () => {
      setCatalog(parseCatalog((await window.api?.dataFetchCatalog()) ?? null));
    })();
  }, [contentPickerOpen, catalog]);

  useEffect(() => {
    (async () => {
      const parsed = parseCatalog(
        (await window.api?.dataFetchCatalog()) ?? null,
      );
      if (!parsed) return;
      setCatalog(parsed);
      if (localStorage.getItem(LS_KEYS.seenCatalog) === parsed.version) return;
      const fresh = newlyOffered(parsed, selection, t.common.sermons);
      if (fresh.length > 0) setFreshOffers(fresh);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selectionSummary = [
    ...selection.songbooks.map((key) => SONGBOOK_NAMES[key]),
    ...selection.bibles.map((key) => BIBLE_LABELS[key as BibleKey] ?? key),
    ...(selection.messages ? [t.common.sermonsLower] : []),
  ].join(", ");

  const dismissOffers = () => {
    if (catalog) localStorage.setItem(LS_KEYS.seenCatalog, catalog.version);
    setFreshOffers([]);
  };
  const [mainSizes] = useState(() => readPaneSizes(LS_KEYS.layoutMain, 3));
  const [leftSizes] = useState(() => readPaneSizes(LS_KEYS.layoutLeft, 2));

  useEffect(() => watchSystemTheme(), []);

  useEffect(() => {
    window.api?.setOutputStyle?.({ dividerWidth });
  }, [dividerWidth]);

  const [saveStatus, setSaveStatus] = useState<
    "idle" | "saving" | "saved" | "local" | "error"
  >("idle");
  const [saveDetail, setSaveDetail] = useState<string | null>(null);

  const canEditCloud = identity?.role === "admin";

  const toggleBlackout = () => setBlackoutActive((b) => !b);

  const playItem = (item: ApiItem) => {
    player.sendFirstPart(item);
    player.goToSection(0);
    setBlackoutActive(false);
  };

  const buildBibleItem = (ref: BibleChapterRef): ApiItem | null => {
    const { bibleKey, bookFlatIdx, chapterIdx, bookName, bibleName } = ref;
    const bible = bibles[bibleKey];
    const book = bible ? getBookByFlatIndex(bible, bookFlatIdx) : null;
    const rawVerses = (book?.book.Chapters ?? [])[chapterIdx]?.Verses;
    if (!rawVerses) return null;

    const chapter = chapterIdx + 1;
    const title = `${bookName} ${chapter}`;
    const entries = rawVerses.map((v, i) => {
      const lines = (v.Text || "").split("\n").filter((l) => l.trim() !== "");
      return {
        order: i + 1,
        type: "verse" as const,
        number: v.ID || i + 1,
        lines,
        slides: splitVerseIntoParts(v.Text || "").map((part) =>
          part.split("\n").filter((l) => l.trim() !== ""),
        ),
      };
    });
    const { sections, slides } = buildSectionsAndSlides(entries);
    const fullText = rawVerses
      .map((v, i) => `${v.ID || i + 1}. ${v.Text || ""}`)
      .join("\n\n");

    return {
      id: `bible:${bookName}:${chapter}`,
      number: null,
      title,
      key: null,
      sequence: "",
      source: "custom",
      bookName: bibleName,
      secondaryIsTranslation: false,
      translationLabel: TRANSLATION_LABEL_DEFAULT,
      sections,
      slides,
      fullText,
      searchIndex: "",
      isBible: true,
      bibleMeta: { bookName, chapter, bibleName, bibleKey, bookFlatIdx },
    };
  };

  const showBibleChapter = (
    ref: BibleChapterRef,
    autoSelectVerseIdx?: number,
    goLive = false,
  ) => {
    const item = buildBibleItem(ref);
    if (!item) return;
    player.sendFirstPart(item);
    if (
      autoSelectVerseIdx !== undefined &&
      autoSelectVerseIdx >= 0 &&
      autoSelectVerseIdx < item.sections.length
    ) {
      player.goToSection(autoSelectVerseIdx, goLive);
    }
  };

  const buildMessageItem = async (
    dateKey: string,
    title: string,
  ): Promise<ApiItem | null> => {
    const entry = await getMessageText(dateKey);
    if (!entry || entry.chunks.length === 0) return null;

    const withOrder = entry.chunks.map((c, i) => {
      const isFirstOfParagraph = i === 0 || entry.chunks[i - 1].pnum !== c.pnum;
      const prefix = isFirstOfParagraph ? `${c.pnum}. ` : `${c.pnum}. ... `;
      return {
        order: i + 1,
        type: "verse" as const,
        number: i + 1,
        lines: [prefix + c.text],
        slides: [[prefix + c.text]],
      };
    });
    const { sections, slides } = buildSectionsAndSlides(withOrder);
    const fullText = withOrder.map((v) => v.lines.join("\n")).join("\n\n");

    return {
      id: `msg:${dateKey}`,
      number: null,
      title,
      key: null,
      sequence: "",
      source: "custom",
      bookName: "",
      secondaryIsTranslation: false,
      translationLabel: TRANSLATION_LABEL_DEFAULT,
      sections,
      slides,
      fullText,
      searchIndex: "",
      isMessage: true,
      messageMeta: {
        dateKey,
        title: entry.title || title,
        location: entry.location || "",
        pnums: entry.chunks.map((c) => c.pnum),
      },
    };
  };

  const showMessage = async (
    dateKey: string,
    title: string,
    chunkIdx?: number,
    goLive = false,
  ) => {
    const item = await buildMessageItem(dateKey, title);
    if (!item) return;
    player.sendFirstPart(item);
    if (
      chunkIdx !== undefined &&
      chunkIdx >= 0 &&
      chunkIdx < item.sections.length
    ) {
      player.goToSection(chunkIdx, goLive);
    }
  };

  // The list keeps the spot you were on, so an entry added while reading a
  // verse comes back at that verse rather than at the top of the chapter.
  const selectItem = (item: ApiItem) => {
    const entry = entryFor(item, player.stepIndex);
    if (!entry || selectedKeys.has(entry.key)) return;
    setSelectedItems([...selectedItems, entry]);
  };

  const itemForEntry = async (entry: SelectedEntry): Promise<ApiItem | null> =>
    entry.kind === "song"
      ? entry.item
      : entry.kind === "bible"
        ? buildBibleItem(entry)
        : await buildMessageItem(entry.dateKey, entry.title);

  // A single click only pre-selects: the entry opens in the panel at its saved
  // spot and the outputs keep whatever they were showing.
  const openEntry = async (entry: SelectedEntry, goLive: boolean) => {
    const item = await itemForEntry(entry);
    if (!item) return;
    if (!goLive) {
      player.restoreOpened(item, entry.stepIndex);
      return;
    }
    player.sendFirstPart(item);
    player.goToStep(Math.max(0, entry.stepIndex));
    setBlackoutActive(false);
  };

  const openEditorForNew = () => setEditorContext({});

  const openEditorForExisting = (item: ApiItem) => {
    const targetBook: TargetBook =
      item.source === "custom" ? "custom" : (item.source as SongBookKey);

    const song =
      item.source === "custom"
        ? customSongEntries.find((s) => s.id === item.id)
        : findSongById(item.source as SongBookKey, item.id);
    if (!song) return;

    setEditorContext({
      initial: {
        songName: song.title,
        songNumber: song.number,
        key: song.key,
        sections: songToEditorSections(song),
        targetBook,
        translationLabel: song.text[1]?.translationLabel ?? "",
      },
      editing: { source: item.source, id: item.id },
    });
  };

  const closeEditor = () => setEditorContext(null);

  const showSaveStatus = (
    status: "saving" | "saved" | "local" | "error",
    detail: string | null = null,
  ) => {
    setSaveStatus(status);
    setSaveDetail(detail);
    if (status === "saving") return;
    const ms = status === "saved" ? 2500 : status === "local" ? 4500 : 7000;
    setTimeout(() => {
      setSaveStatus("idle");
      setSaveDetail(null);
    }, ms);
  };

  const refreshSongRefs = (song: SongEntry, book: SongSource) => {
    const item = toApiItem(
      song,
      book,
      book === "custom" ? "" : bookNames[book as SongBookKey],
    );
    if (player.currentSong?.id === song.id) {
      player.sendFirstPart(item);
    }
    const key = songEntryKey(book, song.id);
    setSelectedItems((prev) =>
      prev.map((entry) =>
        entry.kind === "song" && entry.item.id === song.id
          ? { ...entry, key, item }
          : entry,
      ),
    );
  };

  const handleSave = async (state: EditorState) => {
    const editing = editorContext?.editing;
    const target = state.targetBook;
    if (target !== "custom" && !canEditCloud) {
      showSaveStatus("error", t.songSave.publishedAdminOnly);
      return;
    }
    const sourceBook = editing?.source;
    const isMove = !!editing && sourceBook !== target;
    if (isMove && sourceBook !== "custom" && !canEditCloud) {
      showSaveStatus("error", t.songSave.cannotMoveOutOfPublished);
      return;
    }

    const song = buildSongFromEditor({
      songName: state.songName,
      key: state.key,
      number: state.songNumber,
      sections: state.sections,
      translationLabel: state.translationLabel,
      existingId: editing?.id,
    });

    if (target === "custom") {
      const exists = customSongEntries.some((s) => s.id === song.id);
      setCustomSongEntries(
        exists
          ? customSongEntries.map((s) => (s.id === song.id ? song : s))
          : [...customSongEntries, song],
      );
      if (isMove && sourceBook !== "custom") {
        showSaveStatus("saving");
        try {
          const del = await deleteSongById(
            sourceBook as SongBookKey,
            editing!.id,
          );
          if (!del.localOk) {
            showSaveStatus("error", t.songSave.copiedButRemoveFailed);
          } else if (del.cloudOk === true) {
            showSaveStatus("saved", t.songSave.movedToMySongs);
          } else if (del.cloudOk === false) {
            showSaveStatus("error", t.songSave.movedLocallyCloudFailed);
          } else {
            showSaveStatus("local", t.songSave.movedToMySongsLocal);
          }
        } catch (err) {
          console.error("Move delete failed:", err);
          showSaveStatus("error", t.songSave.copiedButRemoveFailed);
        }
      }
      refreshSongRefs(song, "custom");
      closeEditor();
      return;
    }

    showSaveStatus("saving");
    let result: Awaited<ReturnType<typeof upsertSong>>;
    try {
      result = await upsertSong(target, song);
    } catch (err) {
      console.error("Save failed:", err);
      showSaveStatus("error", t.songSave.saveFailed);
      return;
    }
    if (result.refused || !result.localOk) {
      showSaveStatus("error", t.songSave.saveRefused);
      return;
    }

    if (isMove) {
      const targetName = bookNames[target];
      if (sourceBook === "custom") {
        setCustomSongEntries(
          customSongEntries.filter((s) => s.id !== editing!.id),
        );
        if (result.cloudOk === true) {
          showSaveStatus("saved", t.songSave.movedTo(targetName));
        } else if (result.cloudOk === false) {
          showSaveStatus("error", t.songSave.movedToCloudFailed(targetName));
        } else {
          showSaveStatus("local", t.songSave.movedToLocalOnly(targetName));
        }
      } else {
        try {
          const del = await deleteSongById(
            sourceBook as SongBookKey,
            editing!.id,
          );
          if (!del.localOk) {
            showSaveStatus("error", t.songSave.addedButRemoveFailed(targetName));
          } else if (result.cloudOk === true && del.cloudOk === true) {
            showSaveStatus("saved", t.songSave.movedTo(targetName));
          } else if (result.cloudOk === false || del.cloudOk === false) {
            showSaveStatus("error", t.songSave.movedToCloudFailed(targetName));
          } else {
            showSaveStatus("local", t.songSave.movedToLocalOnly(targetName));
          }
        } catch (err) {
          console.error("Move delete failed:", err);
          showSaveStatus("error", t.songSave.addedButRemoveFailed(targetName));
        }
      }
    } else {
      if (result.cloudOk === true) showSaveStatus("saved");
      else if (result.cloudOk === false)
        showSaveStatus("error", t.songSave.savedLocallyCloudFailed);
      else showSaveStatus("local");
    }

    refreshSongRefs(song, target);
    closeEditor();
  };

  const handleDelete = async () => {
    const editing = editorContext?.editing;
    if (!editing) return;

    if (editing.source === "custom") {
      setCustomSongEntries(
        customSongEntries.filter((s) => s.id !== editing.id),
      );
      closeEditor();
      return;
    }

    if (!canEditCloud) {
      showSaveStatus("error", t.songSave.publishedAdminOnly);
      return;
    }

    showSaveStatus("saving");
    let result: Awaited<ReturnType<typeof deleteSongById>>;
    try {
      result = await deleteSongById(editing.source, editing.id);
    } catch (err) {
      console.error("Delete failed:", err);
      showSaveStatus("error", t.songSave.deleteFailed);
      return;
    }

    if (!result.localOk) {
      showSaveStatus("error", t.songSave.deleteFailed);
      return;
    }
    if (result.cloudOk === true)
      showSaveStatus("saved", t.songSave.songDeleted);
    else if (result.cloudOk === false)
      showSaveStatus("error", t.songSave.deletedLocallyCloudFailed);
    else showSaveStatus("local", t.songSave.deletedThisDeviceOnly);

    closeEditor();
  };

  const refreshDisplays = async () => {
    if (!window.api?.getDisplays) return;
    const d = await window.api.getDisplays();
    setDisplays(d);
    const usable = d.filter((x) => !x.isCurrent);
    if (selectedDisplayId === null && usable.length > 0) {
      setSelectedDisplayId(usable[0].id);
    }
    if (selectedDisplayId2 === null && usable.length > 0) {
      setSelectedDisplayId2(usable[usable.length - 1].id);
    }
  };

  const toggleHdmi = async () => {
    if (hdmiActive) {
      window.api?.closeHdmi();
      setHdmiActive(false);
      return;
    }
    if (selectedDisplayId === null) return;
    await window.api?.openHdmi(selectedDisplayId);
    setHdmiActive(true);
  };

  const toggleHdmi2 = async () => {
    if (hdmi2Active) {
      window.api?.closeHdmi2();
      setHdmi2Active(false);
      return;
    }
    if (selectedDisplayId2 === null) return;
    await window.api?.openHdmi2(selectedDisplayId2);
    setHdmi2Active(true);
  };

  // Switching a slot's type or turning it off has to take the previous carrier
  // down with it, otherwise a stale HDMI window or web server keeps serving
  // whatever was last on it.
  useEffect(() => {
    if (!outputs.out1.enabled || outputs.out1.type !== "hdmi") {
      if (hdmiActive) {
        window.api?.closeHdmi();
        setHdmiActive(false);
      }
    }
    if (!outputs.out2.enabled || outputs.out2.type !== "hdmi") {
      if (hdmi2Active) {
        window.api?.closeHdmi2();
        setHdmi2Active(false);
      }
    }
    for (const id of OUTPUT_IDS) {
      const stillIp = outputs[id].enabled && outputs[id].type === "ip";
      if (stillIp || netStatus[id]?.running !== true) continue;
      void callNet("netStop", id).then((next) =>
        setNetStatus((prev) => ({ ...prev, [id]: next })),
      );
    }
  }, [outputs, hdmiActive, hdmi2Active, netStatus]);

  const activeKey = entryKeyFor(player.currentSong);

  const libraryTab = useLibraryState((s) => s.tab);
  const currentSong = player.currentSong;
  const currentStepIndex = player.stepIndex;

  // Every tab keeps the last thing opened from it together with the part the
  // operator stopped on.
  useEffect(() => {
    if (!currentSong) return;
    const entry = entryFor(currentSong, currentStepIndex);
    if (entry) rememberOpened(entry, currentStepIndex);
  }, [currentSong, currentStepIndex]);

  const restoreOpenedForTab = useEffectEvent(async () => {
    const remembered = recallOpened(TAB_KIND[libraryTab]);
    if (!remembered || remembered.entry.key === activeKey) return;
    const item = await itemForEntry(remembered.entry);
    // A sermon is read from disk, so a quick second switch can land first.
    if (item && useLibraryState.getState().tab === libraryTab) {
      player.restoreOpened(item, remembered.stepIndex);
    }
  });

  useEffect(() => {
    void restoreOpenedForTab();
  }, [libraryTab]);

  const liveGroup = displayGroupFor(player.liveSong ?? {});

  const liveTranslationLabel = player.liveSong
    ? player.liveSong.customTranslationLabel ||
      translationLabelOverride(player.liveSong.source, translationLabels) ||
      player.liveSong.translationLabel
    : "";

  const outputHtml = useMemo(() => {
    const build = (id: OutputId) =>
      player.liveSong
        ? buildOutputHtml({
            song: player.liveSong,
            text: id === "out1" ? player.out1Text : player.out2Text,
            sectionLabel,
            chrome: outputSettingsFor(player.liveSong, id, outputConfig).chrome,
            mode: outputs[id].mode,
            footerConfig: songFooter,
            translationLabel: liveTranslationLabel,
          })
        : "";
    return { out1: build("out1"), out2: build("out2") };
  }, [
    player.liveSong,
    player.out1Text,
    player.out2Text,
    sectionLabel,
    outputConfig,
    outputs,
    songFooter,
    liveTranslationLabel,
  ]);

  const hdmiHtml = outputs.out1.type === "hdmi" ? outputHtml.out1 : "";
  const hdmi2Html = outputs.out2.type === "hdmi" ? outputHtml.out2 : "";
  useHdmiSync(1, hdmiActive && outputs.out1.type === "hdmi", hdmiHtml, blackoutActive);
  useHdmiSync(2, hdmi2Active && outputs.out2.type === "hdmi", hdmi2Html, blackoutActive);

  const netRunning = (id: OutputId) => netStatus[id]?.running === true;

  useEffect(() => {
    for (const id of OUTPUT_IDS) {
      if (outputs[id].type !== "ip" || netStatus[id]?.running !== true) continue;
      window.api?.netUpdate?.(id, outputHtml[id]);
    }
  }, [netStatus, outputs, outputHtml]);

  useEffect(() => {
    for (const id of OUTPUT_IDS) {
      if (netStatus[id]?.running !== true) continue;
      window.api?.netBlackout?.(id, blackoutActive);
    }
  }, [netStatus, blackoutActive]);

  useEffect(() => {
    const refresh = async () => {
      const next = {} as Record<OutputId, NetStatus | null>;
      for (const id of OUTPUT_IDS) next[id] = await callNet("netStatus", id);
      setNetStatus(next);
    };
    void refresh();
    window.addEventListener("focus", refresh);
    return () => window.removeEventListener("focus", refresh);
  }, []);

  const toggleNet = async (id: OutputId) => {
    setNetBusy(true);
    const next = await callNet(netRunning(id) ? "netStop" : "netStart", id);
    setNetStatus((prev) => ({ ...prev, [id]: next }));
    setNetBusy(false);
  };

  const [messagesIndexLoaded, setMessagesIndexLoaded] = useState(() =>
    isMessageChunkIndexReady(),
  );
  const [bibleIndexLoaded, setBibleIndexLoaded] = useState(false);

  useEffect(() => {
    prebuildMessageChunkIndex(() => setMessagesIndexLoaded(true));
  }, []);

  useEffect(() => {
    if (!biblesLoaded) return;
    prebuildBibleVerseIndexes(bibles, () => setBibleIndexLoaded(true));
  }, [biblesLoaded, bibles]);

  const TOTAL_PHASES = 4;
  const loadedCount =
    (songbooksLoaded ? 1 : 0) +
    (biblesLoaded ? 1 : 0) +
    (bibleIndexLoaded ? 1 : 0) +
    (messagesIndexLoaded ? 1 : 0);
  const allLoaded = loadedCount === TOTAL_PHASES;
  const loadedRatio = loadedCount / TOTAL_PHASES;

  const MIN_DURATION_MS = 5000;
  const [startedAt] = useState(() =>
    typeof performance !== "undefined" ? performance.now() : 0,
  );
  const [elapsed, setElapsed] = useState(0);
  const linearRatio = Math.min(1, elapsed / MIN_DURATION_MS);
  const easedRatio = 1 - Math.pow(1 - linearRatio, 3);
  const loadingProgress = Math.min(easedRatio, loadedRatio);
  const splashVisible = !allLoaded || elapsed < MIN_DURATION_MS;
  useEffect(() => {
    if (!splashVisible) return;
    let raf = 0;
    const tick = () => {
      setElapsed(performance.now() - startedAt);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [splashVisible, startedAt]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;

      if (e.key === "x" || e.key === "X") {
        e.preventDefault();
        toggleBlackout();
        return;
      }

      if (!player.currentSong) return;
      if (e.key === "ArrowDown" || e.key === " ") {
        e.preventDefault();
        player.navigatePart("next");
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        player.navigatePart("prev");
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        if (player.currentSong.isMessage) player.navigateParagraph("next");
        else player.navigateSection("next");
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        if (player.currentSong.isMessage) player.navigateParagraph("prev");
        else player.navigateSection("prev");
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [player]);

  return (
    <main className="h-screen w-screen bg-background flex flex-col">
      {splashVisible && <LoadingScreen progress={loadingProgress} />}
      <TopBar onOpenSettings={() => setSettingsOpen(true)} />
      <div className="flex-1 min-h-0">
        <Allotment
          defaultSizes={mainSizes}
          onDragEnd={savePaneSizes(LS_KEYS.layoutMain)}
        >
          <Allotment.Pane preferredSize={mainSizes ? undefined : "30%"}>
            <Allotment
              vertical
              defaultSizes={leftSizes}
              onDragEnd={savePaneSizes(LS_KEYS.layoutLeft)}
            >
              <Allotment.Pane preferredSize={leftSizes ? undefined : "40%"}>
                <SelectedPanel
                  customSongs={customSongs}
                  entries={selectedItems}
                  activeKey={activeKey}
                  liveKey={entryKeyFor(player.liveSong)}
                  selectedKeys={selectedKeys}
                  onOpen={(entry, goLive) => void openEntry(entry, goLive)}
                  onShow={player.sendFirstPart}
                  onPlay={playItem}
                  onSelect={selectItem}
                  onRemove={(key) =>
                    setSelectedItems(
                      selectedItems.filter((entry) => entry.key !== key),
                    )
                  }
                  onReorder={(fromKey, toKey) =>
                    setSelectedItems(moveEntry(selectedItems, fromKey, toKey))
                  }
                  onClearAll={() => setSelectedItems([])}
                />
              </Allotment.Pane>

              <Allotment.Pane>
                <Library
                  bibles={bibles}
                  biblesLoaded={biblesLoaded}
                  onShowBibleChapter={showBibleChapter}
                  onShowMessage={showMessage}
                  activeDateKey={
                    player.currentSong?.messageMeta?.dateKey ?? null
                  }
                  activeBibleRef={
                    player.currentSong?.bibleMeta
                      ? {
                          bookName: player.currentSong.bibleMeta.bookName,
                          chapter: player.currentSong.bibleMeta.chapter,
                        }
                      : null
                  }
                  available={{
                    songbooks: selection.songbooks.length > 0,
                    bibles: selection.bibles.length > 0,
                    messages: selection.messages,
                  }}
                  songbooksContent={
                    <SongbooksTree
                      dataByBook={dataByBook}
                      bookNames={bookNames}
                      selectedKeys={selectedKeys}
                      activeItem={player.currentSong}
                      onShow={player.sendFirstPart}
                      onPlay={playItem}
                      onSelect={selectItem}
                    />
                  }
                />
              </Allotment.Pane>
            </Allotment>
          </Allotment.Pane>

          <Allotment.Pane preferredSize={mainSizes ? undefined : "32%"}>
            <div className="h-full flex flex-col bg-surface overflow-hidden">
              {editorMode && editorContext ? (
                <SongEditor
                  initial={editorContext.initial}
                  lockTargetBook={editorContext.lockTargetBook}
                  isEditing={!!editorContext.editing}
                  canEditCloud={canEditCloud}
                  onSave={handleSave}
                  onDelete={editorContext.editing ? handleDelete : undefined}
                  onCancel={closeEditor}
                />
              ) : (
                <>
                  <SelectionHeader
                    currentSong={player.currentSong}
                    onUnselect={player.clearSelection}
                    onRestoreSelection={player.restoreSelection}
                    canRestoreSelection={player.canRestore}
                  />
                  {player.currentSong &&
                  !player.currentSong.isBible &&
                  !player.currentSong.isMessage ? (
                    <SongChunks
                      currentSong={player.currentSong}
                      plan={player.plan}
                      activeStepIndex={player.stepIndex}
                      liveStepIndex={player.liveStepIndex}
                      onGoToStep={(idx) => {
                        player.goToStep(idx);
                        setBlackoutActive(false);
                      }}
                    />
                  ) : (
                    <SectionsList
                      currentSong={player.currentSong}
                      activeSectionIndex={activeSectionIndex}
                      liveSectionIndex={player.liveSectionIndex}
                      onGoToSection={(idx) => {
                        player.goToSection(idx);
                        setBlackoutActive(false);
                      }}
                    />
                  )}
                </>
              )}
              <div className="shrink-0 border-t border-border">
                <ActionBar
                  hasSong={!!player.currentSong}
                  blackoutActive={blackoutActive}
                  onToggleBlackout={toggleBlackout}
                  onNavigatePrev={() => player.navigatePart("prev")}
                  onNavigateNext={() => player.navigatePart("next")}
                  saveStatus={saveStatus}
                  saveDetail={saveDetail}
                  onToggleSelected={
                    !editorMode && player.currentSong && activeKey
                      ? () => {
                          if (selectedKeys.has(activeKey)) {
                            setSelectedItems(
                              selectedItems.filter(
                                (entry) => entry.key !== activeKey,
                              ),
                            );
                          } else {
                            selectItem(player.currentSong!);
                          }
                        }
                      : undefined
                  }
                  isInSelected={!!activeKey && selectedKeys.has(activeKey)}
                  onStartNewSong={
                    editorMode ||
                    player.currentSong?.isBible ||
                    player.currentSong?.isMessage
                      ? undefined
                      : openEditorForNew
                  }
                  onEditCurrentSong={
                    !editorMode &&
                    player.currentSong &&
                    !player.currentSong.isBible &&
                    !player.currentSong.isMessage &&
                    (canEditCloud || player.currentSong.source === "custom")
                      ? () => openEditorForExisting(player.currentSong!)
                      : undefined
                  }
                />
              </div>
            </div>
          </Allotment.Pane>

          <Allotment.Pane>
            <div className="h-full flex flex-col bg-surface overflow-hidden">
              <div className="shrink-0 flex items-center justify-end px-3 pt-2">
                <div className="inline-flex items-center gap-0.5 p-0.5 rounded-md border border-border bg-surface-secondary">
                  {OUTPUT_IDS.filter((id) => outputs[id].enabled).map((id) => (
                    <button
                      key={id}
                      onClick={() =>
                        setVisiblePreviews((prev) =>
                          prev.includes(id)
                            ? prev.filter((k) => k !== id)
                            : [...prev, id],
                        )
                      }
                      title={t.preview.toggleVisibility(
                        outputName(outputs[id], id),
                      )}
                      className={`px-2.5 py-1 text-[10px] font-semibold rounded transition-colors ${
                        visiblePreviews.includes(id)
                          ? "bg-primary text-white"
                          : "text-text-muted hover:bg-surface-hover hover:text-text-primary"
                      }`}
                    >
                      {outputName(outputs[id], id)}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex-1 min-h-0 overflow-y-auto px-2 py-2 flex">
                <div className="@container m-auto w-full flex flex-wrap justify-center items-start gap-2">
                  {OUTPUT_IDS.map((id) => (
                    <div key={id} {...previewSlot(id)}>
                      <OutputPreview
                        id={id}
                        def={outputs[id]}
                        html={outputHtml[id]}
                        blackoutActive={blackoutActive}
                        group={liveGroup}
                        dividerWidth={dividerWidth}
                        positionText={id === "out2" ? positionText : undefined}
                        displays={displays}
                        selectedDisplayId={
                          id === "out1" ? selectedDisplayId : selectedDisplayId2
                        }
                        setSelectedDisplayId={
                          id === "out1"
                            ? setSelectedDisplayId
                            : setSelectedDisplayId2
                        }
                        hdmiActive={id === "out1" ? hdmiActive : hdmi2Active}
                        onToggleHdmi={id === "out1" ? toggleHdmi : toggleHdmi2}
                        onRefreshDisplays={refreshDisplays}
                        netStatus={netStatus[id]}
                        netBusy={netBusy}
                        onToggleNet={() => toggleNet(id)}
                      />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </Allotment.Pane>
        </Allotment>
      </div>
      <SettingsModal
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        identity={identity}
        selection={selection}
        selectionSummary={selectionSummary}
        onOpenContentPicker={() => {
          setSettingsOpen(false);
          setContentPickerOpen(true);
        }}
        outputs={outputs}
        onChangeOutputs={setOutputs}
        outputConfig={outputConfig}
        onChangeOutputConfig={setOutputConfig}
        songFooter={songFooter}
        onChangeSongFooter={setSongFooter}
        translationLabels={translationLabels}
        onChangeTranslationLabels={setTranslationLabels}
        dividerWidth={dividerWidth}
        onChangeDividerWidth={setDividerWidth}
      />
      {freshOffers.length > 0 && !contentPickerOpen && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-30 flex items-center gap-3 px-4 py-2.5 rounded-lg bg-surface border border-primary/40 shadow-xl">
          <Icon name="Sparkles" size={15} className="shrink-0 text-primary" />
          <span className="text-xs text-text-secondary">
            {t.offers.newContentAvailable}{" "}
            <span className="font-semibold text-text-primary">
              {freshOffers.join(", ")}
            </span>
          </span>
          <button
            onClick={() => {
              dismissOffers();
              setContentPickerOpen(true);
            }}
            className="px-2.5 py-1 text-xs font-semibold rounded bg-primary text-white transition-colors hover:bg-primary-hover"
          >
            {t.offers.download}
          </button>
          <button
            onClick={dismissOffers}
            title={t.offers.notNow}
            className="w-6 h-6 flex items-center justify-center rounded text-text-muted hover:bg-surface-hover hover:text-text-primary transition-colors"
          >
            <Icon name="X" size={12} />
          </button>
        </div>
      )}

      {contentPickerOpen && (
        <ContentPicker
          asModal
          showEverything={identity?.role === "admin"}
          catalog={catalog}
          initial={selection}
          onConfirm={(next) => {
            setContentPickerOpen(false);
            onChangeSelection(next);
          }}
          onSkip={() => setContentPickerOpen(false)}
          onCancel={() => setContentPickerOpen(false)}
        />
      )}
    </main>
  );
}

import {
  bootstrap,
  NO_CACHE_ERROR,
  type BootstrapProgress,
} from "./lib/cloudData";

type Stage = "checking" | "auth" | "picker" | "booting" | "ready";

const FULL_SELECTION: ContentSelection = {
  songbooks: ALL_SONGBOOK_KEYS,
  bibles: Object.keys(BIBLE_LABELS),
  messages: true,
};

export default function Home() {
  const { t } = useI18n();
  const [stage, setStage] = useState<Stage>("checking");
  const [identity, setIdentity] = useState<Identity | null>(null);
  const [authMessage, setAuthMessage] = useState<string | null>(null);
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [selection, setSelection] = useState<ContentSelection>(EMPTY_SELECTION);
  const [bootProgress, setBootProgress] = useState<BootstrapProgress>({
    phase: "init",
    ratio: 0,
  });
  const [bootError, setBootError] = useState<string | null>(null);

  const startBoot = (sel: ContentSelection) => {
    setSelection(sel);
    localStorage.setItem(LS_KEYS.contentSelection, JSON.stringify(sel));
    setStage("booting");
    bootstrap((p) => setBootProgress(p), sel)
      .then(() => setStage("ready"))
      .catch((err: Error) =>
        setBootError(
          err?.message === NO_CACHE_ERROR
            ? t.boot.noCloudNoCache
            : err?.message || t.boot.bootstrapFailed,
        ),
      );
  };

  const afterAuth = async (who: Identity) => {
    setIdentity(who);
    localStorage.setItem(LS_KEYS.identity, JSON.stringify(who));

    const stored = localStorage.getItem(LS_KEYS.contentSelection);
    if (stored) {
      startBoot(normalizeSelection(JSON.parse(stored)));
      return;
    }
    if (who.role === "admin") {
      startBoot(FULL_SELECTION);
      return;
    }
    setCatalog(parseCatalog((await window.api?.dataFetchCatalog()) ?? null));
    setStage("picker");
  };

  useEffect(() => {
    (async () => {
      const api = window.api;
      if (!api) {
        setStage("ready");
        return;
      }

      if (await api.dataLocalMode?.()) {
        setIdentity({
          role: "admin",
          orgId: "local",
          name: t.boot.localDataMode,
        });
        startBoot(FULL_SELECTION);
        return;
      }

      const result = await api.authWhoami();
      if (result.ok && result.identity) {
        await afterAuth(result.identity);
        return;
      }

      const cachedRaw = localStorage.getItem(LS_KEYS.identity);
      const serverTooOld = result.status === 404;
      if (
        (result.offline || serverTooOld) &&
        cachedRaw &&
        (await api.dataHasLocal())
      ) {
        const cached = JSON.parse(cachedRaw) as Identity;
        setIdentity(cached);
        startBoot(
          normalizeSelection(
            JSON.parse(
              localStorage.getItem(LS_KEYS.contentSelection) ?? "null",
            ),
          ),
        );
        return;
      }

      if (result.status === 401 && cachedRaw) {
        setAuthMessage(t.boot.tokenExpired);
        localStorage.removeItem(LS_KEYS.identity);
      }
      setStage("auth");
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (bootError) {
    return (
      <main className="h-screen w-screen bg-background flex items-center justify-center">
        <div className="max-w-md text-center px-8">
          <h2 className="text-xl font-semibold text-text-primary mb-2">
            {t.boot.cannotLoadData}
          </h2>
          <p className="text-sm text-text-muted">{bootError}</p>
          <p className="text-xs text-text-muted mt-4">
            {t.boot.connectAndRestart}
          </p>
        </div>
      </main>
    );
  }

  if (stage === "auth") {
    return (
      <TokenGate
        initialMessage={authMessage}
        onAuthorized={(who) => void afterAuth(who)}
      />
    );
  }

  if (stage === "picker") {
    return (
      <ContentPicker
        catalog={catalog}
        showEverything={identity?.role === "admin"}
        initial={selection}
        onConfirm={startBoot}
        onSkip={() => startBoot(EMPTY_SELECTION)}
      />
    );
  }

  if (stage === "checking") {
    return (
      <main className="h-screen w-screen bg-background">
        <LoadingScreen progress={0} message={t.boot.connecting} />
      </main>
    );
  }

  if (stage === "booting") {
    const label =
      bootProgress.phase === "downloading"
        ? t.boot.downloadingData(bootProgress.currentFile ?? "")
        : bootProgress.phase === "checking"
          ? t.boot.checkingForData
          : t.boot.connecting;
    return (
      <main className="h-screen w-screen bg-background">
        <LoadingScreen progress={bootProgress.ratio} message={label} />
      </main>
    );
  }

  return (
    <HomeContent
      identity={identity}
      selection={selection}
      onChangeSelection={startBoot}
    />
  );
}
