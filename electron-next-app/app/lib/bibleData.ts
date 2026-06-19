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

/**
 * Polské názvy knih v kanonickém pořadí per překlad — VideoPsalm formát
 * neukládá názvy, pozice v poli určuje knihu. Každý překlad má vlastní
 * konvenci pojmenování (typicky liší se Stary Testament).
 */
export const BOOK_NAMES_BY_BIBLE: Record<BibleKey, string[][]> = {
  // Biblia Warszawska (BW) — používá modernizované názvy knih
  warszawska: [
    // Stary Testament (39)
    [
      "Rodzaju",
      "Wyjścia",
      "Kapłańska",
      "Liczb",
      "Powtórzonego Prawa",
      "Jozuego",
      "Sędziów",
      "Rut",
      "1 Samuela",
      "2 Samuela",
      "1 Królewska",
      "2 Królewska",
      "1 Kronik",
      "2 Kronik",
      "Ezdrasza",
      "Nehemiasza",
      "Estery",
      "Joba",
      "Psalmów",
      "Przypowieści Salomona",
      "Kaznodziei Salomona",
      "Pieśń nad pieśniami",
      "Izajasza",
      "Jeremiasza",
      "Treny",
      "Ezechiela",
      "Daniela",
      "Ozeasza",
      "Joela",
      "Amosa",
      "Abdiasza",
      "Jonasza",
      "Micheasza",
      "Nahuma",
      "Habakuka",
      "Sofoniasza",
      "Aggeusza",
      "Zachariasza",
      "Malachiasza",
    ],
    // Nowy Testament (27)
    [
      "Mateusza",
      "Marka",
      "Łukasza",
      "Jana",
      "Dzieje Apostolskie",
      "Rzymian",
      "1 Koryntian",
      "2 Koryntian",
      "Galacjan",
      "Efezjan",
      "Filipian",
      "Kolosan",
      "1 Tesaloniczan",
      "2 Tesaloniczan",
      "1 Tymoteusza",
      "2 Tymoteusza",
      "Tytusa",
      "Filemona",
      "Hebrajczyków",
      "Jakuba",
      "1 Piotra",
      "2 Piotra",
      "1 Jana",
      "2 Jana",
      "3 Jana",
      "Judy",
      "Objawienie",
    ],
  ],
  // Uwspółcześniona Biblia Gdańska (UBG)
  gdanska: [
    // Stary Testament (39)
    [
      "Rodzaju",
      "Wyjścia",
      "Kapłańska",
      "Liczb",
      "Powtórzonego Prawa",
      "Jozuego",
      "Sędziów",
      "Rut",
      "1 Samuela",
      "2 Samuela",
      "1 Królewska",
      "2 Królewska",
      "1 Kronik",
      "2 Kronik",
      "Ezdrasza",
      "Nehemiasza",
      "Estery",
      "Hioba",
      "Psalmów",
      "Przysłów",
      "Kaznodziei",
      "Pieśń nad Pieśniami",
      "Izajasza",
      "Jeremiasza",
      "Lamentacje (Treny)",
      "Ezechiela",
      "Daniela",
      "Ozeasza",
      "Joela",
      "Amosa",
      "Abdiasza",
      "Jonasza",
      "Micheasza",
      "Nahuma",
      "Habakuka",
      "Sofoniasza",
      "Aggeusza",
      "Zachariasza",
      "Malachiasza",
    ],
    // Nowy Testament (27)
    [
      "Mateusza",
      "Marka",
      "Łukasza",
      "Jana",
      "Dzieje Apostolskie",
      "Rzymian",
      "1 Koryntian",
      "2 Koryntian",
      "Galacjan",
      "Efezjan",
      "Filipian",
      "Kolosan",
      "1 Tesaloniczan",
      "2 Tesaloniczan",
      "1 Tymoteusza",
      "2 Tymoteusza",
      "Tytusa",
      "Filemona",
      "Hebrajczyków",
      "Jakuba",
      "1 Piotra",
      "2 Piotra",
      "1 Jana",
      "2 Jana",
      "3 Jana",
      "Judy",
      "Objawienie Jana",
    ],
  ],
};

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
export function getBookName(bibleKey: BibleKey, flatIndex: number): string {
  const testaments = BOOK_NAMES_BY_BIBLE[bibleKey];
  let cumulative = 0;
  for (let t = 0; t < testaments.length; t++) {
    if (flatIndex < cumulative + testaments[t].length) {
      return testaments[t][flatIndex - cumulative];
    }
    cumulative += testaments[t].length;
  }
  return `Book ${flatIndex + 1}`;
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
