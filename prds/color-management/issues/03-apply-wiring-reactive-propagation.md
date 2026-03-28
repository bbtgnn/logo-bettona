done: false
---

## Parent PRD

prds/color-management/index.md

## What to build

Wire the color application engine into the composition state so that color changes propagate reactively to `Ring.color` whenever relevant state changes. Add an `applyColorMode()` function to the composition state module and ensure it is called in all the right situations.

This slice bridges the pure engine (issue #2) and the UI (issue #4). After this slice, changing the color mode store or palette data will immediately rewrite all ring colors and trigger a canvas redraw — with no UI built yet.

## Acceptance criteria

- [ ] `applyColorMode()` calls the engine and writes results into each `Ring.color` via `updateRing()`
- [ ] `applyColorMode()` is triggered when: mode changes, palette index changes, palette content changes, rings are added or removed
- [ ] A `reshuffle()` function exists that re-runs palette randomization and writes new colors (only meaningful in Palette mode, no-op otherwise)
- [ ] Out-of-bounds palette index is clamped to 0 when switching modes
- [ ] Switching to Manual mode does not overwrite ring colors (no-op)
- [ ] TypeScript compiles with no errors

## Blocked by

- Blocked by `prds/color-management/issues/01-foundation-types-defaults-store.md`
- Blocked by `prds/color-management/issues/02-color-application-engine.md`

## User stories addressed

- User story 3
- User story 11
- User story 12
- User story 26
