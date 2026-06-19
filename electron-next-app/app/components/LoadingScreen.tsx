"use client";

interface LoadingScreenProps {
  /** 0..1 — progress fraction. */
  progress: number;
  /** Volitelná zpráva pod % (např. "Downloading messages..."). */
  message?: string;
}

/**
 * Full-screen splash: app icon (music note pill) + jméno + progress bar.
 * Pozadí matchne hlavní pozadí appky (var(--background)).
 */
export default function LoadingScreen({ progress, message }: LoadingScreenProps) {
  // Bar šířka: floating-point pro plynulý 60fps pohyb.
  // Label: zaokrouhleno na celé %.
  const barWidth = Math.max(0, Math.min(100, progress * 100));
  const pct = Math.round(barWidth);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-6 px-8">
        <div
          className="w-24 h-24 rounded-2xl flex items-center justify-center shadow-xl"
          style={{ backgroundColor: "var(--primary)" }}
        >
          <svg
            viewBox="0 0 24 24"
            className="w-14 h-14 text-white"
            fill="currentColor"
            aria-hidden
          >
            <path d="M12 3v10.55A4 4 0 1 0 14 17V7h4V3h-6z" />
          </svg>
        </div>

        <div className="text-2xl font-semibold text-text-primary">
          ChoirPresenter
        </div>

        <div className="w-64 h-2 rounded-full bg-surface-secondary overflow-hidden">
          <div
            className="h-full"
            style={{
              width: `${barWidth}%`,
              backgroundColor: "var(--primary)",
            }}
          />
        </div>

        <div className="text-xs text-text-muted tabular-nums">{pct}%</div>

        {message && (
          <div className="text-[11px] text-text-muted text-center max-w-xs truncate">
            {message}
          </div>
        )}
      </div>
    </div>
  );
}
