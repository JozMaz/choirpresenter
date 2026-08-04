"use client";

import { useCallback, useLayoutEffect, useRef } from "react";

interface AutoTextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  minRows?: number;
  ref?: React.Ref<HTMLTextAreaElement>;
}

export default function AutoTextarea({
  minRows = 2,
  className = "",
  value,
  ref,
  ...rest
}: AutoTextareaProps) {
  const inner = useRef<HTMLTextAreaElement>(null);

  const setRef = useCallback(
    (el: HTMLTextAreaElement | null) => {
      inner.current = el;
      if (typeof ref === "function") ref(el);
      else if (ref) ref.current = el;
    },
    [ref],
  );

  useLayoutEffect(() => {
    const el = inner.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight + 2}px`;
  }, [value]);

  return (
    <textarea
      ref={setRef}
      rows={minRows}
      value={value}
      className={`resize-none overflow-hidden ${className}`}
      {...rest}
    />
  );
}
