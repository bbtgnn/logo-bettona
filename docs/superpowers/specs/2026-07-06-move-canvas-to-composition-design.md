# Move Canvas panel to Composition — design

**Date:** 2026-07-06
**Branch:** `feat/move-canvas-to-composition`

## Context

The tool is being restructured into four sections: Tracciati → Anelli →
Composizione → Animazione. Composizione currently exists only as an empty
container. This is the first "trasloco" (move): the Canvas panel (aspect
ratio, canvas sheet) conceptually belongs to Composition — that is where you
decide the "sheet" the marchio is laid out on — but today it lives in the
Editor sidebar.

### Current architecture (real code, not `.planning/codebase/`)

- `src/routes/(app)/+layout.svelte` — shared shell for `editor` and `animate`.
  Sidebar = `SidebarNav` + `{@render children()}` (each page supplies its
  sidebar sections). Main = `<PreviewCanvas animate={isAnimate} />`, always
  mounted (`data-testid="app-canvas"`).
- `src/routes/(app)/editor/+page.svelte` — supplies sidebar sections only:
  `SettingsSection`, `CanvasSection`, Rings, `KaleidoscopeSection`,
  `ColorsSection`. The preview comes from the layout.
- `src/routes/composition/+page.svelte` — **standalone** route that
  hand-duplicates the `(app)` shell (own `SidebarProvider`, header, main) and
  renders a placeholder body. It does **not** render `PreviewCanvas`.
- `src/lib/components/CanvasSection.svelte` — one `SidebarCollapsible` with the
  aspect-ratio `<select>` wired to `composition` state.
- `PreviewCanvas` already owns export controls including a functional
  "Resolution" select (1x/2x/4x).

## Decisions

1. **Fold `composition` into the `(app)` route group** rather than keeping it
   standalone. Composition inherits the shared shell and the persistent
   `PreviewCanvas` main for free (the goal: opening Composition shows the
   current marchio on the chosen canvas), and the duplicated shell is deleted.
   URL `/composition` is unchanged (route groups do not affect the URL).
2. **Placeholder slot: print format only.** Export-resolution already exists,
   functional, under the preview; a second one in the Canvas panel would be a
   confusing duplicate. Reserve UI space only for a future "Print format"
   control (disabled, "Coming soon", no logic).

## Changes

### Move 1 — fold Composition, relocate Canvas panel

- Delete `<CanvasSection />` from `editor/+page.svelte` (line 37). Editor loses
  only the Canvas panel; everything else identical.
- Move `src/routes/composition/+page.svelte` → `src/routes/(app)/composition/+page.svelte`,
  stripping the hand-rolled shell. Body becomes sidebar sections only:
  `<CanvasSection />` (plus a `<svelte:head><title>` if desired). Shell,
  header, and `PreviewCanvas` main come from `(app)/+layout.svelte`.
  `isAnimate` is false on `/composition` → static preview.

### Move 2 — print-format placeholder

- In `CanvasSection`, add a disabled "Print format" `<select>` under Aspect
  ratio. New message key `composition_print_format`; reuse
  `composition_coming_soon` for the option text. No behaviour.

### i18n cleanup

- Keep `composition_page_title`, `composition_coming_soon`.
- Remove now-unused `composition_under_construction` (all locales).
- Add `composition_print_format` (all locales).

### Known naming smell (out of scope)

- `CanvasSection` keeps using the `editor_canvas` / `editor_aspect_ratio`
  message keys even though the panel now lives in Composition. Renaming touches
  every locale and is deferred; noted, not done here.

## Test impact

- `src/routes/composition/page.svelte.spec.ts` → moves to
  `(app)/composition/page.svelte.spec.ts`, rewritten editor-style: the page in
  isolation now renders only `CanvasSection`, so assert the Canvas panel
  (heading `Canvas`, `Aspect ratio` control) and drop the nav/placeholder
  assertions. Nav is now layout-level and already covered by
  `(app)/layout.svelte.spec.ts`.
- `src/routes/(app)/workspace-nav.e2e.ts` — the composition step asserts
  `composition-placeholder` is visible (line 10); change it to assert the
  Canvas preview / panel is visible instead (placeholder is gone).
- `(app)/layout.svelte.spec.ts` — unchanged (nav + `app-canvas`).

## Commits (small, tests green each)

1. Fold Composition into the `(app)` shell (move page + spec, strip shell,
   rewrite spec, fix nav e2e).
2. Remove `<CanvasSection />` from the Editor page.
3. Add the print-format placeholder + i18n (add `composition_print_format`,
   drop `composition_under_construction`).
