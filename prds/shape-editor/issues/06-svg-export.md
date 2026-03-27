done: false
---

## Parent PRD

prds/shape-editor/index.md

## What to build

Add an "Export SVG" button that downloads the current composition as an SVG file. The export uses `paper.project.exportSVG()` on the preview `PaperScope` and triggers a browser file download. The exported file should faithfully represent what the user sees in the preview canvas.

## Acceptance criteria

- [ ] An "Export SVG" button is visible in the UI (e.g. top of sidebar or above the preview canvas)
- [ ] Clicking the button downloads an `.svg` file to the user's machine
- [ ] The exported SVG visually matches the preview canvas content
- [ ] The export uses `paper.project.exportSVG()` from the preview `PaperScope`
- [ ] The button is a no-op (or disabled) when the composition has no renderable rings

## Blocked by

- Blocked by `prds/shape-editor/issues/05-geometry-bend-compose-live-preview.md`

## User stories addressed

- User story 22 (export as SVG file)
- User story 23 (exported SVG matches preview)
