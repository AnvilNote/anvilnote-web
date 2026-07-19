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

Smart Mode is a document-operation Sheet, not a chat. It infers compose or
selection rewrite from the current editor state, optionally extracts local
attachments through the API, estimates cost, and previews the versioned AI AST
before any editor change. Accept uses one history-eligible Tiptap transaction;
selection/document hashes prevent a late result from overwriting newer edits.

The browser imports only `@anvilnote/ai-writer` contracts, document schemas,
and pricing. It never bundles the OpenAI SDK or prompt/policy Markdown. Browser
BYOK is tab-memory-only and disappears on reload; no API Key is written to
localStorage, IndexedDB, persisted Zustand state, a URL, or analytics.

Supported AI round trips include paragraphs, headings, lists, blockquotes,
code blocks, math, tables, horizontal rules, safe links, and the registered
text marks. Footnotes and cross-references are protected; unsupported custom
nodes block rewriting instead of being silently dropped.
