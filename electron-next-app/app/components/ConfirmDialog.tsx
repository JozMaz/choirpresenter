"use client";

import { useEffect } from "react";
import { useI18n } from "../lib/i18n/context";
import Icon, { type IconName } from "./Icon";

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  icon?: IconName;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel,
  cancelLabel,
  icon = "TriangleAlert",
  danger = true,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const { t } = useI18n();
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
      if (e.key === "Enter") onConfirm();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onCancel, onConfirm]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-6"
      onClick={onCancel}
    >
      <div
        className="w-full max-w-sm bg-surface rounded-lg border border-border shadow-xl p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-3">
          <span
            className={`shrink-0 w-9 h-9 rounded-full flex items-center justify-center ${
              danger ? "bg-danger/15 text-danger" : "bg-primary/15 text-primary"
            }`}
          >
            <Icon name={icon} size={18} />
          </span>
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-text-primary leading-tight">
              {title}
            </h3>
            <p className="text-xs text-text-secondary mt-1 leading-relaxed">
              {message}
            </p>
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-5">
          <button
            onClick={onCancel}
            className="px-3 py-1.5 text-xs font-semibold text-text-secondary border border-border rounded hover:bg-surface-hover transition-colors"
          >
            {cancelLabel ?? t.common.cancel}
          </button>
          <button
            onClick={onConfirm}
            autoFocus
            className={`px-4 py-1.5 text-xs font-semibold text-white rounded transition-colors ${
              danger
                ? "bg-danger hover:bg-danger-hover"
                : "bg-primary hover:bg-primary-hover"
            }`}
          >
            {confirmLabel ?? t.common.confirm}
          </button>
        </div>
      </div>
    </div>
  );
}
