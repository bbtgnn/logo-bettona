# About Page Design

Date: 2026-05-21
Status: Approved in chat, documented for planning

## Goal

Add a public `/about` page that introduces the project (what it is) and gives a brief overview of how to use it. Reachable from a header link in the main app shell. Standalone page (no sidebar), with a hero section showcasing an animated ring preset and a two-column grid below.

Non-goals:

- No designer/author bio (project-focused only).
- No step-by-step tutorial, video, or animated GIFs.
- No personalization of the hero ring (no use of user editor state).
- No randomization of the hero ring.
- No footer.
- No localization layer (Italian/English toggle); single-language copy.

## Chosen Approach

Hero ring uses a fixed preset hardcoded inside a dedicated wrapper component. Palette, geometry, and animation driver values are constants, identical on every visit.

Why:

- Predictable visual identity for the About page.
- No coupling to editor state or stores.
- No runtime variability — no risk of unflattering combinations.

## Routing and Navigation

- New SvelteKit route: `src/routes/about/+page.svelte`.
- Main app shell (`src/routes/+page.svelte`) header gets an `About` link right-aligned in the header row (after the existing `SidebarTrigger` + "Shape Editor" title, pushed to the far right with `ml-auto`).
- About page does **not** use the sidebar shell. It is a standalone full-width page.
- About page header is minimal: a single `← Back` link that navigates to `/`.
- No other navigation elements on the About page.

## Layout

Container max width approximately 1100px, horizontally centered.

```
┌─────────────────────────────────────────────┐
│ ← Back                                      │  minimal header
├─────────────────────────────────────────────┤
│                                             │
│           [Title]                           │
│           [Tagline]                         │
│           [ Hero ring (animated preset) ]   │  hero, centered
│                                             │
├─────────────────────────────────────────────┤
│  ┌─────────────────┐  ┌─────────────────┐   │
│  │  What it is     │  │  How to use     │   │  2-col grid
│  │  (2-3 sentences)│  │  • Colors       │   │
│  │                 │  │  • Animation    │   │
│  │                 │  │  • Settings     │   │
│  └─────────────────┘  └─────────────────┘   │
└─────────────────────────────────────────────┘
```

Responsive behavior:

- Desktop: 2-column grid.
- Mobile: cards stack vertically.

Spacing and typography use existing Tailwind / shadcn tokens already in use in the app.

## Content (initial copy, editable later)

Hero:

- Title: `logo-bettona` (final wording to be confirmed by user before commit; placeholder for now).
- Tagline: one line, e.g. "Strumento per generare loghi a forma di anello."

Card "Cos'è" (What it is):

- 2-3 dry, factual sentences. What it does, who it's for, what the output is.
- Suggested draft: "Editor interattivo per creare loghi circolari. Configura colori, anima percorsi, esporta. Pensato per designer che vogliono iterare velocemente su identità visive radiali."

Card "Come si usa" (How to use) — short bullets, one per sidebar section, 1-2 lines each:

- **Colors** — Imposta palette monocromatica o piena. Definisce colori anello e sfondo.
- **Animation** — Anima percorsi anello. Scegli driver (es. anime.js) e parametri.
- **Settings** — Geometria anello: raggio, spessore, segmenti.

Tone: technical and dry (no jokes, no warmth, no marketing voice).

## Components

New files:

- `src/routes/about/+page.svelte` — the About page itself: minimal header + hero + 2-col grid + copy.
- `src/lib/components/AboutHeroRing.svelte` — self-contained animated hero ring. Owns its own Paper.js scope, defines a hardcoded local `Composition` constant, drives it through `createRenderPipeline()`, and animates `morphT` via an internal `requestAnimationFrame` loop. No props, no coupling to global stores.

Reused:

- `src/lib/geometry/render-pipeline.ts` — existing Paper.js-based composition renderer (`createRenderPipeline()`), the same pipeline used by `PreviewCanvas.svelte`. (Note: `RingCanvas.svelte` is a path editor with handles, not a ring renderer; it is not used here.)
- Existing Tailwind / shadcn tokens for typography and spacing.

Modified:

- `src/routes/+page.svelte` — add an `About` link in the header.

No changes to:

- The sidebar (`Sidebar.svelte`) or any editor section components.
- Root layout (`+layout.svelte`).
- Any state/store wiring.

## Hero Ring Preset

The preset values live as constants inside `AboutHeroRing.svelte`. They are picked at implementation time and may be tuned later in code; they are not user-configurable from the About page.

Preset must cover:

- A local `Composition` constant: `baseRadius`, `ringIncrement`, `rings[]` (each ring with `templatePath`, `secondaryTemplatePath`, `color`, `copies`, `ringHeight`, initial `morphT`), and at least one `monochromePalettes` / `fullPalettes` entry to satisfy the `Composition` type.
- An internal animation loop (`requestAnimationFrame`) that drives `morphT` (e.g. triangle wave over a fixed duration) on the local composition and re-renders via the existing pipeline.
- Autoplay enabled (animation starts on mount; loop on cleanup).

The component renders the ring sized appropriately for the hero (visually balanced with the title block above it).

## Accessibility

- `← Back` link is a real anchor (`<a href="/">`), keyboard reachable.
- About page has a single `<h1>` (the hero title) and `<h2>` headings for the two cards.
- The hero ring is decorative; the canvas/SVG container should be marked as decorative (`aria-hidden="true"` or equivalent) so screen readers skip it.
- Color contrast follows existing app token choices.

## Testing

- Unit/component test for `AboutHeroRing.svelte`: mounts without error and renders a `<canvas>` inside the `about-hero-ring` wrapper.
- Component test for `src/routes/about/+page.svelte`: renders header, hero title/tagline, both cards with expected headings.
- Playwright smoke test: navigate from `/` to `/about` via the header link, assert About hero title is visible, click `← Back`, assert main editor shell is visible again.

## Out of Scope (explicit)

- Per-card visuals beyond text (no icons unless trivially available from existing tokens).
- Theming toggle on the About page.
- Analytics events.
- SEO/meta tag work beyond a basic `<svelte:head>` title.
