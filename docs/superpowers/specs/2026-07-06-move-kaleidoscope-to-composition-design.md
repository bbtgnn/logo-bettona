# Move Kaleidoscope panel to Composition — design

**Date:** 2026-07-06
**Branch:** off `main` (second "trasloco" of the four-section restructure)
**Precedes:** continues `2026-07-06-move-canvas-to-composition-design.md`

## Goal

The Kaleidoscope panel currently renders in **two** places — Editor
(`animatable={false}`, static) and Animate (`animatable=true`, audio). That
duplication confuses. Give the kaleidoscope a single home in **Composition**, in
its **static** form, and introduce a Poster/Caleidoscopio layout switch there.
The audio-reactivity controls stay in Animate as a slim remainder.

Guiding rule: **move the view, do not rewrite the logic.** State, setters, and
the render pipeline are untouched.

## Non-negotiable constraints

1. **Saved config survives.** Kaleidoscope state lives in the global module
   `$lib/state/kaleidoscope.svelte` (`kaleidoscope` `$state`), not per-page. The
   panels are views onto it. Moving a view cannot change the state → any saved
   configuration is found identical. No migration needed.
2. **Audio animation keeps working** on the kaleidoscope scene even though its
   config panel now lives in Composition. The animation is driven by
   `preview-presenter.svelte.ts` / the render pipeline reading `kaleidoscope.*`
   and `animationState.layers.kaleidoscope` globals — none of which move. The
   two audio-only UI toggles (layer gate + live tile) keep a home in Animate
   (see below), so nothing about the audio path changes.

## Core mechanic: the switch IS `kaleidoscope.enabled`

No new state. The Poster/Caleidoscopio segmented control maps onto the existing
`kaleidoscope.enabled` flag:

- **Poster** → `enabled: false` → `preview-presenter` paints the flat
  composition to the visible canvas (the single mark). Already the default and
  already works (`preview-presenter.svelte.ts` guards `if (kaleidoscope.enabled)`
  around the kaleidoscope rAF loop).
- **Caleidoscopio** → `enabled: true` → the kaleidoscope rAF loop becomes the
  sole writer of the visible canvas. Already works.

So the segmented control **replaces** the current "Kaleidoscope mode" checkbox
(`m.editor_kaleido_mode`). It calls the existing `setKaleidoscopeEnabled(v)`.
Poster is the default (`enabled` starts `false`).

Poster mode is intentionally minimal this PR: it shows the single mark and
**no** poster-specific controls. A short hint line only. Richer poster controls
land in a future PR.

## Component structure (approach A — split into focused components)

Today `KaleidoscopeSection.svelte` crams three concerns behind the `animatable`
flag: the enabled checkbox, the static look (sliders + circular mask), and the
audio controls (layer gate + live tile). The move splits these across two
sections and one switch. We split the component to match:

### New: `LayoutModeSwitch.svelte`
- Segmented control: **Poster** | **Caleidoscopio**.
- Reads `kaleidoscope.enabled`, writes via `setKaleidoscopeEnabled`.
- Lives in Composition, directly under `CanvasSection`.

### New: `KaleidoscopePanel.svelte` (static look)
- Rendered in Composition **only when Caleidoscopio is selected**
  (`kaleidoscope.enabled === true`).
- Contents: the eight static `KALEIDO_PARAMS` sliders
  (`<AnimatableSlider {param} animatable={false} />`) + the **Circular mask**
  checkbox.
- **No** enabled checkbox (the switch owns `enabled`).
- **No** audio rows (layer gate, live tile).

### New: `KaleidoscopeAudioSection.svelte` (audio remainder)
- Rendered in Animate.
- Contents: the **Layer attivo** checkbox
  (`data-testid="layer-toggle-kaleidoscope"`, `animationState.layers.kaleidoscope`
  via `setLayerEnabled('kaleidoscope', …)`) and the **Live tile da audio**
  checkbox (`kaleidoscope.liveTile` via `setLiveTile`).
- Wrapped in a `SidebarCollapsible` titled "Caleidoscopio (audio)".

### Deleted: `KaleidoscopeSection.svelte` (+ its spec)
- Its behaviour is fully re-homed into the three files above. Its spec coverage
  is recycled into the new components' specs.

## Wiring

- **`(app)/composition/+page.svelte`** — after `<CanvasSection />`, add
  `<LayoutModeSwitch />` and, gated on `kaleidoscope.enabled`,
  `<KaleidoscopePanel />`.
- **`(app)/animate/+page.svelte`** — replace `<KaleidoscopeSection />` with
  `<KaleidoscopeAudioSection />`. Other sections unchanged.
- **`(app)/editor/+page.svelte`** — remove `<KaleidoscopeSection animatable={false} />`
  and its import. Editor keeps Settings, Rings, Colors.

## i18n

Kaleidoscope panel message keys reused as-is where the label is unchanged
(`editor_kaleido_circular_mask`, `editor_kaleido_live_tile_audio`,
`animate_kaleidoscope_layer_toggle`, the `KALEIDO_PARAMS` slider labels). The
static panel's `SidebarCollapsible` title reuses `editor_kaleidoscope`.

New keys (added to `messages/en.json` and `messages/it.json`, then
`bun run paraglide`):

- `composition_layout` — section label "Layout".
- `composition_layout_poster` — "Poster".
- `composition_layout_kaleidoscope` — "Caleidoscopio" / "Kaleidoscope".
- `composition_poster_hint` — "Single mark, no controls yet".
- `animate_kaleidoscope_audio` — "Caleidoscopio (audio)" section title.

The pre-existing `editor_*` naming smell (keys prefixed `editor_` now used in
Composition) is **out of scope**, same call as the previous trasloco — renaming
touches every locale and is deferred.

## Testing

- **`KaleidoscopePanel.svelte.spec.ts`** (browser, `.svelte.spec.ts`) — renders,
  shows the static sliders + circular mask, does NOT render enabled/layer/liveTile.
- **`KaleidoscopeAudioSection.svelte.spec.ts`** — renders the layer toggle
  (`layer-toggle-kaleidoscope`) and live-tile checkbox; toggling flips state.
- **`LayoutModeSwitch.svelte.spec.ts`** — Poster active when `enabled=false`,
  Caleidoscopio active when `enabled=true`; clicking flips `kaleidoscope.enabled`.
- **`(app)/composition/page.svelte.spec.ts`** — extend: switch present; panel
  appears only in Caleidoscopio mode.
- **`(app)/animate/page.svelte.spec.ts`** — audio section present; no static
  slider/circular-mask rows.
- **`(app)/editor/page.svelte.spec.ts`** — no kaleidoscope UI.
- Delete `KaleidoscopeSection.svelte.spec.ts` (behaviour moved).
- Per the vitest routing note: DOM/PointerEvent tests must be named
  `*.svelte.spec.ts` (browser); plain `*.spec.ts` runs in node.
- Composition specs mock `./composition` for ring ids/state — read from the mock,
  not composition-persistence (existing convention).

## Verification (run before handing back)

- `bun run paraglide` (compile new `m.*` keys) — or `bun run check`, which
  compiles first.
- `bun run check` → 0 errors, 0 warnings.
- `bun run test:unit -- --run` → all green.
- `bunx playwright test workspace-nav` → green (nav untouched but cheap to confirm).
- Svelte MCP `svelte-autofixer` on every new/edited `.svelte` file until clean
  (CLAUDE.md mandate).

## Out of scope

- Poster-specific controls (future PR).
- Renaming `editor_*` message keys.
- Any change to animation logic, the render pipeline, or export.

## Delivery

Small commits, project checks each step. At the end: list the touched files and
stop — the user handles the final commit / PR.
