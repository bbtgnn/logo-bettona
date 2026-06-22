# Morph-target relocation: Editor → Animate (Simple) — design

**Date:** 2026-06-22
**Branch:** `feat/kaleidoscope`
**Status:** approved (design), pending implementation plan

## Context

Final phase of the editor/animate QA batch. The morph-target mechanic (a ring's
secondary template path + the blend amount `morphT`) currently lives in the **Editor**
(`RingEditor.svelte`): a primary/secondary variant toggle, a secondary path editor,
Create/Remove morph buttons, and import/library apply to the secondary. The blend
slider (`morphT`) already moved to the Animate **Simple** window in a prior phase.

This phase moves the **whole** morph mechanic out of the Editor into the Animate Simple
window, leaving the Editor to draw only the primary shape. This also makes the editor
curve-editing bug (Editor #2) fix **definitive**: with the Editor editing only the
primary, the `updateRingPathVariant` primary re-seed (introduced earlier as a stopgap)
becomes the permanent, correct behavior — primary curves are always editable, and the
morph pair stays interpolatable.

User decisions (this phase):
- Morph editing home = the **Simple** section (the layer that means "morph between shapes").
- Bring the **full** toolkit to Animate: create + secondary path editor + import SVG +
  load-from-library (secondary) + `morphT` slider + remove.
- Editor library access = **primary only** (the secondary/both slots leave the Editor).

## State layer — unchanged

`src/lib/state/composition.ts` already exposes everything needed; no signature changes:
- `createRingMorphTarget(index)` — clones primary → secondary.
- `removeRingMorphTarget(index)` — clears secondary, resets `morphT` to 0.
- `updateRingPathVariant(index, variant, path)` — primary edits re-seed an incompatible
  secondary (this stopgap is now the **permanent** behavior); secondary edits stay
  strictly compatibility-checked against the primary.
- `setRingMorphT(index, t)`.

Render pipeline and the Simple driver are unchanged (they read `secondaryTemplatePath` +
`morphT`).

## Component changes

### `RingEditor.svelte` — strip to primary-only

Remove:
- the primary/secondary variant toggle (the two `editor_ring_primary`/`_secondary`
  buttons) and the `editVariant` state;
- the `{#key editVariant}` wrapper — `RingCanvas` now always edits `ring.templatePath`
  (the primary), label `m.editor_path_editor()`;
- the **Create morph target** / **Remove morph target** buttons;
- the `morphInactive` derived and all its gating;
- the file-import-to-secondary branch — `handleFileChange` always targets the primary
  (`updateRingPathVariant(index, 'primary', path)`);
- the secondary library-apply logic in `handleApplyFromLibrary`.

Keep: primary path editor, copies, ring height, color, import SVG (primary),
Save to library (still saves primary + any existing secondary), Load from library
(primary only — see below).

### `LibraryPickerSheet.svelte` — selectable slots

Add an optional prop `slots?: ApplySlot[]` (default `['template', 'secondary', 'both']`,
preserving current behavior). Render only the radio options present in `slots`. When
`slots` has a single entry, skip the slot fieldset entirely and apply that slot directly
on confirm. The Editor passes `slots={['template']}` (primary only). The new Animate
morph editor passes `slots={['secondary', 'both']}`.

`handleApplyFromLibrary` in the Editor keeps only the `template` branch.

### `RingMorphConfigItem.svelte` — NEW (per-ring morph editor, Animate)

Mirrors `RingWaveConfigItem` / `RingZoneConfigItem`. Props: `{ ring: Ring; index: number }`.
Root carries `data-testid="ring-morph-config-{index}"`. Inside a collapsible (ring label
via `m.editor_ring_label({ index: index + 1 })`):

- When `ring.secondaryTemplatePath == null`: a **Create morph target** button
  (`m.editor_create_morph()` → `createRingMorphTarget(index)`).
- When it exists:
  - a secondary path editor — `RingCanvas` bound to `ring.secondaryTemplatePath`, label
    `m.editor_path_editor_secondary()`, `onchange` → `updateRingPathVariant(index, 'secondary', path)`
    (errors surfaced like the Editor does today);
  - **Import SVG** (to secondary) — same input pattern as `RingEditor`, applying to the
    `secondary` variant;
  - **Load from library** — `LibraryPickerSheet slots={['secondary', 'both']}`, applying
    via `updateRingPathVariant(index, 'secondary'|'both', ...)` (reuse the Editor's
    current `handleApplyFromLibrary` secondary/both logic, including the `'both'` path
    that may `removeRingMorphTarget` when the entry has no secondary);
  - the **morphT** slider (moved from the current SimpleSection inline block);
  - a **Remove morph target** button (`m.editor_remove_morph()` → `removeRingMorphTarget(index)`).

This isolates the morph UI in one focused, testable unit instead of growing
`SimpleSection`.

### `SimpleSection.svelte` — host the morph editors

Keep the layer toggle (`layer-toggle-simple`). Replace the current
`morphRings`-filtered, morphT-only list with one `RingMorphConfigItem` per ring:

```svelte
{#each composition.rings as ring, i (i)}
	<RingMorphConfigItem {ring} index={i} />
{/each}
```

When there are no rings, show a hint pointing to the Editor to add rings
(reword `animate_simple_empty`, e.g. "Add a ring in the Editor, then create a morph
target here."). The old "draw a second shape in the editor" wording no longer applies.

## i18n

Reuse existing keys: `editor_create_morph`, `editor_remove_morph`, `editor_path_editor`,
`editor_path_editor_secondary`, `editor_import_svg`, `editor_load_from_library`,
`editor_ring_label`, `editor_morph_t` (or the existing morphT label used in SimpleSection),
`slot_*`, `common_*`.

Reword (EN+IT): `animate_simple_empty` to the "add a ring then create a morph" hint.
Add new keys only if a label has no existing equivalent (keep to a minimum; add to BOTH
`messages/en.json` and `messages/it.json`).

## Testing

- `RingEditor.svelte.spec.ts`: assert the morph controls are GONE — no "Primary"/
  "Secondary" variant toggle, no "Create morph target" button; the primary path editor
  (`m.editor_path_editor()`) is present; copies/ring-height/color still present.
- `RingMorphConfigItem.svelte.spec.ts` (NEW): create → secondary editor + morphT +
  Remove appear; remove → back to Create; morphT slider drives `setRingMorphT`; import
  and library apply target the secondary.
- `SimpleSection.svelte.spec.ts`: one `ring-morph-config-{i}` per ring; layer toggle
  still toggles `layers.simple`; empty-state hint when no rings.
- `LibraryPickerSheet.svelte.spec.ts`: with `slots={['template']}` the slot fieldset is
  absent and confirm applies `template`; default still shows all three.
- **demo e2e** (`src/routes/demo/playwright/page.svelte.e2e.ts`, the "creates and removes
  ring morph target controls" test): rewrite to exercise morph in the Animate Simple
  window instead of the Editor — add a ring in the Editor, navigate to `/animate`, open
  the Simple section, Create morph target, assert Remove appears, Remove, assert Create
  returns. (e2e runs in English.)
- Gates: `bun run check`, `bun run test:unit -- run`, `bunx playwright test`, and
  svelte-autofixer `issues: []` on every touched `.svelte`.

## Out of scope

- Any change to `composition.ts` morph semantics (the re-seed stays as-is, now permanent).
- Render-pipeline / driver changes.
- Data Series, audio layers, kaleidoscope.
- Path Library page (`ApplyToRingSheet`) — unchanged; only the in-sidebar
  `LibraryPickerSheet` gains the `slots` prop.

## Acceptance

- The Editor shows only primary-shape controls; editing primary curves always works,
  including on rings that have a morph target.
- The Animate Simple window lets you create, draw (drag nodes), import-SVG, library-load,
  blend (`morphT`), and remove a morph target per ring — full parity with the old Editor
  morph toolkit.
- No morph UI remains in the Editor; the Simple driver animates exactly as before.
- All gates green; the demo e2e exercises morph in its new home.
