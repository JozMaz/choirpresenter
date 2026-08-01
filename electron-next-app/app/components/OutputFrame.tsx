"use client";

import { useEffect, useRef, useState } from "react";
import type { OverlayConfig } from "../lib/types";

const VIEW_WIDTH = 1920;
const VIEW_HEIGHT = 1080;

interface OutputFrameProps {
  html: string;
  blackout: boolean;
  bg?: string;
  overlay?: boolean;
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

  useEffect(() => {
    const box = boxRef.current;
    if (!box) return;
    const measure = () => setScale(box.clientWidth / VIEW_WIDTH);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(box);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    if (!ready) return;
    frameRef.current?.contentWindow?.postMessage(
      { type: "view-update", html },
      "*",
    );
  }, [html, ready]);

  useEffect(() => {
    if (!ready) return;
    frameRef.current?.contentWindow?.postMessage(
      { type: "view-blackout", active: blackout },
      "*",
    );
  }, [blackout, ready]);

  useEffect(() => {
    if (!ready) return;
    frameRef.current?.contentWindow?.postMessage(
      {
        type: "view-config",
        config: {
          bg,
          dividerWidth,
          fadeMs,
          bibleScale,
          messageScale,
          tightLabels,
          ...overlayConfig,
        },
      },
      "*",
    );
  }, [
    bg,
    dividerWidth,
    fadeMs,
    bibleScale,
    messageScale,
    tightLabels,
    overlayConfig,
    ready,
  ]);

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
