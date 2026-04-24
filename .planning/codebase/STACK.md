# Technology Stack

**Analysis Date:** 2026-04-24

## Languages

**Primary:**
- TypeScript - Application logic and tests in `src/lib/**/*.ts`, route config in `src/routes/+layout.ts`, and config in `vite.config.ts`/`playwright.config.ts`.
- Svelte (with TypeScript) - UI components and pages in `src/routes/**/*.svelte` and `src/lib/components/**/*.svelte`.

**Secondary:**
- JavaScript (ESM) - Tooling configuration in `svelte.config.js` and `eslint.config.js`.
- CSS - Global route styling in `src/routes/layout.css`.

## Runtime

**Environment:**
- Node.js runtime for development/build/test scripts declared in `package.json`.
- Browser runtime for the shipped app (static prerender with client-side rendering) configured in `src/routes/+layout.ts`.

**Package Manager:**
- npm scripts are the primary task interface (`dev`, `build`, `test`, `lint`) in `package.json`.
- Lockfile: present (`bun.lock`), indicating Bun is also used for dependency locking.

## Frameworks

**Core:**
- SvelteKit (`@sveltejs/kit`) - Application framework and routing, configured via `svelte.config.js` and route files in `src/routes/`.
- Svelte 5 (`svelte`) - Component/runtime layer used across `src/lib/components/` and `src/lib/shadcn/ui/`.

**Testing:**
- Vitest (`vitest`) - Unit/component test runner configured in `vite.config.ts`.
- Playwright (`@playwright/test`) - E2E runner configured in `playwright.config.ts`.
- Vitest browser mode (`@vitest/browser-playwright`, `vitest-browser-svelte`) - Browser component tests in `src/**/*.svelte.spec.ts`.

**Build/Dev:**
- Vite (`vite`) - Dev server and bundler via scripts in `package.json` and config in `vite.config.ts`.
- Tailwind CSS v4 (`tailwindcss`, `@tailwindcss/vite`) - Styling pipeline wired in `vite.config.ts`.
- Adapter Static (`@sveltejs/adapter-static`) - Static build target set in `svelte.config.js`.

## Key Dependencies

**Critical:**
- `paper` - Vector geometry/drawing engine used in rendering and geometry modules (`src/lib/geometry/*.ts`, `src/lib/components/*Canvas.svelte`).
- `rune-sync` - Local persistence/state sync via `lsSync` in `src/lib/state/composition.ts`.
- `bits-ui` - Headless UI primitives used in `src/lib/shadcn/ui/**`.

**Infrastructure:**
- `tailwind-variants`, `tailwind-merge`, `clsx` - Utility styling composition in `src/lib/shadcn/utils.ts` and UI components.
- `phosphor-svelte` - Icon library consumed in UI components like `src/lib/components/RingEditor.svelte`.
- ESLint/Prettier/TypeScript toolchain - Static analysis and formatting configured in `eslint.config.js`, `tsconfig.json`, and `package.json`.

## Configuration

**Environment:**
- No project `.env` files detected in repository root (`.env*` not detected).
- No runtime env-variable reads detected in application source under `src/` (`import.meta.env`, `process.env`, `$env` not detected).

**Build:**
- `svelte.config.js` configures Svelte compiler runes mode and static adapter.
- `vite.config.ts` configures SvelteKit plugin, Tailwind plugin, and multi-project Vitest setup.
- `tsconfig.json` extends generated SvelteKit config with strict TypeScript settings.
- `playwright.config.ts` configures E2E execution against preview server.
- `eslint.config.js` configures JS/TS/Svelte linting and Prettier compatibility.

## Platform Requirements

**Development:**
- Node.js-compatible environment with npm scripts from `package.json`.
- Browser automation prerequisites for Playwright tests (`playwright.config.ts`).

**Production:**
- Static hosting target (generated assets from `npm run build`) based on `@sveltejs/adapter-static` in `svelte.config.js` and `prerender`/`ssr` settings in `src/routes/+layout.ts`.

---

*Stack analysis: 2026-04-24*
