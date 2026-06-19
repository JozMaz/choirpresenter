"use client";

import { useCallback, useEffect, useRef } from "react";

/**
 * Vrací refs na container + content; obsah se automaticky scale-uje tak, aby se vešel.
 * Spustí se na změnu deps (typicky text) i na resize containeru.
 */
export function useScaleToFit(deps: unknown[] = []) {
  const containerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  const scale = useCallback(() => {
    const container = containerRef.current;
    const content = contentRef.current;
    if (!container || !content) return;

    content.style.transform = "scale(1)";
    const containerW = container.clientWidth;
    const containerH = container.clientHeight;
    const contentW = content.scrollWidth;
    const contentH = content.scrollHeight;
    if (containerW === 0 || containerH === 0) return;

    const scaleW = contentW > 0 ? containerW / contentW : 1;
    const scaleH = contentH > 0 ? containerH / contentH : 1;
    const s = Math.min(scaleW, scaleH, 1);
    content.style.transform = s < 1 ? `scale(${s})` : "scale(1)";
  }, []);

  useEffect(() => {
    const frame = requestAnimationFrame(scale);
    return () => cancelAnimationFrame(frame);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scale, ...deps]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => scale());
    ro.observe(el);
    return () => ro.disconnect();
  }, [scale]);

  return { containerRef, contentRef };
}
