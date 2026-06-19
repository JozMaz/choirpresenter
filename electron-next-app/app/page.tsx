"use client";

import { Allotment } from "allotment";
import "allotment/dist/style.css";
import { useEffect, useState } from "react";

import { getMessageText } from "./lib/messageIndex";

import type {
  ApiItem,
  DisplayInfo,
  SongBookKey,
  SongSource,
} from "./lib/types";
import { LS_KEYS, STARTING_CUSTOM_ID } from "./lib/constants";
import { buildSearchIndex } from "./lib/textUtils";
import {
  isMessageChunkIndexReady,
  prebuildMessageChunkIndex,
} from "./lib/messageIndex";
import { prebuildBibleVerseIndexes } from "./lib/bibleIndex";
import { buildHdmiHtml, buildHdmi2Html } from "./lib/hdmiHtml";
import {
  apiItemToEditorSections,
  buildSongFromEditor,
  getNextSongbookId,
} from "./lib/songSerialize";
import {
  processBilingualSongbook,
  processPlOnlySongbook,
} from "./lib/songProcessing";

import { usePersistedState } from "./hooks/usePersistedState";
import {
  useSongPlayer,
  getCurrentSectionLabel,
  getCurrentPosition,
  getActiveSectionIndex,
} from "./hooks/useSongPlayer";
import { useHdmiSync } from "./hooks/useHdmiSync";
import { useSongbooks } from "./hooks/useSongbooks";
import { useBibles } from "./hooks/useBibles";

import Library from "./components/Library";
import LoadingScreen from "./components/LoadingScreen";
import SongbooksTree from "./components/SongbooksTree";
import SelectedPanel from "./components/SelectedPanel";
import LocalPreview from "./components/LocalPreview";
import StreamPreview from "./components/StreamPreview";
import SectionsList from "./components/SectionsList";
import SettingsModal from "./components/SettingsModal";
import SongEditor, {
  type EditorState,
  type TargetBook,
} from "./components/SongEditor";

/** Co editor aktuálně edituje (pre-fill + co dělat při save/delete). */
interface EditorContext {
  initial?: EditorState;
  /** Při editaci existující písně – identifikuje původní záznam. */
  editing?: { source: SongSource; id: number };
  lockTargetBook?: boolean;
}

function HomeContent() {
  // ===== SEARCH =====

  // ===== PERSISTED STATE =====
  const [selectedItems, setSelectedItems] = usePersistedState<ApiItem[]>(
    LS_KEYS.selectedItems,
    [],
  );
  const [customSongs, setCustomSongs] = usePersistedState<ApiItem[]>(
    LS_KEYS.customSongs,
    [],
  );
  const [nextCustomId, setNextCustomId] = usePersistedState<number>(
    LS_KEYS.nextCustomId,
    STARTING_CUSTOM_ID,
    (raw) => Number(raw) || STARTING_CUSTOM_ID,
  );

  // ===== SONGBOOKS =====
  const {
    dataByBook,
    raw: rawSongbooks,
    findSong,
    upsertSong,
    deleteSong,
    loaded: songbooksLoaded,
  } = useSongbooks();

  // ===== BIBLES =====
  const { bibles, loaded: biblesLoaded } = useBibles();

  // ===== SONG PLAYER =====
  const player = useSongPlayer();
  const sectionLabel = getCurrentSectionLabel(player);
  const positionText = getCurrentPosition(player);
  const activeSectionIndex = getActiveSectionIndex(player);

  // ===== EDITOR =====
  const [editorContext, setEditorContext] = useState<EditorContext | null>(
    null,
  );
  const editorMode = editorContext !== null;

  // ===== HDMI =====
  const [displays, setDisplays] = useState<DisplayInfo[]>([]);
  const [selectedDisplayId, setSelectedDisplayId] = useState<number | null>(
    null,
  );
  const [selectedDisplayId2, setSelectedDisplayId2] = useState<number | null>(
    null,
  );
  const [hdmiActive, setHdmiActive] = useState(false);
  const [hdmi2Active, setHdmi2Active] = useState(false);
  // Defaultně ON — po refreshi je vždy černá obrazovka, dokud Moon nezpypne.
  const [blackoutActive, setBlackoutActive] = useState(true);
  const [settingsOpen, setSettingsOpen] = useState(false);
  /**
   * Stav uložení:
   * - "idle" → nic se neukládá
   * - "saving" → běží PUT na cloud (UI ukazuje spinner)
   * - "saved" → cloud OK (UI ukazuje checkmark, fade po 2s)
   * - "local" → local OK, cloud failed/skipped (warning, fade po 4s)
   * - "error" → vše selhalo
   */
  const [saveStatus, setSaveStatus] = useState<
    "idle" | "saving" | "saved" | "local" | "error"
  >("idle");

  const toggleBlackout = () => setBlackoutActive((b) => !b);

  // ===== BIBLE CHAPTER → PLAYER =====
  /** Celá biblická kapitola se přepošle jako "píseň" v bible módu. */
  const showBibleChapter = (
    rawVerses: { Text?: string; ID?: number }[],
    bookName: string,
    chapter: number,
    bibleName: string,
    autoSelectVerseIdx?: number,
  ) => {
    const verses = rawVerses.map((v, i) => ({
      Text: v.Text || "",
      ID: v.ID || i + 1,
    }));
    const sequence = verses.map((v) => `V${v.ID}`).join(" ");
    const fullText = verses.map((v) => `${v.ID}. ${v.Text}`).join("\n\n");
    const title = `${bookName} ${chapter}`;

    const item: ApiItem = {
      id: -1,
      text: title,
      title,
      fullText,
      selected: false,
      sequence,
      verses,
      key: "",
      source: "custom",
      searchIndex: "",
      isBible: true,
      bibleMeta: { bookName, chapter, bibleName },
    };
    player.sendFirstPart(item);
    // Pokud uživatel klikl výsledek vyhledávání, rovnou ten verš ukaž.
    if (
      autoSelectVerseIdx !== undefined &&
      autoSelectVerseIdx >= 0 &&
      autoSelectVerseIdx < verses.length
    ) {
      player.goToSection(autoSelectVerseIdx);
    }
  };

  // ===== MESSAGE → PLAYER =====
  /** Načte sermon text jako "píseň" v message módu, každý wmb chunk = sekce. */
  const showMessage = async (
    dateKey: string,
    title: string,
    chunkIdx?: number,
  ) => {
    const entry = await getMessageText(dateKey);
    if (!entry || entry.chunks.length === 0) return;

    // Prefix: "1. text" pro první chunk paragrafu, "1. ... text" pro další chunky uvnitř.
    const verses = entry.chunks.map((c, i) => {
      const isFirstOfParagraph = i === 0 || entry.chunks[i - 1].pnum !== c.pnum;
      const prefix = isFirstOfParagraph ? `${c.pnum}. ` : `${c.pnum}. ... `;
      return {
        Text: prefix + c.text,
        ID: i + 1,
      };
    });
    const sequence = verses.map((v) => `V${v.ID}`).join(" ");
    const fullText = verses.map((v) => v.Text).join("\n\n");

    const item: ApiItem = {
      id: -2,
      text: title,
      title,
      fullText,
      selected: false,
      sequence,
      verses,
      key: "",
      source: "custom",
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
    // Search výsledek na konkrétní chunk: skoč na ten chunk (SectionsList scrollne
    // a označí jako aktivní), ALE rovnou aktivuj blackout — text je sice připravený,
    // na preview/HDMI ale neviditelný. Uživatel si nejdřív v SectionsList ověří,
    // co to je, a teprve pak klikne Moon ikonu pro odhalení.
    if (chunkIdx !== undefined && chunkIdx >= 0 && chunkIdx < verses.length) {
      player.goToSection(chunkIdx);
      setBlackoutActive(true);
    }
  };

  // ===== SELECTION HANDLERS =====
  const selectItem = (item: ApiItem) => {
    if (
      !selectedItems.find((i) => i.id === item.id && i.source === item.source)
    ) {
      setSelectedItems([...selectedItems, { ...item, selected: true }]);
    }
  };

  const removeItem = (id: number, source: SongSource) => {
    setSelectedItems(
      selectedItems.filter(
        (item) => !(item.id === id && item.source === source),
      ),
    );
  };

  // ===== EDITOR HANDLERS =====
  const openEditorForNew = () => setEditorContext({});

  const openEditorForExisting = (item: ApiItem) => {
    const targetBook: TargetBook =
      item.source === "custom" ? "custom" : (item.source as SongBookKey);

    setEditorContext({
      initial: {
        songName: item.title,
        key: item.key || "C",
        sections: apiItemToEditorSections(item),
        targetBook,
      },
      editing: { source: item.source, id: item.id },
      lockTargetBook: true,
    });
  };

  const closeEditor = () => setEditorContext(null);

  const handleSave = async (state: EditorState) => {
    const editing = editorContext?.editing;

    if (state.targetBook === "custom") {
      // Custom song saved to localStorage
      const id = editing?.source === "custom" ? editing.id : nextCustomId;
      const apiItem: ApiItem = {
        ...buildApiItemForCustom(state, id),
      };

      if (editing?.source === "custom") {
        setCustomSongs(
          customSongs.map((s) => (s.id === editing.id ? apiItem : s)),
        );
      } else {
        setCustomSongs([...customSongs, apiItem]);
        setNextCustomId(nextCustomId + 1);
      }
      closeEditor();
      return;
    }

    // Save to a songbook file
    const book = state.targetBook;
    const existingRaw =
      editing && editing.source === book
        ? findSong(book, editing.id)
        : undefined;

    const nextId =
      existingRaw?.ID ?? getNextSongbookId(rawSongbooks[book] || []) + 1;

    const song = buildSongFromEditor({
      songName: state.songName,
      key: state.key,
      sections: state.sections,
      targetBook: book,
      existing: existingRaw,
      nextId,
    });

    setSaveStatus("saving");
    const result = await upsertSong(book, song);
    if (result.cloudOk === true) setSaveStatus("saved");
    else if (result.cloudOk === false) setSaveStatus("error");
    else setSaveStatus("local"); // null = no token, local only
    closeEditor();

    // Pokud uživatel měl právě tu píseň otevřenou v playeru, refresh ji,
    // ať se aktualizované sekce hned ukážou v SectionsList + preview/HDMI.
    if (
      editing?.source === book &&
      player.currentSong?.id === editing.id &&
      player.currentSong?.source === book
    ) {
      const newItem = (
        book === "newSongPlGb" || book === "roboczy" || book === "children"
          ? processBilingualSongbook(song, book)
          : processPlOnlySongbook(song, book)
      );
      player.sendFirstPart(newItem);
    }

    // Auto-reset indicator
    const resetMs =
      result.cloudOk === true ? 2000 : result.cloudOk === false ? 5000 : 3000;
    setTimeout(() => setSaveStatus("idle"), resetMs);
  };

  const handleDelete = async () => {
    const editing = editorContext?.editing;
    if (!editing) return;

    if (editing.source === "custom") {
      setCustomSongs(customSongs.filter((s) => s.id !== editing.id));
    } else {
      await deleteSong(editing.source, editing.id);
    }
    closeEditor();
  };

  // ===== HDMI HANDLERS =====
  const refreshDisplays = async () => {
    if (!window.api?.getDisplays) return;
    const d = await window.api.getDisplays();
    setDisplays(d);
    if (selectedDisplayId === null && d.length > 0) {
      const secondary = d.find((x) => !x.primary);
      setSelectedDisplayId(secondary?.id ?? d[0].id);
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

  // ===== HDMI SYNC =====
  /** Aktuální verš (v PL/EN módu) je jen překlad? → EN část se renderuje italic. */
  const currentVerseIsTranslation =
    player.allVersesParts[player.currentVerseIndex]?.isTranslation === true;

  const hdmiHtml = buildHdmiHtml({
    currentSong: player.currentSong,
    output1Text: player.output1Text,
    sectionLabel,
    isTranslation: currentVerseIsTranslation,
  });
  const hdmi2Html = buildHdmi2Html(
    player.currentSong,
    player.output2Text,
    sectionLabel,
    currentVerseIsTranslation,
  );
  useHdmiSync(1, hdmiActive, hdmiHtml, blackoutActive);
  useHdmiSync(2, hdmi2Active, hdmi2Html, blackoutActive);

  // ===== LOADING STATE =====
  const [messagesIndexLoaded, setMessagesIndexLoaded] = useState(() =>
    isMessageChunkIndexReady(),
  );
  const [bibleIndexLoaded, setBibleIndexLoaded] = useState(false);

  // Předpočítá Messages search index na pozadí po prvním paintu,
  // ať switch na Messages tab je instant (jinak ~2s lag při prvním otevření).
  useEffect(() => {
    prebuildMessageChunkIndex(() => setMessagesIndexLoaded(true));
  }, []);

  // Bible verse index buduj až po načtení biblí (data jsou potřeba),
  // pak na pozadí, ať switch na Bible tab je taky instant.
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

  // Plynulá animace progress baru: i když fáze rychle hop hop hop dokončí,
  // bar leze plynule od 0 % nahoru a splash zůstane viditelný
  // alespoň MIN_DURATION_MS ms. Easing easeOutCubic dělá pohyb "klidným" —
  // bar startuje rychleji, ke konci se zpomaluje a "usadí" se na 100 %.
  const MIN_DURATION_MS = 5000;
  const [startedAt] = useState(() =>
    typeof performance !== "undefined" ? performance.now() : 0,
  );
  const [elapsed, setElapsed] = useState(0);
  const linearRatio = Math.min(1, elapsed / MIN_DURATION_MS);
  const easedRatio = 1 - Math.pow(1 - linearRatio, 3); // easeOutCubic
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

  // ===== KEYBOARD NAVIGATION =====
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!player.currentSong) return;
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;

      if (e.key === "ArrowRight" || e.key === "ArrowDown") {
        e.preventDefault();
        player.navigatePart("next");
      } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
        e.preventDefault();
        player.navigatePart("prev");
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [player]);

  // ===== RENDER =====
  return (
    <main className="h-screen w-screen bg-background">
      {splashVisible && <LoadingScreen progress={loadingProgress} />}
      <Allotment>
        <Allotment.Pane preferredSize="30%">
          <Allotment vertical>
            <Allotment.Pane preferredSize="60%">
              <Library
                bibles={bibles}
                biblesLoaded={biblesLoaded}
                onShowBibleChapter={showBibleChapter}
                onShowMessage={showMessage}
                songbooksContent={
                  <SongbooksTree
                    dataByBook={dataByBook}
                    selectedItems={selectedItems}
                    onShow={player.sendFirstPart}
                    onSelect={selectItem}
                  />
                }
              />
            </Allotment.Pane>

            <Allotment.Pane>
              <SelectedPanel
                customSongs={customSongs}
                selectedItems={selectedItems}
                onShow={player.sendFirstPart}
                onSelect={selectItem}
                onRemove={removeItem}
              />
            </Allotment.Pane>
          </Allotment>
        </Allotment.Pane>

        <Allotment.Pane>
          <Allotment vertical>
            <Allotment.Pane preferredSize="40%">
              <div className="h-full flex gap-2 p-2 overflow-auto bg-surface">
                <LocalPreview
                  currentSong={player.currentSong}
                  output1Text={player.output1Text}
                  sectionLabel={sectionLabel}
                  blackoutActive={blackoutActive}
                  onToggleBlackout={toggleBlackout}
                  isTranslation={currentVerseIsTranslation}
                  displays={displays}
                  selectedDisplayId={selectedDisplayId}
                  setSelectedDisplayId={setSelectedDisplayId}
                  hdmiActive={hdmiActive}
                  onToggleHdmi={toggleHdmi}
                  onRefreshDisplays={refreshDisplays}
                />
                <StreamPreview
                  currentSong={player.currentSong}
                  output2Text={player.output2Text}
                  sectionLabel={sectionLabel}
                  positionText={positionText}
                  blackoutActive={blackoutActive}
                  isTranslation={currentVerseIsTranslation}
                  displays={displays}
                  selectedDisplayId={selectedDisplayId2}
                  setSelectedDisplayId={setSelectedDisplayId2}
                  hdmiActive={hdmi2Active}
                  onToggleHdmi={toggleHdmi2}
                  onRefreshDisplays={refreshDisplays}
                />
              </div>
            </Allotment.Pane>

            <Allotment.Pane>
              <div className="h-full flex flex-col bg-surface overflow-hidden">
                {editorMode && editorContext ? (
                  <SongEditor
                    initial={editorContext.initial}
                    lockTargetBook={editorContext.lockTargetBook}
                    isEditing={!!editorContext.editing}
                    onSave={handleSave}
                    onDelete={editorContext.editing ? handleDelete : undefined}
                    onCancel={closeEditor}
                    onPlaySection={(item, idx) => {
                      player.sendFirstPart(item);
                      player.goToSection(idx);
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
                    onOpenSettings={() => setSettingsOpen(true)}
                    saveStatus={saveStatus}
                    onNavigatePrev={() => player.navigatePart("prev")}
                    onNavigateNext={() => player.navigatePart("next")}
                    onStartNewSong={
                      player.currentSong?.isBible ||
                      player.currentSong?.isMessage
                        ? undefined
                        : openEditorForNew
                    }
                    onEditCurrentSong={
                      player.currentSong &&
                      !player.currentSong.isBible &&
                      !player.currentSong.isMessage
                        ? () => openEditorForExisting(player.currentSong!)
                        : undefined
                    }
                  />
                )}
              </div>
            </Allotment.Pane>
          </Allotment>
        </Allotment.Pane>
      </Allotment>
      <SettingsModal
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
      />
    </main>
  );
}

/** Sestaví ApiItem pro custom (localStorage) song bez prochodu přes Song. */
function buildApiItemForCustom(state: EditorState, id: number): ApiItem {
  const hasBilingual = state.sections.some((s) => s.textEN.trim() !== "");

  const verses = state.sections.map((section) => {
    const tag =
      section.type === "chorus" ? 1 : section.type === "bridge" ? 2 : undefined;
    const verseId =
      section.type === "verse"
        ? section.number
        : section.number === 1
          ? 0
          : section.number;

    if (hasBilingual) {
      return {
        Tag: tag,
        ID: verseId,
        TextPL: section.textPL,
        TextEN: section.textEN || undefined,
      };
    }
    return { Tag: tag, ID: verseId, Text: section.textPL };
  });

  const sequence = state.sections
    .map((s) => {
      if (s.type === "verse") return `V${s.number}`;
      if (s.type === "chorus") return s.number === 1 ? "C" : `C${s.number}`;
      if (s.type === "bridge") return s.number === 1 ? "B" : `B${s.number}`;
      return "";
    })
    .join(" ");

  const fullText = state.sections
    .map((s) => {
      const label =
        s.type === "chorus"
          ? `Ref.${s.number}`
          : s.type === "bridge"
            ? `Bridge ${s.number}`
            : `${s.number}.`;
      if (hasBilingual && s.textEN) {
        return `${label}\n${s.textPL}\n\n${s.textEN}`;
      }
      return `${label} ${s.textPL}`;
    })
    .join("\n\n");

  const searchIndex = buildSearchIndex(
    `${id} ${state.songName} ${state.sections
      .map((s) => `${s.textPL} ${s.textEN}`)
      .join(" ")}`,
  );

  return {
    id,
    text: state.songName,
    title: state.songName,
    fullText,
    selected: false,
    sequence,
    verses,
    key: state.key,
    source: "custom",
    searchIndex,
  };
}

// ===== BOOTSTRAP WRAPPER =====
// Před prvním renderem hlavního UI ověří, že lokální cache obsahuje data.
// Pokud nemá → stáhne vše z cloudu (Cloudflare Worker) a uloží do userData.
// Pokud má → manifest poll na pozadí pro detekci updates (nezdržuje boot).

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
