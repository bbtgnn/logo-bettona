done: false
---

## Parent PRD

prds/shape-editor/index.md

## What to build

Build the single-page app shell: a SvelteKit `+page.svelte` with a shadcn sidebar on the left and a main content area on the right. The sidebar contains `baseRadius` and `ringIncrement` number inputs at the top (wired to the state store) and an "Add Ring" button that appends a new empty ring. The main area contains a fixed 600×600 canvas element (placeholder — no drawing yet). The ring list in the sidebar is rendered but empty.

See the **App scaffold** section of the parent PRD for layout details.

## Acceptance criteria

- [ ] Page renders with a left sidebar and a main content area
- [ ] `baseRadius` and `ringIncrement` inputs appear at the top of the sidebar and update the store on change
- [ ] "Add Ring" button adds a new ring to the store (with default values: `copies: 1`, `ringHeight: 0.5`, `color: '#000000'`, `templatePath: null`)
- [ ] A 600×600 canvas element is present in the main area (placeholder, not yet functional)
- [ ] Shadcn components are used for all UI primitives
- [ ] Adding multiple rings via the button results in multiple entries visible in the sidebar (even if just shown as empty placeholders)

## Blocked by

- Blocked by `prds/shape-editor/issues/01-foundation-types-state-persistence.md`

## User stories addressed

- User story 2 (add a new ring)
- User story 11 (reorder rings — sidebar list exists)
- User story 13 (set base radius)
- User story 14 (set ring increment)
