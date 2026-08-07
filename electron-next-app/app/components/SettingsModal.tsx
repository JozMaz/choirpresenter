"use client";

import { useEffect, useState } from "react";
import {
  applyUpdate,
  getLastManifest,
  type BootstrapProgress,
} from "../lib/cloudData";
import { getThemePref, setThemePref, type ThemePref } from "../lib/theme";
import { LS_KEYS } from "../lib/constants";
import {
  FOOTER_SOURCE_ORDER,
  footerFieldsFor,
  type FooterConfig,
  type FooterFields,
  type TranslationLabelConfig,
} from "../lib/footerConfig";
import { TRANSLATION_LABEL_DEFAULT } from "../lib/constants";
import {
  MAX_GROUP_LINES,
  MIN_GROUP_LINES,
  OUTPUT_KEYS,
  OUTPUT_SCOPE_ORDER,
  type GroupMode,
  type OutputConfig,
  type OutputScope,
  type OutputSettings,
} from "../lib/outputConfig";
import {
  DEFAULT_OUTPUT_NAMES,
  OUTPUT_IDS,
  OUTPUT_TYPE_LABELS,
  outputName,
  type OutputDef,
  type OutputId,
  type OutputMode,
  type OutputsConfig,
  type OutputType,
} from "../lib/outputs";
import { DEFAULT_MAX_LINES } from "../lib/slideSplit";
import { SONGBOOK_NAMES } from "../lib/songAdapter";
import type { ContentSelection, Identity } from "../lib/access";
import type { SongSource } from "../lib/types";
import { useI18n } from "../lib/i18n/context";
import type { Dict } from "../lib/i18n";
import AdminPanel from "./AdminPanel";
import Checkbox from "./Checkbox";
import ConfirmDialog from "./ConfirmDialog";
import Icon, { type IconName } from "./Icon";
import LanguageSwitch from "./LanguageSwitch";

const footerFields = (
  t: Dict,
): { key: keyof FooterFields; label: string }[] => [
  { key: "number", label: t.settings.footerNumber },
  { key: "title", label: t.settings.footerTitle },
  { key: "key", label: t.settings.footerKey },
];

const footerSourceLabels = (t: Dict): Record<SongSource, string> => ({
  custom: t.common.mySongs,
  newSong: SONGBOOK_NAMES.newSong,
  newSongPlGb: SONGBOOK_NAMES.newSongPlGb,
  pielgrzym: SONGBOOK_NAMES.pielgrzym,
  roboczy: SONGBOOK_NAMES.roboczy,
  children: SONGBOOK_NAMES.children,
});

const outputScopeLabels = (t: Dict): Record<OutputScope, string> => ({
  ...footerSourceLabels(t),
  bible: t.common.bible,
  messages: t.common.sermons,
});

const SONG_SCOPES = OUTPUT_SCOPE_ORDER.filter(
  (s) => s !== "bible" && s !== "messages",
);

const groupChoices = (
  t: Dict,
): { kind: GroupMode["kind"]; label: string }[] => [
  { kind: "section", label: t.settings.groupWhole },
  { kind: "stored", label: t.settings.groupSaved },
  { kind: "max", label: t.settings.groupMaxLines },
];

const chromeLabels = (
  t: Dict,
): Record<OutputScope, { header: string; footer: string }> => {
  const song = {
    header: t.settings.chromeSongHeader,
    footer: t.settings.chromeSongFooter,
  };
  return {
    newSong: song,
    newSongPlGb: song,
    pielgrzym: song,
    roboczy: song,
    children: song,
    custom: song,
    bible: {
      header: t.settings.chromeBibleHeader,
      footer: t.settings.chromeBibleFooter,
    },
    messages: {
      header: t.settings.chromeMessageHeader,
      footer: t.settings.chromeMessageFooter,
    },
  };
};

const themeOptions = (
  t: Dict,
): { value: ThemePref; label: string; icon: IconName }[] => [
  { value: "dark", label: t.settings.themeDark, icon: "Moon" },
  { value: "light", label: t.settings.themeLight, icon: "Sun" },
  { value: "system", label: t.settings.themeSystem, icon: "Monitor" },
];

const outputModeLabels = (t: Dict): Record<OutputMode, string> => ({
  fullscreen: t.outputModes.fullscreen,
  lowerThirds: t.outputModes.lowerThirds,
});

function OutputPanel({
  scope,
  label,
  settings,
  onChange,
}: {
  scope: OutputScope;
  label: string;
  settings: OutputSettings;
  onChange: (next: OutputSettings) => void;
}) {
  const { t } = useI18n();
  const GROUP_CHOICES = groupChoices(t);
  const CHROME_LABELS = chromeLabels(t);
  const { group, chrome } = settings;
  const maxLines = group.kind === "max" ? group.lines : DEFAULT_MAX_LINES;
  const isSong = scope !== "bible" && scope !== "messages";

  const setGroup = (kind: GroupMode["kind"]) =>
    onChange({
      ...settings,
      group: kind === "max" ? { kind, lines: maxLines } : { kind },
    });

  const stepLines = (delta: number) =>
    onChange({
      ...settings,
      group: {
        kind: "max",
        lines: Math.min(
          MAX_GROUP_LINES,
          Math.max(MIN_GROUP_LINES, maxLines + delta),
        ),
      },
    });

  const setChrome = (field: keyof typeof chrome, value: boolean) =>
    onChange({ ...settings, chrome: { ...chrome, [field]: value } });

  return (
    <div className="flex-1 min-w-0 rounded border border-border p-2.5">
      <div className="text-[11px] font-semibold text-text-primary mb-2">
        {label}
      </div>
      <div className="flex items-center gap-1 mb-2">
        {GROUP_CHOICES.map((choice) => (
          <button
            key={choice.kind}
            onClick={() => setGroup(choice.kind)}
            className={`px-2 py-0.5 text-[10px] font-semibold rounded border transition-colors ${
              group.kind === choice.kind
                ? "bg-primary border-primary text-white"
                : "bg-surface-secondary border-border text-text-secondary hover:text-text-primary"
            }`}
          >
            {choice.label}
          </button>
        ))}
        {group.kind === "max" && (
          <span className="flex items-center gap-1 ml-0.5">
            <button
              onClick={() => stepLines(-1)}
              disabled={maxLines <= MIN_GROUP_LINES}
              className="w-5 h-5 flex items-center justify-center rounded border border-border text-text-secondary hover:text-text-primary disabled:opacity-40"
            >
              <Icon name="Minus" size={10} />
            </button>
            <span className="w-3 text-center text-[11px] font-semibold text-text-primary tabular-nums">
              {maxLines}
            </span>
            <button
              onClick={() => stepLines(1)}
              disabled={maxLines >= MAX_GROUP_LINES}
              className="w-5 h-5 flex items-center justify-center rounded border border-border text-text-secondary hover:text-text-primary disabled:opacity-40"
            >
              <Icon name="Plus" size={10} />
            </button>
          </span>
        )}
      </div>
      <div className="space-y-1">
        <Checkbox
          checked={chrome.header}
          onChange={(checked) => setChrome("header", checked)}
          label={CHROME_LABELS[scope].header}
        />
        {isSong && (
          <Checkbox
            checked={chrome.sequence}
            onChange={(checked) => setChrome("sequence", checked)}
            label={t.settings.chromeSequence}
          />
        )}
        <Checkbox
          checked={chrome.footer}
          onChange={(checked) => setChrome("footer", checked)}
          label={CHROME_LABELS[scope].footer}
        />
        {isSong && (
          <Checkbox
            checked={chrome.secondary}
            onChange={(checked) => setChrome("secondary", checked)}
            label={t.settings.chromeSecondary}
          />
        )}
        {scope === "bible" && (
          <Checkbox
            checked={chrome.swapLabels}
            onChange={(checked) => setChrome("swapLabels", checked)}
            label={t.settings.chromeSwapLabels}
            hint={t.settings.chromeSwapLabelsHint}
          />
        )}
      </div>
    </div>
  );
}

function OutputsSection({
  outputs,
  onChange,
}: {
  outputs: OutputsConfig;
  onChange: (next: OutputsConfig) => void;
}) {
  const { t } = useI18n();
  const OUTPUT_MODE_LABELS = outputModeLabels(t);
  const patch = (id: OutputId, changes: Partial<OutputDef>) =>
    onChange({ ...outputs, [id]: { ...outputs[id], ...changes } });

  return (
    <div className="flex flex-col gap-2 sm:flex-row">
      {OUTPUT_IDS.map((id) => {
        const def = outputs[id];
        const only =
          def.enabled && !OUTPUT_IDS.some((o) => o !== id && outputs[o].enabled);
        return (
          <div
            key={id}
            className={`flex-1 min-w-0 rounded border p-2.5 transition-colors ${
              def.enabled ? "border-border" : "border-border/40 opacity-60"
            }`}
          >
            <div className="flex items-center gap-2 mb-2">
              <input
                type="text"
                value={def.name}
                placeholder={DEFAULT_OUTPUT_NAMES[id]}
                onChange={(e) => patch(id, { name: e.target.value })}
                className="flex-1 min-w-0 px-2 py-1 text-[11px] font-semibold border border-border-secondary rounded bg-surface text-text-primary placeholder-text-muted focus:outline-none focus:ring-1 focus:ring-primary"
              />
              <button
                onClick={() => patch(id, { enabled: !def.enabled })}
                disabled={only}
                title={
                  only
                    ? t.settings.keepOneOutputOn
                    : def.enabled
                      ? t.settings.turnOutputOff
                      : t.settings.turnOutputOn
                }
                className={`px-2 py-1 text-[10px] font-semibold rounded border transition-colors disabled:opacity-40 ${
                  def.enabled
                    ? "bg-primary border-primary text-white"
                    : "bg-surface-secondary border-border text-text-secondary"
                }`}
              >
                {def.enabled ? t.settings.on : t.settings.off}
              </button>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <span className="w-10 shrink-0 text-[10px] text-text-muted">
                  {t.settings.sentBy}
                </span>
                <div className="inline-flex items-center gap-0.5 p-0.5 rounded-md border border-border bg-surface-secondary">
                  {(["hdmi", "ip"] as OutputType[]).map((type) => (
                    <button
                      key={type}
                      onClick={() => patch(id, { type })}
                      title={
                        type === "hdmi" ? t.settings.hdmiHint : t.settings.ipHint
                      }
                      className={`px-2 py-0.5 text-[10px] font-semibold rounded transition-colors ${
                        def.type === type
                          ? "bg-primary text-white"
                          : "text-text-muted hover:bg-surface-hover hover:text-text-primary"
                      }`}
                    >
                      {OUTPUT_TYPE_LABELS[type]}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span className="w-10 shrink-0 text-[10px] text-text-muted">
                  {t.settings.shows}
                </span>
                <div className="inline-flex items-center gap-0.5 p-0.5 rounded-md border border-border bg-surface-secondary">
                  {(["fullscreen", "lowerThirds"] as OutputMode[]).map(
                    (mode) => (
                      <button
                        key={mode}
                        onClick={() => patch(id, { mode })}
                        title={
                          mode === "fullscreen"
                            ? t.settings.fullscreenHint
                            : t.settings.lowerThirdsHint
                        }
                        className={`px-2 py-0.5 text-[10px] font-semibold rounded transition-colors ${
                          def.mode === mode
                            ? "bg-primary text-white"
                            : "text-text-muted hover:bg-surface-hover hover:text-text-primary"
                        }`}
                      >
                        {OUTPUT_MODE_LABELS[mode]}
                      </button>
                    ),
                  )}
                </div>
              </div>
            </div>

            <p className="mt-2 text-[10px] text-text-muted leading-snug">
              {def.mode === "lowerThirds" && def.type !== "ip" ? (
                <>
                  {t.settings.hdmiNoAlphaBefore}
                  <span className="text-text-secondary font-semibold">
                    {t.settings.hdmiNoAlphaBold}
                  </span>
                  {t.settings.hdmiNoAlphaAfter}
                </>
              ) : def.mode === "lowerThirds" ? (
                t.settings.lowerThirdsNote
              ) : (
                t.settings.fullscreenNote
              )}
            </p>
          </div>
        );
      })}
    </div>
  );
}

interface SettingsModalProps {
  open: boolean;
  onClose: () => void;
  outputs: OutputsConfig;
  onChangeOutputs: (outputs: OutputsConfig) => void;
  outputConfig: OutputConfig;
  onChangeOutputConfig: (config: OutputConfig) => void;
  songFooter: FooterConfig;
  onChangeSongFooter: (config: FooterConfig) => void;
  translationLabels: TranslationLabelConfig;
  onChangeTranslationLabels: (config: TranslationLabelConfig) => void;
  dividerWidth: number;
  onChangeDividerWidth: (value: number) => void;
  identity: Identity | null;
  onOpenContentPicker: () => void;
  selection: ContentSelection;
  selectionSummary: string;
}

export default function SettingsModal({
  open,
  onClose,
  outputs,
  onChangeOutputs,
  outputConfig,
  onChangeOutputConfig,
  songFooter,
  onChangeSongFooter,
  translationLabels,
  onChangeTranslationLabels,
  dividerWidth,
  onChangeDividerWidth,
  identity,
  onOpenContentPicker,
  selection,
  selectionSummary,
}: SettingsModalProps) {
  const { t } = useI18n();
  const FOOTER_FIELDS = footerFields(t);
  const FOOTER_SOURCE_LABELS = footerSourceLabels(t);
  const OUTPUT_SCOPE_LABELS = outputScopeLabels(t);
  const THEME_OPTIONS = themeOptions(t);
  const [outputScope, setOutputScope] = useState<OutputScope>("newSong");
  const [token, setToken] = useState("");
  const [savedToken, setSavedToken] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState<string | null>(null);
  const [theme, setTheme] = useState<ThemePref>("dark");
  const [appVersion, setAppVersion] = useState<string | null>(null);
  const [adminView, setAdminView] = useState(false);
  const [confirmWipe, setConfirmWipe] = useState(false);
  const [confirmSignOut, setConfirmSignOut] = useState(false);

  const wipeLocalData = async () => {
    await window.api?.dataClearLocal();
    localStorage.removeItem(LS_KEYS.contentSelection);
    localStorage.removeItem(LS_KEYS.seenCatalog);
    window.location.reload();
  };

  const signOut = async () => {
    await window.api?.setWriteToken("");
    localStorage.removeItem(LS_KEYS.identity);
    localStorage.removeItem(LS_KEYS.contentSelection);
    localStorage.removeItem(LS_KEYS.seenCatalog);
    window.location.reload();
  };

  const [exporting, setExporting] = useState(false);
  const [exportMsg, setExportMsg] = useState<string | null>(null);
  const [exportFailed, setExportFailed] = useState(false);

  const runExport = async (categories: string[]) => {
    if (!window.api?.exportData) return;
    setExporting(true);
    setExportMsg(null);
    setExportFailed(false);
    try {
      const customSongs = categories.includes("songs")
        ? (localStorage.getItem(LS_KEYS.customSongs) ?? undefined)
        : undefined;
      const r = await window.api.exportData(categories, customSongs);
      if (r?.canceled) return;
      setExportFailed(!r?.ok);
      setExportMsg(
        r?.ok
          ? t.settings.exported(r.files ?? 0, r.path ?? "")
          : (r?.error ?? t.settings.exportFailed),
      );
    } catch (err) {
      setExportFailed(true);
      setExportMsg(String((err as Error)?.message || err));
    } finally {
      setExporting(false);
    }
  };

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
    setExportMsg(null);
    setExportFailed(false);
    setTheme(getThemePref());
    setAdminView(false);
    (async () => {
      const v = await window.api?.getAppVersion?.();
      setAppVersion(v ?? null);
      const t = await window.api?.getWriteToken?.();
      setSavedToken(t ?? null);
      setToken(t ?? "");

      const local = getLastManifest();
      setLocalVersion(local?.version ?? null);

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
      setSavedMsg(t.settings.tokenSavedMsg);
    } else {
      setSavedMsg(t.settings.tokenSaveFailed);
    }
  };

  const handleClear = async () => {
    if (!window.api?.setWriteToken) return;
    await window.api.setWriteToken("");
    setSavedToken(null);
    setToken("");
    setSavedMsg(t.settings.tokenCleared);
  };

  const handleSync = async (forceAll: boolean) => {
    setSyncBusy(true);
    setSyncProgress({ phase: "init", ratio: 0 });
    try {
      await applyUpdate((p) => setSyncProgress(p), { forceAll, selection });
      const local = getLastManifest();
      setLocalVersion(local?.version ?? null);
      setSyncProgress({
        phase: "done",
        ratio: 1,
        message: t.settings.dataUpdated,
      });
      setTimeout(() => {
        window.location.reload();
      }, 800);
    } catch (err) {
      setSyncProgress({
        phase: "error",
        ratio: 0,
        message: (err as Error)?.message || t.settings.syncFailed,
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

  const card = "bg-surface-secondary/30 border border-border rounded-md p-4";

  return (
    <div
      className="fixed inset-0 z-40 bg-black/60 flex items-center justify-center p-6"
      onClick={onClose}
    >
      <ConfirmDialog
        open={confirmWipe}
        title={t.settings.confirmWipeTitle}
        message={t.settings.confirmWipeMessage}
        confirmLabel={t.settings.confirmWipeButton}
        icon="Trash2"
        onConfirm={() => void wipeLocalData()}
        onCancel={() => setConfirmWipe(false)}
      />
      <ConfirmDialog
        open={confirmSignOut}
        title={t.settings.confirmSignOutTitle}
        message={t.settings.confirmSignOutMessage}
        confirmLabel={t.settings.confirmSignOutButton}
        icon="LogOut"
        onConfirm={() => void signOut()}
        onCancel={() => setConfirmSignOut(false)}
      />
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-3xl max-h-[85vh] flex flex-col bg-surface rounded-lg border border-border shadow-xl"
      >
        <div className="shrink-0 flex items-center gap-2 px-6 pt-5 pb-3">
          {adminView && (
            <button
              onClick={() => setAdminView(false)}
              title={t.settings.backToSettings}
              className="w-7 h-7 flex items-center justify-center rounded border border-border-secondary text-text-secondary transition-colors hover:bg-surface-hover hover:text-text-primary"
            >
              <Icon name="ChevronLeft" size={13} />
            </button>
          )}
          <h2 className="flex-1 text-lg font-semibold text-text-primary">
            {adminView ? t.settings.admin : t.settings.title}
          </h2>
          {identity?.role === "admin" && !adminView && (
            <button
              onClick={() => setAdminView(true)}
              className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded border border-border-secondary text-text-secondary transition-colors hover:bg-surface-hover hover:text-text-primary"
            >
              <Icon name="ShieldCheck" size={13} />
              {t.settings.admin}
            </button>
          )}
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded text-text-secondary hover:bg-surface-hover hover:text-text-primary transition-colors"
          >
            <Icon name="X" size={16} />
          </button>
        </div>

        {adminView && <AdminPanel />}

        <div
          className={`flex-1 overflow-y-auto px-6 pb-5 ${adminView ? "hidden" : ""}`}
        >
          <div className={`${card} mb-4`}>
            <label className="block text-xs font-semibold text-text-primary mb-1">
              {t.settings.outputs}
            </label>
            <p className="text-[11px] text-text-muted mb-2 leading-snug">
              {t.settings.outputsHint}
            </p>
            <OutputsSection outputs={outputs} onChange={onChangeOutputs} />
          </div>

          <div className={`${card} mb-4`}>
            <label className="block text-xs font-semibold text-text-primary mb-1">
              {t.settings.whatGoesOnOutputs}
            </label>
            <p className="text-[11px] text-text-muted mb-2 leading-snug">
              {t.settings.whatGoesOnOutputsHint}
            </p>
            <div className="flex flex-wrap items-center gap-1 mb-3">
              {OUTPUT_SCOPE_ORDER.map((scope) => (
                <button
                  key={scope}
                  onClick={() => setOutputScope(scope)}
                  className={`px-2 py-0.5 text-[10px] font-semibold rounded border transition-colors ${
                    outputScope === scope
                      ? "bg-primary border-primary text-white"
                      : "bg-surface-secondary border-border text-text-secondary hover:text-text-primary"
                  }`}
                >
                  {OUTPUT_SCOPE_LABELS[scope]}
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              {OUTPUT_KEYS.filter((output) => outputs[output].enabled).map(
                (output) => (
                  <OutputPanel
                    key={output}
                    scope={outputScope}
                    label={outputName(outputs[output], output)}
                    settings={outputConfig[outputScope][output]}
                    onChange={(next) =>
                      onChangeOutputConfig({
                        ...outputConfig,
                        [outputScope]: {
                          ...outputConfig[outputScope],
                          [output]: next,
                        },
                      })
                    }
                  />
                ),
              )}
            </div>
            {outputScope !== "bible" && outputScope !== "messages" && (
              <button
                onClick={() => {
                  const pair = outputConfig[outputScope];
                  const next = { ...outputConfig };
                  for (const scope of SONG_SCOPES) {
                    next[scope] = {
                      out1: { ...pair.out1, chrome: { ...pair.out1.chrome } },
                      out2: { ...pair.out2, chrome: { ...pair.out2.chrome } },
                    };
                  }
                  onChangeOutputConfig(next);
                }}
                className="mt-2 px-2.5 py-1 text-[11px] font-semibold rounded border border-border text-text-secondary transition-colors hover:bg-surface-hover hover:text-text-primary"
              >
                {t.settings.copyToEverySongbook}
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
            <div className="space-y-4">
              <div className={card}>
                <label className="block text-xs font-semibold text-text-primary mb-1">
                  {t.settings.downloadedContent}
                </label>
                <p className="text-[11px] text-text-muted mb-2 leading-snug">
                  {selectionSummary
                    ? t.settings.nowDownloaded(selectionSummary)
                    : t.settings.nothingDownloaded}
                </p>
                <div className="flex flex-wrap items-center gap-1.5">
                  <button
                    onClick={onOpenContentPicker}
                    className="flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded border border-primary/50 bg-primary/10 text-primary transition-colors hover:bg-primary hover:text-white"
                  >
                    <Icon name="Download" size={13} />
                    {t.settings.chooseWhatToDownload}
                  </button>
                  <button
                    onClick={() => setConfirmWipe(true)}
                    className="flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded border border-border text-text-secondary transition-colors hover:bg-danger hover:text-white hover:border-danger"
                  >
                    <Icon name="Trash2" size={13} />
                    {t.settings.deleteDownloadedData}
                  </button>
                </div>
              </div>

              <div className={card}>
                <label className="block text-xs font-semibold text-text-primary mb-1">
                  {t.settings.access}
                </label>
                <p className="text-[11px] text-text-muted mb-2 leading-snug">
                  {identity
                    ? t.settings.signedInAs(
                        identity.name,
                        identity.role === "admin",
                      )
                    : t.settings.notSignedIn}
                </p>
                <button
                  onClick={() => setConfirmSignOut(true)}
                  className="flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded border border-border text-text-secondary transition-colors hover:bg-surface-hover hover:text-text-primary"
                >
                  <Icon name="LogOut" size={13} />
                  {t.settings.forgetToken}
                </button>
              </div>

              <div className={card}>
                <label className="block text-xs font-semibold text-text-primary mb-2">
                  {t.settings.appearance}
                </label>
                <div className="flex items-center gap-1.5">
                  {THEME_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => {
                        setThemePref(opt.value);
                        setTheme(opt.value);
                      }}
                      title={opt.label}
                      aria-label={opt.label}
                      aria-pressed={theme === opt.value}
                      className={`w-8 h-7 flex items-center justify-center rounded border transition-colors ${
                        theme === opt.value
                          ? "bg-primary border-primary text-white"
                          : "bg-surface-secondary border-border text-text-secondary hover:text-text-primary"
                      }`}
                    >
                      <Icon name={opt.icon} size={14} />
                    </button>
                  ))}
                </div>
              </div>

              <div className={card}>
                <label className="block text-xs font-semibold text-text-primary mb-2">
                  {t.settings.language}
                </label>
                <LanguageSwitch />
              </div>

              <div className={card}>
                <label className="block text-xs font-semibold text-text-primary mb-1">
                  {t.settings.songFooter}
                </label>
                <p className="text-[11px] text-text-muted mb-2 leading-snug">
                  {t.settings.songFooterHint}
                </p>
                <div className="space-y-1">
                  <div className="flex items-center gap-2 pb-1 border-b border-border">
                    <span className="flex-1" />
                    {FOOTER_FIELDS.map((f) => (
                      <span
                        key={f.key}
                        className="w-12 text-[10px] font-semibold text-text-muted uppercase text-center"
                      >
                        {f.label}
                      </span>
                    ))}
                  </div>
                  {FOOTER_SOURCE_ORDER.map((source) => {
                    const fields = footerFieldsFor(source, songFooter);
                    return (
                      <div key={source} className="flex items-center gap-2">
                        <span className="flex-1 min-w-0 text-[11px] text-text-secondary truncate">
                          {FOOTER_SOURCE_LABELS[source]}
                        </span>
                        {FOOTER_FIELDS.map((f) => (
                          <span
                            key={f.key}
                            className="w-12 flex justify-center"
                          >
                            <Checkbox
                              checked={fields[f.key]}
                              onChange={(checked) =>
                                onChangeSongFooter({
                                  ...songFooter,
                                  [source]: { ...fields, [f.key]: checked },
                                })
                              }
                              label=""
                              hint={t.settings.footerCell(
                                f.label,
                                FOOTER_SOURCE_LABELS[source],
                              )}
                            />
                          </span>
                        ))}
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className={card}>
                <label className="block text-xs font-semibold text-text-primary mb-1">
                  {t.settings.divider}
                </label>
                <p className="text-[11px] text-text-muted mb-2 leading-snug">
                  {t.settings.dividerHint}
                </p>
                <div className="flex items-center gap-2">
                  <input
                    type="range"
                    min={1}
                    max={8}
                    step={1}
                    value={dividerWidth}
                    onChange={(e) =>
                      onChangeDividerWidth(Number(e.target.value))
                    }
                    className="flex-1 min-w-0 h-3 appearance-none bg-transparent cursor-pointer outline-none [&::-webkit-slider-runnable-track]:h-0.75 [&::-webkit-slider-runnable-track]:rounded-full [&::-webkit-slider-runnable-track]:bg-border-secondary [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:-mt-[4.5px] [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-primary"
                  />
                  <span className="w-8 shrink-0 text-right text-[11px] font-mono tabular-nums text-text-secondary">
                    {dividerWidth}px
                  </span>
                </div>
              </div>

              <div className={card}>
                <label className="block text-xs font-semibold text-text-primary mb-1">
                  {t.settings.translationLabel}
                </label>
                <p className="text-[11px] text-text-muted mb-2 leading-snug">
                  {t.settings.translationLabelHint}
                </p>
                <div className="space-y-1">
                  {FOOTER_SOURCE_ORDER.map((source) => (
                    <div key={source} className="flex items-center gap-2">
                      <span className="flex-1 min-w-0 text-[11px] text-text-secondary truncate">
                        {FOOTER_SOURCE_LABELS[source]}
                      </span>
                      <input
                        type="text"
                        value={translationLabels[source] ?? ""}
                        onChange={(e) =>
                          onChangeTranslationLabels({
                            ...translationLabels,
                            [source]: e.target.value,
                          })
                        }
                        placeholder={t.settings.translationLabelAuto(
                          TRANSLATION_LABEL_DEFAULT,
                        )}
                        className="w-40 px-2 py-1 text-[11px] border border-border-secondary rounded hover:border-primary/60 transition-colors focus:outline-none focus:ring-1 focus:ring-primary bg-surface text-text-primary placeholder-text-muted"
                      />
                    </div>
                  ))}
                </div>
              </div>

              <div className={card}>
                <label className="block text-xs font-semibold text-text-primary mb-1">
                  {t.settings.backup}
                </label>
                <p className="text-[11px] text-text-muted mb-2 leading-snug">
                  {t.settings.backupHint}
                </p>
                <div className="flex items-center gap-1.5 flex-wrap">
                  <button
                    onClick={() => runExport(["songs", "bibles", "messages"])}
                    disabled={exporting}
                    className="px-3 py-1 text-xs font-semibold bg-primary text-white rounded hover:bg-primary-hover transition-colors disabled:opacity-50 flex items-center gap-1.5"
                  >
                    <Icon name="FolderDown" size={12} />
                    {t.settings.exportAll}
                  </button>
                  <button
                    onClick={() => runExport(["songs"])}
                    disabled={exporting}
                    className="flex items-center gap-1.5 px-3 py-1 text-xs font-semibold bg-surface-secondary border border-border text-text-primary rounded hover:bg-surface-hover transition-colors disabled:opacity-50"
                  >
                    <Icon name="Music" size={12} />
                    {t.common.songs}
                  </button>
                  <button
                    onClick={() => runExport(["bibles"])}
                    disabled={exporting}
                    className="flex items-center gap-1.5 px-3 py-1 text-xs font-semibold bg-surface-secondary border border-border text-text-primary rounded hover:bg-surface-hover transition-colors disabled:opacity-50"
                  >
                    <Icon name="BookOpen" size={12} />
                    {t.common.bibles}
                  </button>
                  <button
                    onClick={() => runExport(["messages"])}
                    disabled={exporting}
                    className="flex items-center gap-1.5 px-3 py-1 text-xs font-semibold bg-surface-secondary border border-border text-text-primary rounded hover:bg-surface-hover transition-colors disabled:opacity-50"
                  >
                    <Icon name="Mic" size={12} />
                    {t.common.messages}
                  </button>
                </div>
                {exporting && (
                  <div className="text-[11px] text-text-muted mt-2 flex items-center gap-1">
                    <Icon name="Loader" size={12} className="animate-spin" />
                    {t.settings.exporting}
                  </div>
                )}
                {exportMsg && (
                  <div
                    className={`text-[11px] mt-2 break-all ${
                      exportFailed ? "text-danger" : "text-success"
                    }`}
                  >
                    {exportMsg}
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-4">
              <div className={card}>
                <label className="block text-xs font-semibold text-text-primary mb-1">
                  {t.settings.cloudData}
                </label>
                <div className="text-[11px] text-text-muted leading-snug space-y-0.5 mb-2">
                  <div>
                    {t.settings.localVersion}{" "}
                    <span className="font-mono text-text-primary">
                      {localVersion ?? "—"}
                    </span>
                  </div>
                  <div>
                    {t.settings.cloudVersion}{" "}
                    <span className="font-mono text-text-primary">
                      {remoteVersion ?? "—"}
                    </span>
                  </div>
                </div>

                {updateAvailable && !syncBusy && (
                  <div className="mb-2 px-2 py-1.5 bg-primary/10 border border-primary/30 rounded text-[11px] text-primary">
                    {t.settings.updateAvailable}
                  </div>
                )}

                <div className="flex items-center gap-2 flex-wrap">
                  {updateAvailable && !syncBusy && (
                    <button
                      onClick={() => handleSync(false)}
                      className="px-3 py-1 text-xs font-semibold bg-primary text-white rounded hover:bg-primary-hover transition-colors flex items-center gap-1.5"
                    >
                      <Icon name="Download" size={12} />
                      {t.settings.updateNow}
                    </button>
                  )}
                  <button
                    onClick={() => handleSync(true)}
                    disabled={syncBusy}
                    title={t.settings.forceResyncHint}
                    className="px-3 py-1 text-xs font-semibold bg-surface-secondary border border-border text-text-primary rounded hover:bg-surface-hover transition-colors disabled:opacity-50 flex items-center gap-1.5"
                  >
                    {syncBusy ? (
                      <>
                        <Icon
                          name="Loader"
                          size={12}
                          className="animate-spin"
                        />
                        {t.settings.syncing}
                      </>
                    ) : (
                      <>
                        <Icon name="RefreshCw" size={12} />
                        {t.settings.forceResync}
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
                        {syncProgress.message ?? t.settings.upToDate}
                      </div>
                    )}
                    {syncProgress.phase === "error" && (
                      <div className="text-[11px] text-danger flex items-center gap-1">
                        <Icon name="TriangleAlert" size={12} />
                        {syncProgress.message ?? t.settings.syncFailed}
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className={card}>
                <label className="block text-xs font-semibold text-text-primary mb-1">
                  {t.settings.writeToken}
                </label>
                <p className="text-[11px] text-text-muted mb-2 leading-snug">
                  {t.settings.writeTokenHint}
                </p>
                <input
                  type="password"
                  placeholder={
                    savedToken
                      ? t.settings.tokenSaved
                      : t.settings.tokenPlaceholder
                  }
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  className="w-full px-2 py-1.5 text-xs border border-border-secondary rounded hover:border-primary/60 transition-colors focus:outline-none focus:ring-1 focus:ring-primary bg-surface text-text-primary placeholder-text-muted font-mono"
                />
                <div className="flex items-center gap-2 mt-2">
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    className="px-3 py-1 text-xs font-semibold bg-primary text-white rounded hover:bg-primary-hover transition-colors disabled:opacity-50"
                  >
                    {saving ? t.common.saving : t.common.save}
                  </button>
                  {savedToken && (
                    <button
                      onClick={handleClear}
                      className="px-3 py-1 text-xs font-semibold text-danger hover:bg-danger/10 rounded transition-colors"
                    >
                      {t.common.clear}
                    </button>
                  )}
                  {savedMsg && (
                    <span className="text-[11px] text-text-muted">
                      {savedMsg}
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-text-muted mt-3">
                  {t.settings.status}{" "}
                  {savedToken ? (
                    <span className="text-success">
                      {t.settings.writeEnabled}
                    </span>
                  ) : (
                    <span className="text-text-secondary">
                      {t.settings.readOnly}
                    </span>
                  )}
                </p>
              </div>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-border text-[11px] text-text-muted leading-relaxed">
            <span className="text-text-primary font-semibold">
              ChoirPresenter{appVersion ? ` v${appVersion}` : ""}
            </span>{" "}
            {t.settings.about}
          </div>
        </div>
      </div>
    </div>
  );
}
