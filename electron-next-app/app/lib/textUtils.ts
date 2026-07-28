export const normalizeSearch = (text: string): string => {
  if (!text) return "";
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/ł/g, "l")
    .replace(/Ł/g, "l")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
};

export const buildSearchIndex = (text: string): string => {
  const spaced = normalizeSearch(text);
  if (!spaced) return "";
  const nospace = spaced.replace(/\s+/g, "");
  return `${spaced} ${nospace}`;
};
