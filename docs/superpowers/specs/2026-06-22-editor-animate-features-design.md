# Editor & Animate features — PNG export + Audio Zones per-ring preview — design

**Date:** 2026-06-22
**Branch:** `feat/kaleidoscope`
**Status:** approved (design), pending implementation plan

## Context

The "feature phase" of the editor/animate QA batch (bugs already fixed and merged on
this branch). Two independent features:

- **A — PNG export with a background toggle** (Editor #3). Add a PNG export alongside
  the existing SVG export, with a "include background" toggle that applies to **both**
  PNG and SVG, and a PNG resolution selector (1x / 2x / 4x).
- **B — Audio Zones per-ring preview** (Animate #4). Wire the existing
  `RingZoneConfigItem` + `ZonePreview` into `AudioZonesSection`, mirroring how
  `AudioBarsSection` uses `RingWaveConfigItem` + `WavePreview`; translate the
  hardcoded English strings.

Still deferred (separate phase): the morph-target relocation from Editor to Animate
(Animate #2), which is also the definitive fix for the editor curve bug.

## Current state (verified)

- `PreviewCanvas.svelte` renders the canvas and an "Export SVG" button (always) plus
  "Export animation" (animate route only). `animate` prop marks the route.
- `preview-presenter.svelte.ts`:
  - `exportSvg()` — flat mode exports `scope.project` (which includes a
    `preview-background`-named rect added on every flat render); kaleidoscope mode calls
    `exportKaleidoscopeSvg()` → `generateKaleidoscopeSVG(tileSvg, kaleidoParams(), frame)`.
  - `kaleidoParams()` returns `{ ...kaleidoscope, backgroundColor }`; `drawBackground`
    is a derived getter (`!tileBackground`); `kaleidoscopeLayout` already emits a `null`
    background when `drawBackground` is false.
  - The flat render uses `pipeline.render({ composition, scope, ignoreMorph, viewport, restFit })`
    then adds the `preview-background` rect; `renderTile()` builds the offscreen
    kaleidoscope tile; `renderKaleidoscopeToCanvas(ctx, tile, w, h, params, frame)` paints
    the kaleidoscope (fills `params.backgroundColor` only when `drawBackground`).
  - `ratioToCanvasSize(aspectRatio, CANVAS_LONG_SIDE=600)` maps the ratio to pixel dims.
- `AudioBarsSection.svelte`: per-ring block `{#each composition.rings}` →
  `RingWaveConfigItem {ring} index globalDefault` where `globalDefault` is a `$derived`
  WaveConfig from `animationState.audioBars`.
- `AudioZonesSection.svelte`: has the audio-source picker, input meter, and the global
  band-intensity sliders (`getAudioZonesParams()`), but **no** per-ring block.
- `RingZoneConfigItem.svelte` + `ZonePreview.svelte` exist and are correct, but
  `RingZoneConfigItem` has hardcoded English ("Ring", "(custom)", "Customize zones for
  this ring", "Bass/Mid/Treble intensity") and is not imported anywhere in the section.
- Global default zone intensity lives at `animationState.audioZones.defaultIntensity`
  (type `ZoneIntensity = { bass; mid; treble }`); `resolveZoneIntensity(ring, def)`
  resolves a ring's effective intensity.

## Feature A — PNG export + background toggle

### UI (`PreviewCanvas.svelte`)

Next to "Export SVG", always (both routes):

- An **Export PNG** button.
- An **Include background** checkbox. Its state is passed to both export paths.
- A **resolution selector** (1x / 2x / 4x) used by PNG only.

Component-local `$state`: `includeBackground = true` (default on), `pngScale = 1`.
Both export buttons stay disabled while `exportStatus.rendering` (matching Export SVG).

### Presenter API (`preview-presenter.svelte.ts`)

Change the exported surface:

- `exportSvg(opts?: { includeBackground?: boolean })` — default `includeBackground` true
  (preserves current behavior when called with no args).
  - Flat: if `includeBackground` is false, export the composition WITHOUT the
    `preview-background` rect. Implementation: locate the `preview-background` child in
    the active layer, `remove()` it, run `project.exportSVG`, then re-insert it
    (`addChild` + `sendToBack`). The removal/export/re-insert is synchronous and never
    calls `view.update()`, so the visible canvas does not flicker. If `includeBackground`
    is true, behavior is unchanged.
  - Kaleidoscope: pass an explicit `drawBackground` into the params used by
    `exportKaleidoscopeSvg` — when `includeBackground` is false, generate the SVG with a
    `null` background (override `drawBackground` to false in the params object). When
    true, current behavior.
- `exportPng(opts: { includeBackground: boolean; scale: number })` — new.
  - Compute `{ width, height } = ratioToCanvasSize(composition.aspectRatio, CANVAS_LONG_SIDE * scale)`.
  - Create a fresh offscreen `<canvas>` at `width × height` (transparent by default).
  - Flat: set up a temporary paper scope on the offscreen canvas; `pipeline.render`
    with `viewport = { width, height, padding: 32 * scale }` and the same `ignoreMorph` /
    `restFit` rules the visible flat render uses; if `includeBackground`, add a
    palette-colored rect sized to the view and `sendToBack`. Export via
    `offscreen.toDataURL('image/png')`. Dispose the temp scope.
  - Kaleidoscope: `renderTile()` to get the source tile, then
    `renderKaleidoscopeToCanvas(ctx, tile, tile.width, tile.height, params, { width, height })`
    where `params` is `kaleidoParams()` with `drawBackground` forced to `includeBackground`.
    Export via `offscreen.toDataURL('image/png')`.
  - Download as `composition.png` (flat) / `kaleidoscope.png` (kaleidoscope) using the
    existing `downloadSvg`-style anchor-click helper (rename/generalize to `downloadDataUrl`
    or add a sibling; reuse the same URL/anchor pattern).
  - Transparency: because the offscreen canvas starts transparent and the background is
    only painted when `includeBackground`, "no background" yields a transparent PNG in
    both modes.

`PreviewCanvas` wires the new button/checkbox/select to `exportPng` / `exportSvg`.

### Acceptance (A)

- Export PNG button appears next to Export SVG on both Editor and Animate.
- PNG downloads at 1x/2x/4x → pixel dimensions scale accordingly (long side ≈ 600 × scale).
- "Include background" off → exported PNG is transparent (no background painted); on →
  background present. Same toggle controls SVG background (flat: no `preview-background`
  rect in the output; kaleidoscope: no background rect in the SVG).
- The visible canvas does not flicker during SVG export with background off.
- Existing Export SVG behavior (called with background on / no args) is unchanged.

## Feature B — Audio Zones per-ring preview

### `AudioZonesSection.svelte`

Add a per-ring block after the global band sliders, mirroring `AudioBarsSection`:

```svelte
<div class="flex flex-col gap-1">
	<p class="text-[11px] font-medium text-muted-foreground">{m.animate_zones_per_ring()}</p>
	{#each composition.rings as ring, i (i)}
		<RingZoneConfigItem {ring} index={i} globalDefault={animationState.audioZones.defaultIntensity} />
	{/each}
</div>
```

Imports added: `composition` from `$lib/state/composition`, `RingZoneConfigItem`.

### `RingZoneConfigItem.svelte` — i18n

Replace hardcoded English with message keys. Reuse existing keys where present:

- `Ring {n}` → `m.editor_ring_label({ index: index + 1 })` (already used by bars).
- `(custom)` badge → `m.animate_custom()` (already used by bars).

New keys (add to BOTH `messages/en.json` and `messages/it.json`):

- `animate_zones_per_ring` — EN "Per-ring intensity" / IT "Intensità per anello"
- `animate_customize_zones` — EN "Customize zones for this ring" / IT "Personalizza le zone per questo anello"
- `animate_zone_bass` — EN "Bass intensity" / IT "Intensità bassi"
- `animate_zone_mid` — EN "Mid intensity" / IT "Intensità medi"
- `animate_zone_treble` — EN "Treble intensity" / IT "Intensità alti"

### Acceptance (B)

- `AudioZonesSection` renders one `RingZoneConfigItem` (with its `ZonePreview`) per ring,
  below the global band sliders.
- Each item resolves its preview/intensity from `animationState.audioZones.defaultIntensity`
  via `resolveZoneIntensity`, and toggling "customize" persists a per-ring `zoneConfig`.
- No hardcoded English remains in `RingZoneConfigItem`; EN and IT both render their copy.

## Out of scope

- Morph-target relocation (Animate #2) and the definitive editor-curve fix.
- Any change to the kaleidoscope tile-background (`tileBackground`) control semantics.
- PNG/SVG export of anything other than the current preview (no batch/sprite export).

## Testing notes

- **A (PNG/SVG):**
  - SVG background toggle — assert on the emitted SVG string: flat no-bg output contains
    no `preview-background` rect; kaleidoscope no-bg output contains no background `<rect>`.
    Use the existing download-spy pattern (override `HTMLAnchorElement.prototype.click`),
    plus capture the generated SVG (e.g. spy on the blob/text) or assert via a small
    pure helper if extracted.
  - PNG — spy the download to assert filename (`composition.png` / `kaleidoscope.png`)
    and that scale changes the offscreen dimensions (assert the offscreen canvas
    width/height, e.g. by having `exportPng` testable or checking the produced dataURL's
    decoded size). Assert `includeBackground=false` produces a transparent corner pixel
    where feasible; otherwise assert the background-paint branch is not taken.
  - Component — `PreviewCanvas` shows Export PNG + the checkbox + the resolution select
    on both routes; buttons disabled while `exportStatus.rendering`.
- **B (zones):** `AudioZonesSection` browser test renders a `RingZoneConfigItem`
  (assert its `ZonePreview` / a per-ring testid) per ring; i18n — assert IT and EN copy
  for the new keys; `messages-parity` test must stay green (keys added to both files).
- Gates: `bun run check`, `bun run test:unit -- run`, `bunx playwright test`, and
  svelte-autofixer `issues: []` on every touched `.svelte` / `.svelte.ts`.
- Add EN+IT keys together (paraglide recompiles on `check`/`prepare`; a first run after
  editing `messages/*.json` can transiently fail — rerun).
