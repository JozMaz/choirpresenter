"use client";

import { useState } from "react";
import type { Identity } from "../lib/access";
import Icon from "./Icon";

interface TokenGateProps {
  onAuthorized: (identity: Identity, token: string) => void;
  initialMessage?: string | null;
}

export default function TokenGate({
  onAuthorized,
  initialMessage = null,
}: TokenGateProps) {
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
      setError(
        "No connection to the server. Check the internet and try again.",
      );
      return;
    }
    setError("This token is not valid. Ask the administrator for a new one.");
  };

  return (
    <main className="h-screen w-screen bg-background flex items-center justify-center p-6">
      <div className="w-full max-w-sm bg-surface border border-border rounded-lg shadow-xl px-6 py-6">
        <h1 className="text-lg font-semibold text-text-primary mb-1">
          ChoirPresenter
        </h1>
        <p className="text-xs text-text-muted leading-snug mb-4">
          Enter the access token for your congregation. You get it from the
          administrator and it works on any number of devices.
        </p>

        <input
          type="password"
          autoFocus
          value={token}
          onChange={(e) => setToken(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") void submit();
          }}
          placeholder="Access token"
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
          {checking ? "Checking..." : "Continue"}
        </button>
      </div>
    </main>
  );
}
