"use client";

import { useEffect } from "react";

/**
 * Posílá obsah do HDMI okna a udržuje blackout stav v sync.
 * Variant = 1 → primární HDMI; variant = 2 → druhý HDMI.
 */
export function useHdmiSync(
  variant: 1 | 2,
  active: boolean,
  html: string,
  blackout: boolean,
) {
  // Update content
  useEffect(() => {
    if (!active) return;
    const api = window.api;
    if (!api) return;
    if (variant === 1 && api.updateHdmi && html) api.updateHdmi(html);
    if (variant === 2 && api.updateHdmi2 && html) api.updateHdmi2(html);
  });

  // Sync blackout
  useEffect(() => {
    if (!active) return;
    const api = window.api;
    if (!api) return;
    if (variant === 1) api.setHdmiBlackout?.(blackout);
    if (variant === 2) api.setHdmi2Blackout?.(blackout);
  }, [active, blackout, variant]);
}
