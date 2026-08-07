"use client";

import type { HighlightResult } from "../lib/searchHighlight";

interface HighlightedTextProps {
  result: HighlightResult;
  hitClassName?: string;
  fallback?: string;
}

export default function HighlightedText({
  result,
  hitClassName = "bg-primary/10 text-text-primary rounded px-0.5",
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
