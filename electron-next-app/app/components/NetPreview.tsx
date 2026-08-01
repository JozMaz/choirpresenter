"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useDebounced } from "../hooks/useDebounced";
import { usePersistedState } from "../hooks/usePersistedState";
import { LS_KEYS } from "../lib/constants";
import type { NetStatus, OverlayConfig } from "../lib/types";
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
}

const PREVIEW_INTERVAL_MS = 110;

const MIRROR_OPTIONS: { value: NetMirror; label: string }[] = [
  { value: "local", label: "Local" },
  { value: "stream", label: "Stream" },
];

const SLIDER_CLASS = `flex-1 min-w-0 h-3 appearance-none bg-transparent cursor-pointer outline-none
  [&::-webkit-slider-runnable-track]:h-0.75 [&::-webkit-slider-runnable-track]:rounded-full [&::-webkit-slider-runnable-track]:bg-border-secondary
  [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:-mt-[4.5px] [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-primary [&::-webkit-slider-thumb]:transition-transform hover:[&::-webkit-slider-thumb]:scale-110`;

function useSliderSetting(
  storageKey: string,
  fallback: number,
  ref: React.RefObject<HTMLInputElement | null>,
) {
  const [stored, setStored, hydrated] = usePersistedState<number>(
    storageKey,
    fallback,
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

  return { value, stored, onChange, commit };
}

function Slider({
  label,
  min,
  max,
  inputRef,
  value,
  stored,
  onChange,
  commit,
}: {
  label: string;
  min: number;
  max: number;
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
        step={1}
        defaultValue={stored}
        onChange={onChange}
        onPointerUp={commit}
        onKeyUp={commit}
        onBlur={commit}
        className={SLIDER_CLASS}
      />
      <span className="w-6 shrink-0 text-right text-[10px] font-mono tabular-nums text-text-secondary">
        {value}
      </span>
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
}: NetPreviewProps) {
  const [copied, setCopied] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [addressIndex, setAddressIndex] = useState(0);
  const edgeRef = useRef<HTMLInputElement>(null);
  const widthRef = useRef<HTMLInputElement>(null);
  const heightRef = useRef<HTMLInputElement>(null);
  const scaleRef = useRef<HTMLInputElement>(null);
  const radiusRef = useRef<HTMLInputElement>(null);
  const edgeFade = useSliderSetting(LS_KEYS.netEdgeFade, 40, edgeRef);
  const boxWidth = useSliderSetting(LS_KEYS.netBoxWidth, 100, widthRef);
  const boxHeight = useSliderSetting(LS_KEYS.netBoxHeight, 100, heightRef);
  const boxScale = useSliderSetting(LS_KEYS.netBoxScale, 40, scaleRef);
  const boxRadius = useSliderSetting(LS_KEYS.netBoxRadius, 30, radiusRef);
  const running = status?.running === true;

  const config = useMemo<OverlayConfig>(
    () => ({
      edgeFade: edgeFade.value,
      boxWidth: boxWidth.value,
      boxHeight: boxHeight.value,
      boxScale: boxScale.value,
      boxRadius: boxRadius.value,
    }),
    [
      edgeFade.value,
      boxWidth.value,
      boxHeight.value,
      boxScale.value,
      boxRadius.value,
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
        />
      </div>

      {settingsOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 flex items-center justify-center p-6"
          onClick={() => setSettingsOpen(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-4xl max-h-[85vh] flex flex-col bg-surface rounded-lg border border-border shadow-xl"
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

            <div className="flex-1 overflow-y-auto px-5 pb-5 grid grid-cols-1 md:grid-cols-2 gap-5 items-start">
              <div className="space-y-4">
                <div className="space-y-1">
                  <Slider
                    label="Scale"
                    min={10}
                    max={100}
                    inputRef={scaleRef}
                    {...boxScale}
                  />
                  <Slider
                    label="Width"
                    min={25}
                    max={250}
                    inputRef={widthRef}
                    {...boxWidth}
                  />
                  <Slider
                    label="Height"
                    min={15}
                    max={250}
                    inputRef={heightRef}
                    {...boxHeight}
                  />
                  <Slider
                    label="Radius"
                    min={0}
                    max={100}
                    inputRef={radiusRef}
                    {...boxRadius}
                  />
                  <Slider
                    label="Soft edges"
                    min={0}
                    max={100}
                    inputRef={edgeRef}
                    {...edgeFade}
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

              <div className="border border-border rounded overflow-hidden">
                <OutputFrame
                  html={html}
                  blackout={blackoutActive}
                  overlay
                  overlayConfig={config}
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
