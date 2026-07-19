# anvilnote-web

`anvilnote-web` is the Next.js frontend for AnvilNote.

It uses:

- Next.js App Router
- React
- Tiptap
- Zustand
- next-intl

## Setup

```bash
pnpm install
cp .env.example .env.local
pnpm dev
```

Default frontend URL:

```txt
http://localhost:3000
```

## Environment

```env
NEXT_PUBLIC_API_URL=http://localhost:4000
```

## Local Development

Start the three repos from the shared parent folder:

```bash
cd anvilnote-renderer
pnpm install

cd ../anvilnote-api
pnpm install
cp .env.example .env
pnpm prisma:migrate --name init
pnpm dev

cd ../anvilnote-web
pnpm install
cp .env.example .env.local
pnpm dev
```

## API Integration

The frontend now calls `anvilnote-api` for:

- listing documents
- creating documents
- updating titles and BlockNote content
- deleting documents
- triggering PDF rendering
- provider-neutral Smart Mode operations

Documents are loaded from the API during store hydration instead of local document persistence.

## PDF Export

The existing export UI now calls:

```txt
POST /api/documents/:id/render
```

If rendering succeeds, the frontend opens:

```txt
${NEXT_PUBLIC_API_URL}${pdfUrl}
```

## Notes

- Settings remain locally persisted in the browser.
- Document content is stored as Tiptap JSON through the API.
- The UI remains the same; only the persistence and render flow changed.

## Smart Mode

Smart Mode is a document-scoped conversation in the right-side Sheet. Each
document has its own named conversations, with newest conversation summaries
and messages loaded lazily; a new conversation is not persisted until its
first successful turn. Assistant results remain safe versioned-AST previews:
compose drafts can insert at the cursor or explicitly replace the whole
document (including an optional suggested title). Usage, pricing and warnings
are deliberately absent from the transcript.

Selecting ordinary marked text also exposes Smart Mode from the editor toolbar.
The toolbar turns into a small inline composer; its pending red-strike/black
proposal is a decoration only. Accept is one history-eligible Tiptap
transaction, while reject, selection changes, document changes and unmounting
leave document JSON untouched. Complex selections use the right-side preview.
Historical selection rewrites remain preview-only because their original range
and protected-content registry are not reconstructed after a reload.

The browser imports only `@anvilnote/ai-writer` contracts, document schemas,
and pricing. It never bundles the OpenAI SDK or prompt/policy Markdown. Browser
BYOK is tab-memory-only and disappears on reload; no API Key is written to
localStorage, IndexedDB, persisted Zustand state, a URL, or analytics.

For Next.js hot reload with persistent encrypted key profiles, stop the direct
Web dev process and run `make dev-hot` from `anvilnote-desktop`. That command
loads the dev server inside Electron with the trusted SQLite/safeStorage
boundary. A direct browser deliberately labels its key action as current-tab
use rather than a persistent save.

Supported AI round trips include paragraphs, headings, lists, blockquotes,
code blocks, math, tables, horizontal rules, safe links, and the registered
text marks. Footnotes and cross-references are protected; unsupported custom
nodes block rewriting instead of being silently dropped.
