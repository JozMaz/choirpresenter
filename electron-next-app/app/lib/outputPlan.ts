import { partsForMax } from "./slideSplit";
import {
  DEFAULT_OUTPUT_CONFIG,
  outputScopeFor,
  type GroupMode,
  type OutputConfig,
} from "./outputConfig";
import type { ApiItem, Section, SlideText } from "./types";

export interface Step {
  sectionIndex: number;
  local: SlideText;
  stream: SlideText;
  preview: SlideText;
}

export interface SongPlan {
  steps: Step[];
  sectionStart: number[];
  sectionCount: number[];
}

const EMPTY_PLAN: SongPlan = {
  steps: [],
  sectionStart: [],
  sectionCount: [],
};

export const EMPTY_TEXT: SlideText = { primary: [] };

function storedSlides(song: ApiItem, section: Section) {
  return song.slides.slice(
    section.slideStart,
    section.slideStart + section.slideCount,
  );
}

function storedCuts(song: ApiItem, section: Section): number[] {
  const total = section.primary.length;
  const cuts = [0];
  let at = 0;
  for (const slide of storedSlides(song, section)) {
    at += slide.primary.length;
    cuts.push(at);
  }
  return cuts.length > 1 && at === total ? cuts : [0, total];
}

function splitCuts(from: number, to: number, maxLines: number): number[] {
  const total = to - from;
  const parts = partsForMax(total, maxLines);
  const base = Math.floor(total / parts);
  const remainder = total % parts;
  const cuts: number[] = [];
  let at = from;
  for (let i = 0; i < parts - 1; i++) {
    at += base + (i >= parts - remainder ? 1 : 0);
    cuts.push(at);
  }
  return cuts;
}

function cutsFor(song: ApiItem, section: Section, mode: GroupMode): number[] {
  const total = section.primary.length;
  if (mode.kind === "stored") return storedCuts(song, section);
  if (mode.kind === "section") return [0, total];
  return [0, ...splitCuts(0, total, mode.lines), total];
}

function nestedCuts(
  outer: number[],
  song: ApiItem,
  section: Section,
  mode: GroupMode,
): number[] {
  if (mode.kind === "section") return outer;
  if (mode.kind === "stored") {
    const merged = new Set([...outer, ...storedCuts(song, section)]);
    return [...merged].sort((a, b) => a - b);
  }
  const cuts = [outer[0]];
  for (let i = 0; i + 1 < outer.length; i++) {
    cuts.push(...splitCuts(outer[i], outer[i + 1], mode.lines), outer[i + 1]);
  }
  return cuts;
}

function materialize(
  song: ApiItem,
  section: Section,
  cuts: number[],
  mode: GroupMode,
): SlideText[] {
  const isTranslation = section.secondaryIsTranslation === true;
  const primary = section.primary;
  const secondary = section.secondary ?? [];
  const lineCount = primary.length;
  const altCount = secondary.length;

  if (lineCount === 0) {
    return [
      {
        primary: [],
        secondary: altCount > 0 ? secondary : undefined,
        isTranslation,
      },
    ];
  }

  const stored = mode.kind === "stored" ? storedSlides(song, section) : null;
  const keepStoredAlt = stored !== null && stored.length === cuts.length - 1;
  const altAt = (cut: number) => Math.round((cut * altCount) / lineCount);

  const blocks: SlideText[] = [];
  for (let i = 0; i + 1 < cuts.length; i++) {
    const from = cuts[i];
    const to = cuts[i + 1];
    const alt = keepStoredAlt
      ? stored[i].secondary
      : altCount > 0
        ? secondary.slice(altAt(from), altAt(to))
        : undefined;
    blocks.push({
      primary: primary.slice(from, to),
      secondary: alt?.length ? alt : undefined,
      isTranslation,
    });
  }
  return blocks;
}

export function buildPlan(song: ApiItem, config: OutputConfig): SongPlan {
  const scope = outputScopeFor(song);
  const pair = config[scope] ?? DEFAULT_OUTPUT_CONFIG[scope];

  const steps: Step[] = [];
  const sectionStart: number[] = [];
  const sectionCount: number[] = [];

  song.sections.forEach((section, sectionIndex) => {
    const localOwn = cutsFor(song, section, pair.local.group);
    const streamOwn = cutsFor(song, section, pair.stream.group);
    const localIsOuter = localOwn.length <= streamOwn.length;

    const outerCuts = localIsOuter ? localOwn : streamOwn;
    const innerCuts = nestedCuts(
      outerCuts,
      song,
      section,
      localIsOuter ? pair.stream.group : pair.local.group,
    );

    const localBlocks = materialize(
      song,
      section,
      localIsOuter ? outerCuts : innerCuts,
      pair.local.group,
    );
    const streamBlocks = materialize(
      song,
      section,
      localIsOuter ? innerCuts : outerCuts,
      pair.stream.group,
    );

    const outerBlocks = localIsOuter ? localBlocks : streamBlocks;
    const innerBlocks = localIsOuter ? streamBlocks : localBlocks;

    sectionStart.push(steps.length);
    sectionCount.push(innerBlocks.length);

    let outerIndex = 0;
    innerBlocks.forEach((block, i) => {
      while (
        outerIndex + 2 < outerCuts.length &&
        outerCuts[outerIndex + 1] <= innerCuts[i]
      ) {
        outerIndex++;
      }
      const outer = outerBlocks[outerIndex];
      steps.push({
        sectionIndex,
        local: localIsOuter ? outer : block,
        stream: localIsOuter ? block : outer,
        preview: block,
      });
    });
  });

  return { steps, sectionStart, sectionCount };
}

const cache = new WeakMap<ApiItem, { config: OutputConfig; plan: SongPlan }>();

export function planFor(song: ApiItem | null, config: OutputConfig): SongPlan {
  if (!song) return EMPTY_PLAN;
  const hit = cache.get(song);
  if (hit && hit.config === config) return hit.plan;
  const plan = buildPlan(song, config);
  cache.set(song, { config, plan });
  return plan;
}
