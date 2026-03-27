done: false
---

## Parent PRD

prds/ring-canvas-editor/index.md

## What to build

Add a multi-subpath guard to the SVG import pipeline. If the extracted path contains more than one `M` command in its `cmds` array, `svg-import.ts` returns `null`. `RingEditor` surfaces this as an inline error below the file input (via the existing `importError` mechanism) and preserves the previous `templatePath` unchanged.

See **Coordinate space** and **Multi-subpath rejection** sections in the parent PRD.

## Acceptance criteria

- [ ] `svg-import.ts` returns `null` when the imported path has more than one `M` in `cmds`
- [ ] `RingEditor` displays an appropriate inline error message below the file input when a multi-subpath SVG is uploaded
- [ ] The previously loaded `templatePath` is preserved when rejection occurs
- [ ] Single-subpath SVGs continue to import correctly (no regression)
- [ ] Unit test: a path string with two `M` commands returns `null` from `importSvg`

## Blocked by

None — can start immediately.

## User stories addressed

- User story 16 (multi-subpath SVGs rejected with inline error)
- User story 17 (previous path preserved on rejection)
