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
];

export const ALL_KEYS = [...MAJOR_KEYS, ...MAJOR_KEYS.map((k) => `${k}m`)];

const KEY_SET = new Set(ALL_KEYS);

const ROOT_ALIASES = {
  h: "B",
  b: "Bb",
  db: "C#",
  "c#": "C#",
  "d#": "Eb",
  eb: "Eb",
  gb: "F#",
  "f#": "F#",
  "g#": "Ab",
  ab: "Ab",
  "a#": "Bb",
  bb: "Bb",
  c: "C",
  d: "D",
  e: "E",
  f: "F",
  g: "G",
  a: "A",
};

export function normalizeKey(raw, dialect = "pl") {
  if (!raw) return null;
  let s = String(raw).trim();
  if (!s) return null;

  s = s
    .replace(/^Es\b/i, "Eb")
    .replace(/^As\b/i, "Ab")
    .replace(/^Des\b/i, "Db")
    .replace(/^Ges\b/i, "Gb")
    .replace(/^Ces\b/i, "Cb");

  const m = s.match(
    /^([A-Ha-h])\s*([#♯b♭]?)\s*(?:[-\s]*(moll|mol|minor|min|m|dur|major|maj)\b)?\s*$/i,
  );
  if (!m) return null;

  const letter = m[1];
  const accidental = (m[2] || "").replace("♯", "#").replace("♭", "b");
  const qualifier = (m[3] || "").toLowerCase();

  let isMinor;
  if (/^(moll|mol|minor|min|m)$/.test(qualifier)) isMinor = true;
  else if (/^(dur|major|maj)$/.test(qualifier)) isMinor = false;
  else isMinor = letter === letter.toLowerCase();

  const rootKey = (letter + accidental).toLowerCase();
  let root = ROOT_ALIASES[rootKey];
  if (!root) return null;
  if (dialect === "en") {
    if (rootKey === "h") return null;
    if (rootKey === "b") root = "B";
  }

  const result = isMinor ? `${root}m` : root;
  return KEY_SET.has(result) ? result : null;
}

export function isValidKey(k) {
  return k === null || KEY_SET.has(k);
}

export const KEY_IN_PARENS_RE =
  /\(\s*(?:Es|As|Des|Ges|Ces|[A-Ha-h])\s*[#♯b♭]?\s*(?:[-\s]*(?:moll|mol|minor|min|m|dur|major|maj))?\s*\)/i;
