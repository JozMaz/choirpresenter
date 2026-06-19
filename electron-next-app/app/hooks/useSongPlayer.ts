"use client";

import { useState } from "react";
import type { ApiItem, VerseParts } from "../lib/types";
import {
  extractSongParts,
  getAllPartsFlat,
  isBilingualSource,
  processAllVersesForPLEN,
} from "../lib/songProcessing";

interface SongPlayerState {
  currentSong: ApiItem | null;
  currentVerseIndex: number;
  currentPartIndex: number;
  allVersesParts: VerseParts[];
  totalParts: number;
  output1Text: string;
  output2Text: string;
}

const emptyState: SongPlayerState = {
  currentSong: null,
  currentVerseIndex: -1,
  currentPartIndex: -1,
  allVersesParts: [],
  totalParts: 0,
  output1Text: "",
  output2Text: "",
};

/** Odstraní "Translation:" prefix z EN textu (ponechá leading style tagy). */
function stripTranslationPrefix(text: string): string {
  return text.replace(/^((?:<\/?s\d*>)*)\s*Translation:\s*\n?/i, "$1");
}

/**
 * Stream / Output 2 text z verše a part-indexu.
 * Zajišťuje, že pokud verse má EN, vždy se zobrazí PL i EN spolu —
 * když jeden jazyk má méně částí, použijeme jeho poslední dostupnou
 * (nikdy nezobrazujeme samotný EN nebo samotný PL když existují oba).
 *
 * Pro IsTranslation verše navíc strippne "Translation:" prefix z EN
 * (na Output 1 zůstává — strip se děje až tady).
 */
function buildOutput2(
  verse: { fullPL: string; fullEN: string; plParts: string[]; enParts: string[] },
  partIdx: number,
): string {
  const hasPL = verse.fullPL.trim() !== "";
  const hasEN = verse.fullEN.trim() !== "";

  const plClamp = Math.max(0, Math.min(partIdx, verse.plParts.length - 1));
  const enClamp = Math.max(0, Math.min(partIdx, verse.enParts.length - 1));
  const pl = verse.plParts[plClamp] || "";
  // Strippneme "Translation:" prefix vždy — pokud tam není, regex pass-through.
  const en = stripTranslationPrefix(verse.enParts[enClamp] || "");

  if (hasPL && hasEN) return pl + "\n\n" + en;
  if (hasPL) return pl;
  return en;
}

export function useSongPlayer() {
  const [state, setState] = useState<SongPlayerState>(emptyState);

  /**
   * Načte píseň/kapitolu do panelu sekcí, ALE nezobrazí žádnou sekci
   * — uživatel musí kliknout v pravém dolním panelu na konkrétní sekci.
   */
  const loadSong = (item: ApiItem) => {
    if (isBilingualSource(item)) {
      const versesParts = processAllVersesForPLEN(item);
      const total = versesParts.reduce(
        (sum, vp) => sum + Math.max(vp.plParts.length, vp.enParts.length),
        0,
      );
      setState({
        currentSong: item,
        currentVerseIndex: -1,
        currentPartIndex: -1,
        allVersesParts: versesParts,
        totalParts: total,
        output1Text: "",
        output2Text: "",
      });
    } else {
      const flatParts = getAllPartsFlat(item);
      setState({
        currentSong: item,
        currentVerseIndex: -1,
        currentPartIndex: -1,
        allVersesParts: [],
        totalParts: flatParts.length,
        output1Text: "",
        output2Text: "",
      });
    }
  };

  /** Zpětně-kompatibilní alias pro místa, která ještě používají sendFirstPart. */
  const sendFirstPart = loadSong;

  const navigatePart = (direction: "next" | "prev") => {
    setState((prev) => {
      if (!prev.currentSong) return prev;
      const { currentSong, allVersesParts, currentVerseIndex, currentPartIndex } =
        prev;

      if (isBilingualSource(currentSong)) {
        if (allVersesParts.length === 0) return prev;

        // První navigace po načtení — skoč na první verš
        if (currentVerseIndex < 0 || currentPartIndex < 0) {
          const verse = allVersesParts[0];
          return {
            ...prev,
            currentVerseIndex: 0,
            currentPartIndex: 0,
            output1Text: verse.fullPL + "\n\n" + verse.fullEN,
            output2Text: buildOutput2(verse, 0),
          };
        }

        let newVerseIndex = currentVerseIndex;
        let newPartIndex = currentPartIndex;

        if (direction === "next") {
          newPartIndex++;
          const currentVerseParts = allVersesParts[currentVerseIndex];
          const maxParts = Math.max(
            currentVerseParts.plParts.length,
            currentVerseParts.enParts.length,
          );
          if (newPartIndex >= maxParts) {
            newVerseIndex = (currentVerseIndex + 1) % allVersesParts.length;
            newPartIndex = 0;
          }
        } else {
          newPartIndex--;
          if (newPartIndex < 0) {
            newVerseIndex =
              currentVerseIndex - 1 < 0
                ? allVersesParts.length - 1
                : currentVerseIndex - 1;
            newPartIndex = 0;
          }
        }

        const verse = allVersesParts[newVerseIndex];
        return {
          ...prev,
          currentVerseIndex: newVerseIndex,
          currentPartIndex: newPartIndex,
          output1Text: verse.fullPL + "\n\n" + verse.fullEN,
          output2Text: buildOutput2(verse, newPartIndex),
        };
      }

      const flatParts = getAllPartsFlat(currentSong);
      if (flatParts.length === 0) return prev;

      // První navigace po načtení — skoč na první část
      if (currentPartIndex < 0) {
        return {
          ...prev,
          currentPartIndex: 0,
          output1Text: flatParts[0].verseText,
          output2Text: flatParts[0].partText,
        };
      }

      let newIndex = currentPartIndex;
      if (direction === "next") {
        newIndex =
          currentPartIndex + 1 >= flatParts.length ? 0 : currentPartIndex + 1;
      } else {
        const candidateIdx =
          currentPartIndex - 1 < 0
            ? flatParts.length - 1
            : currentPartIndex - 1;
        if (
          flatParts[candidateIdx].verseText !==
          flatParts[currentPartIndex].verseText
        ) {
          let startIdx = candidateIdx;
          while (
            startIdx > 0 &&
            flatParts[startIdx - 1].verseText ===
              flatParts[candidateIdx].verseText
          ) {
            startIdx--;
          }
          newIndex = startIdx;
        } else {
          newIndex = candidateIdx;
        }
      }

      return {
        ...prev,
        currentPartIndex: newIndex,
        output1Text: flatParts[newIndex].verseText,
        output2Text: flatParts[newIndex].partText,
      };
    });
  };

  const goToSection = (sectionIndex: number) => {
    setState((prev) => {
      if (!prev.currentSong) return prev;
      const { currentSong, allVersesParts } = prev;

      if (isBilingualSource(currentSong)) {
        if (sectionIndex < 0 || sectionIndex >= allVersesParts.length)
          return prev;
        const target = allVersesParts[sectionIndex];
        return {
          ...prev,
          currentVerseIndex: sectionIndex,
          currentPartIndex: 0,
          output1Text: target.fullPL + "\n\n" + target.fullEN,
          output2Text: buildOutput2(target, 0),
        };
      }

      const songParts = extractSongParts(currentSong);
      if (sectionIndex < 0 || sectionIndex >= songParts.length) return prev;
      let flatIdx = 0;
      for (let i = 0; i < sectionIndex; i++) {
        flatIdx += songParts[i].parts.length;
      }
      const flatParts = getAllPartsFlat(currentSong);
      if (flatIdx >= flatParts.length) return prev;
      return {
        ...prev,
        currentPartIndex: flatIdx,
        output1Text: flatParts[flatIdx].verseText,
        output2Text: flatParts[flatIdx].partText,
      };
    });
  };

  return {
    ...state,
    sendFirstPart,
    navigatePart,
    goToSection,
  };
}

// ===== Pure selectors =====

export function getCurrentSectionLabel(state: SongPlayerState): string {
  const { currentSong, currentVerseIndex, currentPartIndex } = state;
  if (!currentSong) return "";
  // Nic není vybráno
  if (currentPartIndex < 0) return "";

  // Bible mód: vrátíme plnou referenci "Ks. Przysłów 10:24"
  if (currentSong.isBible && currentSong.bibleMeta) {
    const sequenceParts = (currentSong.sequence || "")
      .split(/\s+/)
      .filter(Boolean);
    const songParts = extractSongParts(currentSong);
    let cumulative = 0;
    for (let i = 0; i < songParts.length; i++) {
      const partsCount = songParts[i].parts.length;
      if (currentPartIndex < cumulative + partsCount) {
        const code = sequenceParts[i] || "";
        const verseNum = code.startsWith("V") ? code.substring(1) : "";
        const { bookName, chapter } = currentSong.bibleMeta;
        return `${bookName} ${chapter}:${verseNum}`;
      }
      cumulative += partsCount;
    }
    return "";
  }

  // Message mód: vrátíme "Title - 47-0412" (zobrazí se DOLE).
  // Paragraph číslo je už součástí textu chunku ("1. Text" nebo "1. ... Text").
  if (currentSong.isMessage && currentSong.messageMeta) {
    const { dateKey, title } = currentSong.messageMeta;
    return `${title} - ${dateKey}`;
  }

  if (isBilingualSource(currentSong)) {
    const verses = currentSong.verses;
    const verse = verses[currentVerseIndex];
    if (!verse) return "";

    if (verse.Tag === 1) {
      const list = verses.filter((v) => v.Tag === 1);
      const idx = list.indexOf(verse) + 1;
      return list.length > 1 ? `Chorus ${idx}` : "Chorus";
    }
    if (verse.Tag === 2) {
      const list = verses.filter((v) => v.Tag === 2);
      const idx = list.indexOf(verse) + 1;
      return list.length > 1 ? `Bridge ${idx}` : "Bridge";
    }
    const verseList = verses.filter((v) => !v.Tag);
    const idx = verseList.indexOf(verse) + 1;
    return `Verse ${idx}`;
  }

  const sequenceParts = (currentSong.sequence || "")
    .split(/\s+/)
    .filter(Boolean);
  const songParts = extractSongParts(currentSong);
  let cumulative = 0;
  for (let i = 0; i < songParts.length; i++) {
    const partsCount = songParts[i].parts.length;
    if (currentPartIndex < cumulative + partsCount) {
      const code = sequenceParts[i] || "";
      if (code.startsWith("V")) return `Verse ${code.substring(1) || "1"}`;
      if (code === "C") return "Chorus";
      if (code.startsWith("C")) return `Chorus ${code.substring(1)}`;
      if (code === "B") return "Bridge";
      if (code.startsWith("B")) return `Bridge ${code.substring(1)}`;
      return code;
    }
    cumulative += partsCount;
  }
  return "";
}

export function getCurrentPosition(state: SongPlayerState): string {
  const {
    currentSong,
    allVersesParts,
    currentVerseIndex,
    currentPartIndex,
    totalParts,
  } = state;
  if (!currentSong) return "";
  if (currentPartIndex < 0) return "";

  if (isBilingualSource(currentSong)) {
    if (allVersesParts.length === 0) return "";
    let counter = 0;
    for (let i = 0; i < currentVerseIndex; i++) {
      counter += Math.max(
        allVersesParts[i].plParts.length,
        allVersesParts[i].enParts.length,
      );
    }
    counter += currentPartIndex + 1;
    return `${counter} / ${totalParts}`;
  }
  const flatParts = getAllPartsFlat(currentSong);
  return `${currentPartIndex + 1} / ${flatParts.length}`;
}

export function getActiveSectionIndex(state: SongPlayerState): number {
  const { currentSong, currentVerseIndex, currentPartIndex } = state;
  if (!currentSong) return -1;
  if (currentPartIndex < 0) return -1;
  if (isBilingualSource(currentSong)) return currentVerseIndex;
  const songParts = extractSongParts(currentSong);
  let cumulative = 0;
  for (let i = 0; i < songParts.length; i++) {
    cumulative += songParts[i].parts.length;
    if (currentPartIndex < cumulative) return i;
  }
  return -1;
}
