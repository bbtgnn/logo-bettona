# Sidebar shells — design (candidate 06)

**Date:** 2026-06-24
**Branch:** `feat/kaleidoscope`
**Status:** approved design, pre-plan

## Goal

Remove the real duplication in the animate sidebar by extracting shared shells,
**without changing any runtime behavior or visible UI**. This is a pure
refactor (a "trasloco"): the same controls, the same values written to state,
the same on-screen appearance. The existing component specs are the safety net —
they must stay green.

## Problem (current duplication)

### Group A — per-ring config items

`RingMorphConfigItem`, `RingWaveConfigItem`, `RingZoneConfigItem` each
hand-roll the same collapsible shell:

- `<div class="rounded border bg-background">` wrapper (+ optional testid)
- `Collapsible.Collapsible bind:open` with `open = $state(false)`
- a trigger row: `CaretDown`/`CaretRight` toggle + `m.editor_ring_label({ index: index + 1 })`
- an optional "custom" badge (`m.animate_custom()`) shown when an override is set
- `CollapsibleContent class="space-y-3 px-3 pb-3"`

`RingWaveConfigItem` and `RingZoneConfigItem` are near-identical twins. Beyond
the shell they share:

- a preview component at the top (differs: `WavePreview` vs `ZonePreview`)
- an "override" checkbox toggling `waveConfig` / `zoneConfig` between
  `{ ...globalDefault }` and `null`
- exactly three native `<input type="range">` sliders, each writing
  `updateRing(index, { <key>: { ...config, <field>: Number(value) } })`

They differ only in: the preview, the three slider specs (label / min / max /
step / field), the config key, the resolve function, the customize label, and
the testid.

`RingMorphConfigItem` shares only the shell; its body is richer (library picker,
SVG import, canvas editor, morphT slider) and stays as-is.

### Group B — audio layer sections

`AudioBarsSection` and `AudioZonesSection` share ~60%:

- the input-level meter `$effect` (identical: RAF-polls `audioSource.readLevel()`
  while `showInputLevel`)
- `showInputLevel` derived (differs only in the layer key)
- `inputLevelPercent` derived
- the `SidebarCollapsible` wrapper + a `layer-toggle-<key>` checkbox
- the audio-source `<select>` (identical options; differs only in element `id`)
- the "mic listening" hint, the `file` → `AudioFilePanel` branch
- a list of `AnimatableSlider`s over the layer's params

They differ in: layer key, params source (`getAudioBarsParams` vs
`getAudioZonesParams`), the input hint message, and the per-ring section
(`RingWaveConfigItem` + `globalWaveDefault` vs `RingZoneConfigItem` +
`defaultIntensity`).

## Approved decisions

1. **Wave/Zone — "tanto":** extract a shared item that owns the shell **and** the
   override checkbox **and** the three sliders, driven by a small data list that
   stays declared explicitly inside each section. Slider numbers (min/max/step)
   remain in plain sight in `RingWaveConfigItem` / `RingZoneConfigItem`, not
   hidden inside the shell.
2. **Audio sections — yes:** extract a shared `AudioLayerSection` shell.
3. **Shell shared by all three:** `RingMorphConfigItem` also uses the shared
   collapsible shell (its rich body stays intact).

## Design

### New components

#### `RingConfigShell.svelte`

The collapsible frame. Props:

- `index: number`
- `badge?: boolean` — when true, render the `m.animate_custom()` badge in the trigger
- `testid?: string` — applied to the outer wrapper `data-testid` (omitted when undefined)
- `content: Snippet`

Renders: outer `<div class="rounded border bg-background">` (+ testid),
`Collapsible.Collapsible bind:open` (`open = $state(false)`), the caret + ring
label trigger row, optional badge, and `CollapsibleContent` with the existing
classes. No behavior beyond open/close.

#### `RingOverrideConfigItem.svelte`

Built on `RingConfigShell`. Owns the override checkbox + three-slider body.
Props:

- `index: number`
- `hasOverride: boolean`
- `onToggle: (enabled: boolean) => void` — parent maps to its `updateRing(... config ...)`
- `customizeLabel: string`
- `sliders: Array<{ id: string; label: string; min: number; max: number; step: number; value: number; oninput: (value: number) => void }>`
- `testid?: string`
- `preview: Snippet`

Renders inside the shell: the `preview` snippet, the override checkbox bound to
`hasOverride`/`onToggle`, and — when `hasOverride` — the `sliders` list as
labelled native range inputs (`for`/`id` wired from `slider.id`). `badge` on the
shell = `hasOverride`.

#### `AudioLayerSection.svelte`

Built on `SidebarCollapsible`. Props:

- `layerKey: 'audioBars' | 'audioZones'`
- `title: string`
- `params: AnimatableParam[]` — whatever `getAudio*Params()` returns
- `inputHint: string`
- `perRing: Snippet` — the layer's per-ring block (label + `#each rings` + config item)

Owns: the `layer-toggle-<layerKey>` checkbox, the audio-source `<select>`
(element id derived from `layerKey`), the input-level meter `$effect` + meter
markup (gated on `animationState.layers[layerKey] && audioSource === 'mic'`), the
mic-listening hint, the `file` → `AudioFilePanel` branch, and the `params`
`AnimatableSlider` list. Then renders the `perRing` snippet.

### Rewritten thin

- `RingMorphConfigItem` → wraps body in `RingConfigShell` (testid
  `ring-morph-config-{index}`, no badge). All morph logic unchanged.
- `RingWaveConfigItem` → builds its three slider specs + preview snippet, renders
  `RingOverrideConfigItem` (no testid — matches current).
- `RingZoneConfigItem` → same, testid `ring-zone-config-{index}`.
- `AudioBarsSection` → renders `AudioLayerSection` with a `perRing` snippet
  containing the wave-per-ring block (keeps its `globalWaveDefault` derived).
- `AudioZonesSection` → renders `AudioLayerSection` with a `perRing` snippet
  containing the zones-per-ring block.

## Invariants (must not change)

- **Testids preserved:** `ring-morph-config-{i}`, `ring-zone-config-{i}`,
  `layer-toggle-audioBars`, `layer-toggle-audioZones`. (Wave keeps no testid.)
- Slider ranges/steps/values and the exact `updateRing(...)` payloads.
- The override null/default toggle semantics.
- The input-level meter `role="meter"` + aria attributes.
- Visible layout, labels, and i18n keys.

## Testing strategy

- Existing component specs (`AudioBarsSection`, `AudioZonesSection`,
  `SimpleSection`, the animate page spec) and the e2e are the regression net —
  run them green at every step.
- Add focused specs for the new shells where they carry their own logic:
  - `RingConfigShell` — renders label, toggles open, shows/hides badge, applies testid.
  - `RingOverrideConfigItem` — checkbox calls `onToggle`; sliders call `oninput`
    with the numeric value; sliders hidden when `!hasOverride`.
  - `AudioLayerSection` — layer toggle wired; source select wired; meter shown
    only for `mic` + enabled layer.
- DOM/PointerEvent specs named `*.svelte.spec.ts` (browser project). Assert
  DOM/testid/role/text, not geometry (Tailwind inert in tests).

## Out of scope

- `AudioFilePanel`'s hand-rolled pointer capture (separate future candidate).
- Any change to animation/composition state, params, or geometry.
- Folding `SidebarCollapsible` and `RingConfigShell` into one (different visual
  role, default-open, and styling — kept separate).
