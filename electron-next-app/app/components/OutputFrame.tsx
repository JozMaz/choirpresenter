"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { OverlayConfig } from "../lib/types";

const VIEW_WIDTH = 1920;
const VIEW_HEIGHT = 1080;

interface OutputFrameProps {
  html: string;
  blackout: boolean;
  bg?: string;
  overlay?: boolean;
  boxed?: boolean;
  overlayConfig?: OverlayConfig;
  dividerWidth?: number;
  fadeMs?: number;
  bibleScale?: number;
  messageScale?: number;
  tightLabels?: boolean;
}

const CHECKER =
  "repeating-conic-gradient(#3a3a3a 0% 25%, #2a2a2a 0% 50%) 0 0 / 16px 16px";

export default function OutputFrame({
  html,
  blackout,
  bg,
  overlay,
  boxed,
  overlayConfig,
  dividerWidth,
  fadeMs,
  bibleScale,
  messageScale,
  tightLabels,
}: OutputFrameProps) {
  const boxRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<HTMLIFrameElement>(null);
  const [scale, setScale] = useState(0);
  const [ready, setReady] = useState(false);

  const config = useMemo(
    () => ({
      bg,
      dividerWidth,
      fadeMs,
      bibleScale,
      messageScale,
      tightLabels,
      ...overlayConfig,
      boxed: boxed ?? overlay ?? false,
    }),
    [
      bg,
      dividerWidth,
      fadeMs,
      bibleScale,
      messageScale,
      tightLabels,
      overlayConfig,
      boxed,
      overlay,
    ],
  );

  const latest = useRef({ html, blackout, config });

  useEffect(() => {
    latest.current = { html, blackout, config };
  }, [html, blackout, config]);

  useEffect(() => {
    const box = boxRef.current;
    if (!box) return;
    const measure = () => setScale(box.clientWidth / VIEW_WIDTH);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(box);
    return () => ro.disconnect();
  }, []);

  const push = useCallback((message: unknown) => {
    frameRef.current?.contentWindow?.postMessage(message, "*");
  }, []);

  const pushAll = useCallback(() => {
    const { html, blackout, config } = latest.current;
    push({ type: "view-config", config });
    push({ type: "view-update", html });
    push({ type: "view-blackout", active: blackout });
  }, [push]);

  // The embedded view announces itself whenever its document (re)loads. Without
  // this the frame would keep whatever it had before the reload, because the
  // effects below only fire when their own input changes.
  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      if (e.source !== frameRef.current?.contentWindow) return;
      if ((e.data as { type?: string } | null)?.type !== "view-ready") return;
      setReady(true);
      pushAll();
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [pushAll]);

  // Same order as pushAll and as the network stream: the config has to land
  // before the html it applies to, or a group switch lays the new text out
  // under the profile of the one that just left.
  useEffect(() => {
    if (ready) push({ type: "view-config", config });
  }, [config, ready, push]);

  useEffect(() => {
    if (ready) push({ type: "view-update", html });
  }, [html, ready, push]);

  useEffect(() => {
    if (ready) push({ type: "view-blackout", active: blackout });
  }, [blackout, ready, push]);

  return (
    <div
      ref={boxRef}
      className={`relative w-full overflow-hidden rounded ${
        overlay ? "" : "bg-black"
      }`}
      style={{
        aspectRatio: `${VIEW_WIDTH} / ${VIEW_HEIGHT}`,
        background: overlay ? CHECKER : undefined,
      }}
    >
      <iframe
        ref={frameRef}
        src={overlay ? "hdmi-view.html?overlay=1" : "hdmi-view.html"}
        title="output"
        scrolling="no"
        onLoad={() => setReady(true)}
        style={{
          width: VIEW_WIDTH,
          height: VIEW_HEIGHT,
          border: 0,
          position: "absolute",
          top: 0,
          left: 0,
          transform: `scale(${scale})`,
          transformOrigin: "top left",
          pointerEvents: "none",
          visibility: scale > 0 ? "visible" : "hidden",
        }}
      />
    </div>
  );
}
