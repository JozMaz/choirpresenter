export const SECTION_TYPES = ["verse", "chorus", "bridge", "ending"];

const TOKEN_PREFIX = {
  verse: "V",
  chorus: "C",
  bridge: "B",
  ending: "E",
};

const TYPE_LABEL = {
  verse: "Verse",
  chorus: "Chorus",
  bridge: "Bridge",
  ending: "Ending",
};

export function sequenceToken(type, number) {
  const prefix = TOKEN_PREFIX[type];
  if (!prefix) throw new Error(`neznámý typ sekce: ${type}`);
  if (type === "verse") return `V${number}`;
  return number === 1 ? prefix : `${prefix}${number}`;
}

export function deriveSequence(sections) {
  const tokens = [];
  let prevType = null;
  let prevNumber = null;
  for (const s of sections) {
    if (s.type === prevType && s.number === prevNumber) continue;
    tokens.push(sequenceToken(s.type, s.number));
    prevType = s.type;
    prevNumber = s.number;
  }
  return tokens.join(" ");
}

export function sectionLabel(type, number) {
  if (type === "verse") return `${TYPE_LABEL.verse} ${number}`;
  return number === 1 ? TYPE_LABEL[type] : `${TYPE_LABEL[type]} ${number}`;
}

export function assignOrder(sections) {
  return sections.map((s, i) => ({ ...s, order: i + 1 }));
}
