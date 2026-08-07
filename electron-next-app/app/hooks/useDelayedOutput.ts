"use client";

import { useEffect, useMemo, useRef, useState } from "react";

export interface OutputFrame {
  html: string;
  blackout: boolean;
}

interface Pending {
  frame: OutputFrame;
  at: number;
}

// Holds an output behind the operator by a fixed amount. It is a pipeline, not
// a debounce: every change is emitted, each one the same distance after it was
// made, so five quick clicks arrive as five clicks with their original spacing.
// The text and the blackout travel as one frame — splitting them would let a
// blackout overtake the change it belongs to.
export function useDelayedOutput(
  html: string,
  blackout: boolean,
  delayMs: number,
): OutputFrame {
  const live = useMemo<OutputFrame>(
    () => ({ html, blackout }),
    [html, blackout],
  );

  const [emitted, setEmitted] = useState<OutputFrame | null>(null);
  const queue = useRef<Pending[]>([]);
  const timer = useRef(0);
  const lastLive = useRef(live);
  const armedDelay = useRef(delayMs);

  // Changing the delay resyncs the output to what the operator sees rather than
  // draining a queue that was timed against the old value.
  const [lastDelay, setLastDelay] = useState(delayMs);
  if (lastDelay !== delayMs) {
    setLastDelay(delayMs);
    setEmitted(null);
  }

  useEffect(() => {
    const changed = lastLive.current !== live;
    lastLive.current = live;

    if (armedDelay.current !== delayMs) {
      armedDelay.current = delayMs;
      queue.current = [];
    }

    if (delayMs <= 0) {
      queue.current = [];
      window.clearTimeout(timer.current);
      timer.current = 0;
      return;
    }

    if (changed) queue.current.push({ frame: live, at: performance.now() });

    // Due times are absolute, so re-arming on every change cannot make the
    // queue drift.
    function arm() {
      window.clearTimeout(timer.current);
      timer.current = 0;
      const next = queue.current[0];
      if (!next) return;
      timer.current = window.setTimeout(
        () => {
          timer.current = 0;
          const now = performance.now();
          let due: OutputFrame | null = null;
          while (queue.current.length && queue.current[0].at + delayMs <= now) {
            due = queue.current.shift()!.frame;
          }
          if (due) setEmitted(due);
          arm();
        },
        Math.max(0, next.at + delayMs - performance.now()),
      );
    }

    arm();
  }, [live, delayMs]);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  return delayMs > 0 && emitted ? emitted : live;
}
