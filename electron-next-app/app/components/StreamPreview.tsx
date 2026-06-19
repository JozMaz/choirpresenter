"use client";

import type { ApiItem, DisplayInfo } from "../lib/types";
import { isBilingualSource } from "../lib/songProcessing";
import { useScaleToFit } from "../hooks/useScaleToFit";
import MonitorPicker from "./MonitorPicker";

interface StreamPreviewProps {
  currentSong: ApiItem | null;
  output2Text: string;
  sectionLabel: string;
  positionText: string;
  blackoutActive: boolean;
  /** True když aktuální verš je jen Translation — EN renderuje italic. */
  isTranslation?: boolean;
  displays: DisplayInfo[];
  selectedDisplayId: number | null;
  setSelectedDisplayId: (id: number | null) => void;
  hdmiActive: boolean;
  onToggleHdmi: () => void;
  onRefreshDisplays: () => void;
}

export default function StreamPreview({
  currentSong,
  output2Text,
  sectionLabel,
  positionText,
  blackoutActive,
  isTranslation,
  displays,
  selectedDisplayId,
  setSelectedDisplayId,
  hdmiActive,
  onToggleHdmi,
  onRefreshDisplays,
}: StreamPreviewProps) {
  const { containerRef, contentRef } = useScaleToFit([output2Text]);
  const bilingual = currentSong ? isBilingualSource(currentSong) : false;
  const isBible = currentSong?.isBible === true;
  const isMessage = currentSong?.isMessage === true;
  const [plPart = "", enPart = ""] = bilingual ? output2Text.split("\n\n") : [];

  const contentStyle: React.CSSProperties = {
    transformOrigin: "top center",
    opacity: blackoutActive ? 0 : 1,
    transition: "opacity 0.5s ease",
  };

  return (
    <div className="flex-1">
      <div className="flex items-center gap-2 mb-2">
        <h2 className="text-lg font-semibold text-text-primary">Stream</h2>
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
        className="flex-1 border border-border p-4 bg-[#111111] rounded overflow-hidden aspect-video"
      >
        {currentSong && (isBible || isMessage) ? (
          <div
            ref={contentRef}
            style={contentStyle}
            className="h-full flex flex-col text-sm text-text-secondary whitespace-pre-wrap font-myriad font-semibold text-center"
          >
            {/* V message módu top je prázdný — label jde dolů */}
            {output2Text && isBible && (
              <div className="flex justify-center items-center w-full px-10">
                <span className="italic text-xs text-text-secondary">
                  {sectionLabel}
                </span>
              </div>
            )}
            <div className="flex-1 flex items-center justify-center px-6">
              <div
                className={`whitespace-pre-wrap font-myriad font-semibold ${
                  isMessage ? "text-justify" : "text-center"
                }`}
              >
                {output2Text}
              </div>
            </div>
            {output2Text && (
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
            className="h-full flex flex-col text-sm text-text-secondary whitespace-pre-wrap font-myriad font-semibold text-center"
          >
            {enPart ? (
              // Bilingual: 2 stejné poloviny s divider
              <>
                <div className="flex-1 flex flex-col justify-center">
                  {plPart && (
                    <div className="whitespace-pre-wrap">{plPart}</div>
                  )}
                </div>
                {plPart && (
                  <div className="flex-none py-2">
                    <div className="border-t border-border w-full"></div>
                  </div>
                )}
                <div className="flex-1 flex flex-col justify-center">
                  <div
                    className={`whitespace-pre-wrap ${isTranslation ? "italic" : ""}`}
                  >
                    {enPart}
                  </div>
                </div>
              </>
            ) : (
              // Jen PL — vycentruj přes celou výšku
              <div className="flex-1 flex items-center justify-center">
                {plPart && <div className="whitespace-pre-wrap">{plPart}</div>}
              </div>
            )}
          </div>
        ) : (
          <div
            ref={contentRef}
            style={contentStyle}
            className="h-full flex items-center justify-center"
          >
            <pre className="text-sm text-text-secondary whitespace-pre-wrap font-myriad font-semibold text-center">
              {output2Text}
            </pre>
          </div>
        )}
      </div>
      <div className="mt-2 h-7 flex justify-end items-center">
        {currentSong && (
          <span className="text-xs text-text-muted">{positionText}</span>
        )}
      </div>
    </div>
  );
}
