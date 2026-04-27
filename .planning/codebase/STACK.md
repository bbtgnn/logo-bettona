# Technology Stack

**Analysis Date:** 2026-04-27

## Languages

**Primary:**
- TypeScript (strict) - application logic and state in `src/lib/**` with strict compiler settings from `tsconfig.json`.
- Svelte 5 - UI components and runes-based state modules in `src/lib/components/**` and `src/lib/state/*.svelte.ts`.

**Secondary:**
- JavaScript (ESM) - toolchain/config files such as `svelte.config.js` and `eslint.config.js`.

## Runtime

**Environment:**
- Browser-first SPA runtime - `src/routes/+layout.ts` sets `ssr = false` and `prerender = true`.
- Node.js test runtime - server-side Vitest project in `vite.config.ts` for non-browser specs.

**Package Manager:**
- Bun - primary package manager in CI via `.github/workflows/deploy.yml` (`bun i`, `bun run build`).
- Lockfile: present (`bun.lock`).

## Frameworks

**Core:**
- SvelteKit `^2.50.2` - routing, static build pipeline, aliasing (`svelte.config.js`).
- Svelte `^5.54.0` - rune-based component/state authoring across `src/lib/components/**` and `src/lib/state/**`.
- Vite `^7.3.1` - dev/build tool and Vitest host (`vite.config.ts`).
- `@sveltejs/adapter-static` `^3.0.10` - static artifact generation for Pages deploy (`svelte.config.js`).

**Testing:**
- Vitest `^4.1.0` - split browser+node test projects in `vite.config.ts`.
- `@vitest/browser-playwright` `^4.1.0` + `vitest-browser-svelte` `^2.0.2` - browser component tests (e.g. `src/lib/components/AnimationSection.svelte.spec.ts`).
- Playwright `^1.58.2` - E2E and browser provider (`playwright.config.ts`).

**Build/Dev:**
- Tailwind CSS v4 stack (`@tailwindcss/vite`, `tailwindcss`) - styling from `src/routes/layout.css`.
- ESLint + Prettier - lint/format enforcement via `eslint.config.js` and `.prettierrc`.

## Key Dependencies

**Critical:**
- `paper` `^0.12.18` - ring geometry, SVG import, and rendering pipeline (`src/lib/geometry/**`, `src/lib/components/RingCanvas.svelte`, `src/lib/components/PreviewCanvas.svelte`).
- `animejs` `^4.3.6` - playback engine for morph sweep animations in `src/lib/state/animation.svelte.ts`.

**Infrastructure:**
- `rune-sync` `^0.2.1` - persistent client state via `lsSync` in `src/lib/state/composition.ts`.
- Animation state module - centralized playback/model sync in `src/lib/state/animation.svelte.ts` and re-export through `src/lib/state/animation.ts`.

**UI dependencies:**
- `bits-ui` `^2.16.3` - sidebar/collapsible primitives used by animation UI (`src/lib/components/Sidebar.svelte`, `src/lib/components/AnimationSection.svelte`).
- `phosphor-svelte` `^3.1.0` - icon set used by editor controls (`src/lib/components/RingEditor.svelte`).

## Configuration

**Environment:**
- `.env` patterns are git-ignored via `.gitignore`; no committed env file detected in repo root.
- CI build injects `BASE_PATH` in `.github/workflows/deploy.yml`.

**Build:**
- `vite.config.ts` - SvelteKit/Tailwind plugins and Vitest split projects, including explicit handling for `src/lib/state/animation.svelte.spec.ts`.
- `svelte.config.js` - project-wide rune mode (except `node_modules`) and static adapter.
- `playwright.config.ts` - preview-backed E2E run (`npm run build && npm run preview`).

## Platform Requirements

**Development:**
- Bun runtime/tooling support for package scripts in `package.json`.
- Chromium available for browser test project and Playwright execution.
- Node.js compatibility for Vite/Vitest/SvelteKit tooling.

**Production:**
- Static hosting target on GitHub Pages using `build/` output from SvelteKit static adapter.
- Client-only rendering model (no server runtime requirement at deploy target).

---

*Stack analysis: 2026-04-27*
