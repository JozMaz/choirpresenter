"use client";

import { useEffect, useRef, useState } from "react";

const VIEW_WIDTH = 1920;
const VIEW_HEIGHT = 1080;

interface OutputFrameProps {
  html: string;
  blackout: boolean;
  bg?: string;
}

export default function OutputFrame({ html, blackout, bg }: OutputFrameProps) {
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
    if (!ready || !bg) return;
    frameRef.current?.contentWindow?.postMessage(
      { type: "view-config", config: { bg } },
      "*",
    );
  }, [bg, ready]);

  return (
    <div
      ref={boxRef}
      className="relative w-full overflow-hidden bg-black rounded"
      style={{ aspectRatio: `${VIEW_WIDTH} / ${VIEW_HEIGHT}` }}
    >
      <iframe
        ref={frameRef}
        src="hdmi-view.html"
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
