/**
 * Odstraní VideoPsalm style tagy z textu:
 *  - `<s\d+>` a `</s>` — style/size tagy
 *  - `<f...>` a `</f>` — font tagy (např. `<fFranklin Gothic Book>`)
 *  - `<i>` a `</i>` — italic tagy (renderování italic řeší IsTranslation flag)
 */
export const removeStyleTags = (text: string): string => {
  if (!text) return text;
  return text
    .replace(/<\/?s\d*>/g, "")
    .replace(/<\/?f[^>]*>/g, "")
    .replace(/<\/?i>/g, "")
    .trim();
};

/**
 * Odstraní příponu z názvu písně typu " (C)  42" — VideoPsalm formát
 * v Nowa Pieśń JSON má v `Text` název písně i zopakované ID a tóninu.
 */
export const stripTitleSuffix = (text: string): string => {
  if (!text) return text;
  return text.replace(/\s*\([^)]*\)\s*\d+\s*$/, "").trim();
};

/**
 * Normalizuje text pro vyhledávání:
 * - lowercase
 * - odstraní diakritiku (české/polské znaky → ASCII)
 * - sjednotí bílé znaky
 */
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

/**
 * Postaví search index z textu tak, aby `.includes(token)` matchnul
 * i token přes hranice slov — tj. uživatel může psát bez mezer.
 *
 * Vrací `"<spaced> <nospace>"` — dva normalizované tvary spojené mezerou.
 * Token "wiarajest" se najde v nospace části "wiarajestsubstancja";
 * tokeny "wiara" + "bogu" (non-adjacent) se najdou v spaced části "wiara w bogu".
 */
export const buildSearchIndex = (text: string): string => {
  const spaced = normalizeSearch(text);
  if (!spaced) return "";
  const nospace = spaced.replace(/\s+/g, "");
  return `${spaced} ${nospace}`;
};
