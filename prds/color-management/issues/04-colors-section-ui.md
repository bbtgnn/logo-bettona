done: false
---

## Parent PRD

prds/color-management/index.md

## What to build

The full Colors section UI in the sidebar: a collapsible section with a mode selector and mode-specific palette editors. Covers both the Monochrome editor (color pickers) and the Full Palette editor (text input, swatch rows, reshuffle). Also hides per-ring color pickers in non-manual modes.

See the Implementation Decisions section of the parent PRD for component breakdown (Colors Section, MonochromePaletteEditor, FullPaletteEditor) and UI behavior details.

## Acceptance criteria

- [ ] A collapsible "Colors" section appears at the top of the sidebar
- [ ] Section contains a mode selector for Monochrome / Palette / Manual
- [ ] **Monochrome mode**: shows swatch rows (two color boxes per row); clicking a row selects it; active row is visually distinguished; delete button per row disabled when only one remains; "New palette" button adds a default entry; selected palette shows two `<input type="color">` pickers labeled "Main" and "Background"
- [ ] **Palette mode**: shows swatch rows (N color boxes per row); clicking a row selects it; delete button per row disabled when only one remains; "New palette" button adds a default entry; selected palette shows an always-editable comma-separated hex text input; a live preview of parsed colors is shown below the input; reshuffle button triggers `reshuffle()` from issue #3
- [ ] **Manual mode**: no extra UI in the Colors section
- [ ] Per-ring color pickers in `RingEditor` are hidden when mode is not `manual`
- [ ] All interactions update the color mode store and/or composition, triggering reactive color propagation from issue #3
- [ ] UI renders without errors in all three modes

## Blocked by

- Blocked by `prds/color-management/issues/03-apply-wiring-reactive-propagation.md`

## User stories addressed

- User story 1
- User story 4
- User story 7
- User story 8
- User story 13
- User story 14
- User story 15
- User story 16
- User story 17
- User story 20
- User story 21
- User story 23
- User story 24
- User story 25
- User story 28
