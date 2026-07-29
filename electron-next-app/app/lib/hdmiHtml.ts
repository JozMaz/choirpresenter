import type { ApiItem, SlideText } from "./types";
import { buildSongFooter } from "./songAdapter";

const ESCAPES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

const escapeHtml = (s: string): string => s.replace(/[&<>"']/g, (c) => ESCAPES[c]);

const linesToHtml = (lines: string[]): string =>
  lines.map(escapeHtml).join("<br>");

interface BuildHdmiHtmlArgs {
  currentSong: ApiItem | null;
  output1: SlideText;
  sectionLabel: string;
  isTranslation?: boolean;
}

function buildCenteredHtml(
  lines: string[],
  topLabel: string,
  bottomLabel: string,
  options: { justify?: boolean } = {},
) {
  const top = topLabel
    ? `<div class="title-row"><span class="sequence">${escapeHtml(topLabel)}</span></div>`
    : "";
  const textClass = options.justify
    ? "text-fit text-flow text-justify"
    : "text-fit text-flow";
  return (
    top +
    `<div class="text-block"><div class="${textClass}">${linesToHtml(lines)}</div></div>` +
    `<div class="title-row"><span class="sequence">${escapeHtml(bottomLabel)}</span></div>`
  );
}

function buildBody(
  primary: string[],
  secondary: string[] | undefined,
  isTranslation?: boolean,
  translationLabel?: string,
  hugDivider?: boolean,
  roomy?: boolean,
): string {
  const hasPrimary = primary.length > 0;
  const hasSecondary = (secondary?.length ?? 0) > 0;
  const hug = hugDivider === true && hasPrimary && hasSecondary;
  const split = hasPrimary && hasSecondary;
  const topExtra = roomy ? (split ? " roomy-top" : " roomy") : "";
  const bottomExtra = roomy ? (split ? " roomy-bottom" : " roomy") : "";

  let html = "";
  if (hasPrimary) {
    const block = hug ? "text-block align-bottom" : `text-block${topExtra}`;
    html += `<div class="${block}"><div class="text-fit">${linesToHtml(primary)}</div></div>`;
  }
  if (hasPrimary && hasSecondary) html += `<div class="divider"></div>`;
  if (hasSecondary) {
    const cls = isTranslation ? "text-fit text-italic" : "text-fit";
    const block = hug ? "text-block align-top" : `text-block${bottomExtra}`;
    const lines =
      isTranslation && translationLabel
        ? [translationLabel, ...secondary!]
        : secondary!;
    html += `<div class="${block}"><div class="${cls}">${linesToHtml(lines)}</div></div>`;
  }
  return html;
}

const isEmpty = (t: SlideText) =>
  t.primary.length === 0 && (t.secondary?.length ?? 0) === 0;

export function buildHdmiHtml({
  currentSong,
  output1,
  sectionLabel,
  isTranslation,
}: BuildHdmiHtmlArgs): string {
  if (!currentSong || isEmpty(output1)) return "";

  if (currentSong.isBible && currentSong.bibleMeta) {
    return buildCenteredHtml(
      output1.primary,
      sectionLabel,
      currentSong.bibleMeta.bibleName,
    );
  }

  if (currentSong.isMessage && currentSong.messageMeta) {
    return buildCenteredHtml(output1.primary, "", sectionLabel, { justify: true });
  }

  const header = `<div class="header"><span class="sequence">${escapeHtml(sectionLabel)}</span><span class="sequence">${escapeHtml(currentSong.sequence || "")}</span></div>`;
  const footer = `<div class="title-row"><span class="sequence">${escapeHtml(buildSongFooter(currentSong))}</span></div>`;

  return (
    header +
    buildBody(
      output1.primary,
      output1.secondary,
      isTranslation,
      currentSong.translationLabel,
      false,
      true,
    ) +
    footer
  );
}

export function buildHdmi2Html(
  currentSong: ApiItem | null,
  output2: SlideText,
  sectionLabel: string,
  isTranslation?: boolean,
): string {
  if (!currentSong || isEmpty(output2)) return "";

  let inner: string;
  if (currentSong.isBible && currentSong.bibleMeta) {
    inner = buildCenteredHtml(
      output2.primary,
      sectionLabel,
      currentSong.bibleMeta.bibleName,
    );
  } else if (currentSong.isMessage && currentSong.messageMeta) {
    inner = buildCenteredHtml(output2.primary, "", sectionLabel, {
      justify: true,
    });
  } else {
    inner = buildBody(
      output2.primary,
      output2.secondary,
      isTranslation,
      currentSong.translationLabel,
      true,
    );
  }
  return `<div class="out2">${inner}</div>`;
}
