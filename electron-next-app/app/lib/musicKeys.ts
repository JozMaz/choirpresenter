export const MAJOR_KEYS = [
  "C",
  "C#",
  "D",
  "Eb",
  "E",
  "F",
  "F#",
  "G",
  "Ab",
  "A",
  "Bb",
  "B",
] as const;

export const MUSICAL_KEYS: string[] = [
  ...MAJOR_KEYS,
  ...MAJOR_KEYS.map((k) => `${k}m`),
];

const KEY_SET = new Set(MUSICAL_KEYS);

export const KEY_LABEL_PL: Record<string, string> = {
  C: "C",
  "C#": "Cis",
  D: "D",
  Eb: "Es",
  E: "E",
  F: "F",
  "F#": "Fis",
  G: "G",
  Ab: "As",
  A: "A",
  Bb: "B",
  B: "H",
  Cm: "c-moll",
  "C#m": "cis-moll",
  Dm: "d-moll",
  Ebm: "es-moll",
  Em: "e-moll",
  Fm: "f-moll",
  "F#m": "fis-moll",
  Gm: "g-moll",
  Abm: "as-moll",
  Am: "a-moll",
  Bbm: "b-moll",
  Bm: "h-moll",
};

export const formatKey = (key: string | null | undefined): string =>
  key ? (KEY_LABEL_PL[key] ?? key) : "";

export const isValidKey = (key: string | null): boolean =>
  key === null || KEY_SET.has(key);
