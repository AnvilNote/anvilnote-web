# Public Web Deployment

`anvilnote-web` has two build-time runtime modes.

```text
NEXT_PUBLIC_ANVILNOTE_RUNTIME=public-web
NEXT_PUBLIC_ANVILNOTE_RUNTIME=desktop
```

Use `public-web` for the deployed website. It serves only the localized landing
page, product demonstration, privacy policy, and terms of use. Requests to
application routes such as `/en/documents`,
`/zh-TW/settings`, `/en/templates`, `/en/projects`, and `/en/about` return a
server-side 404. The check runs in the Next proxy and again in the desktop route
group layout; it is not a client-side visibility check.

Use `desktop` only for the Electron application. It retains every application
route and is selected explicitly by `anvilnote-desktop/scripts/build-web.mjs`
and `anvilnote-desktop/scripts/dev-hot.mjs`.

Build the public website with:

```bash
pnpm build:web
pnpm start:web
```

The project uses `output: "standalone"`, so `start:web` runs
`.next/standalone/server.js`. Supply `PORT` and `HOSTNAME` as required by the
deployment environment.

## Sibling package requirement

This repository currently depends on `@anvilnote/ai-writer` through the local
package reference `file:../anvilnote-ai-writer`. Therefore an isolated clone of
`anvilnote-web` cannot install or build until that sibling exists at the
expected path, or the dependency is replaced by a published package or packed
artifact. The parent-directory layout documented in the README is required for
the current deployment workflow.
