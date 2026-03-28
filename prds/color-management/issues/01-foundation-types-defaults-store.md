done: false
---

## Parent PRD

prds/color-management/index.md

## What to build

Extend the `Composition` type with two new palette lists (`monochromePalettes` and `fullPalettes`), update the default composition to include sensible starter palettes and default to Monochrome mode, and create a new `colorMode` lsSync store that tracks the active mode and palette index.

This slice establishes the data contract that all subsequent slices depend on. No UI or logic changes — only types, defaults, and the new store.

## Acceptance criteria

- [ ] `Composition` type includes `monochromePalettes: { main: string; bg: string }[]` and `fullPalettes: { colors: string[] }[]`
- [ ] Default composition includes at least one monochrome palette `{ main: '#000000', bg: '#ffffff' }` and at least two invented full palettes
- [ ] A new `colorMode` lsSync store is created with shape `{ mode: 'monochrome' | 'palette' | 'manual', palette: number }`
- [ ] Default color mode is `{ mode: 'monochrome', palette: 0 }`
- [ ] `Ring.color` is unchanged
- [ ] Existing localStorage data is not broken (new fields are additive with defaults)
- [ ] TypeScript compiles with no errors

## Blocked by

None — can start immediately.

## User stories addressed

- User story 1
- User story 2
- User story 29
