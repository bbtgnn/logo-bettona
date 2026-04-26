# Technology Stack

**Analysis Date:** 2026-04-26

## Languages

**Primary:**
- TypeScript (strict) — application source under `src/` (`tsconfig.json` extends `.svelte-kit/tsconfig.json`).
- Svelte 5 — UI and runes; components in `src/lib/components/`, `src/routes/`.

**Secondary:**
- JavaScript — config only (`svelte.config.js`, `eslint.config.js`).

## Runtime

**Environment:**
- Browser — primary execution (`src/routes/+layout.ts` sets `ssr = false`, `prerender = true` for static output).
- Node.js — Vitest **server** project (`vite.config.ts` `environment: 'node'`) for non-Svelte unit tests.

**Package Manager:**
- Bun — lockfile `bun.lock`; CI uses `bun i` and `bun run build` (`.github/workflows/deploy.yml`).
- Lockfile: present (`bun.lock`).

## Frameworks

**Core:**
- SvelteKit `^2.50.2` — routing, build, `$lib` alias (`svelte.config.js`).
- Vite `^7.3.1` — bundler and dev server (`vite.config.ts`).
- `@sveltejs/adapter-static` `^3.0.10` — static site generation (`svelte.config.js`).

**Testing:**
- Vitest `^4.1.0` — dual-project setup in `vite.config.ts`: **client** (browser, Playwright provider, Chromium) for `src/**/*.svelte.{test,spec}.{js,ts}`; **server** (Node) for other `src/**/*.{test,spec}.{js,ts}` excluding Svelte browser specs.
- `@playwright/test` `^1.58.2` + `playwright` — E2E (`playwright.config.ts`, `**/*.e2e.{ts,js}`) and Vitest browser provider.
- `@vitest/browser-playwright` `^4.1.0`, `vitest-browser-svelte` `^2.0.2` — component tests in real browser.

**Build/Dev:**
- `@tailwindcss/vite` `^4.1.18`, `tailwindcss` `^4.1.18` — styling (`vite.config.ts`, `src/routes/layout.css` referenced from `.prettierrc`).
- `bits-ui` `^2.16.3` — headless primitives for shadcn-style UI under `src/lib/shadcn/`.

## Key Dependencies

**Critical:**
- `paper` `^0.12.18` — vector paths, segments, hit testing, SVG import, ring construction and preview rendering. Used in `src/lib/geometry/bend.ts`, `src/lib/geometry/svg-import.ts`, `src/lib/geometry/compose.ts`, `src/lib/geometry/render-pipeline.ts`, `src/lib/components/RingCanvas.svelte`, `src/lib/components/PreviewCanvas.svelte`, `src/lib/components/RingEditor.svelte`, `src/routes/experiments/paper.ts`, and multiple `*.spec.ts` files.
- **Path morph (primary ↔ secondary templates):** morph logic itself is **pure TypeScript** in `src/lib/geometry/path-morph.ts` (`validatePathCompatibility`, `interpolatePath`, `PathMorphError`) — no Paper.js calls inside that module. Paper is used **after** morph when `src/lib/geometry/render-pipeline.ts` applies `interpolatePath` then `buildRingPath` from `bend.ts`, and for interactive editing in `RingCanvas.svelte`.

**Infrastructure / client persistence:**
- `rune-sync` `^0.2.1` — `lsSync` from `rune-sync/localstorage` in `src/lib/state/composition.ts` for reactive state synced to `localStorage` (composition, color mode, UI expansion).

**UI utilities:**
- `clsx`, `tailwind-merge`, `tailwind-variants` — class composition (`src/lib/shadcn/utils.ts` pattern).
- `phosphor-svelte` `^3.1.0` — icons.
- `@fontsource-variable/jetbrains-mono` — typography.
- `@internationalized/date` — present as devDependency (calendar-related stacks if used from bits-ui).

## Configuration

**Environment:**
- No committed `.env` / `.env.example` detected at repo root (glob). Runtime is client-static; deploy injects `BASE_PATH` in CI only (see `INTEGRATIONS.md`).

**Build:**
- `vite.config.ts` — plugins: Tailwind Vite, SvelteKit; Vitest projects.
- `svelte.config.js` — `adapter-static()`, Svelte 5 **runes** enabled for non-`node_modules` files via `compilerOptions.runes`.
- `playwright.config.ts` — preview server for E2E: `npm run build && npm run preview` on port `4173`.
- `eslint.config.js` — flat config: `typescript-eslint`, `eslint-plugin-svelte`, Prettier integration, `.gitignore` honored via `@eslint/compat`.
- `.prettierrc` — tabs, single quotes, Svelte + Tailwind Prettier plugins.

## Platform Requirements

**Development:**
- Bun (per lockfile and CI) or compatible npm-compatible client for scripts in `package.json`.
- Node compatible with Vite 7 / Vitest 4 (for tooling and Vitest Node project).
- Chromium for Vitest browser tests and Playwright.

**Production:**
- Static assets deployed to **GitHub Pages** (workflow builds to `build/`, artifact upload). SPA behavior implied by `ssr = false` + static adapter.

---

*Stack analysis: 2026-04-26*
