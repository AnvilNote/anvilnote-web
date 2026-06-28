# anvilnote-web

`anvilnote-web` is the Next.js frontend for AnvilNote.

It uses:

- Next.js App Router
- React
- BlockNote
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
- Document content is stored as BlockNote-compatible JSON through the API.
- The UI remains the same; only the persistence and render flow changed.
