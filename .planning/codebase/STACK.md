# Technology Stack

**Analysis Date:** 2026-07-06

## Languages

**Primary:**
- TypeScript (strict) - application logic and state in `src/lib/**` with strict compiler settings from `tsconfig.json`.
- Svelte 5 - UI components and runes-based state modules in `src/lib/components/**` and `src/lib/state/*.svelte.ts`.

**Secondary:**
- JavaScript (ESM) - toolchain/config files such as `svelte.config.js`, `vite.config.ts`, and `eslint.config.js`.

## Runtime

**Environment:**
- Browser-first SPA runtime - `src/routes/+layout.ts` sets `ssr = false` and `prerender = true`.
- Node.js test runtime - server-side Vitest project in `vite.config.ts` for non-browser specs (`environment: 'node'`).

**Package Manager:**
- Bun - primary package manager in CI via `.github/workflows/deploy.yml` (`bun i`, `bun run build`).
- Lockfile: present (`bun.lock`).
- **Inconsistency:** `package.json` scripts internally shell out via `npm run …` (e.g. `"prepare": "svelte-kit sync && npm run paraglide || echo ''"`, `"check": "npm run paraglide && ..."`), while `playwright.config.ts`'s `webServer.command` runs `npm run build && npm run preview`. So the declared/CI package manager is bun, but script-to-script invocation is hardcoded to npm. This is stated as fact, not resolved here — see CONCERNS.md for the cross-reference.

## Frameworks

**Core:**
- SvelteKit `^2.50.2` - routing, static build pipeline, aliasing (`svelte.config.js`).
- Svelte `^5.54.0` - rune-based component/state authoring across `src/lib/components/**` and `src/lib/state/**`.
- Vite `^7.3.1` - dev/build tool and Vitest host (`vite.config.ts`).
- `@sveltejs/adapter-static` `^3.0.10` - static artifact generation for Pages deploy (`svelte.config.js`).

**Testing:**
- Vitest `^4.1.0` - split browser+node test projects in `vite.config.ts` (`client` + `server`), `expect: { requireAssertions: true }`.
- `@vitest/browser-playwright` `^4.1.0` + `vitest-browser-svelte` `^2.0.2` - browser component tests (`client` project, `src/**/*.svelte.{test,spec}.{js,ts}`, excludes `src/lib/state/animation.svelte.spec.ts` which instead runs under `server`).
- Playwright `^1.58.2` - E2E (`*.e2e.ts`) and browser test provider (`playwright.config.ts`).

**Build/Dev:**
- Tailwind CSS v4 stack (`@tailwindcss/vite`, `tailwindcss`, `@tailwindcss/forms`, `@tailwindcss/typography`, `tw-animate-css`) - styling entry at `src/routes/layout.css` (`@import 'tailwindcss'`, `@import "tw-animate-css"`, `@plugin '@tailwindcss/forms'`, `@plugin '@tailwindcss/typography'`).
- `@inlang/paraglide-js` `^2.20.0` - i18n; compiled via `paraglideVitePlugin` in `vite.config.ts` (`project: './project.inlang'`, `outdir: './src/lib/paraglide'`, `strategy: ['localStorage', 'preferredLanguage', 'baseLocale']`) and the `paraglide` npm script (`paraglide-js compile --project ./project.inlang --outdir ./src/lib/paraglide`); messages in `messages/{en,it}.json`.
- ESLint + Prettier - lint/format enforcement via `eslint.config.js` and `.prettierrc` (`prettier-plugin-svelte`, `prettier-plugin-tailwindcss`).

## Key Dependencies

**Critical:**
- `paper` `^0.12.18` - ring geometry, SVG import, and rendering pipeline (`src/lib/geometry/**`, `src/lib/components/RingCanvas.svelte`, `src/lib/components/PreviewCanvas.svelte`).
- `animejs` `^4.3.6` - playback engine for morph sweep animations in `src/lib/state/animation.svelte.ts`.
- `rune-sync` `^0.2.1` - persistent client state via `lsSync` singleton in `src/lib/state/composition-persistence.svelte.ts` (surfaced through `src/lib/state/composition.ts`).

These three (`animejs`, `paper`, `rune-sync`) are the **only** entries under `package.json`'s `dependencies`; every other package listed here (SvelteKit, Svelte, Vite, Tailwind stack, Paraglide, bits-ui, phosphor-svelte, testing tools, fonts) is a `devDependency` — the app is built/prerendered at build time, so nothing else needs to ship as a runtime dependency in `node_modules` resolution terms, but they are all still bundled into the client build output.

**UI dependencies:**
- `bits-ui` `^2.16.3` - headless primitives (sidebar, collapsible, tooltip, slider, sheet, separator, switch) underlying `src/lib/shadcn/ui/**` (e.g. `sidebar/sidebar.svelte`, `sidebar/sidebar-trigger.svelte`, `sheet/*.svelte`, `collapsible/*.svelte`), consumed by `src/lib/components/SidebarNav.svelte` and `SidebarCollapsible.svelte`.
- `phosphor-svelte` `^3.1.0` - icon set used by editor/nav controls (`src/lib/components/RingEditor.svelte`, `SidebarNav.svelte`, `RingConfigShell.svelte`, and others).
- `@fontsource-variable/jetbrains-mono` `^5.2.8` - variable font import in `src/routes/layout.css` (`@import "@fontsource-variable/jetbrains-mono"`).

## Configuration

**Environment:**
- `.env` patterns are git-ignored via `.gitignore`; no committed env file detected in repo root.
- `BASE_PATH` env var feeds `svelte.config.js`'s `kit.paths.base: process.env.BASE_PATH ?? ''`; CI (`.github/workflows/deploy.yml`) sets `BASE_PATH: '/${{ github.event.repository.name }}'` before `bun run build`.

**Build:**
- `vite.config.ts` - SvelteKit + Tailwind + Paraglide Vite plugins, and the split Vitest `client`/`server` test projects.
- `svelte.config.js` - `adapter-static` with `fallback: '404.html'` (SPA fallback for deep-link reloads on Pages), `paths.base` from `BASE_PATH`, and project-wide rune mode (`compilerOptions.runes`, `undefined` for `node_modules`, `true` otherwise).
- `playwright.config.ts` - preview-backed E2E run (`webServer.command: 'npm run build && npm run preview'`, `testMatch: '**/*.e2e.{ts,js}'`).

## Platform Requirements

**Development:**
- Bun runtime/tooling support for package scripts in `package.json` (per declared PM / lockfile), while individual scripts invoke `npm run …` internally — see Runtime → Package Manager note above.
- Chromium available for the Vitest `client` (browser) project and Playwright execution.
- Node.js compatibility for Vite/Vitest/SvelteKit tooling.

**Production:**
- Static hosting target on GitHub Pages using `build/` output from SvelteKit's static adapter, with `404.html` fallback for SPA deep links and a `BASE_PATH`-derived base path.
- Client-only rendering model (no server runtime requirement at deploy target; `ssr = false`, `prerender = true`).

---

*Stack analysis: 2026-07-06*
