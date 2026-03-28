done: false
---

## Parent PRD

prds/color-management/index.md

## What to build

A pure, side-effect-free color application engine: a function that takes a color mode, the active palette entry, and ring count, and returns an array of hex color strings (one per ring, outermost-first).

This module has zero Svelte or store dependencies and is designed for isolated unit testing. See the Implementation Decisions section of the parent PRD for the full logic spec (monochrome alternation, palette looping, no-adjacent constraint, manual no-op).

## Acceptance criteria

- [ ] Function accepts `(mode, paletteEntry, currentRingColors, ringCount)` and returns `string[]`
- [ ] Monochrome: outermost ring (last index) = `main`, strict alternation inward
- [ ] Palette: random assignment, no two adjacent rings share the same color, loops when palette shorter than ring count
- [ ] Palette with 1 color: all rings receive that color
- [ ] Manual: returns current `Ring.color` values unchanged
- [ ] Hex validation: invalid entries skipped; fallback to `['#000000', '#ffffff']` if no valid colors remain
- [ ] Unit tests cover: monochrome even/odd ring count, palette looping, palette 1-color edge case, no-adjacent constraint (run multiple times), manual no-op, hex validation fallback
- [ ] All tests pass with `bun test`

## Blocked by

- Blocked by `prds/color-management/issues/01-foundation-types-defaults-store.md`

## User stories addressed

- User story 5
- User story 6
- User story 9
- User story 10
- User story 11
- User story 18
- User story 19
- User story 22
- User story 27
