"use client";

import { Allotment } from "allotment";
import "allotment/dist/style.css";
import { useEffect, useMemo, useState } from "react";

import { getMessageText } from "./lib/messageIndex";

import type {
  ApiItem,
  DisplayInfo,
  SongBookKey,
  SongEntry,
  SongSource,
} from "./lib/types";
import { LS_KEYS, TRANSLATION_LABEL_DEFAULT } from "./lib/constants";
import { DEFAULT_FOOTER_CONFIG, type FooterConfig } from "./lib/footerConfig";
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
import { buildHdmiHtml, buildHdmi2Html } from "./lib/hdmiHtml";
import { buildSongFromEditor, songToEditorSections } from "./lib/songSerialize";
import { toApiItem } from "./lib/songAdapter";
import { splitVerseIntoParts } from "./lib/bibleSlides";
import { buildSectionsAndSlides } from "./lib/songSchema";

import { usePersistedState } from "./hooks/usePersistedState";
import { watchSystemTheme } from "./lib/theme";
import {
  useSongPlayer,
  getCurrentSectionLabel,
  getCurrentPosition,
  getActiveSectionIndex,
} from "./hooks/useSongPlayer";
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
import LocalPreview from "./components/LocalPreview";
import StreamPreview from "./components/StreamPreview";
import SectionsList from "./components/SectionsList";
import SettingsModal from "./components/SettingsModal";
import SongChunks from "./components/SongChunks";
import SongEditor, {
  type EditorState,
  type TargetBook,
} from "./components/SongEditor";

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
  const [selectedItems, setSelectedItems] = usePersistedState<ApiItem[]>(
    LS_KEYS.selectedItems,
    [],
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

  const player = useSongPlayer();
  const sectionLabel = getCurrentSectionLabel(player);
  const positionText = getCurrentPosition(player);
  const activeSectionIndex = getActiveSectionIndex(player);

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
      const fresh = newlyOffered(parsed, selection);
      if (fresh.length > 0) setFreshOffers(fresh);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const dismissOffers = () => {
    if (catalog) localStorage.setItem(LS_KEYS.seenCatalog, catalog.version);
    setFreshOffers([]);
  };
  const [out2Bg, setOut2Bg] = usePersistedState<string>(
    LS_KEYS.out2Bg,
    "#000000",
    (raw) => raw,
  );
  const [out2SecondLang, setOut2SecondLang] = usePersistedState<boolean>(
    LS_KEYS.out2SecondLang,
    false,
  );
  const [songFooter, setSongFooter] = usePersistedState<FooterConfig>(
    LS_KEYS.songFooter,
    DEFAULT_FOOTER_CONFIG,
  );

  const [mainSizes] = useState(() => readPaneSizes(LS_KEYS.layoutMain, 3));
  const [leftSizes] = useState(() => readPaneSizes(LS_KEYS.layoutLeft, 2));

  useEffect(() => watchSystemTheme(), []);

  useEffect(() => {
    window.api?.setHdmi2Config?.({ bg: out2Bg });
  }, [out2Bg]);
  const [saveStatus, setSaveStatus] = useState<
    "idle" | "saving" | "saved" | "local" | "error"
  >("idle");
  const [saveDetail, setSaveDetail] = useState<string | null>(null);

  const canEditCloud = identity?.role === "admin";

  const toggleBlackout = () => setBlackoutActive((b) => !b);

  const showBibleChapter = (
    rawVerses: { Text?: string; ID?: number }[],
    bookName: string,
    chapter: number,
    bibleName: string,
    autoSelectVerseIdx?: number,
  ) => {
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

    const item: ApiItem = {
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
      bibleMeta: { bookName, chapter, bibleName },
    };
    player.sendFirstPart(item);
    if (
      autoSelectVerseIdx !== undefined &&
      autoSelectVerseIdx >= 0 &&
      autoSelectVerseIdx < sections.length
    ) {
      player.goToSection(autoSelectVerseIdx);
    }
  };

  const showMessage = async (
    dateKey: string,
    title: string,
    chunkIdx?: number,
  ) => {
    const entry = await getMessageText(dateKey);
    if (!entry || entry.chunks.length === 0) return;

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

    const item: ApiItem = {
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
    player.sendFirstPart(item);
    if (chunkIdx !== undefined && chunkIdx >= 0 && chunkIdx < sections.length) {
      player.goToSection(chunkIdx);
      setBlackoutActive(true);
    }
  };

  const selectItem = (item: ApiItem) => {
    if (
      !selectedItems.find((i) => i.id === item.id && i.source === item.source)
    ) {
      setSelectedItems([...selectedItems, item]);
    }
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
    setSelectedItems((prev) => prev.map((i) => (i.id === song.id ? item : i)));
  };

  const handleSave = async (state: EditorState) => {
    const editing = editorContext?.editing;
    const target = state.targetBook;
    if (target !== "custom" && !canEditCloud) {
      showSaveStatus(
        "error",
        "Published songbooks can only be changed by the administrator.",
      );
      return;
    }
    const sourceBook = editing?.source;
    const isMove = !!editing && sourceBook !== target;

    const song = buildSongFromEditor({
      songName: state.songName,
      key: state.key,
      number: state.songNumber,
      sections: state.sections,
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
            showSaveStatus(
              "error",
              "Copied to My Songs, but removing from the old songbook failed — song is now in both.",
            );
          } else if (del.cloudOk === true) {
            showSaveStatus("saved", "Moved to My Songs");
          } else if (del.cloudOk === false) {
            showSaveStatus(
              "error",
              "Moved locally, but cloud sync failed — others still see it in the old songbook.",
            );
          } else {
            showSaveStatus("local", "Moved to My Songs (this device only)");
          }
        } catch (err) {
          console.error("Move delete failed:", err);
          showSaveStatus(
            "error",
            "Copied to My Songs, but removing from the old songbook failed — song is now in both.",
          );
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
      showSaveStatus("error", "Save failed — nothing was changed.");
      return;
    }
    if (result.refused || !result.localOk) {
      showSaveStatus(
        "error",
        "Save was refused — nothing was changed. Check the data and try again.",
      );
      return;
    }

    if (isMove) {
      const targetName = bookNames[target];
      if (sourceBook === "custom") {
        setCustomSongEntries(
          customSongEntries.filter((s) => s.id !== editing!.id),
        );
        if (result.cloudOk === true) {
          showSaveStatus("saved", `Moved to ${targetName}`);
        } else if (result.cloudOk === false) {
          showSaveStatus(
            "error",
            `Moved to ${targetName} locally, but cloud sync failed.`,
          );
        } else {
          showSaveStatus("local", `Moved to ${targetName} (this device only)`);
        }
      } else {
        try {
          const del = await deleteSongById(
            sourceBook as SongBookKey,
            editing!.id,
          );
          if (!del.localOk) {
            showSaveStatus(
              "error",
              `Added to ${targetName}, but removing from the old songbook failed — song is now in both.`,
            );
          } else if (result.cloudOk === true && del.cloudOk === true) {
            showSaveStatus("saved", `Moved to ${targetName}`);
          } else if (result.cloudOk === false || del.cloudOk === false) {
            showSaveStatus(
              "error",
              `Moved to ${targetName} locally, but cloud sync failed.`,
            );
          } else {
            showSaveStatus(
              "local",
              `Moved to ${targetName} (this device only)`,
            );
          }
        } catch (err) {
          console.error("Move delete failed:", err);
          showSaveStatus(
            "error",
            `Added to ${targetName}, but removing from the old songbook failed — song is now in both.`,
          );
        }
      }
    } else {
      if (result.cloudOk === true) showSaveStatus("saved");
      else if (result.cloudOk === false)
        showSaveStatus("error", "Saved locally, but cloud sync failed.");
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
    } else {
      await deleteSongById(editing.source, editing.id);
    }
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

  const hdmiHtml = buildHdmiHtml({
    currentSong: player.liveSong,
    output1: player.output1,
    sectionLabel,
    isTranslation: player.output1.isTranslation === true,
    footerConfig: songFooter,
  });
  const hdmi2Html = buildHdmi2Html(
    player.liveSong,
    player.output2,
    sectionLabel,
    player.output2.isTranslation === true,
    out2SecondLang,
  );
  useHdmiSync(1, hdmiActive, hdmiHtml, blackoutActive);
  useHdmiSync(2, hdmi2Active, hdmi2Html, blackoutActive);

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
                  selectedItems={selectedItems}
                  onShow={player.sendFirstPart}
                  onSelect={selectItem}
                  onRemove={(id, source) =>
                    setSelectedItems(
                      selectedItems.filter(
                        (item) => !(item.id === id && item.source === source),
                      ),
                    )
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
                  available={{
                    songbooks: selection.songbooks.length > 0,
                    bibles: selection.bibles.length > 0,
                    messages: selection.messages,
                  }}
                  songbooksContent={
                    <SongbooksTree
                      dataByBook={dataByBook}
                      bookNames={bookNames}
                      selectedItems={selectedItems}
                      onShow={player.sendFirstPart}
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
                      activeSlideIndex={player.slideIndex}
                      onGoToSlide={(idx) => {
                        player.goToSlide(idx);
                        setBlackoutActive(false);
                      }}
                    />
                  ) : (
                    <SectionsList
                      currentSong={player.currentSong}
                      activeSectionIndex={activeSectionIndex}
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
                    !editorMode &&
                    player.currentSong &&
                    !player.currentSong.isBible &&
                    !player.currentSong.isMessage
                      ? () => {
                          const song = player.currentSong!;
                          const isIn = selectedItems.some(
                            (i) => i.id === song.id && i.source === song.source,
                          );
                          if (isIn) {
                            setSelectedItems(
                              selectedItems.filter(
                                (i) =>
                                  !(
                                    i.id === song.id && i.source === song.source
                                  ),
                              ),
                            );
                          } else {
                            selectItem(song);
                          }
                        }
                      : undefined
                  }
                  isInSelected={
                    !!player.currentSong &&
                    selectedItems.some(
                      (i) =>
                        i.id === player.currentSong!.id &&
                        i.source === player.currentSong!.source,
                    )
                  }
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
              <div className="flex-1 min-h-0 overflow-y-auto px-2 py-2 flex">
                <div className="m-auto w-full flex flex-col items-center gap-2">
                  <div
                    className="w-full"
                    style={{ maxWidth: "calc(36vh * 16 / 9)" }}
                  >
                    <StreamPreview
                      html={hdmi2Html}
                      positionText={positionText}
                      blackoutActive={blackoutActive}
                      bg={out2Bg}
                      displays={displays}
                      selectedDisplayId={selectedDisplayId2}
                      setSelectedDisplayId={setSelectedDisplayId2}
                      hdmiActive={hdmi2Active}
                      onToggleHdmi={toggleHdmi2}
                      onRefreshDisplays={refreshDisplays}
                    />
                  </div>
                  <div
                    className="w-full"
                    style={{ maxWidth: "calc(36vh * 16 / 9)" }}
                  >
                    <LocalPreview
                      html={hdmiHtml}
                      blackoutActive={blackoutActive}
                      displays={displays}
                      selectedDisplayId={selectedDisplayId}
                      setSelectedDisplayId={setSelectedDisplayId}
                      hdmiActive={hdmiActive}
                      onToggleHdmi={toggleHdmi}
                      onRefreshDisplays={refreshDisplays}
                    />
                  </div>
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
        onOpenContentPicker={() => {
          setSettingsOpen(false);
          setContentPickerOpen(true);
        }}
        out2Bg={out2Bg}
        onChangeOut2Bg={setOut2Bg}
        out2SecondLang={out2SecondLang}
        songFooter={songFooter}
        onChangeSongFooter={setSongFooter}
        onChangeOut2SecondLang={setOut2SecondLang}
      />
      {freshOffers.length > 0 && !contentPickerOpen && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-30 flex items-center gap-3 px-4 py-2.5 rounded-lg bg-surface border border-primary/40 shadow-xl">
          <Icon name="Sparkles" size={15} className="shrink-0 text-primary" />
          <span className="text-xs text-text-secondary">
            New content available:{" "}
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
            Download
          </button>
          <button
            onClick={dismissOffers}
            title="Not now"
            className="w-6 h-6 flex items-center justify-center rounded text-text-muted hover:bg-surface-hover hover:text-text-primary transition-colors"
          >
            <Icon name="X" size={12} />
          </button>
        </div>
      )}

      {contentPickerOpen && (
        <ContentPicker
          asModal
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

import { bootstrap, type BootstrapProgress } from "./lib/cloudData";

type Stage = "auth" | "picker" | "booting" | "ready";

const LOCAL_DEV_IDENTITY: Identity = {
  role: "admin",
  orgId: "local",
  name: "Local data mode",
};

const FULL_SELECTION: ContentSelection = {
  songbooks: ALL_SONGBOOK_KEYS,
  bibles: ["gdanska", "warszawska"],
  messages: true,
};

export default function Home() {
  const [stage, setStage] = useState<Stage>("auth");
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
        setBootError(err?.message || "Failed to bootstrap data."),
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
        setIdentity(LOCAL_DEV_IDENTITY);
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
        setAuthMessage(
          "The token is no longer valid. Ask the administrator for a new one.",
        );
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
            Cannot load data
          </h2>
          <p className="text-sm text-text-muted">{bootError}</p>
          <p className="text-xs text-text-muted mt-4">
            Connect to internet and restart the app.
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
        initial={selection}
        onConfirm={startBoot}
        onSkip={() => startBoot(EMPTY_SELECTION)}
      />
    );
  }

  if (stage === "booting") {
    const label =
      bootProgress.phase === "downloading"
        ? `Downloading data — ${bootProgress.currentFile ?? ""}`
        : bootProgress.phase === "checking"
          ? "Checking for data..."
          : "Connecting...";
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
