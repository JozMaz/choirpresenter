"use client";

import { useEffect, useState } from "react";
import Icon from "./Icon";

interface SettingsModalProps {
  open: boolean;
  onClose: () => void;
}

export default function SettingsModal({ open, onClose }: SettingsModalProps) {
  const [token, setToken] = useState("");
  const [savedToken, setSavedToken] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setSavedMsg(null);
    (async () => {
      const t = await window.api?.getWriteToken?.();
      setSavedToken(t ?? null);
      setToken(t ?? "");
    })();
  }, [open]);

  const handleSave = async () => {
    if (!window.api?.setWriteToken) return;
    setSaving(true);
    const ok = await window.api.setWriteToken(token.trim());
    setSaving(false);
    if (ok) {
      setSavedToken(token.trim() || null);
      setSavedMsg("Saved.");
    } else {
      setSavedMsg("Failed to save.");
    }
  };

  const handleClear = async () => {
    if (!window.api?.setWriteToken) return;
    await window.api.setWriteToken("");
    setSavedToken(null);
    setToken("");
    setSavedMsg("Cleared.");
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-40 bg-black/60 flex items-center justify-center p-6"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md bg-surface rounded-lg border border-border shadow-xl p-6"
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-text-primary">Settings</h2>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded text-text-secondary hover:bg-surface-secondary hover:text-text-primary transition-colors"
          >
            <Icon name="X" size={16} />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-text-primary mb-1">
              Write token
            </label>
            <p className="text-[11px] text-text-muted mb-2 leading-snug">
              Token to authorize saving song edits to the shared cloud
              database. Without a token, edits are saved only locally on this
              device. Ask the admin for a token.
            </p>
            <input
              type="password"
              placeholder={savedToken ? "•••••••••• (saved)" : "Paste your token"}
              value={token}
              onChange={(e) => setToken(e.target.value)}
              className="w-full px-2 py-1.5 text-xs border border-border-secondary rounded focus:outline-none focus:ring-1 focus:ring-primary bg-surface text-text-primary placeholder-text-muted font-mono"
            />
            <div className="flex items-center gap-2 mt-2">
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-3 py-1 text-xs font-semibold bg-primary text-white rounded hover:bg-primary-hover transition-colors disabled:opacity-50"
              >
                {saving ? "Saving..." : "Save"}
              </button>
              {savedToken && (
                <button
                  onClick={handleClear}
                  className="px-3 py-1 text-xs font-semibold text-danger hover:bg-danger/10 rounded transition-colors"
                >
                  Clear
                </button>
              )}
              {savedMsg && (
                <span className="text-[11px] text-text-muted">{savedMsg}</span>
              )}
            </div>
          </div>

          <div className="border-t border-border pt-4">
            <p className="text-[11px] text-text-muted">
              Status:{" "}
              {savedToken ? (
                <span className="text-success">
                  Write access enabled — edits sync to cloud
                </span>
              ) : (
                <span className="text-text-secondary">
                  Read-only — edits stay on this device
                </span>
              )}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
