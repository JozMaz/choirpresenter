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

function HomeContent() {
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
  const [out2Bg, setOut2Bg] = usePersistedState<string>(
    LS_KEYS.out2Bg,
    "#000000",
    (raw) => raw,
  );
  const [out2SecondLang, setOut2SecondLang] = usePersistedState<boolean>(
    LS_KEYS.out2SecondLang,
    false,
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
    setSelectedItems((prev) =>
      prev.map((i) => (i.id === song.id ? item : i)),
    );
  };

  const handleSave = async (state: EditorState) => {
    const editing = editorContext?.editing;
    const target = state.targetBook;
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
      setCustomSongEntries(customSongEntries.filter((s) => s.id !== editing.id));
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
        player.navigateSection("next");
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        player.navigateSection("prev");
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
                onSave={handleSave}
                onDelete={editorContext.editing ? handleDelete : undefined}
                onCancel={closeEditor}
              />
            ) : player.currentSong &&
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
                                !(i.id === song.id && i.source === song.source),
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
                  !player.currentSong.isMessage
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
                <div className="w-full" style={{ maxWidth: "calc(36vh * 16 / 9)" }}>
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
                <div className="w-full" style={{ maxWidth: "calc(36vh * 16 / 9)" }}>
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
        out2Bg={out2Bg}
        onChangeOut2Bg={setOut2Bg}
        out2SecondLang={out2SecondLang}
        onChangeOut2SecondLang={setOut2SecondLang}
      />
    </main>
  );
}

import { bootstrap, type BootstrapProgress } from "./lib/cloudData";

export default function Home() {
  const [bootDone, setBootDone] = useState(false);
  const [bootProgress, setBootProgress] = useState<BootstrapProgress>({
    phase: "init",
    ratio: 0,
  });
  const [bootError, setBootError] = useState<string | null>(null);

  useEffect(() => {
    bootstrap((p) => setBootProgress(p))
      .then(() => setBootDone(true))
      .catch((err: Error) =>
        setBootError(err?.message || "Failed to bootstrap data."),
      );
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

  if (!bootDone) {
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

  return <HomeContent />;
}
