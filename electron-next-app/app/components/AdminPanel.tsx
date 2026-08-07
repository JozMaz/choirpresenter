"use client";

import { useCallback, useEffect, useState } from "react";
import type { OrgRecord, SongBookKey, Songbook } from "../lib/types";
import { SONGBOOK_NAMES } from "../lib/songAdapter";
import { ALL_SONGBOOK_KEYS, type Catalog } from "../lib/access";
import { useI18n } from "../lib/i18n/context";
import Checkbox from "./Checkbox";

const BIBLE_OPTIONS = [
  { key: "gdanska", name: "Biblia Gdańska" },
  { key: "warszawska", name: "Biblia Warszawska" },
];

const MESSAGE_DEFAULTS = { count: 534, sizeMb: 41 };

export default function AdminPanel() {
  const { t } = useI18n();
  const [orgs, setOrgs] = useState<OrgRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const [issuedToken, setIssuedToken] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [offered, setOffered] = useState<{
    songbooks: SongBookKey[];
    bibles: string[];
    messages: boolean;
  }>({ songbooks: [], bibles: [], messages: false });
  const [catalogMsg, setCatalogMsg] = useState<string | null>(null);
  const [importMsg, setImportMsg] = useState<string | null>(null);

  const loadOrgs = useCallback(async () => {
    const result = await window.api?.adminListOrgs();
    setLoading(false);
    if (!result?.ok) {
      setError(result?.error || t.admin.loadOrgsFailed);
      return;
    }
    setError(null);
    setOrgs(result.data?.orgs ?? []);
  }, [t]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const raw = await window.api?.dataFetchCatalog();
      if (cancelled) return;
      if (raw) {
        try {
          const catalog = JSON.parse(raw) as Catalog;
          setOffered({
            songbooks: (catalog.songbooks ?? []).map((s) => s.key),
            bibles: (catalog.bibles ?? []).map((b) => b.key),
            messages: (catalog.messages?.count ?? 0) > 0,
          });
        } catch {
          /* keep defaults */
        }
      }
      if (!cancelled) await loadOrgs();
    })();
    return () => {
      cancelled = true;
    };
  }, [loadOrgs]);

  const createOrg = async () => {
    const name = newName.trim();
    if (!name || busy) return;
    setBusy(true);
    const result = await window.api?.adminCreateOrg(name);
    setBusy(false);
    if (!result?.ok || !result.data) {
      setError(result?.error || t.admin.createOrgFailed);
      return;
    }
    setError(null);
    setNewName("");
    setIssuedToken(result.data.token);
    void loadOrgs();
  };

  const rotateToken = async (org: OrgRecord) => {
    setBusy(true);
    const result = await window.api?.adminRotateToken(org.orgId);
    setBusy(false);
    if (!result?.ok || !result.data) {
      setError(result?.error || t.admin.rotateTokenFailed);
      return;
    }
    setError(null);
    setIssuedToken(result.data.token);
    void loadOrgs();
  };

  const setRevoked = async (org: OrgRecord, revoked: boolean) => {
    setBusy(true);
    const result = await window.api?.adminPatchOrg(org.orgId, { revoked });
    setBusy(false);
    if (!result?.ok) {
      setError(result?.error || t.admin.patchOrgFailed);
      return;
    }
    setError(null);
    void loadOrgs();
  };

  const publishCatalog = async () => {
    setBusy(true);
    setCatalogMsg(null);
    const songCounts = new Map<SongBookKey, number>();
    for (const key of offered.songbooks) {
      const book = await window.api?.readSongBook(key);
      if (book?.songs) songCounts.set(key, book.songs.length);
    }
    const catalog = {
      songbooks: offered.songbooks.map((key) => ({
        key,
        name: SONGBOOK_NAMES[key],
        songs: songCounts.get(key) ?? 0,
      })),
      bibles: offered.bibles.map((key) => ({
        key,
        name: BIBLE_OPTIONS.find((b) => b.key === key)?.name ?? key,
      })),
      messages: offered.messages ? MESSAGE_DEFAULTS : { count: 0, sizeMb: 0 },
    };
    const result = await window.api?.adminPatchCatalog(catalog);
    setBusy(false);
    setCatalogMsg(
      result?.ok
        ? t.admin.catalogPublished
        : result?.error || t.admin.catalogFailed,
    );
  };

  const importSongbook = async (target: SongBookKey) => {
    setImportMsg(null);
    const picked = await window.api?.pickJsonFile();
    if (!picked) return;

    let parsed: Songbook;
    try {
      parsed = JSON.parse(picked.contents) as Songbook;
    } catch {
      setImportMsg(t.admin.notValidJson(picked.name));
      return;
    }
    if (!parsed || !Array.isArray(parsed.songs)) {
      setImportMsg(t.admin.noSongsArray(picked.name));
      return;
    }

    setBusy(true);
    const result = await window.api?.writeSongBook(target, {
      name: parsed.name || SONGBOOK_NAMES[target],
      songs: parsed.songs,
    });
    setBusy(false);
    setImportMsg(
      result?.cloudOk
        ? t.admin.imported(parsed.songs.length, SONGBOOK_NAMES[target])
        : result?.localOk
          ? t.admin.importedLocalOnly(parsed.songs.length)
          : t.admin.importFailed,
    );
  };

  const card = "bg-surface-secondary/30 border border-border rounded-md p-4";
  const label = "block text-xs font-semibold text-text-primary mb-1";
  const input =
    "w-full px-2 py-1 text-xs border border-border-secondary rounded bg-surface text-text-primary placeholder-text-muted hover:border-primary/60 focus:outline-none focus:ring-1 focus:ring-primary transition-colors";
  const smallButton =
    "px-2.5 py-1 text-xs font-semibold rounded border border-border-secondary text-text-secondary transition-colors enabled:hover:bg-surface-hover enabled:hover:text-text-primary disabled:opacity-40";

  return (
    <div className="flex-1 overflow-y-auto px-6 pb-5 space-y-4">
      {error && <p className="text-[11px] text-danger leading-snug">{error}</p>}

      <div className={card}>
        <label className={label}>{t.admin.organizations}</label>
        <p className="text-[11px] text-text-muted mb-2 leading-snug">
          {t.admin.organizationsHint}
        </p>

        <div className="flex gap-1.5 mb-3">
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void createOrg();
            }}
            placeholder={t.admin.newOrgPlaceholder}
            className={input}
          />
          <button
            onClick={() => void createOrg()}
            disabled={!newName.trim() || busy}
            className="px-3 py-1 shrink-0 text-xs font-semibold rounded bg-primary text-white transition-colors enabled:hover:bg-primary-hover disabled:bg-disabled"
          >
            {t.admin.create}
          </button>
        </div>

        {issuedToken && (
          <div className="mb-3 p-2 rounded border border-amber-500/40 bg-amber-500/10">
            <p className="text-[11px] font-semibold text-amber-600 mb-1">
              {t.admin.copyTokenNow}
            </p>
            <code className="block text-[11px] break-all text-text-primary select-all">
              {issuedToken}
            </code>
            <button
              onClick={() => setIssuedToken(null)}
              className="mt-1.5 text-[10px] font-semibold text-text-muted hover:text-text-primary transition-colors"
            >
              {t.admin.tokenSavedAck}
            </button>
          </div>
        )}

        {loading ? (
          <p className="text-[11px] text-text-muted">{t.common.loading}</p>
        ) : orgs.length === 0 ? (
          <p className="text-[11px] text-text-muted">{t.admin.noOrgs}</p>
        ) : (
          <div className="space-y-1">
            {orgs.map((org) => (
              <div
                key={org.orgId}
                className="flex items-center gap-2 px-2 py-1 rounded bg-surface-secondary border border-border"
              >
                <span className="flex-1 min-w-0 truncate text-[11px] text-text-primary">
                  {org.name}
                  {org.role === "admin" && (
                    <span className="ml-1.5 text-[9px] font-semibold text-primary uppercase">
                      {t.admin.roleAdmin}
                    </span>
                  )}
                  {org.revokedAt && (
                    <span className="ml-1.5 text-[9px] font-semibold text-danger uppercase">
                      {t.admin.revoked}
                    </span>
                  )}
                </span>
                <button
                  onClick={() => void rotateToken(org)}
                  disabled={busy}
                  title={t.admin.newTokenHint}
                  className={smallButton}
                >
                  {t.admin.newToken}
                </button>
                <button
                  onClick={() => void setRevoked(org, !org.revokedAt)}
                  disabled={busy}
                  className={smallButton}
                >
                  {org.revokedAt ? t.admin.restore : t.admin.revoke}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className={card}>
        <label className={label}>{t.admin.offered}</label>
        <p className="text-[11px] text-text-muted mb-2 leading-snug">
          {t.admin.offeredHint}
        </p>
        <div className="space-y-1.5 mb-3">
          {ALL_SONGBOOK_KEYS.map((key) => (
            <Checkbox
              key={key}
              checked={offered.songbooks.includes(key)}
              onChange={(checked) =>
                setOffered((prev) => ({
                  ...prev,
                  songbooks: checked
                    ? [...prev.songbooks, key]
                    : prev.songbooks.filter((k) => k !== key),
                }))
              }
              label={SONGBOOK_NAMES[key]}
            />
          ))}
          {BIBLE_OPTIONS.map((bible) => (
            <Checkbox
              key={bible.key}
              checked={offered.bibles.includes(bible.key)}
              onChange={(checked) =>
                setOffered((prev) => ({
                  ...prev,
                  bibles: checked
                    ? [...prev.bibles, bible.key]
                    : prev.bibles.filter((k) => k !== bible.key),
                }))
              }
              label={bible.name}
            />
          ))}
          <Checkbox
            checked={offered.messages}
            onChange={(checked) =>
              setOffered((prev) => ({ ...prev, messages: checked }))
            }
            label={t.common.sermons}
          />
        </div>
        <button
          onClick={() => void publishCatalog()}
          disabled={busy}
          className="px-3 py-1 text-xs font-semibold rounded bg-primary text-white transition-colors enabled:hover:bg-primary-hover disabled:bg-disabled"
        >
          {t.admin.publish}
        </button>
        {catalogMsg && (
          <p className="mt-2 text-[11px] text-text-muted leading-snug">
            {catalogMsg}
          </p>
        )}
      </div>

      <div className={card}>
        <label className={label}>{t.admin.importSongbook}</label>
        <p className="text-[11px] text-text-muted mb-2 leading-snug">
          {t.admin.importSongbookHint}
        </p>
        <div className="flex flex-wrap gap-1.5">
          {ALL_SONGBOOK_KEYS.map((key) => (
            <button
              key={key}
              onClick={() => void importSongbook(key)}
              disabled={busy}
              className={smallButton}
            >
              {SONGBOOK_NAMES[key]}
            </button>
          ))}
        </div>
        {importMsg && (
          <p className="mt-2 text-[11px] text-text-muted leading-snug">
            {importMsg}
          </p>
        )}
      </div>
    </div>
  );
}
