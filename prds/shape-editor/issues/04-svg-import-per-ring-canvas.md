done: false
---

## Parent PRD

prds/shape-editor/index.md

## What to build

Build the SVG import pipeline and the per-ring template canvas. This slice adds two things to `RingEditor`: a file input for uploading an SVG, and a `RingCanvas` that displays the imported template path.

`svg-import.ts` accepts a `File`, uses paper.js to parse the SVG, extracts the first path (flattening all transforms into absolute coordinates), and converts it to the internal `Path` format (`cmds`/`crds`). It exposes a `preprocessors` array hook so future transforms can be inserted into the pipeline before path extraction.

`RingCanvas` gets its own `PaperScope`, set up on `onMount` and torn down on unmount. It is only mounted when the ring panel is expanded. It displays the template path centered in the canvas. If no path is loaded yet, it shows a placeholder message. If the SVG import fails (no paths found, malformed file), an inline error appears below the file input and the previous path (if any) is preserved.

See **`geometry/svg-import.ts`** and **`components/RingCanvas.svelte`** in the parent PRD.

## Acceptance criteria

- [ ] File input in `RingEditor` accepts SVG files
- [ ] On successful upload, the first path is extracted and stored as `templatePath` on the ring
- [ ] The extracted path is displayed in `RingCanvas` centered in the canvas
- [ ] `RingCanvas` uses its own isolated `PaperScope` (no interference between rings)
- [ ] `RingCanvas` is only mounted when the ring panel is expanded
- [ ] A placeholder is shown in `RingCanvas` when `templatePath` is null
- [ ] An inline error is shown below the file input when the SVG has no paths or is malformed
- [ ] The previous `templatePath` is preserved when a new upload fails
- [ ] `svg-import.ts` exposes a `preprocessors` hook (array of `(item: paper.Item) => paper.Item`)
- [ ] All transforms in the source SVG are flattened into absolute coordinates before extraction

## Blocked by

- Blocked by `prds/shape-editor/issues/03-ring-editor-parameters-reordering.md`

## User stories addressed

- User story 3 (upload SVG as ring template)
- User story 4 (first path extracted and displayed)
- User story 5 (inline error on invalid SVG)
- User story 6 (previous path preserved on failed upload)
- User story 26 (each ring canvas is isolated)
- User story 27 (per-ring canvas only renders when expanded)
