done: false
---

## Parent PRD

prds/shape-editor/index.md

## What to build

Build the `RingEditor` collapsible panel component and wire up all ring parameters. Each ring in the sidebar renders as a collapsible panel. When collapsed, it shows only a title/handle. When expanded, it shows: a `copies` integer input (min 1), a `ringHeight` slider (0–1), and a color picker. A delete button removes the ring from the composition. Rings can be drag-to-reordered in the sidebar.

Collapse/expand state per ring is persisted via the UI state store from issue 01.

No SVG upload or canvas in this slice — that comes in issue 04.

See the **`components/RingEditor.svelte`** and **`components/Sidebar.svelte`** sections of the parent PRD.

## Acceptance criteria

- [ ] Each ring renders as a collapsible panel in the sidebar
- [ ] Collapse/expand state persists across page refreshes
- [ ] `copies` input (integer, min 1) updates the ring in the store
- [ ] `ringHeight` slider (0.0–1.0) updates the ring in the store
- [ ] Color picker updates the ring color in the store
- [ ] Delete button removes the ring and its panel from the sidebar
- [ ] Rings can be reordered via drag-and-drop; new order is reflected in the store
- [ ] Ring at index 0 is understood as the innermost ring (ordering semantics established)

## Blocked by

- Blocked by `prds/shape-editor/issues/02-app-scaffold-sidebar-shell.md`

## User stories addressed

- User story 7 (set number of copies)
- User story 8 (set ring height via slider)
- User story 9 (set ring color)
- User story 10 (collapse/expand ring panel)
- User story 11 (reorder rings)
- User story 12 (index 0 = innermost ring)
- User story 19 (delete a ring)
- User story 27 (per-ring canvas only renders when expanded)
