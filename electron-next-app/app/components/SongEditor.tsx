"use client";

import { useEffect, useMemo, useState } from "react";
import type {
  ApiItem,
  EditorSection,
  SectionType,
  SongBookKey,
  Verse,
} from "../lib/types";
import { MUSICAL_KEYS } from "../lib/constants";
import { formatSequencePart, generateSequence } from "../lib/sequence";
import Icon from "./Icon";
import SectionsList from "./SectionsList";

export type TargetBook = SongBookKey | "custom";

export interface EditorState {
  songName: string;
  /** Volitelné vlastní číslo písně (ID). Když undefined, použije se auto-generated. */
  songId?: number;
  key: string;
  sections: EditorSection[];
  targetBook: TargetBook;
}

interface SongEditorProps {
  /** Pre-fill při editaci. */
  initial?: EditorState;
  /** Zamkne výběr songbooku (typicky při editaci). */
  lockTargetBook?: boolean;
  /** True = "Edit Song" header + povolen Delete. */
  isEditing?: boolean;
  onSave: (state: EditorState) => void | Promise<void>;
  onDelete?: () => void | Promise<void>;
  onCancel: () => void;
  /**
   * Klik na sekci v preview panelu — parent načte synthetic píseň do playeru
   * a posune ji na danou sekci (Output 1/2 + HDMI ji ukáží).
   */
  onPlaySection?: (previewItem: ApiItem, sectionIdx: number) => void;
}

const createEmptySection = (): EditorSection => ({
  id: crypto.randomUUID(),
  type: "verse",
  number: 1,
  textPL: "",
  textEN: "",
  showEN: false,
});

const BOOK_LABEL: Record<TargetBook, string> = {
  custom: "My Songs",
  newSong: "New Song",
  newSongPlGb: "New Song PL/EN",
  pielgrzym: "Pielgrzym",
  roboczy: "Roboczy",
  children: "Children",
};

/** Songbooky které ukládají dvojjazyčný formát (TextPL/TextEN). */
const BILINGUAL_TARGETS: TargetBook[] = ["newSongPlGb", "roboczy"];
/** Songbooky které ukládají jen PL (Text). */
const MONOLINGUAL_TARGETS: TargetBook[] = [
  "newSong",
  "pielgrzym",
  "roboczy",
  "children",
];

const SECTION_STYLE: Record<
  SectionType,
  { dot: string; label: string }
> = {
  verse: { dot: "bg-primary", label: "Verse" },
  chorus: { dot: "bg-success", label: "Chorus" },
  bridge: { dot: "bg-amber-500", label: "Bridge" },
};

export default function SongEditor({
  initial,
  lockTargetBook,
  isEditing,
  onSave,
  onDelete,
  onCancel,
  onPlaySection,
}: SongEditorProps) {
  const [activePreviewIdx, setActivePreviewIdx] = useState(-1);
  const [songName, setSongName] = useState(initial?.songName ?? "");
  // Prázdný string pro auto-generated, číslo pro custom.
  const [songIdInput, setSongIdInput] = useState<string>(
    initial?.songId != null ? String(initial.songId) : "",
  );
  const [musicKey, setMusicKey] = useState(initial?.key ?? "C");
  const [sections, setSections] = useState<EditorSection[]>(
    initial?.sections ?? [createEmptySection()],
  );
  const [targetBook, setTargetBook] = useState<TargetBook>(
    initial?.targetBook ?? "custom",
  );

  /**
   * Dostupné cílové songbooky podle toho, jestli má píseň anglický překlad:
   *  - bilingual → newSongPlGb, roboczy
   *  - mono-lingual → newSong, pielgrzym, roboczy, children
   * "custom" (My Songs / localStorage) je vždy dostupný.
   */
  const hasBilingual = sections.some((s) => s.textEN.trim() !== "");
  const availableTargets = useMemo<TargetBook[]>(() => {
    const list: TargetBook[] = ["custom"];
    list.push(...(hasBilingual ? BILINGUAL_TARGETS : MONOLINGUAL_TARGETS));
    return list;
  }, [hasBilingual]);

  // Když uživatel přidá/odebere EN obsah a aktuální targetBook už není povolený,
  // přepneme ho na první dostupný (typicky "custom").
  useEffect(() => {
    if (lockTargetBook) return;
    if (!availableTargets.includes(targetBook)) {
      setTargetBook(availableTargets[0]);
    }
  }, [availableTargets, targetBook, lockTargetBook]);

  const addSection = () => {
    const verseCount = sections.filter((s) => s.type === "verse").length;
    setSections([
      ...sections,
      {
        id: crypto.randomUUID(),
        type: "verse",
        number: verseCount + 1,
        textPL: "",
        textEN: "",
        showEN: false,
      },
    ]);
  };

  const updateType = (id: string, type: SectionType) =>
    setSections((prev) =>
      prev.map((s) => (s.id === id ? { ...s, type } : s)),
    );

  const updateNumber = (id: string, n: number) =>
    setSections((prev) =>
      prev.map((s) => (s.id === id ? { ...s, number: Math.max(1, n) } : s)),
    );

  const updateText = (id: string, field: "textPL" | "textEN", value: string) =>
    setSections((prev) =>
      prev.map((s) => (s.id === id ? { ...s, [field]: value } : s)),
    );

  const toggleEN = (id: string) =>
    setSections((prev) =>
      prev.map((s) => (s.id === id ? { ...s, showEN: !s.showEN } : s)),
    );

  const removeSection = (id: string) =>
    setSections((prev) => prev.filter((s) => s.id !== id));

  const handleSave = () => {
    if (!songName.trim() || sections.length === 0) return;
    if (sections.every((s) => s.textPL.trim() === "")) return;
    const parsedId = songIdInput.trim() ? Number(songIdInput.trim()) : NaN;
    const songId = Number.isFinite(parsedId) && parsedId > 0 ? parsedId : undefined;
    onSave({ songName, songId, key: musicKey, sections, targetBook });
  };

  const canSave =
    songName.trim() !== "" && sections.some((s) => s.textPL.trim() !== "");

  /** Synthetic ApiItem pro live preview v SectionsList. */
  const previewItem = useMemo<ApiItem>(() => {
    const hasBilingual = sections.some((s) => s.textEN.trim() !== "");
    const verses: Verse[] = sections.map((s, i) => {
      const tag =
        s.type === "chorus" ? 1 : s.type === "bridge" ? 2 : undefined;
      const verseId =
        s.type === "verse" ? s.number : s.number === 1 ? 0 : s.number;
      if (hasBilingual) {
        return {
          Tag: tag,
          ID: verseId,
          TextPL: s.textPL || `(empty — section ${i + 1})`,
          TextEN: s.textEN || undefined,
        };
      }
      return {
        Tag: tag,
        ID: verseId,
        Text: s.textPL || `(empty — section ${i + 1})`,
      };
    });
    const sequence = sections
      .map((s) => formatSequencePart(s.type, s.number))
      .join(" ");
    return {
      id: -999,
      text: songName || "Untitled",
      title: songName || "Untitled",
      fullText: "",
      selected: false,
      sequence,
      verses,
      key: musicKey,
      source: "custom",
      searchIndex: "",
    };
  }, [sections, songName, musicKey]);

  return (
    <div className="flex-1 overflow-y-auto px-5 py-4">
      <div className="flex gap-4 max-w-5xl mx-auto"><div className="flex-1 min-w-0 space-y-4">
        {/* === Sticky header card === */}
        <div className="sticky top-0 z-10 bg-surface border border-border-secondary rounded-md shadow-sm p-4 flex justify-between items-center gap-3">
          <div>
            <h2 className="text-base font-semibold text-text-primary leading-tight">
              {isEditing ? "Edit song" : "New song"}
            </h2>
            <p className="text-[11px] text-text-muted">
              {isEditing
                ? "Changes will be saved to the songbook."
                : "Create a new song in the selected songbook."}
            </p>
          </div>
          <div className="flex gap-2 shrink-0">
            <button
              onClick={onCancel}
              className="px-3 py-1.5 text-xs font-semibold text-text-secondary border border-border rounded hover:bg-surface-secondary transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={!canSave}
              className="px-4 py-1.5 text-xs font-semibold bg-primary text-white rounded hover:bg-primary-hover disabled:bg-disabled disabled:cursor-not-allowed transition-colors"
            >
              {isEditing ? "Update" : "Save"}
            </button>
          </div>
        </div>

        {/* === Metadata card === */}
        <div className="bg-surface-secondary border border-border-secondary rounded-md p-4 space-y-3">
          <div>
            <label className="block text-xs font-semibold text-text-secondary mb-1">
              Songbook
            </label>
            <select
              value={targetBook}
              onChange={(e) => setTargetBook(e.target.value as TargetBook)}
              disabled={lockTargetBook}
              className="w-full px-3 py-2 text-sm border border-border-secondary rounded focus:outline-none focus:ring-1 focus:ring-primary bg-surface text-text-primary disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {availableTargets.map((b) => (
                <option key={b} value={b}>
                  {BOOK_LABEL[b]}
                </option>
              ))}
            </select>
          </div>

          <div className="flex gap-3">
            <div className="w-20">
              <label className="block text-xs font-semibold text-text-secondary mb-1">
                ID
              </label>
              <input
                type="number"
                min={1}
                value={songIdInput}
                onChange={(e) => setSongIdInput(e.target.value)}
                placeholder="auto"
                title="Song number. Leave empty to auto-assign."
                className="w-full px-3 py-2 text-sm border border-border-secondary rounded focus:outline-none focus:ring-1 focus:ring-primary bg-surface text-text-primary placeholder-text-muted"
              />
            </div>
            <div className="flex-1">
              <label className="block text-xs font-semibold text-text-secondary mb-1">
                Song name
              </label>
              <input
                type="text"
                value={songName}
                onChange={(e) => setSongName(e.target.value)}
                placeholder="Title…"
                className="w-full px-3 py-2 text-sm border border-border-secondary rounded focus:outline-none focus:ring-1 focus:ring-primary bg-surface text-text-primary placeholder-text-muted"
              />
            </div>
            <div className="w-20">
              <label className="block text-xs font-semibold text-text-secondary mb-1">
                Key
              </label>
              <select
                value={musicKey}
                onChange={(e) => setMusicKey(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-border-secondary rounded focus:outline-none focus:ring-1 focus:ring-primary bg-surface text-text-primary"
              >
                {MUSICAL_KEYS.map((k) => (
                  <option key={k} value={k}>
                    {k}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-text-secondary mb-1">
              Sequence preview
            </label>
            <div className="px-3 py-2 bg-surface border border-border rounded text-xs font-mono text-text-secondary min-h-8">
              {generateSequence(sections) || "—"}
            </div>
          </div>
        </div>

        {/* === Sections === */}
        <div className="space-y-3">
          <div className="flex justify-between items-center px-1">
            <h3 className="text-xs font-semibold text-text-secondary uppercase tracking-wide">
              Sections
            </h3>
            <span className="text-[10px] text-text-muted">
              {sections.length} {sections.length === 1 ? "section" : "sections"}
            </span>
          </div>

          {sections.map((section, idx) => {
            const style = SECTION_STYLE[section.type];
            return (
              <div
                key={section.id}
                className="bg-surface border border-border-secondary rounded-md shadow-sm overflow-hidden"
              >
                {/* Section header */}
                <div className="flex items-center gap-2 px-3 py-2 bg-surface-secondary border-b border-border">
                  <span
                    className={`w-1.5 h-6 rounded-full ${style.dot} shrink-0`}
                  />
                  <span className="text-xs font-bold text-text-muted w-5 shrink-0">
                    {idx + 1}
                  </span>
                  <select
                    value={section.type}
                    onChange={(e) =>
                      updateType(section.id, e.target.value as SectionType)
                    }
                    className="flex-1 px-2 py-1 text-xs font-semibold border border-border-secondary rounded bg-surface text-text-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  >
                    <option value="verse">Verse</option>
                    <option value="chorus">Chorus</option>
                    <option value="bridge">Bridge</option>
                  </select>
                  <select
                    value={section.number}
                    onChange={(e) =>
                      updateNumber(section.id, Number(e.target.value))
                    }
                    className="w-14 px-2 py-1 text-xs font-semibold border border-border-secondary rounded bg-surface text-text-primary focus:outline-none focus:ring-1 focus:ring-primary"
                    title="Number"
                  >
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
                      <option key={n} value={n}>
                        {n}
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={() => toggleEN(section.id)}
                    className={`px-2 py-1 rounded text-xs font-semibold transition-colors ${
                      section.showEN
                        ? "bg-primary text-white hover:bg-primary-hover"
                        : "bg-surface border border-border text-text-secondary hover:bg-surface-secondary"
                    }`}
                    title={
                      section.showEN
                        ? "Hide EN translation"
                        : "Add EN translation"
                    }
                  >
                    EN
                  </button>
                  {sections.length > 1 && (
                    <button
                      onClick={() => removeSection(section.id)}
                      className="w-7 h-7 flex items-center justify-center rounded text-text-muted hover:bg-danger hover:text-white transition-colors"
                      title="Remove section"
                    >
                      <Icon name="Trash2" size={13} />
                    </button>
                  )}
                </div>

                {/* Section body */}
                <div className="p-3 space-y-2">
                  <div>
                    <label className="block text-[10px] font-semibold text-text-muted uppercase tracking-wide mb-1">
                      Polish
                    </label>
                    <textarea
                      value={section.textPL}
                      onChange={(e) =>
                        updateText(section.id, "textPL", e.target.value)
                      }
                      placeholder="Polish lyrics…"
                      className="w-full px-3 py-2 text-sm border border-border-secondary rounded bg-surface text-text-primary resize-y min-h-20 focus:outline-none focus:ring-1 focus:ring-primary placeholder-text-muted leading-relaxed"
                      rows={4}
                    />
                  </div>
                  {section.showEN && (
                    <div>
                      <label className="block text-[10px] font-semibold text-text-muted uppercase tracking-wide mb-1">
                        English
                      </label>
                      <textarea
                        value={section.textEN}
                        onChange={(e) =>
                          updateText(section.id, "textEN", e.target.value)
                        }
                        placeholder="English translation…"
                        className="w-full px-3 py-2 text-sm border border-border-secondary rounded bg-surface text-text-primary resize-y min-h-20 focus:outline-none focus:ring-1 focus:ring-primary placeholder-text-muted leading-relaxed"
                        rows={4}
                      />
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {/* Add section button */}
          <button
            onClick={addSection}
            className="w-full py-3 border-2 border-dashed border-border-secondary rounded-md text-text-muted text-sm font-semibold hover:border-primary hover:text-primary hover:bg-surface-secondary/50 transition-colors flex items-center justify-center gap-2"
          >
            <Icon name="Plus" size={16} />
            Add Section
          </button>
        </div>

        {/* Delete song (destructive zone) */}
        {isEditing && onDelete && (
          <div className="border border-danger/30 bg-danger/5 rounded-md p-3 flex justify-between items-center gap-3">
            <div>
              <p className="text-xs font-semibold text-text-primary">
                Delete this song
              </p>
              <p className="text-[11px] text-text-muted">
                This action is irreversible. The song will be removed from the songbook.
              </p>
            </div>
            <button
              onClick={onDelete}
              className="px-3 py-1.5 bg-danger text-white rounded text-xs font-semibold hover:bg-danger-hover transition-colors shrink-0"
            >
              Delete
            </button>
          </div>
        )}
        </div>

        {/* === LIVE PREVIEW (sticky) === */}
        <aside className="w-72 shrink-0 hidden md:block">
          <div className="sticky top-0 bg-surface-secondary border border-border-secondary rounded-md shadow-sm overflow-hidden">
            <div className="px-3 py-2 border-b border-border bg-surface flex items-center gap-2">
              <Icon name="Eye" size={14} />
              <h3 className="text-xs font-semibold text-text-primary">
                Preview
              </h3>
            </div>
            <div className="max-h-[70vh] overflow-y-auto">
              <SectionsList
                currentSong={previewItem}
                activeSectionIndex={activePreviewIdx}
                onGoToSection={(idx) => {
                  setActivePreviewIdx(idx);
                  onPlaySection?.(previewItem, idx);
                }}
              />
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
