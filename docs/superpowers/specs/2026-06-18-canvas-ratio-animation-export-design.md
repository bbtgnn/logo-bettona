# Design — Canvas aspect ratio + animation (WebM) export

**Repo:** logo-bettona
**Date:** 2026-06-18
**Status:** approved design, ready for implementation plan

## Goal

Two related additions to the canvas/output area:

1. **Canvas aspect ratio** — a new "Canvas" section in the sidebar that lets the user
   pick the canvas aspect ratio. Options: `1:1, 3:4, 4:3, 4:5, 5:4, 9:16, 16:9`.
2. **Animation export** — export the running animation as a `.webm` video, alongside
   the existing SVG export, with a progress bar shown during capture.

Both touch the preview/canvas surface, so they share one spec.

## Current state (context)

- Sidebar (`Sidebar.svelte`) composes collapsible sections via `SidebarCollapsible`:
  `SettingsSection`, Rings, `ColorsSection`, `AnimationSection`.
- `PreviewCanvas.svelte` holds a fixed **600×600** paper.js canvas and an existing
  **Export SVG** button below it.
- The render pipeline fits the mark to `min(viewport.width, viewport.height) - padding`,
  centered — so a non-square canvas naturally letterboxes the (round) mark.
- The animation runs on a `requestAnimationFrame` loop in `animation.svelte.ts`.
- No aspect-ratio state exists today.

## Feature 1 — Canvas aspect ratio

### State
- New `aspectRatio` field (e.g. `'1:1'`) on the composition/settings state, default `'1:1'`.
- Persisted alongside the other settings.

### UI
- New collapsible **Canvas** section in the sidebar (sibling of Settings/Colors/Animation).
- Inside: a selector offering the 7 ratios: `1:1, 3:4, 4:3, 4:5, 5:4, 9:16, 16:9`.

### Canvas sizing
- The preview canvas fits inside a square whose **long side is ~600px**.
- `ratioToCanvasSize(ratio, longSide)` → `{ width, height }`. Examples:
  - `1:1` → 600×600
  - `16:9` → 600×337
  - `9:16` → 337×600
  - `4:5` → 480×600, `5:4` → 600×480, `3:4` → 450×600, `4:3` → 600×450
- The mark stays round, **centered** in the box (the pipeline already fits to the
  smaller dimension with padding); extra space on the long axis is empty (letterbox).

### Defaults
- Initial ratio `1:1`, long side `600`px.

## Feature 2 — Animation export (WebM, real-time capture)

### UI (below the canvas, where Export SVG lives)
- `Export SVG` — unchanged.
- Below it:
  - **Durata (s)** numeric field, default **5**.
  - **Audio** on/off toggle, default **off**.
  - **Export Animation** button.
- During capture: a **"Rendering… NN%"** progress bar replaces the button; when capture
  finishes the `.webm` downloads automatically (`animation.webm`).

### Mechanism (real-time)
1. On click: if the animation is stopped, start it (Play).
2. Grab the canvas element → `canvas.captureStream(30)` (30 fps).
3. If **audio = on** and a real source (file/mic) is active, connect its audio track to
   the stream (via a `MediaStreamAudioDestinationNode`). Demo has no real audio → silent
   regardless.
4. `MediaRecorder(stream, 'video/webm')` records for *N* seconds; progress = `elapsed / duration`.
5. On finish: stop, build the `Blob`, trigger download (`animation.webm`).

The export takes as long as the chosen duration (live capture, not offline render).

### Behavior per mode
- **simple / dataSeries:** records N seconds of the loop (may span multiple/partial cycles).
- **audioZones / audioBars demo:** synthetic motion, silent video.
- **mic / file:** live; audio included when the toggle is on.

### Export state
- A small export state: `idle` | `rendering` + progress `0..1`.
- One export at a time: while rendering, the export buttons and the aspect-ratio
  selector are disabled.
- **Persistence:** `aspectRatio` is persisted (it changes the artwork's frame). The
  export **duration** and **audio toggle** are transient local UI state, reset to their
  defaults (5s / off) each session.

## Edge cases / errors

- **Safari / unsupported browsers:** WebM via `MediaRecorder` is poorly/unsupported.
  Feature-detect; if unavailable, disable **Export Animation** with a "non supportato dal
  browser" note. (Chrome/Firefox supported.)
- Empty canvas → no-op (same guard as Export SVG).
- Aspect-ratio change and other exports are blocked while a render is in progress.
- Audio toggle on but no real source (demo/off) → silent video, no error.
- Recorder error → caught, state returns to `idle`, message surfaced.
- Cleanup: revoke the blob object URL after download; disconnect the audio node.

## Component structure (isolated, testable units)

- **`aspect-ratio.ts`** — pure `ratioToCanvasSize(ratio, longSide)` → `{ width, height }`.
- **`aspectRatio` state + setter** — persisted with the other settings.
- **`CanvasSection.svelte`** — the ratio selector in the sidebar.
- **`canvas-export`** — capture orchestrator: receives the canvas element + options,
  exposes progress. Thin DOM/`MediaRecorder` glue; the logic (duration→progress, filename,
  `idle→rendering→idle` transitions) is isolated and unit-testable.
- **`PreviewCanvas.svelte`** — wires the canvas size to `aspectRatio`; adds the export UI
  (duration field, audio toggle, button, progress bar).

## Testing

- **Unit:**
  - `ratioToCanvasSize` for all 7 ratios (correct dimensions, long side = 600).
  - `aspectRatio` setter / persistence.
  - export progress/duration logic + state transitions (`idle→rendering→idle`).
- **Manual verify** (browser-API capture layer is thin): switching ratios reshapes the
  canvas; Export Animation downloads a playable `.webm`; progress bar advances; audio
  toggle includes/excludes sound.

## Out of scope (YAGNI for now)

- MP4 / PNG-sequence export (WebM only).
- FPS selector (fixed at 30).
- Per-track timeline / trim (the old p5 repo had this; not needed here).
- Fixing the path-editor point-coupling bug (tracked separately, parked by user).
