"use client";

import { useState } from "react";
import type { EditorSection, SectionType, SongBookKey } from "../lib/types";
import { MUSICAL_KEYS, formatKey } from "../lib/musicKeys";
import { deriveSequence, sectionLabel } from "../lib/songSchema";
import { generateSlides, toLines } from "../lib/songSerialize";
import { translationLabelFor } from "../lib/language";
import AutoTextarea from "./AutoTextarea";
import Checkbox from "./Checkbox";
import ConfirmDialog from "./ConfirmDialog";
import Dropdown from "./Dropdown";
import Icon from "./Icon";

export type TargetBook = SongBookKey | "custom";

export interface EditorState {
  songName: string;
  songNumber: number | null;
  key: string | null;
  sections: EditorSection[];
  targetBook: TargetBook;
  translationLabel: string;
}

interface SongEditorProps {
  initial?: EditorState;
  canEditCloud?: boolean;
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
  isTranslation: false,
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

const bookOptionsFor = (canEditCloud: boolean) =>
  (canEditCloud ? ALL_TARGETS : (["custom"] as TargetBook[])).map((b) => ({
    value: b,
    label: BOOK_LABEL[b],
  }));

const KEY_OPTIONS = [
  { value: "", label: "—" },
  ...MUSICAL_KEYS.map((k: string) => ({ value: k, label: formatKey(k) })),
];

const TYPE_OPTIONS: { value: SectionType; label: string }[] = [
  { value: "verse", label: "Verse" },
  { value: "chorus", label: "Chorus" },
  { value: "bridge", label: "Bridge" },
  { value: "ending", label: "Ending" },
];

const NUMBER_OPTIONS = [1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => ({
  value: n,
  label: String(n),
}));

const SECTION_STYLE: Record<SectionType, string> = {
  verse: "bg-primary",
  chorus: "bg-success",
  bridge: "bg-amber-500",
  ending: "bg-purple-500",
};

export default function SongEditor({
  initial,
  canEditCloud = false,
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
  const [sections, setSections] = useState<EditorSection[]>(
    initial?.sections ?? [createEmptySection()],
  );
  const [targetBook, setTargetBook] = useState<TargetBook>(
    initial?.targetBook ?? "custom",
  );
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [translationLabel, setTranslationLabel] = useState(
    initial?.translationLabel ?? "",
  );

  const detectedLabel = translationLabelFor(
    sections.flatMap((s) => (s.showAlt ? toLines(s.altLines) : [])),
  );
  const secondaryLabel = translationLabel.trim() || detectedLabel;
  const hasTranslation = sections.some((s) => s.showAlt && s.isTranslation);

  const withRegeneratedSlides = (s: EditorSection): EditorSection =>
    s.slidesLocked ? s : { ...s, slides: generateSlides(s) };

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
          : { ...s, slidesLocked: false, slides: generateSlides(s) },
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
      translationLabel: hasTranslation ? translationLabel.trim() : "",
    });
  };

  const canSave =
    songName.trim() !== "" && sections.some((s) => s.lines.trim() !== "");

  const initialBook = initial?.targetBook;
  const isMoving = !!isEditing && !!initialBook && targetBook !== initialBook;

  const inputClass =
    "w-full px-2 py-1 text-xs border border-border-secondary rounded hover:border-primary/60 focus:outline-none focus:ring-1 focus:ring-primary bg-surface text-text-primary placeholder-text-muted transition-colors";
  const areaClass =
    "w-full px-2 py-1.5 text-xs border border-border-secondary rounded bg-surface text-text-primary hover:border-primary/60 focus:outline-none focus:ring-1 focus:ring-primary placeholder-text-muted leading-snug transition-colors";
  const labelClass =
    "block text-[10px] font-semibold text-text-secondary uppercase tracking-wide mb-0.5";

  return (
    <div className="flex-1 overflow-y-auto px-3 py-2">
      <div className="max-w-6xl mx-auto space-y-2">
        <div className="sticky top-0 z-10 bg-surface border border-border-secondary rounded-md shadow-sm px-3 py-2 flex justify-between items-center gap-2">
          <h2 className="text-sm font-semibold text-text-primary leading-tight">
            {isEditing ? "Edit song" : "New song"}
          </h2>
          <div className="flex gap-1.5 shrink-0">
            <button
              onClick={onCancel}
              className="px-2.5 py-1 text-xs font-semibold text-text-secondary border border-border rounded hover:bg-surface-hover transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={!canSave}
              className="px-3 py-1 text-xs font-semibold bg-primary text-white rounded hover:bg-primary-hover disabled:bg-disabled transition-colors"
            >
              {isMoving ? "Update & Move" : isEditing ? "Update" : "Save"}
            </button>
          </div>
        </div>

        <div className="flex gap-2 items-start bg-primary/10 border border-primary/30 rounded-md px-3 py-2">
          <Icon
            name="Info"
            size={13}
            className="shrink-0 mt-0.5 text-primary"
          />
          <div className="text-[11px] text-text-secondary leading-snug">
            <p>
              <span className="font-semibold text-text-primary">
                Slides are used only by outputs set to “Saved” in Settings →
                “What goes on each output”.
              </span>{" "}
              Outputs set to “Whole” or “Max lines” split the text themselves
              and ignore them.
            </p>
            <p>
              Your own split is kept only once a section is marked{" "}
              <span className="font-semibold text-amber-600">edited</span> —
              otherwise it is split again on every load.
            </p>
          </div>
        </div>

        <div className="bg-surface-secondary border border-border-secondary rounded-md p-2.5 space-y-2">
          <div className="flex gap-2">
            <div className="flex-1 min-w-0">
              <label className={labelClass}>Songbook</label>
              <Dropdown
                value={targetBook}
                options={bookOptionsFor(canEditCloud)}
                onChange={(v) => setTargetBook(v)}
                disabled={lockTargetBook}
              />
            </div>
            <div className="w-16">
              <label className={labelClass}>Number</label>
              <input
                type="text"
                inputMode="numeric"
                value={songIdInput}
                onChange={(e) =>
                  setSongIdInput(e.target.value.replace(/[^\d]/g, ""))
                }
                placeholder="—"
                className={inputClass}
              />
            </div>
            <div className="w-20">
              <label className={labelClass}>Key</label>
              <Dropdown
                value={musicKey}
                options={KEY_OPTIONS}
                onChange={(v) => setMusicKey(v)}
              />
            </div>
          </div>
          {isMoving && (
            <p className="text-[11px] text-amber-500 leading-snug">
              On save, the song will be moved from{" "}
              <span className="font-semibold">{BOOK_LABEL[initialBook!]}</span>{" "}
              to <span className="font-semibold">{BOOK_LABEL[targetBook]}</span>
              .
            </p>
          )}

          <div className="flex gap-2">
            <div className="flex-1 min-w-0">
              <label className={labelClass}>Song name</label>
              <input
                type="text"
                value={songName}
                onChange={(e) => setSongName(e.target.value)}
                placeholder="Title…"
                className={inputClass}
              />
            </div>
            <div className="flex-1 min-w-0">
              <label className={labelClass}>Sequence</label>
              <div className="px-2 py-1 bg-surface border border-border rounded text-[11px] font-mono text-text-secondary min-h-6.5 truncate">
                {deriveSequence(sections) || "—"}
              </div>
            </div>
          </div>

          {hasTranslation && (
            <div>
              <label className={labelClass}>Translation label</label>
              <input
                type="text"
                value={translationLabel}
                onChange={(e) => setTranslationLabel(e.target.value)}
                placeholder={detectedLabel}
                className={inputClass}
              />
              <p className="text-[10px] text-text-muted mt-0.5 leading-snug">
                Shown in the box on the divider above the translation. Leave
                empty to use the songbook setting, or „{detectedLabel}” detected
                from the text.
              </p>
            </div>
          )}
        </div>

        {sections.map((section, idx) => (
          <div
            key={section.id}
            className="bg-surface border border-border-secondary rounded-md shadow-sm overflow-hidden"
          >
            <div className="flex items-center gap-1.5 px-2 py-1.5 bg-surface-secondary border-b border-border">
              <span
                className={`w-1 h-5 rounded-full ${SECTION_STYLE[section.type]} shrink-0`}
              />
              <span className="text-[11px] font-bold text-text-muted w-4 shrink-0">
                {idx + 1}
              </span>
              <Dropdown
                value={section.type}
                options={TYPE_OPTIONS}
                onChange={(v) => patchSection(section.id, { type: v })}
                className="w-22"
              />
              <Dropdown
                value={section.number}
                options={NUMBER_OPTIONS}
                onChange={(v) => patchSection(section.id, { number: v })}
                className="w-13"
              />
              <span className="text-[11px] text-text-muted truncate">
                {sectionLabel(section.type, section.number)}
              </span>
              <div className="flex-1" />
              <button
                onClick={() =>
                  patchSection(section.id, { showAlt: !section.showAlt })
                }
                className={`px-2 py-0.5 rounded text-[11px] font-semibold transition-colors ${
                  section.showAlt
                    ? "bg-primary text-white hover:bg-primary-hover"
                    : "bg-surface border border-border text-text-secondary hover:bg-surface-hover"
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
                  className="w-6 h-6 flex items-center justify-center rounded text-text-muted hover:bg-danger hover:text-white transition-colors"
                  title="Remove section"
                >
                  <Icon name="Trash2" size={12} />
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2">
              <div className="p-2 space-y-1.5 lg:border-r border-border">
                <div className="text-[10px] font-semibold text-text-muted uppercase tracking-wide">
                  Output 1 — full section
                </div>
                <AutoTextarea
                  value={section.lines}
                  onChange={(e) =>
                    patchSection(section.id, { lines: e.target.value })
                  }
                  placeholder="Lyrics…"
                  minRows={3}
                  className={areaClass}
                />
                {section.showAlt && (
                  <>
                    <AutoTextarea
                      value={section.altLines}
                      onChange={(e) =>
                        patchSection(section.id, { altLines: e.target.value })
                      }
                      placeholder="Second language…"
                      minRows={3}
                      className={`${areaClass} italic`}
                    />
                    <Checkbox
                      checked={section.isTranslation}
                      onChange={(v) =>
                        patchSection(section.id, { isTranslation: v })
                      }
                      label="Second language is a translation only"
                      hint={`Italics + a „${secondaryLabel}” box on the divider. Leave off when the second language is also sung.`}
                    />
                  </>
                )}
              </div>

              <div className="p-2 space-y-1.5 bg-surface-secondary/30">
                <div className="flex items-center gap-1.5">
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
                      className="text-[10px] px-1.5 py-0.5 rounded border border-border text-text-secondary hover:bg-surface-hover hover:text-text-primary transition-colors"
                      title="Discard manual edits and split again"
                    >
                      Regenerate
                    </button>
                  )}
                  <button
                    onClick={() => addSlide(section.id)}
                    className="w-5 h-5 flex items-center justify-center rounded text-text-muted hover:bg-surface-hover hover:text-text-primary transition-colors"
                    title="Add slide"
                  >
                    <Icon name="Plus" size={12} />
                  </button>
                </div>

                {section.slides.length === 0 && (
                  <p className="text-[11px] text-text-muted py-1">
                    Slides appear here as you type on the left.
                  </p>
                )}

                {section.slides.map((slide, si) => (
                  <div
                    key={slide.id}
                    className="border border-border rounded bg-surface hover:border-border-secondary transition-colors"
                  >
                    <div className="flex items-center gap-1.5 px-1.5 py-0.5 border-b border-border">
                      <span className="text-[10px] font-bold text-text-muted">
                        {si + 1}
                      </span>
                      <div className="flex-1" />
                      <button
                        onClick={() => removeSlide(section.id, slide.id)}
                        className="w-4.5 h-4.5 flex items-center justify-center rounded text-text-muted hover:bg-danger hover:text-white transition-colors"
                        title="Remove slide"
                      >
                        <Icon name="X" size={10} />
                      </button>
                    </div>
                    <div className="p-1.5 space-y-1">
                      <AutoTextarea
                        value={slide.lines}
                        onChange={(e) =>
                          patchSlide(section.id, slide.id, {
                            lines: e.target.value,
                          })
                        }
                        minRows={2}
                        className={areaClass}
                      />
                      {section.showAlt && (
                        <AutoTextarea
                          value={slide.altLines}
                          onChange={(e) =>
                            patchSlide(section.id, slide.id, {
                              altLines: e.target.value,
                            })
                          }
                          minRows={2}
                          className={`${areaClass} italic`}
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
          className="w-full py-2 border-2 border-dashed border-border-secondary rounded-md text-text-muted text-xs font-semibold hover:border-primary hover:text-primary hover:bg-surface-hover transition-colors flex items-center justify-center gap-1.5"
        >
          <Icon name="Plus" size={14} />
          Add Section
        </button>

        {isEditing && onDelete && (
          <div className="border border-danger/30 bg-danger/5 rounded-md px-2.5 py-2 flex justify-between items-center gap-2">
            <p className="text-[11px] text-text-muted">
              <span className="font-semibold text-text-primary">
                Delete this song.
              </span>{" "}
              This action is irreversible.
            </p>
            <button
              onClick={() => setConfirmDelete(true)}
              className="px-2.5 py-1 bg-danger text-white rounded text-xs font-semibold hover:bg-danger-hover transition-colors shrink-0"
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
