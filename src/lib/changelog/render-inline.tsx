import { Fragment, type ReactNode } from "react";

// The only inline markdown a changelog bullet ever needs is **bold** (per
// the authoring convention in src/content/changelog/*.md) -- a full
// markdown renderer would be overkill for one span type, so this is a
// plain split/map instead of a dependency.
export function renderChangelogBullet(text: string): ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*)/g).filter(Boolean);
  return parts.map((part, index) =>
    part.startsWith("**") && part.endsWith("**") ? (
      <strong key={index}>{part.slice(2, -2)}</strong>
    ) : (
      <Fragment key={index}>{part}</Fragment>
    ),
  );
}
