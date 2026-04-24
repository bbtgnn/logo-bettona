# Technology Stack

**Analysis Date:** 2026-04-24

## Languages

**Primary:**
- TypeScript (strict mode) - App code and tests in `src/` (`src/routes/+layout.ts`, `src/lib/state/composition.ts`, `src/lib/geometry/compose.svelte.spec.ts`)
- Svelte components with TypeScript - UI and route components in `src/**/*.svelte` (`src/routes/+page.svelte`, `src/lib/components/RingEditor.svelte`)

**Secondary:**
- JavaScript (ESM) - Tooling config in root files (`svelte.config.js`, `eslint.config.js`)
- YAML - CI/CD workflow definition in `.github/workflows/deploy.yml`

## Runtime

**Environment:**
- Node.js-compatible JavaScript runtime for local dev/build (`package.json` scripts call `vite`/`svelte-kit`)
- Bun runtime in CI pipeline (`.github/workflows/deploy.yml` uses `oven-sh/setup-bun@v2` and `bun run build`)

**Package Manager:**
- npm commands are defined for developers (`package.json` scripts: `dev`, `build`, `test`)
- Bun lockfile is present (`bun.lock`)
- Lockfile: present (`bun.lock`)

## Frameworks

**Core:**
- Svelte 5 (`svelte`) - component framework (`package.json`)
- SvelteKit 2 (`@sveltejs/kit`) - application routing/build system (`package.json`, `src/routes/+layout.ts`)
- Vite 7 (`vite`) - dev server and bundler (`package.json`, `vite.config.ts`)
- Tailwind CSS 4 (`tailwindcss`, `@tailwindcss/vite`) - utility-first styling (`package.json`, `vite.config.ts`)

**Testing:**
- Vitest 4 (`vitest`) - unit/component test runner (`package.json`, `vite.config.ts`)
- Playwright (`@playwright/test`) - end-to-end tests (`package.json`, `playwright.config.ts`, `src/routes/demo/playwright/page.svelte.e2e.ts`)
- vitest-browser-svelte - browser component testing (`package.json`, `src/lib/vitest-examples/Welcome.svelte.spec.ts`)

**Build/Dev:**
- `@sveltejs/adapter-static` - static-site output adapter (`svelte.config.js`)
- `svelte-check` - type/runtime diagnostics (`package.json` `check` scripts)
- ESLint 10 + TypeScript ESLint + eslint-plugin-svelte - linting (`eslint.config.js`)
- Prettier 3 + `prettier-plugin-svelte` + `prettier-plugin-tailwindcss` - formatting (`package.json` lint/format scripts)

## Key Dependencies

**Critical:**
- `paper` - vector/path drawing engine used by geometry and canvas logic (`src/lib/geometry/compose.ts`, `src/lib/components/PreviewCanvas.svelte`, `src/routes/experiments/paper.ts`)
- `rune-sync` - local reactive persistence (localStorage-backed state) (`src/lib/state/composition.ts`)
- `bits-ui` - headless UI primitives for shared components (`src/lib/shadcn/ui/sheet/sheet.svelte`, `src/lib/shadcn/ui/tooltip/tooltip.svelte`)

**Infrastructure:**
- `tailwind-variants`, `tailwind-merge`, `clsx` - style composition helpers (`src/lib/shadcn/ui/button/button.svelte`, `src/lib/shadcn/utils.ts`)
- `phosphor-svelte` - icon set (`src/lib/components/FullPaletteEditor.svelte`, `src/lib/components/RingEditor.svelte`)

## Configuration

**Environment:**
- No repository `.env*` files detected at root
- Build-time base path is injected by CI as `BASE_PATH` in `.github/workflows/deploy.yml`
- Static prerendered SPA behavior configured via `src/routes/+layout.ts` (`prerender = true`, `ssr = false`)

**Build:**
- `svelte.config.js` sets static adapter and Svelte 5 runes compiler behavior
- `vite.config.ts` configures SvelteKit plugin, Tailwind Vite plugin, and Vitest projects
- `tsconfig.json` extends `.svelte-kit/tsconfig.json` with strict TypeScript settings
- `playwright.config.ts` configures E2E test matching and preview web server
- `eslint.config.js` configures JS/TS/Svelte linting with Prettier interop

## Platform Requirements

**Development:**
- JavaScript runtime with npm script support (scripts defined in `package.json`)
- Browser-capable environment for component and E2E tests (`vite.config.ts` browser project + `playwright.config.ts`)

**Production:**
- Static hosting target producing `build/` output (`@sveltejs/adapter-static` in `svelte.config.js`)
- GitHub Pages deployment path via workflow artifact upload and pages deploy (`.github/workflows/deploy.yml`)

---

*Stack analysis: 2026-04-24*
