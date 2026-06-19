"use client";

import type { ApiItem, DisplayInfo } from "../lib/types";
import { getDisplayTitle, isBilingualSource } from "../lib/songProcessing";
import { useScaleToFit } from "../hooks/useScaleToFit";
import Icon from "./Icon";
import MonitorPicker from "./MonitorPicker";

interface LocalPreviewProps {
  currentSong: ApiItem | null;
  output1Text: string;
  sectionLabel: string;
  blackoutActive: boolean;
  onToggleBlackout: () => void;
  /** True když aktuální verš je jen "Translation" — EN se renderuje italic. */
  isTranslation?: boolean;
  displays: DisplayInfo[];
  selectedDisplayId: number | null;
  setSelectedDisplayId: (id: number | null) => void;
  hdmiActive: boolean;
  onToggleHdmi: () => void;
  onRefreshDisplays: () => void;
}

export default function LocalPreview({
  currentSong,
  output1Text,
  sectionLabel,
  blackoutActive,
  onToggleBlackout,
  isTranslation,
  displays,
  selectedDisplayId,
  setSelectedDisplayId,
  hdmiActive,
  onToggleHdmi,
  onRefreshDisplays,
}: LocalPreviewProps) {
  const { containerRef, contentRef } = useScaleToFit([output1Text]);
  const bilingual = currentSong ? isBilingualSource(currentSong) : false;
  const isBible = currentSong?.isBible === true;
  const isMessage = currentSong?.isMessage === true;
  const [plText = "", enText = ""] = bilingual ? output1Text.split("\n\n") : [];

  const contentStyle: React.CSSProperties = {
    transformOrigin: "top center",
    opacity: blackoutActive ? 0 : 1,
    transition: "opacity 0.5s ease",
  };

  return (
    <div className="flex-1">
      <div className="flex items-center gap-2 mb-2">
        <h2 className="text-lg font-semibold text-text-primary">Local</h2>
        <MonitorPicker
          displays={displays}
          selectedDisplayId={selectedDisplayId}
          onSelectDisplayId={setSelectedDisplayId}
          onRefreshDisplays={onRefreshDisplays}
          hdmiActive={hdmiActive}
          onToggleHdmi={onToggleHdmi}
        />
      </div>
      <div
        ref={containerRef}
        className="flex-1 border border-border p-2 bg-[#111111] rounded overflow-hidden aspect-video"
      >
        {currentSong && (isBible || isMessage) ? (
          <div
            ref={contentRef}
            style={contentStyle}
            className="h-full flex flex-col text-sm text-text-secondary whitespace-pre-wrap font-['MyriadPro',sans-serif] font-semibold text-center"
          >
            {/* V message módu top je prázdný — label jde dolů */}
            {output1Text && isBible && (
              <div className="flex justify-center items-center w-full px-10">
                <span className="italic text-xs text-text-secondary">
                  {sectionLabel}
                </span>
              </div>
            )}
            <div className="flex-1 flex items-center justify-center px-6">
              <div
                className={`whitespace-pre-wrap font-['MyriadPro',sans-serif] font-semibold ${
                  isMessage ? "text-justify" : "text-center"
                }`}
              >
                {output1Text}
              </div>
            </div>
            {output1Text && (
              <div className="flex justify-center items-center w-full px-10">
                <span className="font-semibold text-xs text-text-secondary">
                  {isBible
                    ? currentSong.bibleMeta?.bibleName || ""
                    : sectionLabel}
                </span>
              </div>
            )}
          </div>
        ) : currentSong && bilingual ? (
          <div
            ref={contentRef}
            style={contentStyle}
            className="h-full flex flex-col text-sm text-text-secondary whitespace-pre-wrap font-['MyriadPro',sans-serif] font-semibold text-center"
          >
            {output1Text && (
              <div className="flex items-center justify-between w-full px-10">
                <span className="text-xs">{sectionLabel}</span>
                <span className="text-xs">{currentSong.sequence || ""}</span>
              </div>
            )}
            {enText ? (
              // Bilingual: PL nahoře, divider, EN dole — vždy 2 stejné poloviny
              <>
                <div className="flex-1 flex flex-col justify-center">
                  {plText && (
                    <div className="mb-4 whitespace-pre-wrap">{plText}</div>
                  )}
                </div>
                {plText && (
                  <div className="border-t border-border my-4"></div>
                )}
                <div className="flex-1 flex flex-col justify-center">
                  <div
                    className={`whitespace-pre-wrap ${isTranslation ? "italic" : ""}`}
                  >
                    {enText}
                  </div>
                </div>
              </>
            ) : (
              // Jen PL — vycentruj přes celou výšku (jako mono-lingual)
              <div className="flex-1 flex items-center justify-center">
                {plText && (
                  <div className="whitespace-pre-wrap">{plText}</div>
                )}
              </div>
            )}
            {output1Text && (
              <div className="flex justify-center items-center w-full px-10">
                <span className="text-xs">{getDisplayTitle(currentSong)}</span>
              </div>
            )}
          </div>
        ) : (
          <div
            ref={contentRef}
            style={contentStyle}
            className="h-full flex flex-col items-center justify-between"
          >
            {output1Text && (
              <div className="flex items-center justify-between w-full px-10">
                <span className="text-xs text-text-secondary font-semibold">
                  {sectionLabel}
                </span>
                <span className="text-xs text-text-secondary font-semibold">
                  {currentSong?.sequence || ""}
                </span>
              </div>
            )}
            <pre className="text-sm text-text-secondary whitespace-pre-wrap font-['MyriadPro',sans-serif] font-semibold text-center">
              {output1Text}
            </pre>
            {currentSong && output1Text && (
              <div className="flex justify-center items-center w-full px-10">
                <span className="text-xs text-text-secondary font-semibold">
                  {getDisplayTitle(currentSong)}
                </span>
              </div>
            )}
          </div>
        )}
      </div>
      <div className="mt-2 h-7 flex justify-start items-center">
        <button
          onClick={onToggleBlackout}
          title={blackoutActive ? "Show text" : "Hide text (blackout)"}
          className={`w-7 h-7 flex items-center justify-center rounded transition-colors ${
            blackoutActive
              ? "bg-primary text-white hover:bg-primary-hover"
              : "text-text-secondary hover:bg-surface-secondary"
          }`}
        >
          <Icon name="Moon" size={16} />
        </button>
      </div>
    </div>
  );
}
