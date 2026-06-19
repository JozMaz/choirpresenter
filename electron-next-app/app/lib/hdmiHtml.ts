import type { ApiItem } from "./types";
import { buildSongFooter, isBilingualSource } from "./songProcessing";

interface BuildHdmiHtmlArgs {
  currentSong: ApiItem | null;
  output1Text: string;
  sectionLabel: string;
  /** True když aktuální verš je jen "Translation" — EN část se renderuje italic. */
  isTranslation?: boolean;
}

/** Bible/Message layout: volitelný top label, uprostřed text, dole label. */
function buildCenteredHtml(
  text: string,
  topLabel: string,
  bottomLabel: string,
  options: { justify?: boolean } = {},
) {
  const top = topLabel
    ? `<div class="title-row"><span class="sequence">${topLabel}</span></div>`
    : "";
  const textClass = options.justify ? "text-fit text-justify" : "text-fit";
  return (
    top +
    `<div class="text-block"><div class="${textClass}">${text}</div></div>` +
    `<div class="title-row"><span class="sequence">${bottomLabel}</span></div>`
  );
}

export function buildHdmiHtml({
  currentSong,
  output1Text,
  sectionLabel,
  isTranslation,
}: BuildHdmiHtmlArgs): string {
  if (!currentSong) return "";

  if (currentSong.isBible && currentSong.bibleMeta) {
    return buildCenteredHtml(
      output1Text,
      sectionLabel,
      currentSong.bibleMeta.bibleName,
    );
  }

  if (currentSong.isMessage && currentSong.messageMeta) {
    // Message: top prázdný, dole jde celý sectionLabel ("Title - 47-0412 par.5"),
    // text block-justify.
    return buildCenteredHtml(output1Text, "", sectionLabel, { justify: true });
  }

  const sequence = currentSong.sequence || "";
  const footerText = buildSongFooter(currentSong);

  const header = `<div class="header"><span class="sequence">${sectionLabel}</span><span class="sequence">${sequence}</span></div>`;
  const footer = `<div class="title-row"><span class="sequence">${footerText}</span></div>`;

  if (isBilingualSource(currentSong)) {
    const [plText = "", enText = ""] = output1Text.split("\n\n");
    const enClass = isTranslation ? "text-fit text-italic" : "text-fit";
    let html = header;
    if (plText)
      html += `<div class="text-block"><div class="text-fit">${plText}</div></div>`;
    if (plText && enText) html += `<div class="divider"></div>`;
    // Prázdný EN nerenderujeme — PL se tak vycentruje přes celou výšku.
    if (enText)
      html += `<div class="text-block"><div class="${enClass}">${enText}</div></div>`;
    html += footer;
    return html;
  }

  return `${header}<div class="text-block"><div class="text-fit">${output1Text}</div></div>${footer}`;
}

export function buildHdmi2Html(
  currentSong: ApiItem | null,
  output2Text: string,
  sectionLabel: string,
  isTranslation?: boolean,
): string {
  if (!currentSong) return "";

  if (currentSong.isBible && currentSong.bibleMeta) {
    return buildCenteredHtml(
      output2Text,
      sectionLabel,
      currentSong.bibleMeta.bibleName,
    );
  }

  if (currentSong.isMessage && currentSong.messageMeta) {
    return buildCenteredHtml(output2Text, "", sectionLabel, { justify: true });
  }

  if (isBilingualSource(currentSong)) {
    const [plPart = "", enPart = ""] = output2Text.split("\n\n");
    const enClass = isTranslation ? "text-fit text-italic" : "text-fit";
    let html = "";
    if (plPart)
      html += `<div class="text-block"><div class="text-fit">${plPart}</div></div>`;
    if (plPart && enPart) html += `<div class="divider"></div>`;
    if (enPart)
      html += `<div class="text-block"><div class="${enClass}">${enPart}</div></div>`;
    return html;
  }

  return `<div class="text-block"><div class="text-fit">${output2Text}</div></div>`;
}
