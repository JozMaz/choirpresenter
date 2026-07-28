export type BibleGroupKey =
  | "torah"
  | "history"
  | "wisdom"
  | "prophets"
  | "gospels"
  | "acts"
  | "epistles"
  | "revelation";

interface BibleGroup {
  key: BibleGroupKey;
  label: string;
  /** Poslední flat index knihy patřící do skupiny (0-65). */
  lastIndex: number;
  color: string;
}

export const BIBLE_GROUPS: BibleGroup[] = [
  { key: "torah", label: "Pięcioksiąg", lastIndex: 4, color: "#8a6a4a" },
  { key: "history", label: "Księgi historyczne", lastIndex: 16, color: "#b07a3e" },
  { key: "wisdom", label: "Księgi mądrościowe", lastIndex: 21, color: "#a1544d" },
  { key: "prophets", label: "Prorocy", lastIndex: 38, color: "#7d5f9e" },
  { key: "gospels", label: "Ewangelie", lastIndex: 42, color: "#4a6491" },
  { key: "acts", label: "Dzieje Apostolskie", lastIndex: 43, color: "#5b93b5" },
  { key: "epistles", label: "Listy", lastIndex: 64, color: "#4f7d5a" },
  { key: "revelation", label: "Objawienie", lastIndex: 65, color: "#7aa86a" },
];

export function getBibleGroup(flatIndex: number): BibleGroup {
  return (
    BIBLE_GROUPS.find((g) => flatIndex <= g.lastIndex) ??
    BIBLE_GROUPS[BIBLE_GROUPS.length - 1]
  );
}

export function bibleGroupTint(flatIndex: number, strong: boolean) {
  const { color } = getBibleGroup(flatIndex);
  return {
    backgroundColor: `${color}${strong ? "40" : "1f"}`,
    borderLeft: `3px solid ${color}${strong ? "ff" : "b0"}`,
  };
}
