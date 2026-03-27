done: false
---

## Parent PRD

prds/shape-editor/index.md

## What to build

Define the core TypeScript types (`Path`, `Ring`, `Composition`) and wire up the `rune-sync` reactive state store that persists the full composition to localStorage. This is the data backbone that every other slice depends on.

The store exposes mutation helpers: add ring, remove ring, update ring fields, reorder rings (by index swap), and update composition-level params (`baseRadius`, `ringIncrement`). UI collapse state (which rings are expanded) is persisted separately under its own localStorage key.

Default composition on first load: `{ baseRadius: 100, ringIncrement: 50, rings: [] }`.

See the **Data Structures** and **`state/composition.ts`** sections of the parent PRD for the full spec.

## Acceptance criteria

- [ ] `Path`, `Ring`, and `Composition` TypeScript types are defined and exported
- [ ] `rune-sync` store initializes with default values when localStorage is empty
- [ ] Full `Composition` (including `Path` data) survives a page refresh via localStorage
- [ ] Mutation helpers exist for: add ring, remove ring, update ring, reorder rings, update `baseRadius`, update `ringIncrement`
- [ ] UI collapse state (expanded/collapsed per ring) is persisted in a separate localStorage key
- [ ] All types and store are importable from `$lib`

## Blocked by

None — can start immediately.

## User stories addressed

- User story 1 (create a new composition)
- User story 13 (set base radius)
- User story 14 (set ring increment)
- User story 20 (auto-save to localStorage)
- User story 21 (empty initial state)
