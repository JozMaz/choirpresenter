import type { ApiItem, SlideText } from "./types";
import { buildSongFooter } from "./songAdapter";
import type { FooterConfig } from "./footerConfig";
import type { OutputChrome, OutputKey } from "./outputConfig";

const ESCAPES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

const escapeHtml = (s: string): string =>
  s.replace(/[&<>"']/g, (c) => ESCAPES[c]);

const linesToHtml = (lines: string[]): string =>
  lines.map(escapeHtml).join("<br>");

const labelRow = (label: string): string =>
  label
    ? `<div class="title-row"><span class="sequence">${escapeHtml(label)}</span></div>`
    : "";

interface BuildOutputHtmlArgs {
  song: ApiItem | null;
  text: SlideText;
  sectionLabel: string;
  chrome: OutputChrome;
  output: OutputKey;
  footerConfig?: FooterConfig;
  translationLabel?: string;
}

function buildCenteredHtml(
  lines: string[],
  topLabel: string,
  bottomLabel: string,
  options: { justify?: boolean } = {},
) {
  const textClass = options.justify
    ? "text-fit text-flow text-justify"
    : "text-fit text-flow";
  return (
    labelRow(topLabel) +
    `<div class="text-block"><div class="${textClass}">${linesToHtml(lines)}</div></div>` +
    labelRow(bottomLabel)
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

  const badge = isTranslation && translationLabel ? translationLabel : "";

  let html = "";
  if (hasPrimary) {
    const block = hug ? "text-block align-bottom" : `text-block${topExtra}`;
    html += `<div class="${block}"><div class="text-fit">${linesToHtml(primary)}</div></div>`;
  }
  if (hasSecondary && (hasPrimary || badge)) {
    html += badge
      ? `<div class="divider labeled"><span class="divider-label">${escapeHtml(badge)}</span></div>`
      : `<div class="divider"></div>`;
  }
  if (hasSecondary) {
    const cls = isTranslation ? "text-fit text-italic" : "text-fit";
    const block = hug ? "text-block align-top" : `text-block${bottomExtra}`;
    html += `<div class="${block}"><div class="${cls}">${linesToHtml(secondary!)}</div></div>`;
  }
  return html;
}

const isEmpty = (t: SlideText) =>
  t.primary.length === 0 && (t.secondary?.length ?? 0) === 0;

export function buildOutputHtml({
  song,
  text,
  sectionLabel,
  chrome,
  output,
  footerConfig,
  translationLabel,
}: BuildOutputHtmlArgs): string {
  if (!song || isEmpty(text)) return "";

  if (song.isBible && song.bibleMeta) {
    return buildCenteredHtml(
      text.primary,
      chrome.header ? sectionLabel : "",
      chrome.footer ? song.bibleMeta.bibleName : "",
    );
  }

  if (song.isMessage && song.messageMeta) {
    return buildCenteredHtml(
      text.primary,
      chrome.header ? sectionLabel : "",
      chrome.footer ? sectionLabel : "",
      { justify: true },
    );
  }

  const stream = output === "stream";
  const header =
    chrome.header || chrome.sequence
      ? `<div class="header"><span class="sequence">${escapeHtml(
          chrome.header ? sectionLabel : "",
        )}</span><span class="sequence">${escapeHtml(
          chrome.sequence ? song.sequence || "" : "",
        )}</span></div>`
      : "";
  const footer = chrome.footer
    ? labelRow(buildSongFooter(song, footerConfig))
    : "";

  const body = buildBody(
    text.primary,
    chrome.secondary ? text.secondary : undefined,
    text.isTranslation,
    translationLabel || song.translationLabel,
    stream,
    !stream,
  );

  const html = header + body + footer;
  return stream ? `<div class="out2">${html}</div>` : html;
}
