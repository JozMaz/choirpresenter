"use client";

import type { HighlightResult } from "../lib/searchHighlight";

interface HighlightedTextProps {
  result: HighlightResult;
  /** CSS třídy pro vyznačené slovo (pill). */
  hitClassName?: string;
  /** Render-fallback když nejsou žádné segmenty (např. mimo search). */
  fallback?: string;
}

/**
 * Zobrazí výsledek z highlightSnippet: prefix … {segments s pills} … suffix.
 */
export default function HighlightedText({
  result,
  hitClassName = "bg-primary/20 text-primary rounded px-0.5",
  fallback,
}: HighlightedTextProps) {
  if (!result.segments.length && fallback !== undefined) {
    return <>{fallback}</>;
  }
  return (
    <>
      {result.prefix}
      {result.segments.map((seg, i) =>
        seg.hit ? (
          <span key={i} className={hitClassName}>
            {seg.text}
          </span>
        ) : (
          <span key={i}>{seg.text}</span>
        ),
      )}
      {result.suffix}
    </>
  );
}
