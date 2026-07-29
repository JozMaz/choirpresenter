"use client";

import { useEffect } from "react";

export function useHdmiSync(
  variant: 1 | 2,
  active: boolean,
  html: string,
  blackout: boolean,
) {
  useEffect(() => {
    if (!active) return;
    const api = window.api;
    if (!api) return;
    if (variant === 1 && api.updateHdmi && html) api.updateHdmi(html);
    if (variant === 2 && api.updateHdmi2 && html) api.updateHdmi2(html);
  }, [active, html, variant]);

  useEffect(() => {
    if (!active) return;
    const api = window.api;
    if (!api) return;
    if (variant === 1) api.setHdmiBlackout?.(blackout);
    if (variant === 2) api.setHdmi2Blackout?.(blackout);
  }, [active, blackout, variant]);
}
