"use client";

import { useState } from "react";
import type { EditorSection, SectionType, SongBookKey } from "../lib/types";
import { MUSICAL_KEYS, formatKey } from "../lib/musicKeys";
import { deriveSequence, sectionLabel } from "../lib/songSchema";
import { generateSlides, toLines } from "../lib/songSerialize";
import { translationLabelFor } from "../lib/language";
import ConfirmDialog from "./ConfirmDialog";
import Icon from "./Icon";

export type TargetBook = SongBookKey | "custom";

export interface EditorState {
  songName: string;
  songNumber: number | null;
  key: string | null;
  sections: EditorSection[];
  targetBook: TargetBook;
  secondaryIsTranslation: boolean;
}

interface SongEditorProps {
  initial?: EditorState;
  lockTargetBook?: boolean;
  isEditing?: boolean;
  onSave: (state: EditorState) => void | Promise<void>;
  onDelete?: () => void | Promise<void>;
  onCancel: () => void;
}

const createEmptySection = (): EditorSection => ({
  id: crypto.randomUUID(),
  type: "verse",
  number: 1,
  lines: "",
  altLines: "",
  showAlt: false,
  slides: [],
  slidesLocked: false,
});

const BOOK_LABEL: Record<TargetBook, string> = {
  custom: "My Songs",
  newSong: "New Song",
  newSongPlGb: "New Song PL/EN",
  pielgrzym: "Pielgrzym",
  roboczy: "Roboczy",
  children: "Children",
};

const ALL_TARGETS: TargetBook[] = [
  "custom",
  "newSong",
  "newSongPlGb",
  "pielgrzym",
  "roboczy",
  "children",
];

const SECTION_STYLE: Record<SectionType, string> = {
  verse: "bg-primary",
  chorus: "bg-success",
  bridge: "bg-amber-500",
  ending: "bg-purple-500",
};

export default function SongEditor({
  initial,
  lockTargetBook,
  isEditing,
  onSave,
  onDelete,
  onCancel,
}: SongEditorProps) {
  const [songName, setSongName] = useState(initial?.songName ?? "");
  const [songIdInput, setSongIdInput] = useState<string>(
    initial?.songNumber != null ? String(initial.songNumber) : "",
  );
  const [musicKey, setMusicKey] = useState(initial?.key ?? "");
  const [secondaryIsTranslation, setSecondaryIsTranslation] = useState(
    initial?.secondaryIsTranslation ?? false,
  );
  const [sections, setSections] = useState<EditorSection[]>(
    initial?.sections ?? [createEmptySection()],
  );
  const [targetBook, setTargetBook] = useState<TargetBook>(
    initial?.targetBook ?? "custom",
  );
  const [confirmDelete, setConfirmDelete] = useState(false);

  const bilingual = sections.some(
    (s) => s.showAlt && toLines(s.altLines).length > 0,
  );
  const secondaryLabel = translationLabelFor(
    sections.flatMap((s) => (s.showAlt ? toLines(s.altLines) : [])),
  );

  const withRegeneratedSlides = (s: EditorSection): EditorSection =>
    s.slidesLocked ? s : { ...s, slides: generateSlides(s, bilingual) };

  const patchSection = (id: string, patch: Partial<EditorSection>) =>
    setSections((prev) =>
      prev.map((s) =>
        s.id === id ? withRegeneratedSlides({ ...s, ...patch }) : s,
      ),
    );

  const addSection = () => {
    const verseCount = sections.filter((s) => s.type === "verse").length;
    setSections([
      ...sections,
      { ...createEmptySection(), number: verseCount + 1 },
    ]);
  };

  const removeSection = (id: string) =>
    setSections((prev) => prev.filter((s) => s.id !== id));

  const patchSlide = (
    sectionId: string,
    slideId: string,
    patch: { lines?: string; altLines?: string },
  ) =>
    setSections((prev) =>
      prev.map((s) =>
        s.id !== sectionId
          ? s
          : {
              ...s,
              slidesLocked: true,
              slides: s.slides.map((sl) =>
                sl.id === slideId ? { ...sl, ...patch } : sl,
              ),
            },
      ),
    );

  const addSlide = (sectionId: string) =>
    setSections((prev) =>
      prev.map((s) =>
        s.id !== sectionId
          ? s
          : {
              ...s,
              slidesLocked: true,
              slides: [
                ...s.slides,
                { id: crypto.randomUUID(), lines: "", altLines: "" },
              ],
            },
      ),
    );

  const removeSlide = (sectionId: string, slideId: string) =>
    setSections((prev) =>
      prev.map((s) =>
        s.id !== sectionId
          ? s
          : {
              ...s,
              slidesLocked: true,
              slides: s.slides.filter((sl) => sl.id !== slideId),
            },
      ),
    );

  const regenerateSlides = (sectionId: string) =>
    setSections((prev) =>
      prev.map((s) =>
        s.id !== sectionId
          ? s
          : { ...s, slidesLocked: false, slides: generateSlides(s, bilingual) },
      ),
    );

  const handleSave = () => {
    if (!songName.trim() || sections.length === 0) return;
    if (sections.every((s) => s.lines.trim() === "")) return;
    const parsed = songIdInput.trim() ? Number(songIdInput.trim()) : NaN;
    const songNumber = Number.isFinite(parsed) && parsed > 0 ? parsed : null;
    onSave({
      songName,
      songNumber,
      key: musicKey || null,
      sections: sections.map(withRegeneratedSlides),
      targetBook,
      secondaryIsTranslation,
    });
  };

  const canSave =
    songName.trim() !== "" && sections.some((s) => s.lines.trim() !== "");

  const initialBook = initial?.targetBook;
  const isMoving = !!isEditing && !!initialBook && targetBook !== initialBook;

  const inputClass =
    "w-full px-3 py-2 text-sm border border-border-secondary rounded focus:outline-none focus:ring-1 focus:ring-primary bg-surface text-text-primary placeholder-text-muted";
  const areaClass =
    "w-full px-3 py-2 text-sm border border-border-secondary rounded bg-surface text-text-primary resize-y focus:outline-none focus:ring-1 focus:ring-primary placeholder-text-muted leading-relaxed";

  return (
    <div className="flex-1 overflow-y-auto px-5 py-4">
      <div className="max-w-6xl mx-auto space-y-4">
        <div className="sticky top-0 z-10 bg-surface border border-border-secondary rounded-md shadow-sm p-4 flex justify-between items-center gap-3">
          <div>
            <h2 className="text-base font-semibold text-text-primary leading-tight">
              {isEditing ? "Edit song" : "New song"}
            </h2>
            <p className="text-[11px] text-text-muted">
              Left column is what Output 1 shows. Right column is what Output 2
              shows, chopped up.
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
              {isMoving ? "Update & Move" : isEditing ? "Update" : "Save"}
            </button>
          </div>
        </div>

        <div className="bg-surface-secondary border border-border-secondary rounded-md p-4 space-y-3">
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="block text-xs font-semibold text-text-secondary mb-1">
                Songbook
              </label>
              <select
                value={targetBook}
                onChange={(e) => setTargetBook(e.target.value as TargetBook)}
                disabled={lockTargetBook}
                className={`${inputClass} disabled:opacity-60 disabled:cursor-not-allowed`}
              >
                {ALL_TARGETS.map((b) => (
                  <option key={b} value={b}>
                    {BOOK_LABEL[b]}
                  </option>
                ))}
              </select>
              {isMoving && (
                <p className="mt-1 text-[11px] text-amber-500 leading-snug">
                  On save, the song will be moved from{" "}
                  <span className="font-semibold">
                    {BOOK_LABEL[initialBook!]}
                  </span>{" "}
                  to{" "}
                  <span className="font-semibold">{BOOK_LABEL[targetBook]}</span>
                  .
                </p>
              )}
            </div>
            <div className="w-20">
              <label className="block text-xs font-semibold text-text-secondary mb-1">
                Number
              </label>
              <input
                type="number"
                min={1}
                value={songIdInput}
                onChange={(e) => setSongIdInput(e.target.value)}
                placeholder="—"
                className={inputClass}
              />
            </div>
            <div className="w-24">
              <label className="block text-xs font-semibold text-text-secondary mb-1">
                Key
              </label>
              <select
                value={musicKey}
                onChange={(e) => setMusicKey(e.target.value)}
                className={inputClass}
              >
                <option value="">—</option>
                {MUSICAL_KEYS.map((k: string) => (
                  <option key={k} value={k}>
                    {formatKey(k)}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-text-secondary mb-1">
              Song name
            </label>
            <input
              type="text"
              value={songName}
              onChange={(e) => setSongName(e.target.value)}
              placeholder="Title…"
              className={inputClass}
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-text-secondary mb-1">
              Sequence
            </label>
            <div className="px-3 py-2 bg-surface border border-border rounded text-xs font-mono text-text-secondary min-h-8">
              {deriveSequence(sections) || "—"}
            </div>
          </div>

          {bilingual && (
            <label className="flex items-start gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={secondaryIsTranslation}
                onChange={(e) => setSecondaryIsTranslation(e.target.checked)}
                className="mt-0.5"
              />
              <span className="text-xs text-text-secondary">
                Second language is a translation only
                <span className="block text-[11px] text-text-muted">
                  Turns italics on for the second language and puts a
                  „{secondaryLabel}” label above it, on both outputs. Leave off
                  when the second language is also sung.
                </span>
              </span>
            </label>
          )}
        </div>

        <div className="flex justify-between items-center px-1">
          <h3 className="text-xs font-semibold text-text-secondary uppercase tracking-wide">
            Sections
          </h3>
          <span className="text-[10px] text-text-muted">
            {sections.length} {sections.length === 1 ? "section" : "sections"}
          </span>
        </div>

        {sections.map((section, idx) => (
          <div
            key={section.id}
            className="bg-surface border border-border-secondary rounded-md shadow-sm overflow-hidden"
          >
            <div className="flex items-center gap-2 px-3 py-2 bg-surface-secondary border-b border-border">
              <span
                className={`w-1.5 h-6 rounded-full ${SECTION_STYLE[section.type]} shrink-0`}
              />
              <span className="text-xs font-bold text-text-muted w-5 shrink-0">
                {idx + 1}
              </span>
              <select
                value={section.type}
                onChange={(e) =>
                  patchSection(section.id, {
                    type: e.target.value as SectionType,
                  })
                }
                className="px-2 py-1 text-xs font-semibold border border-border-secondary rounded bg-surface text-text-primary focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <option value="verse">Verse</option>
                <option value="chorus">Chorus</option>
                <option value="bridge">Bridge</option>
                <option value="ending">Ending</option>
              </select>
              <select
                value={section.number}
                onChange={(e) =>
                  patchSection(section.id, { number: Number(e.target.value) })
                }
                className="w-14 px-2 py-1 text-xs font-semibold border border-border-secondary rounded bg-surface text-text-primary focus:outline-none focus:ring-1 focus:ring-primary"
              >
                {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
              <span className="text-xs text-text-muted">
                {sectionLabel(section.type, section.number)}
              </span>
              <div className="flex-1" />
              <button
                onClick={() =>
                  patchSection(section.id, { showAlt: !section.showAlt })
                }
                className={`px-2 py-1 rounded text-xs font-semibold transition-colors ${
                  section.showAlt
                    ? "bg-primary text-white hover:bg-primary-hover"
                    : "bg-surface border border-border text-text-secondary hover:bg-surface-secondary"
                }`}
                title={
                  section.showAlt
                    ? "Remove the second language from this section"
                    : "Add a second language to this section"
                }
              >
                Drugi język
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

            <div className="grid grid-cols-1 lg:grid-cols-2">
              <div className="p-3 space-y-2 lg:border-r border-border">
                <div className="text-[10px] font-semibold text-text-muted uppercase tracking-wide">
                  Output 1 — full section
                </div>
                <textarea
                  value={section.lines}
                  onChange={(e) =>
                    patchSection(section.id, { lines: e.target.value })
                  }
                  placeholder="Lyrics…"
                  className={`${areaClass} min-h-24`}
                  rows={5}
                />
                {section.showAlt && (
                  <textarea
                    value={section.altLines}
                    onChange={(e) =>
                      patchSection(section.id, { altLines: e.target.value })
                    }
                    placeholder="Second language…"
                    className={`${areaClass} min-h-20 italic`}
                    rows={4}
                  />
                )}
              </div>

              <div className="p-3 space-y-2 bg-surface-secondary/30">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-semibold text-text-muted uppercase tracking-wide">
                    Output 2 — slides
                  </span>
                  {section.slidesLocked && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-600 font-semibold">
                      edited
                    </span>
                  )}
                  <div className="flex-1" />
                  {section.slidesLocked && (
                    <button
                      onClick={() => regenerateSlides(section.id)}
                      className="text-[10px] px-2 py-0.5 rounded border border-border text-text-secondary hover:bg-surface transition-colors"
                      title="Discard manual edits and split again"
                    >
                      Regenerate
                    </button>
                  )}
                  <button
                    onClick={() => addSlide(section.id)}
                    className="w-6 h-6 flex items-center justify-center rounded text-text-muted hover:bg-surface transition-colors"
                    title="Add slide"
                  >
                    <Icon name="Plus" size={13} />
                  </button>
                </div>

                {section.slides.length === 0 && (
                  <p className="text-[11px] text-text-muted py-2">
                    Slides appear here as you type on the left.
                  </p>
                )}

                {section.slides.map((slide, si) => (
                  <div
                    key={slide.id}
                    className="border border-border rounded bg-surface"
                  >
                    <div className="flex items-center gap-2 px-2 py-1 border-b border-border">
                      <span className="text-[10px] font-bold text-text-muted">
                        {si + 1}
                      </span>
                      <div className="flex-1" />
                      <button
                        onClick={() => removeSlide(section.id, slide.id)}
                        className="w-5 h-5 flex items-center justify-center rounded text-text-muted hover:bg-danger hover:text-white transition-colors"
                        title="Remove slide"
                      >
                        <Icon name="X" size={11} />
                      </button>
                    </div>
                    <div className="p-2 space-y-1">
                      <textarea
                        value={slide.lines}
                        onChange={(e) =>
                          patchSlide(section.id, slide.id, {
                            lines: e.target.value,
                          })
                        }
                        className={`${areaClass} min-h-14 text-xs`}
                        rows={3}
                      />
                      {section.showAlt && (
                        <textarea
                          value={slide.altLines}
                          onChange={(e) =>
                            patchSlide(section.id, slide.id, {
                              altLines: e.target.value,
                            })
                          }
                          className={`${areaClass} min-h-14 text-xs italic`}
                          rows={3}
                        />
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ))}

        <button
          onClick={addSection}
          className="w-full py-3 border-2 border-dashed border-border-secondary rounded-md text-text-muted text-sm font-semibold hover:border-primary hover:text-primary hover:bg-surface-secondary/50 transition-colors flex items-center justify-center gap-2"
        >
          <Icon name="Plus" size={16} />
          Add Section
        </button>

        {isEditing && onDelete && (
          <div className="border border-danger/30 bg-danger/5 rounded-md p-3 flex justify-between items-center gap-3">
            <div>
              <p className="text-xs font-semibold text-text-primary">
                Delete this song
              </p>
              <p className="text-[11px] text-text-muted">
                This action is irreversible. The song will be removed from the
                songbook.
              </p>
            </div>
            <button
              onClick={() => setConfirmDelete(true)}
              className="px-3 py-1.5 bg-danger text-white rounded text-xs font-semibold hover:bg-danger-hover transition-colors shrink-0"
            >
              Delete
            </button>
          </div>
        )}
        <ConfirmDialog
          open={confirmDelete}
          title="Delete this song?"
          message={`"${songName}" will be permanently removed from the songbook${
            targetBook === "custom" ? " on this device" : " for everyone"
          }.`}
          confirmLabel="Delete"
          icon="Trash2"
          onConfirm={() => {
            setConfirmDelete(false);
            onDelete?.();
          }}
          onCancel={() => setConfirmDelete(false)}
        />
      </div>
    </div>
  );
}
