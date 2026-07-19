# AnvilNote Web

`anvilnote-web` is the Next.js frontend for AnvilNote. It contains the Tiptap
editor, document and template UI, PDF/DOCX export controls, localization, and
the Smart Mode experience used in both a browser development session and the
Electron desktop application.

## Stack

- Next.js 16 App Router
- React 19 and TypeScript
- Tiptap 3 and ProseMirror
- shadcn/ui and Radix UI
- Tailwind CSS 4
- Zustand
- next-intl

## Features

- Visual editing for long-form documents
- Headings, lists, task lists, tables, images, math, code, footnotes, and
  cross-references
- Callouts, Proof/QED, Questions, Mermaid diagrams, function plots, and
  statistics charts
- Projects, document versions, templates, metadata, and document outlines
- Typst PDF and Pandoc DOCX export UI
- Smart Mode settings, conversations, attachment context, previews, and
  controlled editor transactions
- English, Traditional Chinese, Japanese, Korean, Thai, and Russian interface
  messages

Documents are stored through `anvilnote-api` as a Tiptap `doc` node wrapped in
a one-element array at the HTTP boundary.

## Smart Mode

Smart Mode opens from the Bot launcher or from the editor toolbar when text is
selected. Each document owns its own named conversations. Conversation and
message lists use cursor pagination, so the browser loads recent history first
instead of hydrating every saved message at once.

Current flows include:

- compose a structured draft from an instruction;
- include extracted attachment text as context;
- rewrite selected text in the inline toolbar or right-side preview;
- preview a safe, versioned AnvilNote AST before applying it;
- insert a compose draft at the captured cursor or explicitly replace the
  whole document;
- accept or reject a selected-text proposal;
- cancel an in-flight request;
- detect selection, cursor, or document changes before applying a stale result;
- preserve applied changes in Tiptap history and create a safety snapshot before
  an AI insertion.

Compose drafts and rewrite proposals are never applied automatically. Inline
rewrite review uses a red struck-through original and a normal replacement as
editor decorations. Rejecting the proposal leaves the document JSON unchanged.
Historical selection rewrites remain preview-only because their original range
and protected-content registry are not reconstructed after a reload.

The current AI round trip supports paragraphs, headings, lists, blockquotes,
Callouts, Proof/QED, all three Question kinds, code blocks, inline and display
math, tables, horizontal rules, safe links, and registered text marks. Footnotes
and cross-references are protected. Images, Mermaid, function plots, statistics
charts, image choices, hidden Question choice stashes, and unknown custom nodes
block rewriting when they cannot be represented without loss.

## AI document boundary

Web imports only the browser-safe contracts, document schemas, and pricing from
`@anvilnote/ai-writer`. It does not bundle the OpenAI SDK or prompt/policy
Markdown.

Before a request, the editor converts the supported Tiptap content to the
provider-neutral AnvilNote AST and records a selection or cursor snapshot. The
API and AI Writer validate the provider result. Web then converts the trusted
public AST back to Tiptap and applies it in one controlled editor transaction.
Unsupported nodes fail closed rather than being silently flattened or dropped.

## Setup

The default API address is `http://localhost:4000`, so no environment file is
required for the standard local layout.

```bash
pnpm install
pnpm dev
```

Open `http://localhost:3000`.

To use a different API address, add this optional value to `.env.local`:

```env
NEXT_PUBLIC_API_URL=http://localhost:4000
```

## Local development

Keep the application repositories as siblings. Build the packages and CLI
boundaries before starting API and Web:

```text
parent-folder/
  anvilnote-ai-writer/
  anvilnote-web/
  anvilnote-api/
  anvilnote-renderer/
  anvilnote-docx-exporter/
  anvilnote-charts/
  anvilnote-desktop/
```

```bash
cd anvilnote-ai-writer
pnpm install
pnpm build

cd ../anvilnote-renderer
pnpm install
pnpm build

cd ../anvilnote-docx-exporter
pnpm install
pnpm build:desktop

cd ../anvilnote-charts
pnpm install
pnpm build:desktop

cd ../anvilnote-api
pnpm install
make dev
```

In another terminal:

```bash
cd anvilnote-web
pnpm install
make dev
```

The API starts its local PostgreSQL container and listens on
`http://127.0.0.1:4000`. Renderer and DOCX exporter are CLIs invoked on demand;
they do not need separate HTTP servers.

For Next.js hot reload with persistent encrypted key profiles, stop the direct
Web process and run `make dev-hot` from `anvilnote-desktop`. This loads the
Next.js development server inside Electron with the trusted Desktop boundary.

## Commands

```bash
pnpm dev
pnpm build
pnpm start
pnpm lint
pnpm typecheck
pnpm test
pnpm test:node
pnpm test:unit
```

## Data and credentials

In direct browser development, Smart Mode can use a key only when the API
advertises session BYOK capability. The key remains in module memory for the
current tab and disappears on reload. It is not written to localStorage,
IndexedDB, persisted Zustand state, a URL, or analytics.

In the Desktop build, named OpenAI key profiles are handled through the trusted
preload and Electron main process. The renderer receives only masked profile
metadata. It never receives a saved raw key or encrypted ciphertext.

OpenAI API use may incur charges on the user's OpenAI account. Automated Web
tests do not make paid provider requests.

## Related repositories

- [AnvilNote project overview](https://github.com/AnvilNote/anvilnote)
- [AnvilNote AI Writer](https://github.com/AnvilNote/anvilnote-ai-writer)
- [AnvilNote API](https://github.com/AnvilNote/anvilnote-api)
- [AnvilNote Desktop](https://github.com/AnvilNote/anvilnote-desktop)
- [AnvilNote Renderer](https://github.com/AnvilNote/anvilnote-renderer)
- [AnvilNote DOCX Exporter](https://github.com/AnvilNote/anvilnote-docx-exporter)
