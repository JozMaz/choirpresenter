"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useDebounced } from "../hooks/useDebounced";
import { usePersistedState } from "../hooks/usePersistedState";
import { LS_KEYS } from "../lib/constants";
import {
  DISPLAY_GROUPS,
  DEFAULT_BG,
  OVERLAY_DEFAULTS,
  PROFILE_DEFAULTS,
  fittedOverlay,
  profileKey,
  readBoxAlign,
  readBoxMode,
  readOverlayConfig,
  type DisplayGroup,
  type ProfileField,
} from "../lib/outputProfiles";
import {
  outputName,
  supportsTransparency,
  type OutputDef,
  type OutputId,
} from "../lib/outputs";
import type {
  BoxAlign,
  BoxMode,
  DisplayInfo,
  NetStatus,
  OverlayConfig,
} from "../lib/types";
import { useI18n } from "../lib/i18n/context";
import type { Dict } from "../lib/i18n";
import Checkbox from "./Checkbox";
import Icon from "./Icon";
import MonitorPicker from "./MonitorPicker";
import OutputFrame from "./OutputFrame";

interface OutputPreviewProps {
  id: OutputId;
  def: OutputDef;
  html: string;
  blackoutActive: boolean;
  group: DisplayGroup;
  dividerWidth?: number;
  positionText?: string;
  displays: DisplayInfo[];
  selectedDisplayId: number | null;
  setSelectedDisplayId: (id: number | null) => void;
  hdmiActive: boolean;
  onToggleHdmi: () => void;
  onRefreshDisplays: () => void;
  netStatus: NetStatus | null;
  netBusy: boolean;
  onToggleNet: () => void;
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

const boxModes = (t: Dict): { value: BoxMode; label: string; hint: string }[] => [
  {
    value: "padding",
    label: t.outputPreview.boxModePadding,
    hint: t.outputPreview.boxModePaddingHint,
  },
  {
    value: "size",
    label: t.outputPreview.boxModeFixed,
    hint: t.outputPreview.boxModeFixedHint,
  },
];

const alignX = (t: Dict): { value: BoxAlign; label: string }[] => [
  { value: "start", label: t.outputPreview.left },
  { value: "center", label: t.outputPreview.centre },
  { value: "end", label: t.outputPreview.right },
];

const alignY = (t: Dict): { value: BoxAlign; label: string }[] => [
  { value: "start", label: t.outputPreview.top },
  { value: "center", label: t.outputPreview.centre },
  { value: "end", label: t.outputPreview.bottom },
];

const SLIDER_CLASS = `flex-1 min-w-0 h-3 appearance-none bg-transparent cursor-pointer outline-none
  [&::-webkit-slider-runnable-track]:h-0.75 [&::-webkit-slider-runnable-track]:rounded-full [&::-webkit-slider-runnable-track]:bg-border-secondary
  [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:-mt-[4.5px] [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-primary [&::-webkit-slider-thumb]:transition-transform hover:[&::-webkit-slider-thumb]:scale-110`;

const readStoredNumber = (key: string, fallback: number) => {
  try {
    const raw = localStorage.getItem(key);
    const parsed = raw?.trim() ? Number(raw) : NaN;
    return Number.isFinite(parsed) ? parsed : fallback;
  } catch {
    return fallback;
  }
};

const writeStoredNumber = (key: string, value: number) => {
  try {
    localStorage.setItem(key, String(value));
  } catch (err) {
    console.error(`Failed to persist ${key}`, err);
  }
};

function useSliderSetting(
  storageKey: string,
  fallback: number,
  ref: React.RefObject<HTMLInputElement | null>,
) {
  const [value, setValue] = useState(fallback);
  // Which key the DOM input currently holds a value for. Until the load effect
  // has run for a new key, the input still shows the previous profile — writing
  // it back would overwrite the profile we just switched to.
  const loadedKey = useRef<string | null>(null);
  const timer = useRef(0);
  const last = useRef(0);

  useEffect(() => {
    const next = readStoredNumber(storageKey, fallback);
    loadedKey.current = storageKey;
    if (ref.current) ref.current.value = String(next);
    setValue(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey]);

  useEffect(() => () => clearTimeout(timer.current), []);

  const apply = () => {
    if (loadedKey.current !== storageKey) return;
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
    if (loadedKey.current !== storageKey) return;
    apply();
    writeStoredNumber(storageKey, Number(ref.current?.value ?? fallback));
  };

  return { value, stored: value, onChange, commit, apply };
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
  disabled = false,
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
  disabled?: boolean;
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
        disabled={disabled}
        className={`${SLIDER_CLASS} ${
          disabled ? "cursor-not-allowed opacity-50" : ""
        }`}
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
  disabled = false,
}: {
  label: string;
  options: { value: T; label: string; hint?: string }[];
  value: T;
  onChange: (value: T) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-center gap-2 pt-1">
      <span className="w-14 shrink-0 text-[10px] text-text-muted">{label}</span>
      <div
        className={`inline-flex items-center gap-0.5 p-0.5 rounded-md border border-border bg-surface-secondary ${
          disabled ? "opacity-50" : ""
        }`}
      >
        {options.map((opt) => (
          <button
            key={opt.value}
            onClick={() => onChange(opt.value)}
            title={opt.hint}
            disabled={disabled}
            className={`px-2 py-0.5 text-[10px] font-semibold rounded transition-colors disabled:cursor-not-allowed ${
              value === opt.value
                ? "bg-primary text-white"
                : `text-text-muted ${
                    disabled
                      ? ""
                      : "hover:bg-surface-hover hover:text-text-primary"
                  }`
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export default function OutputPreview({
  id,
  def,
  html,
  blackoutActive,
  group,
  dividerWidth,
  positionText,
  displays,
  selectedDisplayId,
  setSelectedDisplayId,
  hdmiActive,
  onToggleHdmi,
  onRefreshDisplays,
  netStatus,
  netBusy,
  onToggleNet,
}: OutputPreviewProps) {
  const { t } = useI18n();
  const BOX_MODES = boxModes(t);
  const ALIGN_X = alignX(t);
  const ALIGN_Y = alignY(t);
  const mode = def.mode;
  const transparent = supportsTransparency(def);
  const lower = mode === "lowerThirds";

  // Editing follows whatever is on the output, so tuning always lands on the
  // profile you can see. Picking another one in the modal is a temporary look
  // and is dropped as soon as the output moves to a different kind of content.
  const [override, setOverride] = useState<DisplayGroup | null>(null);
  const [lastGroup, setLastGroup] = useState(group);
  if (group !== lastGroup) {
    setLastGroup(group);
    setOverride(null);
  }
  const editGroup = override ?? group;
  const pk = (field: ProfileField) => profileKey(id, mode, editGroup, field);

  const [zoomFit, setZoomFit] = usePersistedState<boolean>(
    `${LS_KEYS.outputPreviewZoom}:${id}`,
    true,
    (raw) => raw !== "false",
  );

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
  const textScaleRef = useRef<HTMLInputElement>(null);
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

  const edgeFade = useSliderSetting(
    pk("edgeFade"),
    OVERLAY_DEFAULTS.edgeFade,
    edgeRef,
  );
  const boxPadX = useSliderSetting(
    pk("boxPadX"),
    OVERLAY_DEFAULTS.boxPadX,
    padXRef,
  );
  const boxPadY = useSliderSetting(
    pk("boxPadY"),
    OVERLAY_DEFAULTS.boxPadY,
    padYRef,
  );
  const boxWidth = useSliderSetting(
    pk("boxWidth"),
    OVERLAY_DEFAULTS.boxWidth,
    widthRef,
  );
  const boxHeight = useSliderSetting(
    pk("boxHeight"),
    OVERLAY_DEFAULTS.boxHeight,
    heightRef,
  );
  const boxScale = useSliderSetting(
    pk("boxScale"),
    OVERLAY_DEFAULTS.boxScale,
    scaleRef,
  );
  const boxRadius = useSliderSetting(
    pk("boxRadius"),
    OVERLAY_DEFAULTS.boxRadius,
    radiusRef,
  );
  const boxAlpha = useSliderSetting(
    pk("boxAlpha"),
    OVERLAY_DEFAULTS.boxAlpha,
    alphaRef,
  );
  const boxOffsetX = useSliderSetting(
    pk("boxOffsetX"),
    OVERLAY_DEFAULTS.boxOffsetX,
    offsetRef,
  );
  const boxOffsetY = useSliderSetting(
    pk("boxOffsetY"),
    OVERLAY_DEFAULTS.boxOffsetY,
    offsetYRef,
  );
  const fadeMs = useSliderSetting(
    pk("fadeMs"),
    PROFILE_DEFAULTS[mode].fadeMs,
    fadeRef,
  );
  const textScale = useSliderSetting(pk("textScale"), 100, textScaleRef);

  const [boxModeX, setBoxModeX] = usePersistedState<BoxMode>(
    pk("boxModeX"),
    "padding",
    readBoxMode,
  );
  const [boxModeY, setBoxModeY] = usePersistedState<BoxMode>(
    pk("boxModeY"),
    "padding",
    readBoxMode,
  );
  const [boxAlignX, setBoxAlignX] = usePersistedState<BoxAlign>(
    pk("boxAlignX"),
    "center",
    readBoxAlign,
  );
  const [boxAlignY, setBoxAlignY] = usePersistedState<BoxAlign>(
    pk("boxAlignY"),
    "center",
    readBoxAlign,
  );
  const [tightLabels, setTightLabels] = usePersistedState<boolean>(
    pk("tightLabels"),
    lower,
    (raw) => (raw === "true" ? true : raw === "false" ? false : lower),
  );
  const running = netStatus?.running === true;
  const delaySeconds = (def.delayMs / 1000).toFixed(1).replace(/\.0$/, "");

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
      bibleScale: textScale.value,
      messageScale: textScale.value,
      tightLabels,
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
      textScale.value,
      tightLabels,
    ],
  );

  // The sliders load their profile in an effect, so right after a group change
  // they still hold the previous profile's numbers. Only trust them while the
  // modal is actually driving them; otherwise storage is the source of truth,
  // and it is already correct the moment the group flips.
  const editing = settingsOpen && editGroup === group;
  const liveConfig = useMemo(
    () => (editing ? config : readOverlayConfig(id, mode, group)),
    [editing, config, id, mode, group],
  );
  // Debounce only the dragging; a group switch has to land before its text does.
  const debounced = useDebounced(liveConfig, 120);
  const outConfig = editing ? debounced : liveConfig;

  useEffect(() => {
    if (def.type === "ip") {
      if (running) window.api?.netConfig?.(id, outConfig);
      return;
    }
    // A lower third over HDMI keeps the placement of the IP one — only the
    // shaded box, which needs a transparent frame to sit on, is left out.
    window.api?.setHdmiConfig?.(id === "out1" ? 1 : 2, {
      fadeMs: outConfig.fadeMs,
      bibleScale: outConfig.bibleScale,
      messageScale: outConfig.messageScale,
      tightLabels: outConfig.tightLabels,
      bg: DEFAULT_BG,
      boxed: lower,
      boxScale: outConfig.boxScale,
      boxAlignX: outConfig.boxAlignX,
      boxAlignY: outConfig.boxAlignY,
      boxOffsetX: outConfig.boxOffsetX,
      boxOffsetY: outConfig.boxOffsetY,
    });
  }, [def.type, running, outConfig, id, lower]);

  const previewConfig = useMemo(
    () => (zoomFit ? fittedOverlay(outConfig) : outConfig),
    [zoomFit, outConfig],
  );

  const addresses = netStatus?.addresses ?? [];
  const selected = Math.min(addressIndex, addresses.length - 1);
  const active = selected >= 0 ? addresses[selected] : undefined;
  const url =
    running && active ? `http://${active.address}:${netStatus?.port}` : "";

  const copyUrl = () => {
    if (!url) return;
    void navigator.clipboard?.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  // Fit reflows the box to the whole frame so a small lower third stays
  // readable in the panel. Nothing here reaches the actual output.
  const showOverlay = transparent && !zoomFit;
  const frameBg = lower ? DEFAULT_BG : undefined;

  return (
    <div className="flex-1">
      <div className="flex items-center gap-2 mb-2">
        <h2 className="text-lg font-semibold text-text-primary truncate">
          {outputName(def, id)}
        </h2>
        {def.delayMs > 0 && (
          <span
            title={
              def.delayPreview
                ? t.outputPreview.delayBadgeHintMirrored(delaySeconds)
                : t.outputPreview.delayBadgeHint(delaySeconds)
            }
            className="shrink-0 flex items-center gap-1 px-1.5 py-0.5 rounded border border-amber-500/60 bg-amber-500/15 text-[10px] font-semibold text-amber-600"
          >
            <Icon name="Clock" size={10} />
            {t.outputPreview.delayBadge(delaySeconds)}
          </span>
        )}
        <div className="flex-1" />

        {lower && (
          <button
            onClick={() => setZoomFit(!zoomFit)}
            title={zoomFit ? t.outputPreview.fitOn : t.outputPreview.fitOff}
            className={`flex items-center gap-1 px-2 py-1 text-[10px] font-semibold rounded border transition-colors ${
              zoomFit
                ? "bg-primary border-primary text-white"
                : "bg-surface-secondary border-border text-text-secondary hover:text-text-primary"
            }`}
          >
            <Icon name={zoomFit ? "Maximize2" : "Minimize2"} size={11} />
            {zoomFit ? t.outputPreview.fit : t.outputPreview.oneToOne}
          </button>
        )}

        <button
          onClick={() => setSettingsOpen(true)}
          title={t.outputPreview.openSettings(outputName(def, id))}
          className="w-7 h-7 flex items-center justify-center rounded border border-border text-text-secondary transition-colors hover:bg-surface-hover hover:text-text-primary"
        >
          <Icon name="Settings" size={13} />
        </button>

        {def.type === "hdmi" ? (
          <MonitorPicker
            displays={displays}
            selectedDisplayId={selectedDisplayId}
            onSelectDisplayId={setSelectedDisplayId}
            onRefreshDisplays={onRefreshDisplays}
            hdmiActive={hdmiActive}
            onToggleHdmi={onToggleHdmi}
          />
        ) : (
          <button
            onClick={onToggleNet}
            disabled={netBusy}
            className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded border transition-colors disabled:opacity-50 ${
              running
                ? "bg-danger border-danger text-white"
                : "bg-surface-secondary border-border text-text-secondary hover:text-text-primary"
            }`}
          >
            <Icon name={running ? "Square" : "Play"} size={12} />
            {running ? t.outputPreview.netStop : t.outputPreview.netStart}
          </button>
        )}
      </div>

      <div className="border border-border rounded overflow-hidden">
        <OutputFrame
          html={html}
          blackout={blackoutActive}
          bg={showOverlay ? undefined : frameBg}
          overlay={showOverlay}
          boxed={lower && !zoomFit}
          overlayConfig={previewConfig}
          dividerWidth={dividerWidth}
        />
      </div>

      {positionText !== undefined && (
        <div className="mt-2 h-7 flex justify-end items-center">
          <span className="text-xs text-text-muted">{positionText}</span>
        </div>
      )}

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
              <h2 className="text-lg font-semibold text-text-primary">
                {outputName(def, id)}
              </h2>
              <div className="flex-1 flex justify-center">
                <div className="inline-flex items-center gap-0.5 p-0.5 rounded-md border border-border bg-surface-secondary">
                  {DISPLAY_GROUPS.map((value) => (
                    <button
                      key={value}
                      onClick={() => setOverride(value)}
                      title={
                        value === group
                          ? t.outputPreview.groupLive(t.displayGroups[value])
                          : t.displayGroups[value]
                      }
                      className={`px-2.5 py-1 text-[10px] font-semibold rounded transition-colors ${
                        editGroup === value
                          ? "bg-primary text-white"
                          : "text-text-muted hover:bg-surface-hover hover:text-text-primary"
                      }`}
                    >
                      {t.displayGroups[value]}
                      {value === group && (
                        <span className="ml-1 inline-block w-1.5 h-1.5 rounded-full bg-success align-middle" />
                      )}
                    </button>
                  ))}
                </div>
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
                    label={t.outputPreview.fade}
                    min={0}
                    max={1200}
                    step={20}
                    inputRef={fadeRef}
                    {...fadeMs}
                  />
                  <Slider
                    label={t.outputPreview.textSize}
                    min={40}
                    max={200}
                    step={5}
                    inputRef={textScaleRef}
                    {...textScale}
                  />
                  <div className="pt-1">
                    <Checkbox
                      checked={tightLabels}
                      onChange={setTightLabels}
                      label={t.outputPreview.tightLabels}
                      hint={t.outputPreview.tightLabelsHint}
                    />
                  </div>
                </div>

                {lower && (
                  <div className="space-y-1">
                    <Slider
                      label={t.outputPreview.scale}
                      min={10}
                      max={100}
                      inputRef={scaleRef}
                      {...boxScale}
                    />
                    <Segmented
                      label={t.outputPreview.anchorX}
                      options={ALIGN_X}
                      value={boxAlignX}
                      onChange={setBoxAlignX}
                    />
                    <Segmented
                      label={t.outputPreview.anchorY}
                      options={ALIGN_Y}
                      value={boxAlignY}
                      onChange={setBoxAlignY}
                    />
                    <Slider
                      label={t.outputPreview.offsetX}
                      min={-OFFSET_RANGE}
                      max={OFFSET_RANGE}
                      step={0.1}
                      inputRef={offsetRef}
                      {...boxOffsetX}
                    />
                    <Slider
                      label={t.outputPreview.offsetY}
                      min={OFFSET_Y_MIN}
                      max={OFFSET_Y_MAX}
                      step={0.1}
                      inputRef={offsetYRef}
                      {...boxOffsetY}
                    />
                  </div>
                )}

                {lower && (
                  <div className="space-y-1">
                    <div className="text-[11px] font-semibold text-text-primary pb-0.5">
                      {t.outputPreview.background}
                    </div>

                    {!transparent && (
                      <div className="space-y-1.5 rounded border border-border-secondary bg-surface-secondary p-2.5 mb-1.5">
                        <div className="flex items-center gap-1.5">
                          <Icon
                            name="Info"
                            size={12}
                            className="shrink-0 text-text-muted"
                          />
                          <span className="text-[11px] font-semibold text-text-primary">
                            {t.outputPreview.ipOnlyTitle}
                          </span>
                        </div>
                        <p className="text-[10px] text-text-muted leading-snug">
                          {t.outputPreview.ipOnlyBody}
                        </p>
                        <p className="text-[10px] text-text-muted leading-snug">
                          {t.outputPreview.ipOnlyLuma}
                        </p>
                      </div>
                    )}

                    <Segmented
                      label={t.outputPreview.horizontal}
                      options={BOX_MODES}
                      value={boxModeX}
                      onChange={setBoxModeX}
                      disabled={!transparent}
                    />
                    <div className={boxModeX === "padding" ? "" : "hidden"}>
                      <Slider
                        label={t.outputPreview.paddingX}
                        min={0}
                        max={25}
                        step={0.5}
                        inputRef={padXRef}
                        {...boxPadX}
                        disabled={!transparent}
                      />
                    </div>
                    <div className={boxModeX === "size" ? "" : "hidden"}>
                      <Slider
                        label={t.outputPreview.width}
                        min={25}
                        max={250}
                        inputRef={widthRef}
                        {...boxWidth}
                        disabled={!transparent}
                      />
                    </div>

                    <Segmented
                      label={t.outputPreview.vertical}
                      options={BOX_MODES}
                      value={boxModeY}
                      onChange={setBoxModeY}
                      disabled={!transparent}
                    />
                    <div className={boxModeY === "padding" ? "" : "hidden"}>
                      <Slider
                        label={t.outputPreview.paddingY}
                        min={0}
                        max={25}
                        step={0.5}
                        inputRef={padYRef}
                        {...boxPadY}
                        disabled={!transparent}
                      />
                    </div>
                    <div className={boxModeY === "size" ? "" : "hidden"}>
                      <Slider
                        label={t.outputPreview.height}
                        min={15}
                        max={250}
                        inputRef={heightRef}
                        {...boxHeight}
                        disabled={!transparent}
                      />
                    </div>
                    <Slider
                      label={t.outputPreview.radius}
                      min={0}
                      max={100}
                      inputRef={radiusRef}
                      {...boxRadius}
                      disabled={!transparent}
                    />
                    <Slider
                      label={t.outputPreview.darkness}
                      min={0}
                      max={100}
                      inputRef={alphaRef}
                      {...boxAlpha}
                      disabled={!transparent}
                    />
                    <Slider
                      label={t.outputPreview.softEdges}
                      min={0}
                      max={600}
                      inputRef={edgeRef}
                      {...edgeFade}
                      disabled={!transparent}
                    />
                  </div>
                )}

                {def.type === "ip" && (
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-1.5">
                      <input
                        type="text"
                        readOnly
                        value={url}
                        placeholder={t.outputPreview.addressPlaceholder}
                        onFocus={(e) => e.currentTarget.select()}
                        className="flex-1 min-w-0 px-2 py-1 text-[11px] font-mono border border-border-secondary rounded bg-surface text-text-primary placeholder-text-muted focus:outline-none focus:ring-1 focus:ring-primary"
                      />
                      <button
                        onClick={copyUrl}
                        disabled={!url}
                        title={t.outputPreview.copyHint}
                        className="flex items-center gap-1 shrink-0 px-2 py-1 text-[11px] font-semibold rounded border border-border-secondary text-text-secondary transition-colors hover:bg-surface-hover hover:text-text-primary disabled:opacity-40"
                      >
                        <Icon name={copied ? "Check" : "Copy"} size={12} />
                        {copied ? t.common.copied : t.common.copy}
                      </button>
                    </div>

                    {running && addresses.length > 1 && (
                      <div className="flex flex-wrap items-center gap-1">
                        <span className="text-[10px] text-text-muted">
                          {t.outputPreview.adapter}
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

                    {netStatus?.error && (
                      <p className="text-[11px] text-danger">
                        {t.outputPreview.couldNotStart(netStatus.error)}
                      </p>
                    )}
                    {running && addresses.length === 0 && (
                      <p className="text-[11px] text-danger">
                        {t.outputPreview.noNetworkAddress}
                      </p>
                    )}
                    {running && addresses.length > 0 && (
                      <p className="text-[10px] text-text-muted leading-snug">
                        {t.outputPreview.browserSourceHint}
                      </p>
                    )}
                  </div>
                )}
              </div>

              <div className="relative border border-border rounded overflow-hidden">
                <OutputFrame
                  html={html}
                  blackout={blackoutActive}
                  bg={transparent ? undefined : frameBg}
                  overlay={transparent}
                  boxed={lower}
                  overlayConfig={config}
                  dividerWidth={dividerWidth}
                />
                {lower && (
                  <>
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
                      title={t.outputPreview.dragHint}
                      className={`absolute inset-0 ${dragging ? "cursor-grabbing" : "cursor-grab"}`}
                    />
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
