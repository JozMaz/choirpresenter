import { TRANSLATION_LABEL_DEFAULT, TRANSLATION_LABEL_PL } from "./constants";

const POLISH_LETTERS = /[ąćęłńśźżĄĆĘŁŃŚŹŻ]/;

const POLISH_WORDS =
  /\b(nie|jest|sie|ze|jak|ktory|Bog|mnie|Pan|swe|dla|przez|tylko|juz|jego|moj|nasz|tego|byl|ktore)\b/i;

export function isPolish(lines: string[]): boolean {
  const text = lines.join(" ");
  if (POLISH_LETTERS.test(text)) return true;
  return POLISH_WORDS.test(text.normalize("NFD").replace(/[̀-ͯ]/g, ""));
}

export function translationLabelFor(lines: string[]): string {
  return isPolish(lines) ? TRANSLATION_LABEL_PL : TRANSLATION_LABEL_DEFAULT;
}
