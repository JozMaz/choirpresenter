/** Klíče biblí podporovaných ve filesystemu */
export type BibleKey = "warszawska" | "gdanska";

export const BIBLE_LABELS: Record<BibleKey, string> = {
  warszawska: "Biblia Warszawska",
  gdanska: "Uwspółcześniona Biblia Gdańska",
};

export interface BibleVerse {
  /** ID je 1 pro první verš, pak chybí pro některé následující (VideoPsalm konvence) */
  ID?: number;
  Text?: string;
  Style?: unknown;
}

export interface BibleChapter {
  ID?: number; // ID kapitoly (1 pro první, pak chybí)
  Verses?: BibleVerse[];
}

export interface BibleBook {
  ID?: number;
  Chapters?: BibleChapter[];
}

export interface BibleTestament {
  Books?: BibleBook[];
}

export interface Bible {
  Guid?: string;
  Testaments?: BibleTestament[];
}

export const BOOK_NAMES: string[] = [
  "Ks. Rodzaju",
  "Ks. Wyjścia",
  "Ks. Kapłańska",
  "Ks. Liczb",
  "Ks. Powt. Prawa",
  "Ks. Jozuego",
  "Ks. Sędziów",
  "Ks. Rut",
  "I Ks. Samuela",
  "II Ks. Samuela",
  "I Ks. Królewska",
  "II Ks. Królewska",
  "I Ks. Kronik",
  "II Ks. Kronik",
  "Ks. Ezdrasza",
  "Ks. Nehemiasza",
  "Ks. Estery",
  "Ks. Hioba",
  "Ks. Psalmów",
  "Ks. Przysłów",
  "Ks. Kaznodziei",
  "Pieśń nad Pieśniami",
  "Ks. Izajasza",
  "Ks. Jeremiasza",
  "Lamentacje",
  "Ks. Ezechiela",
  "Ks. Daniela",
  "Ks. Ozeasza",
  "Ks. Joela",
  "Ks. Amosa",
  "Ks. Abdiasza",
  "Ks. Jonasza",
  "Ks. Micheasza",
  "Ks. Nahuma",
  "Ks. Habakuka",
  "Ks. Sofoniasza",
  "Ks. Aggeusza",
  "Ks. Zachariasza",
  "Ks. Malachiasza",
  "Ew. Mateusza",
  "Ew. Marka",
  "Ew. Łukasza",
  "Ew. Jana",
  "Dzieje Apostolskie",
  "List do Rzymian",
  "I List do Koryntian",
  "II List do Koryntian",
  "List do Galatów",
  "List do Efezjan",
  "List do Filipian",
  "List do Kolosan",
  "I List do Tesaloniczan",
  "II List do Tesaloniczan",
  "I List do Tymoteusza",
  "II List do Tymoteusza",
  "List do Tytusa",
  "List do Filemona",
  "List do Hebrajczyków",
  "List Jakuba",
  "I List Piotra",
  "II List Piotra",
  "I List Jana",
  "II List Jana",
  "III List Jana",
  "List Judy",
  "Objawienie Jana",
];

/** Vrátí knihu podle plochého indexu (0-based, 0 = Genesis, 65 = Zjevení) */
export function getBookByFlatIndex(
  bible: Bible,
  flatIndex: number,
): { book: BibleBook; testamentIdx: number; bookIdx: number } | null {
  let cumulative = 0;
  const testaments = bible.Testaments || [];
  for (let t = 0; t < testaments.length; t++) {
    const books = testaments[t].Books || [];
    if (flatIndex < cumulative + books.length) {
      const bookIdx = flatIndex - cumulative;
      return { book: books[bookIdx], testamentIdx: t, bookIdx };
    }
    cumulative += books.length;
  }
  return null;
}

/** Vrátí jméno knihy podle překladu a plochého indexu (s případným aliasem v "(...)") */
export function getBookName(flatIndex: number): string {
  return BOOK_NAMES[flatIndex] ?? `Book ${flatIndex + 1}`;
}

/** Strip "(alias)" suffixu — pro referenci v previews/HDMI nechceme alias. */
export function stripBookAlias(name: string): string {
  return name.replace(/\s*\([^)]*\)\s*$/, "").trim();
}

/** Celkový počet knih v bibli */
export function getTotalBookCount(bible: Bible): number {
  return (bible.Testaments || []).reduce(
    (sum, t) => sum + (t.Books?.length || 0),
    0,
  );
}
