"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";

export function DocumentTitle({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const t = useTranslations();

  // Keep a local draft as the textarea's source of truth so an IME composition
  // (e.g. Bopomofo) is never interrupted by the controlled value round-tripping
  // through the store. Without this, half-typed readings commit to characters
  // before the user has finished selecting.
  const [draft, setDraft] = useState(value);
  const composingRef = useRef(false);

  // Sync external title changes (switching documents, renaming elsewhere) into
  // the draft, but never while the user is mid-composition.
  useEffect(() => {
    if (!composingRef.current) setDraft(value);
  }, [value]);

  return (
    <textarea
      value={draft}
      onChange={(e) => {
        setDraft(e.target.value);
        // Hold back store updates until the composition ends.
        if (!composingRef.current) onChange(e.target.value);
      }}
      onCompositionStart={() => {
        composingRef.current = true;
      }}
      onCompositionEnd={(e) => {
        composingRef.current = false;
        onChange(e.currentTarget.value);
      }}
      placeholder={t("editor.titlePlaceholder")}
      rows={1}
      spellCheck={false}
      onKeyDown={(e) => {
        if (e.key === "Enter") e.preventDefault();
      }}
      className="w-full resize-none overflow-hidden border-0 bg-transparent p-0 font-sans text-2xl font-semibold leading-tight tracking-tight text-foreground outline-none placeholder:text-muted-foreground/50 md:text-3xl lg:text-4xl [field-sizing:content]"
    />
  );
}
