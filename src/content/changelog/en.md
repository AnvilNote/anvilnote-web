## 0.1.21
2026-08-10
- **Watermarks**: add an image or text watermark to exported PDFs, with adjustable size, rotation, and opacity
- **Page size**: choose A4, B4, B5, or Letter (supported templates only)
- **Stats charts**: bar, pie, line, scatter, and more, rendered with Plotly
- The sidebar can now be collapsed for a wider workspace
- Blockquotes and callouts support custom colors

## 0.1.20
2026-07-28
- **Function-plot charts**: insert a plotted function graph as a block
- **Feature finder**: ⌘K search that jumps straight to any feature
- AI Smart Mode gained an edit preview and one-shot apply
- Manual page breaks
- Customizable list-marker styles, with double-Tab to demote a list

## 0.1.19
2026-07-24
- **One-click update**: check, download, and apply updates right from the app
- **.anvilnote native format**: export/import that losslessly preserves stats charts, Mermaid diagrams, and more
- **Custom color palettes**: build and name your own palettes, apply them to stats charts
- Live template preview now renders your actual document content
- Fixed tables not working inside callouts and read-only color picker inputs

## 0.1.17
2026-07-20
- **AI Smart Mode**: conversational AI document editing
- **Tables rewritten**: boundary drag-resize, cell selection menu, automatic black/white text by fill color
- New divider block with adjustable thickness and style
- The help button can now be dragged and dismissed
- Math nodes support Tab/arrow-key navigation

## 0.1.16
2026-07-11
- **Question blocks**: single-choice, multiple-choice, and written-answer questions, insertable from the toolbar
- **Cloze references**: type `#` to insert a live-numbered reference to a question
- Fixed-width inline blanks for cloze-style exercises
- Adjustable page margins in the Info panel
- Tour updated with question block and cloze reference steps

## 0.1.15
2026-07-08
- **Side-by-side images**: a new block for two images placed side by side, each with its own caption and cross-reference
- H1/H2/H3 toolbar buttons merged into one dropdown
- Code blocks gained a copy button and auto-indent
- Export panel simplified, dropping secondary options

## 0.1.14
2026-07-05
- Images can now be placed inside callouts
- Charts and table captions support LaTeX math
- **Proof blocks**: a new block for mathematical proofs, with a QED mark
- Lists inside callouts can be indented with Tab

## 0.1.13
2026-07-05
- Release process only, no user-facing changes

## 0.1.12
2026-07-05
- Tour extended with footnote, cross-reference, image-crop, and version-history steps
- Added an MIT license
- Desktop now picks the export folder via a native dialog
- Block math and code blocks can be placed inside callouts

## 0.1.11
2026-07-04
- Release process only, no user-facing changes

## 0.1.10
2026-07-04
- **Cross-references**: auto-numbered references to figures, tables, equations, and headings

## 0.1.9
2026-07-03
- **Version history**: documents are snapshotted automatically, with non-destructive restore
- **PDF images**: insert a PDF and it's embedded as native vector graphics in the export
- Images gained click-to-zoom preview and in-place cropping
- The math editor was rewritten on CodeMirror with syntax highlighting and correct indentation
- Fixed a data-loss bug when dragging blocks, and wrong callout colors in dark mode

## 0.1.8
2026-07-03
- The toolbar and autosave indicator now adapt to the editor's actual width instead of the browser viewport
- Fixed toolbar scroll drift and a stray horizontal scrollbar at narrow widths

## 0.1.7
2026-07-03
- **Footnotes**: full support across the editor, PDF, and DOCX export, plus a new margin-sidenote template
- **DOCX export**: bundled Pandoc, no separate install needed
- Template color-picker fields, a reorganized sidebar, an About page, paginated search
- Fixed footnote clicks jumping the cursor, and the interface language resetting on restart

## 0.1.6
2026-07-02
- Release tooling: one step now builds and publishes macOS, Windows, and Linux together (no user-facing changes)

## 0.1.5
2026-07-02
- Reorganized keyboard shortcuts and added a shortcuts cheat sheet
- Desktop app now checks for updates on launch
- Callouts support nested lists and code blocks

## 0.1.4
2026-07-01
- **10 new templates**, each with bundled fonts and per-locale preview PDFs
- **Backup & restore**: export every document as a Markdown archive and import it back
- Added a Windows build
- Fixed keyboard navigation and the default data folder location

## 0.1.3
2026-07-01
- New first-run screen for choosing language and theme
- Fixed Typst export breaking on text containing `#`, `*`, `_`

## 0.1.2
2026-07-01
- **Callouts**: colored admonition boxes (note, warning, tip, and more)
- Templates now link back to their source Typst Universe package
- Fixed the app icon and package metadata on Linux

## 0.1.1
2026-06-30
- **Projects**: group documents with custom icons, rename, and a move-to menu
- **Workspace tour**: guided onboarding, replayable from the help menu
- Search now matches document body text, not just titles
- Added a Linux build and an improved landing page
- Various editor and localization fixes

## 0.1.0
2026-06-30
- **Initial release**: an offline-first writing app that typesets notes to PDF via Typst
- Tiptap-based editor with inline and block LaTeX math
- A file-based template registry with per-locale previews
- One-click PDF export
- macOS desktop app: Electron-packaged, embedded SQLite, fully offline
