"use client";

import { useEffect, useState } from "react";
import {
  applyUpdate,
  getLastManifest,
  type BootstrapProgress,
} from "../lib/cloudData";
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

  // === Data sync ===
  const [syncBusy, setSyncBusy] = useState(false);
  const [syncProgress, setSyncProgress] = useState<BootstrapProgress | null>(
    null,
  );
  const [localVersion, setLocalVersion] = useState<string | null>(null);
  const [remoteVersion, setRemoteVersion] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setSavedMsg(null);
    setSyncProgress(null);
    (async () => {
      const t = await window.api?.getWriteToken?.();
      setSavedToken(t ?? null);
      setToken(t ?? "");

      // Načti lokální manifest verzi pro info
      const local = getLastManifest();
      setLocalVersion(local?.version ?? null);

      // Fetch remote manifest na pozadí
      const raw = await window.api?.dataFetchManifest?.();
      if (raw) {
        try {
          const remote = JSON.parse(raw);
          setRemoteVersion(remote?.version ?? null);
        } catch {
          setRemoteVersion(null);
        }
      }
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

  const handleSync = async () => {
    setSyncBusy(true);
    setSyncProgress({ phase: "init", ratio: 0 });
    try {
      await applyUpdate((p) => setSyncProgress(p));
      const local = getLastManifest();
      setLocalVersion(local?.version ?? null);
      setSyncProgress({ phase: "done", ratio: 1, message: "Data updated." });
      // Force full reload after sync — easiest way to re-init all hooks
      setTimeout(() => {
        window.location.reload();
      }, 800);
    } catch (err) {
      setSyncProgress({
        phase: "error",
        ratio: 0,
        message: (err as Error)?.message || "Sync failed",
      });
    } finally {
      setSyncBusy(false);
    }
  };

  if (!open) return null;

  const updateAvailable =
    remoteVersion !== null &&
    localVersion !== null &&
    remoteVersion !== localVersion;

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

        <div className="space-y-5">
          {/* === Data sync === */}
          <div>
            <label className="block text-xs font-semibold text-text-primary mb-1">
              Cloud data
            </label>
            <div className="text-[11px] text-text-muted leading-snug space-y-0.5 mb-2">
              <div>
                Local version:{" "}
                <span className="font-mono text-text-primary">
                  {localVersion ?? "—"}
                </span>
              </div>
              <div>
                Cloud version:{" "}
                <span className="font-mono text-text-primary">
                  {remoteVersion ?? "—"}
                </span>
              </div>
            </div>

            {updateAvailable && !syncBusy && (
              <div className="mb-2 px-2 py-1.5 bg-primary/10 border border-primary/30 rounded text-[11px] text-primary">
                New data available on cloud. Click below to update.
              </div>
            )}

            <div className="flex items-center gap-2">
              <button
                onClick={handleSync}
                disabled={syncBusy}
                className="px-3 py-1 text-xs font-semibold bg-primary text-white rounded hover:bg-primary-hover transition-colors disabled:opacity-50 flex items-center gap-1.5"
              >
                {syncBusy ? (
                  <>
                    <Icon name="Loader" size={12} className="animate-spin" />
                    Syncing…
                  </>
                ) : updateAvailable ? (
                  <>
                    <Icon name="Download" size={12} />
                    Update now
                  </>
                ) : (
                  <>
                    <Icon name="RefreshCw" size={12} />
                    Force re-sync
                  </>
                )}
              </button>
            </div>

            {syncProgress && (
              <div className="mt-2">
                {syncProgress.phase === "downloading" && (
                  <>
                    <div className="w-full h-1.5 rounded bg-surface-secondary overflow-hidden">
                      <div
                        className="h-full bg-primary transition-all duration-200"
                        style={{
                          width: `${Math.round(syncProgress.ratio * 100)}%`,
                        }}
                      />
                    </div>
                    <div className="text-[10px] text-text-muted mt-1 truncate">
                      {syncProgress.currentFile}
                    </div>
                  </>
                )}
                {syncProgress.phase === "done" && (
                  <div className="text-[11px] text-success flex items-center gap-1">
                    <Icon name="Check" size={12} />
                    {syncProgress.message ?? "Up to date"}
                  </div>
                )}
                {syncProgress.phase === "error" && (
                  <div className="text-[11px] text-danger flex items-center gap-1">
                    <Icon name="TriangleAlert" size={12} />
                    {syncProgress.message ?? "Sync failed"}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* === Write token === */}
          <div className="border-t border-border pt-4">
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
            <p className="text-[11px] text-text-muted mt-3">
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
