"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useDebounced } from "../hooks/useDebounced";
import { usePersistedState } from "../hooks/usePersistedState";
import { LS_KEYS } from "../lib/constants";
import type { BoxAlign, BoxMode, NetStatus, OverlayConfig } from "../lib/types";
import Icon from "./Icon";
import OutputFrame from "./OutputFrame";

export type NetMirror = "local" | "stream";

interface NetPreviewProps {
  html: string;
  blackoutActive: boolean;
  status: NetStatus | null;
  busy: boolean;
  onToggle: () => void;
  mirror: NetMirror;
  onChangeMirror: (mirror: NetMirror) => void;
  dividerWidth?: number;
}

const PREVIEW_INTERVAL_MS = 110;
const OFFSET_RANGE = 50;
const OFFSET_Y_MIN = -75;
const OFFSET_Y_MAX = 10;
const OFFSET_SNAP = 2;

const clamp = (v: number, min: number, max: number) =>
  Math.max(min, Math.min(max, v));

const round = (v: number) => Math.round(v * 10) / 10;

const snapToCentre = (v: number) => (Math.abs(v) <= OFFSET_SNAP ? 0 : round(v));

const BOX_MODES: { value: BoxMode; label: string; hint: string }[] = [
  {
    value: "padding",
    label: "Padding",
    hint: "Box hugs the text with a margin around it",
  },
  {
    value: "size",
    label: "Fixed",
    hint: "Box keeps the same size no matter how much text there is",
  },
];

const readBoxMode = (raw: string | null): BoxMode =>
  raw === "size" ? "size" : "padding";

const readBoxAlign = (raw: string | null): BoxAlign =>
  raw === "start" || raw === "end" ? raw : "center";

const ALIGN_X: { value: BoxAlign; label: string }[] = [
  { value: "start", label: "Left" },
  { value: "center", label: "Centre" },
  { value: "end", label: "Right" },
];

const ALIGN_Y: { value: BoxAlign; label: string }[] = [
  { value: "start", label: "Top" },
  { value: "center", label: "Centre" },
  { value: "end", label: "Bottom" },
];

const MIRROR_OPTIONS: { value: NetMirror; label: string }[] = [
  { value: "local", label: "Local" },
  { value: "stream", label: "Stream" },
];

const SLIDER_CLASS = `flex-1 min-w-0 h-3 appearance-none bg-transparent cursor-pointer outline-none
  [&::-webkit-slider-runnable-track]:h-0.75 [&::-webkit-slider-runnable-track]:rounded-full [&::-webkit-slider-runnable-track]:bg-border-secondary
  [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:-mt-[4.5px] [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-primary [&::-webkit-slider-thumb]:transition-transform hover:[&::-webkit-slider-thumb]:scale-110`;

const readNumber = (fallback: number) => (raw: string | null) => {
  const parsed = raw?.trim() ? Number(raw) : NaN;
  return Number.isFinite(parsed) ? parsed : fallback;
};

function useSliderSetting(
  storageKey: string,
  fallback: number,
  ref: React.RefObject<HTMLInputElement | null>,
) {
  const [stored, setStored, hydrated] = usePersistedState<number>(
    storageKey,
    fallback,
    readNumber(fallback),
  );
  const [value, setValue] = useState(fallback);
  const timer = useRef(0);
  const last = useRef(0);

  useEffect(() => {
    if (!hydrated) return;
    if (ref.current) ref.current.value = String(stored);
    setValue(stored);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated]);

  useEffect(() => () => clearTimeout(timer.current), []);

  const apply = () => {
    last.current = performance.now();
    setValue(Number(ref.current?.value ?? fallback));
  };

  const onChange = () => {
    const wait = PREVIEW_INTERVAL_MS - (performance.now() - last.current);
    if (wait <= 0) {
      apply();
      return;
    }
    if (timer.current) return;
    timer.current = window.setTimeout(() => {
      timer.current = 0;
      apply();
    }, wait);
  };

  const commit = () => {
    clearTimeout(timer.current);
    timer.current = 0;
    apply();
    setStored(Number(ref.current?.value ?? fallback));
  };

  return { value, stored, onChange, commit, apply };
}

function Slider({
  label,
  min,
  max,
  step = 1,
  inputRef,
  value,
  stored,
  onChange,
  commit,
}: {
  label: string;
  min: number;
  max: number;
  step?: number;
  inputRef: React.Ref<HTMLInputElement>;
  value: number;
  stored: number;
  onChange: () => void;
  commit: () => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-14 shrink-0 text-[10px] text-text-muted">{label}</span>
      <input
        ref={inputRef}
        type="range"
        min={min}
        max={max}
        step={step}
        defaultValue={stored}
        onChange={onChange}
        onPointerUp={commit}
        onKeyUp={commit}
        onBlur={commit}
        className={SLIDER_CLASS}
      />
      <span className="w-9 shrink-0 text-right text-[10px] font-mono tabular-nums text-text-secondary">
        {Number.isInteger(value) ? value : value.toFixed(1)}
      </span>
    </div>
  );
}

function Segmented<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { value: T; label: string; hint?: string }[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <div className="flex items-center gap-2 pt-1">
      <span className="w-14 shrink-0 text-[10px] text-text-muted">{label}</span>
      <div className="inline-flex items-center gap-0.5 p-0.5 rounded-md border border-border bg-surface-secondary">
        {options.map((opt) => (
          <button
            key={opt.value}
            onClick={() => onChange(opt.value)}
            title={opt.hint}
            className={`px-2 py-0.5 text-[10px] font-semibold rounded transition-colors ${
              value === opt.value
                ? "bg-primary text-white"
                : "text-text-muted hover:bg-surface-hover hover:text-text-primary"
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export default function NetPreview({
  html,
  blackoutActive,
  status,
  busy,
  onToggle,
  mirror,
  onChangeMirror,
  dividerWidth,
}: NetPreviewProps) {
  const [copied, setCopied] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [addressIndex, setAddressIndex] = useState(0);
  const edgeRef = useRef<HTMLInputElement>(null);
  const widthRef = useRef<HTMLInputElement>(null);
  const heightRef = useRef<HTMLInputElement>(null);
  const padXRef = useRef<HTMLInputElement>(null);
  const padYRef = useRef<HTMLInputElement>(null);
  const scaleRef = useRef<HTMLInputElement>(null);
  const radiusRef = useRef<HTMLInputElement>(null);
  const alphaRef = useRef<HTMLInputElement>(null);
  const offsetRef = useRef<HTMLInputElement>(null);
  const offsetYRef = useRef<HTMLInputElement>(null);
  const fadeRef = useRef<HTMLInputElement>(null);
  const dragRef = useRef<{
    x: number;
    y: number;
    baseX: number;
    baseY: number;
    width: number;
    height: number;
  } | null>(null);
  const frameRef = useRef(0);
  const [dragging, setDragging] = useState(false);

  useEffect(() => () => cancelAnimationFrame(frameRef.current), []);
  const edgeFade = useSliderSetting(LS_KEYS.netEdgeFade, 40, edgeRef);
  const boxPadX = useSliderSetting(LS_KEYS.netBoxPadX, 4, padXRef);
  const boxPadY = useSliderSetting(LS_KEYS.netBoxPadY, 6, padYRef);
  const boxWidth = useSliderSetting(LS_KEYS.netBoxWidth, 106, widthRef);
  const boxHeight = useSliderSetting(LS_KEYS.netBoxHeight, 110, heightRef);
  const [boxModeX, setBoxModeX] = usePersistedState<BoxMode>(
    LS_KEYS.netBoxModeX,
    "padding",
    readBoxMode,
  );
  const [boxModeY, setBoxModeY] = usePersistedState<BoxMode>(
    LS_KEYS.netBoxModeY,
    "padding",
    readBoxMode,
  );
  const [boxAlignX, setBoxAlignX] = usePersistedState<BoxAlign>(
    LS_KEYS.netBoxAlignX,
    "center",
    readBoxAlign,
  );
  const [boxAlignY, setBoxAlignY] = usePersistedState<BoxAlign>(
    LS_KEYS.netBoxAlignY,
    "center",
    readBoxAlign,
  );
  const boxScale = useSliderSetting(LS_KEYS.netBoxScale, 40, scaleRef);
  const boxRadius = useSliderSetting(LS_KEYS.netBoxRadius, 30, radiusRef);
  const boxAlpha = useSliderSetting(LS_KEYS.netBoxAlpha, 50, alphaRef);
  const boxOffsetX = useSliderSetting(LS_KEYS.netBoxOffsetX, 0, offsetRef);
  const boxOffsetY = useSliderSetting(LS_KEYS.netBoxOffsetY, 0, offsetYRef);
  const fadeMs = useSliderSetting(LS_KEYS.netFadeMs, 320, fadeRef);
  const running = status?.running === true;

  const startDrag = (e: React.PointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    dragRef.current = {
      x: e.clientX,
      y: e.clientY,
      baseX: Number(offsetRef.current?.value ?? 0),
      baseY: Number(offsetYRef.current?.value ?? 0),
      width: e.currentTarget.clientWidth,
      height: e.currentTarget.clientHeight,
    };
    setDragging(true);
  };

  const moveDrag = (e: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || !offsetRef.current || !offsetYRef.current) return;

    const shiftX = ((e.clientX - drag.x) / drag.width) * 100;
    offsetRef.current.value = String(
      snapToCentre(clamp(drag.baseX + shiftX, -OFFSET_RANGE, OFFSET_RANGE)),
    );

    const shiftY = ((e.clientY - drag.y) / drag.height) * 100;
    offsetYRef.current.value = String(
      round(clamp(drag.baseY + shiftY, OFFSET_Y_MIN, OFFSET_Y_MAX)),
    );

    if (frameRef.current) return;
    frameRef.current = requestAnimationFrame(() => {
      frameRef.current = 0;
      boxOffsetX.apply();
      boxOffsetY.apply();
    });
  };

  const endDrag = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragRef.current) return;
    dragRef.current = null;
    cancelAnimationFrame(frameRef.current);
    frameRef.current = 0;
    setDragging(false);
    e.currentTarget.releasePointerCapture(e.pointerId);
    boxOffsetX.commit();
    boxOffsetY.commit();
  };

  const resetPosition = () => {
    if (offsetRef.current) offsetRef.current.value = "0";
    if (offsetYRef.current) offsetYRef.current.value = "0";
    boxOffsetX.commit();
    boxOffsetY.commit();
  };

  const config = useMemo<OverlayConfig>(
    () => ({
      edgeFade: edgeFade.value,
      boxModeX,
      boxModeY,
      boxAlignX,
      boxAlignY,
      boxPadX: boxPadX.value,
      boxPadY: boxPadY.value,
      boxWidth: boxWidth.value,
      boxHeight: boxHeight.value,
      boxScale: boxScale.value,
      boxRadius: boxRadius.value,
      boxAlpha: boxAlpha.value,
      boxOffsetX: boxOffsetX.value,
      boxOffsetY: boxOffsetY.value,
      fadeMs: fadeMs.value,
    }),
    [
      edgeFade.value,
      boxModeX,
      boxModeY,
      boxAlignX,
      boxAlignY,
      boxPadX.value,
      boxPadY.value,
      boxWidth.value,
      boxHeight.value,
      boxScale.value,
      boxRadius.value,
      boxAlpha.value,
      boxOffsetX.value,
      boxOffsetY.value,
      fadeMs.value,
    ],
  );
  const netConfig = useDebounced(config, 120);
  useEffect(() => {
    if (running) window.api?.netConfig?.(netConfig);
  }, [running, netConfig]);
  const addresses = status?.addresses ?? [];
  const selected = Math.min(addressIndex, addresses.length - 1);
  const active = selected >= 0 ? addresses[selected] : undefined;
  const url =
    running && active ? `http://${active.address}:${status?.port}` : "";

  const copy = () => {
    if (!url) return;
    void navigator.clipboard?.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="flex-1">
      <div className="flex items-center gap-2 mb-2">
        <h2 className="text-lg font-semibold text-text-primary">Network</h2>
        <div className="flex-1" />
        <button
          onClick={() => setSettingsOpen(true)}
          title="Network output settings"
          className="w-7 h-7 flex items-center justify-center rounded border border-border text-text-secondary transition-colors hover:bg-surface-hover hover:text-text-primary"
        >
          <Icon name="Settings" size={13} />
        </button>
        <button
          onClick={onToggle}
          disabled={busy}
          className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded border transition-colors disabled:opacity-50 ${
            running
              ? "bg-danger border-danger text-white"
              : "bg-surface-secondary border-border text-text-secondary hover:text-text-primary"
          }`}
        >
          <Icon name={running ? "Square" : "Play"} size={12} />
          {running ? "Stop" : "Start"}
        </button>
      </div>

      <div className="border border-border rounded overflow-hidden">
        <OutputFrame
          html={html}
          blackout={blackoutActive}
          overlay
          overlayConfig={config}
          dividerWidth={dividerWidth}
        />
      </div>

      {settingsOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 flex items-center justify-center p-6"
          onClick={() => setSettingsOpen(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-7xl max-h-[92vh] flex flex-col bg-surface rounded-lg border border-border shadow-xl"
          >
            <div className="shrink-0 flex items-center gap-2 px-5 pt-4 pb-3">
              <h2 className="flex-1 text-lg font-semibold text-text-primary">
                Network output
              </h2>
              <div className="inline-flex items-center gap-0.5 p-0.5 rounded-md border border-border bg-surface-secondary">
                {MIRROR_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => onChangeMirror(opt.value)}
                    title={`Send the ${opt.label} output over the network`}
                    className={`px-2.5 py-1 text-[10px] font-semibold rounded transition-colors ${
                      mirror === opt.value
                        ? "bg-primary text-white"
                        : "text-text-muted hover:bg-surface-hover hover:text-text-primary"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
              <div className="flex-1 flex justify-end">
                <button
                  onClick={() => setSettingsOpen(false)}
                  className="w-8 h-8 flex items-center justify-center rounded text-text-secondary hover:bg-surface-hover hover:text-text-primary transition-colors"
                >
                  <Icon name="X" size={16} />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-5 pb-5 grid grid-cols-1 md:grid-cols-[minmax(0,20rem)_1fr] gap-5 items-start">
              <div className="space-y-4">
                <div className="space-y-1">
                  <Slider
                    label="Scale"
                    min={10}
                    max={100}
                    inputRef={scaleRef}
                    {...boxScale}
                  />
                  <Segmented
                    label="Horizontal"
                    options={BOX_MODES}
                    value={boxModeX}
                    onChange={setBoxModeX}
                  />
                  <Segmented
                    label="Anchor X"
                    options={ALIGN_X}
                    value={boxAlignX}
                    onChange={setBoxAlignX}
                  />
                  <div className={boxModeX === "padding" ? "" : "hidden"}>
                    <Slider
                      label="Padding X"
                      min={0}
                      max={25}
                      step={0.5}
                      inputRef={padXRef}
                      {...boxPadX}
                    />
                  </div>
                  <div className={boxModeX === "size" ? "" : "hidden"}>
                    <Slider
                      label="Width"
                      min={25}
                      max={250}
                      inputRef={widthRef}
                      {...boxWidth}
                    />
                  </div>

                  <Segmented
                    label="Vertical"
                    options={BOX_MODES}
                    value={boxModeY}
                    onChange={setBoxModeY}
                  />
                  <Segmented
                    label="Anchor Y"
                    options={ALIGN_Y}
                    value={boxAlignY}
                    onChange={setBoxAlignY}
                  />
                  <div className={boxModeY === "padding" ? "" : "hidden"}>
                    <Slider
                      label="Padding Y"
                      min={0}
                      max={25}
                      step={0.5}
                      inputRef={padYRef}
                      {...boxPadY}
                    />
                  </div>
                  <div className={boxModeY === "size" ? "" : "hidden"}>
                    <Slider
                      label="Height"
                      min={15}
                      max={250}
                      inputRef={heightRef}
                      {...boxHeight}
                    />
                  </div>
                  <Slider
                    label="Radius"
                    min={0}
                    max={100}
                    inputRef={radiusRef}
                    {...boxRadius}
                  />
                  <Slider
                    label="Darkness"
                    min={0}
                    max={100}
                    inputRef={alphaRef}
                    {...boxAlpha}
                  />
                  <Slider
                    label="Soft edges"
                    min={0}
                    max={300}
                    inputRef={edgeRef}
                    {...edgeFade}
                  />
                  <Slider
                    label="Left / right"
                    min={-OFFSET_RANGE}
                    max={OFFSET_RANGE}
                    step={0.1}
                    inputRef={offsetRef}
                    {...boxOffsetX}
                  />
                  <Slider
                    label="Fade"
                    min={0}
                    max={1200}
                    step={20}
                    inputRef={fadeRef}
                    {...fadeMs}
                  />
                  <Slider
                    label="Up / down"
                    min={OFFSET_Y_MIN}
                    max={OFFSET_Y_MAX}
                    step={0.1}
                    inputRef={offsetYRef}
                    {...boxOffsetY}
                  />
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center gap-1.5">
                    <input
                      type="text"
                      readOnly
                      value={url}
                      placeholder="Start to get the address"
                      onFocus={(e) => e.currentTarget.select()}
                      className="flex-1 min-w-0 px-2 py-1 text-[11px] font-mono border border-border-secondary rounded bg-surface text-text-primary placeholder-text-muted focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                    <button
                      onClick={copy}
                      disabled={!url}
                      title="Copy — paste into a browser source in your streaming software"
                      className="flex items-center gap-1 shrink-0 px-2 py-1 text-[11px] font-semibold rounded border border-border-secondary text-text-secondary transition-colors hover:bg-surface-hover hover:text-text-primary disabled:opacity-40"
                    >
                      <Icon name={copied ? "Check" : "Copy"} size={12} />
                      {copied ? "Copied" : "Copy"}
                    </button>
                  </div>

                  {running && addresses.length > 1 && (
                    <div className="flex flex-wrap items-center gap-1">
                      <span className="text-[10px] text-text-muted">
                        Adapter:
                      </span>
                      {addresses.map((entry, i) => (
                        <button
                          key={entry.address}
                          onClick={() => setAddressIndex(i)}
                          title={`${entry.name} — ${entry.address}`}
                          className={`px-1.5 py-0.5 text-[10px] font-mono rounded border transition-colors ${
                            i === selected
                              ? "bg-primary border-primary text-white"
                              : "bg-surface-secondary border-border text-text-secondary hover:text-text-primary"
                          }`}
                        >
                          {entry.name} · {entry.address}
                        </button>
                      ))}
                    </div>
                  )}

                  {status?.error && (
                    <p className="text-[11px] text-danger">
                      Could not start: {status.error}
                    </p>
                  )}
                  {running && addresses.length === 0 && (
                    <p className="text-[11px] text-danger">
                      No network address found — this machine is not on a LAN.
                    </p>
                  )}
                  {running && addresses.length > 0 && (
                    <p className="text-[10px] text-text-muted leading-snug">
                      Add this address as a browser source in your streaming
                      software. Both computers have to be on the same network,
                      and the firewall must allow incoming connections.
                    </p>
                  )}
                </div>
              </div>

              <div className="relative border border-border rounded overflow-hidden">
                <OutputFrame
                  html={html}
                  blackout={blackoutActive}
                  overlay
                  overlayConfig={config}
                  dividerWidth={dividerWidth}
                />
                {dragging && (
                  <div
                    className={`absolute inset-y-0 left-1/2 w-px -translate-x-1/2 pointer-events-none ${
                      boxOffsetX.value === 0 ? "bg-primary" : "bg-white/25"
                    }`}
                  />
                )}
                <div
                  onPointerDown={startDrag}
                  onPointerMove={moveDrag}
                  onPointerUp={endDrag}
                  onPointerCancel={endDrag}
                  onDoubleClick={resetPosition}
                  title="Drag to move — snaps to centre and to the default position, double-click to reset"
                  className={`absolute inset-0 ${dragging ? "cursor-grabbing" : "cursor-grab"}`}
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
