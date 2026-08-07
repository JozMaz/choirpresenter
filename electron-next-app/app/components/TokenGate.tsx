"use client";

import { useState } from "react";
import type { Identity } from "../lib/access";
import { useI18n } from "../lib/i18n/context";
import Icon from "./Icon";
import LanguageSwitch from "./LanguageSwitch";

interface TokenGateProps {
  onAuthorized: (identity: Identity, token: string) => void;
  initialMessage?: string | null;
}

export default function TokenGate({
  onAuthorized,
  initialMessage = null,
}: TokenGateProps) {
  const { t } = useI18n();
  const [token, setToken] = useState("");
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(initialMessage);

  const submit = async () => {
    const value = token.trim();
    if (!value || checking) return;
    setChecking(true);
    setError(null);

    const result = await window.api?.authWhoami(value);
    setChecking(false);

    if (result?.ok && result.identity) {
      await window.api?.setWriteToken(value);
      onAuthorized(result.identity, value);
      return;
    }
    if (result?.offline) {
      setError(t.tokenGate.offline);
      return;
    }
    setError(t.tokenGate.invalid);
  };

  return (
    <main className="h-screen w-screen bg-background flex items-center justify-center p-6">
      <div className="w-full max-w-sm bg-surface border border-border rounded-lg shadow-xl px-6 py-6">
        <div className="flex items-start gap-2 mb-1">
          <h1 className="flex-1 text-lg font-semibold text-text-primary">
            ChoirPresenter
          </h1>
          <LanguageSwitch />
        </div>
        <p className="text-xs text-text-muted leading-snug mb-4">
          {t.tokenGate.intro}
        </p>

        <input
          type="password"
          autoFocus
          value={token}
          onChange={(e) => setToken(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") void submit();
          }}
          placeholder={t.tokenGate.placeholder}
          className="w-full px-2 py-1.5 text-xs border border-border-secondary rounded bg-surface text-text-primary placeholder-text-muted hover:border-primary/60 focus:outline-none focus:ring-1 focus:ring-primary transition-colors"
        />

        {error && (
          <p className="mt-2 text-[11px] text-danger leading-snug">{error}</p>
        )}

        <button
          onClick={() => void submit()}
          disabled={!token.trim() || checking}
          className="mt-4 w-full flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded bg-primary text-white transition-colors enabled:hover:bg-primary-hover disabled:bg-disabled"
        >
          {checking && (
            <Icon name="Loader" size={12} className="animate-spin" />
          )}
          {checking ? t.tokenGate.checking : t.tokenGate.continue}
        </button>
      </div>
    </main>
  );
}
