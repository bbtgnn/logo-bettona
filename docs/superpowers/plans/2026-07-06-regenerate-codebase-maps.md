# Regenerate `.planning/codebase/` maps — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rewrite the 7 codebase-map files under `.planning/codebase/` so they accurately describe the current four-section tool, preserving each file's existing section skeleton.

**Architecture:** Documentation-only. Each task rewrites one map file: preserve its section headings + footer, stamp `Analysis Date: 2026-07-06`, rewrite the body grounded in current source. No source file is touched. "Tests" are path-existence checks: every file/dir/symbol named in a map must resolve in the tree.

**Tech Stack:** Markdown only. Verification via `git`, `grep`, `ls` against the current repo.

**Spec:** `docs/superpowers/specs/2026-07-06-regenerate-codebase-maps-design.md` — read it first.

## Global Constraints

- **Docs-only.** Touch **only** `.planning/codebase/*.md`. Zero changes under `src/`, config, or anywhere else. Final `git status` must show only those 7 files modified.
- **Preserve skeleton.** Keep each file's existing top-level section headings and footer line. Only refresh content + stamp `Analysis Date: 2026-07-06` (and the footer date line).
- **Ground every claim.** Every file path, directory, and exported symbol named in a map must exist in the current tree. Verify before writing; do not carry forward April-era names that no longer exist.
- **Export framing (per spec decision 3):** `export/canvas-export.ts` = runtime **video** export (WebM via MediaRecorder). Static SVG/PNG download currently lives **inline in `preview-presenter`** (`exportSvg` / `exportPng`). A future dedicated static PNG/SVG export is a **distinct path** — never intertwine the two.
- **CONCERNS = faithful current-state audit** (priorities + file anchors), not a neutral dump.
- **No commits.** The user commits. Do not run `git add`/`git commit`. End by printing the regenerated-file list.

## Key facts (already verified — reuse, do not re-derive)

**Routing / shell:**
- Route group `src/routes/(app)/` with pages `paths/`, `editor/`, `composition/`, `animate/`; sibling `about/`. `(app)/+layout.svelte` = sidebar shell (SidebarNav, PreviewCanvas, conditional TimelinePanel on `/animate`).
- `src/routes/+page.ts` → `redirect(307, resolve('/paths'))`. `+layout.ts` → `prerender = true; ssr = false`.
- `SidebarNav.svelte` tabs: `/paths` (Tracciati), `/editor`, `/composition`, `/animate`; active pill via `page.url.pathname`.
- `svelte.config.js`: `adapter-static` `fallback: '404.html'`, `base: process.env.BASE_PATH ?? ''`, runes mode.

**Pages:**
- `composition/+page.svelte`: `CanvasSection` + `LayoutModeSwitch` + `{#if kaleidoscope.enabled}KaleidoscopePanel`.
- `animate/+page.svelte`: `SimpleSection`, `DataSeriesSection`, `AudioBarsSection`, `AudioZonesSection`, `KaleidoscopeAudioSection`.
- `editor/+page.svelte`: `SettingsSection`, rings (`RingEditor`, drag-reorder via `reorderRings`), `ColorsSection`.

**State:**
- `state/composition-persistence.svelte.ts` = `lsSync` singleton. `state/composition.ts` = action facade (colors, rings, morph targets, `updateRingPathVariant` with primary-reseed stopgap, aspect ratio, bg color).
- `state/animation.svelte.ts` = animate controller: `AnimationLayer = 'audioBars'|'audioZones'|'dataSeries'|'kaleidoscope'`; `LayerKind = 'driver'|'gate'|'inert'`; `DRIVER_LAYERS`; `setLayerEnabled`/`syncActiveDrivers`; `applyKeyframes` (gate coupling); `getExportAudioStream`; `fps`. Re-exported by `state/animation.ts`.
- `state/animation-drivers/`: `runtime.ts` (`createAnimationRuntime` → `registerDriver`/`setActive`/`tick`), `audio-source.ts`, `audio-bars-driver.ts`, `audio-zones-driver.ts`, `data-series-driver.ts`, `fallback-bars.ts`, `demo-zones.ts`, `types.ts` (`AnimationDriverType`, configs).
- `state/kaleidoscope.svelte.ts` = `kaleidoscope` singleton (`enabled`, `sectors`, `repeat`, `liveTile`, `circularMask`, …) + setters.
- `state/keyframes.svelte.ts`, `state/path-library.ts`, `state/locale.svelte.ts`, `state/ring-id.ts`, `state/animatable-params.ts`, `state/builtin-curves.ts`, `state/kaleidoscope-params.ts`, `state/export-status.svelte.ts`, `state/default.ts`.

**Geometry:** `render-pipeline.ts`, `path-morph.ts`, `bend.ts`, `compose.ts`, `compose-ring.ts`, `kaleidoscope.ts`, `kaleidoscope-tile.ts`, `wave.ts`, `zones.ts`, `aspect-ratio.ts`, `fit-to-view.ts`, `grid-snap.ts`, `path-codec.ts`, `path-to-svg.ts`, `path-transform.ts`, `svg-import.ts`.

**Other lib:** `actions/draggable.ts`, `animation/keyframes.ts` + `animation/timeline-geometry.ts`, `color/apply.ts`, `export/canvas-export.ts` (WebM/MediaRecorder), `paraglide/` (generated, gitignored), `shadcn/`, `messages-parity.spec.ts`, `types.ts`, `index.ts`.

**Preview:** `components/preview-presenter.svelte.ts` — single-writer canvas: flat composition `$effect` returns early when `kaleidoscope.enabled`; kaleidoscope rAF loop is sole writer while enabled; offscreen tile scope + snapshot lifecycle; `exportSvg`/`exportPng` inline; `exportAnimation` → `export/canvas-export`.

**Tooling:** deps (runtime) = `animejs`, `paper`, `rune-sync`; all else dev. Paraglide i18n (`messages/{en,it}.json`, strategy `['localStorage','preferredLanguage','baseLocale']`). Scripts use `npm run …`; PM declared as bun (`bun.lock`, CLAUDE.md) — inconsistency for CONCERNS. Vitest projects: `client` (browser, `src/**/*.svelte.{test,spec}.{js,ts}`, excludes `state/animation.svelte.spec.ts`) + `server` (node, `!(*.svelte).spec` + the excluded animation spec). `requireAssertions: true`. E2E `*.e2e.ts` (`workspace-nav`, `about-nav`, `path-manager`, `demo/playwright`).

**localStorage keys (verify exact strings while writing):** `composition` (persistence), `color-mode`, `composition-ui`; plus path-library + locale keys — grep `lsSync(` across `src/lib/state` to list them precisely.

---

## Task 1: STRUCTURE.md

**Files:**
- Modify: `.planning/codebase/STRUCTURE.md`

**Interfaces:**
- Produces: the canonical directory tree + "where to add code" map that Tasks 2–7 stay consistent with.

- [ ] **Step 1: Confirm skeleton + current tree**

Read `.planning/codebase/STRUCTURE.md` for its section headings (Directory Layout, Directory Purposes, Key File Locations, Naming Conventions, Where to Add New Code, Special Directories, footer).
Run: `find src -type d | sort && echo --- && ls src/lib && ls src/routes/'(app)'`
Expected: the dirs listed in Key facts.

- [ ] **Step 2: Rewrite the file**

Preserve every heading. Stamp `Analysis Date: 2026-07-06` and footer `*Structure analysis: 2026-07-06*`. Update:
- Directory Layout tree → current `src/routes/(app)/{paths,editor,composition,animate}` + `about`, `+page.ts`, and `src/lib/` subdirs (`actions`, `animation`, `color`, `components`, `export`, `geometry`, `paraglide` [generated/gitignored], `shadcn`, `state` [+ `animation-drivers`], `types.ts`, `index.ts`).
- Directory Purposes → one entry per real subdir with a real key file each.
- "Where to Add New Code" → mapped to the four sections + drivers + keyframes + path library (e.g. new audio driver → `state/animation-drivers/` + register in `animation.svelte.ts` + `Audio*Section.svelte`).
- Special Directories → `paraglide/` (generated, gitignored), `shadcn/` (vendor UI), `.planning/` (committed, not generated).

- [ ] **Step 3: Verify every named path exists**

Run: `grep -oE '(src|\.planning|static|messages)/[A-Za-z0-9_./()-]+' .planning/codebase/STRUCTURE.md | sed 's/[.,)]*$//' | sort -u | while read p; do [ -e "$p" ] || echo "MISSING: $p"; done`
Expected: no `MISSING:` lines (directories quoted with `(app)` may need manual spot-check).

- [ ] **Step 4: Confirm scope**

Run: `git status --short`
Expected: only `.planning/codebase/STRUCTURE.md` modified (plus the spec/plan docs). No `src/` changes.

---

## Task 2: ARCHITECTURE.md

**Files:**
- Modify: `.planning/codebase/ARCHITECTURE.md`

**Interfaces:**
- Consumes: the tree from Task 1 (keep layer→dir names consistent).

- [ ] **Step 1: Confirm skeleton + read the load-bearing modules**

Read `.planning/codebase/ARCHITECTURE.md` headings (Pattern Overview, Layers, Data Flow, Key Abstractions, Entry Points, Error Handling, Cross-Cutting Concerns, footer).
Read: `src/lib/components/preview-presenter.svelte.ts`, `src/lib/state/animation.svelte.ts`, `src/lib/state/animation-drivers/runtime.ts`, `src/lib/state/composition.ts`, `src/routes/(app)/+layout.svelte`.

- [ ] **Step 2: Rewrite the file**

Preserve headings; stamp `2026-07-06`. Content:
- **Pattern Overview:** client-only SvelteKit, four-section pipeline (Tracciati → Editor → Composizione → Animate), local-first reactive state, Paper.js render core, audio-reactive drivers, kaleidoscope rAF preview.
- **Layers:** `(app)` shell; composition facade over persistence singleton; animate controller (driver runtime + layer flags + keyframes + export audio); kaleidoscope state; preview-presenter canvas arbitration; geometry/render core.
- **Data Flow:** (a) layer toggle → `setLayerEnabled` → `syncActiveDrivers` → runtime `setActive`; per-frame `frame()` → `applyRingT`. (b) keyframes: `applyKeyframes(progress)` samples params, gate-coupled to layer flags. (c) kaleidoscope: single-writer canvas — flat `$effect` yields to rAF loop; offscreen tile snapshot (static vs `liveTile`).
- **Export subsystem (decision 3):** dedicated paragraph — `export/canvas-export` = WebM/MediaRecorder runtime **video**; static SVG/PNG download is **inline in preview-presenter** (`exportSvg`/`exportPng`); a future static-export path is **distinct** and unbuilt. Do not merge the two narratives.
- **Entry Points:** `+layout.ts` (`ssr=false`, `prerender=true`), `+page.ts` redirect → `/paths`, `(app)/+layout.svelte`.
- **Error Handling / Cross-Cutting:** `updateRingPathVariant` result union + primary-reseed stopgap; render warnings; driver clamp (`clamp01` in runtime); i18n via Paraglide.

- [ ] **Step 3: Verify named symbols exist**

Run: `for s in createPreviewPresenter createAnimationRuntime setLayerEnabled syncActiveDrivers applyKeyframes exportAnimation updateRingPathVariant; do grep -rq "$s" src/lib || echo "MISSING: $s"; done`
Expected: no `MISSING:` lines.

- [ ] **Step 4: Confirm scope**

Run: `git status --short`
Expected: only `.planning/codebase/*.md` (+ spec/plan). No `src/` changes.

---

## Task 3: STACK.md

**Files:**
- Modify: `.planning/codebase/STACK.md`

- [ ] **Step 1: Confirm skeleton + read configs**

Read `.planning/codebase/STACK.md` headings (Languages, Runtime, Frameworks, Key Dependencies, Configuration, Platform Requirements, footer).
Read: `package.json`, `vite.config.ts`, `svelte.config.js`.

- [ ] **Step 2: Rewrite the file**

Preserve headings; stamp `2026-07-06`. Content:
- **Key Dependencies → Critical:** `paper`, `animejs`, `rune-sync` (the only runtime `dependencies`). Everything else dev.
- Add: Paraglide (`@inlang/paraglide-js`) i18n; Tailwind v4 stack (`@tailwindcss/vite`, `@tailwindcss/forms`, `@tailwindcss/typography`, `tw-animate-css`); `bits-ui`; `phosphor-svelte`; `@fontsource-variable/jetbrains-mono`.
- **Runtime:** browser-first SPA (`ssr=false`, `prerender=true`); node test runtime.
- **Configuration:** `adapter-static` `fallback: '404.html'`; `base` from `BASE_PATH`; paraglide vite plugin (`project.inlang`, outdir `src/lib/paraglide`).
- **Package Manager note:** scripts run `npm run …` while the declared PM is bun (`bun.lock`, CLAUDE.md) — cross-reference CONCERNS. State this as a fact, don't resolve it.

- [ ] **Step 3: Verify dependency names**

Run: `for d in paper animejs rune-sync @inlang/paraglide-js bits-ui phosphor-svelte @tailwindcss/vite; do grep -q "\"$d\"" package.json || echo "MISSING: $d"; done`
Expected: no `MISSING:` lines.

- [ ] **Step 4: Confirm scope** — `git status --short`; only `.planning` docs.

---

## Task 4: CONVENTIONS.md

**Files:**
- Modify: `.planning/codebase/CONVENTIONS.md`

- [ ] **Step 1: Confirm skeleton + sample real patterns**

Read `.planning/codebase/CONVENTIONS.md` headings (Naming Patterns, Code Style, Import Organization, Error Handling, Logging, Comments, Function Design, Module Design, Svelte 5 patterns, footer).
Read: `src/lib/components/SidebarNav.svelte` (resolve + `m.*`), `src/lib/state/animation-drivers/audio-bars-driver.ts` (driver factory), `src/lib/state/kaleidoscope.svelte.ts` (setters), `.prettierrc`, `eslint.config.js`.

- [ ] **Step 2: Rewrite the file**

Preserve headings; stamp `2026-07-06`. Refresh with current idioms:
- i18n: `m.*` from `$lib/paraglide/messages`; en/it parity (`messages-parity.spec.ts`).
- Routing: `resolve()` from `$app/paths` for every internal link/redirect (GH Pages base-path idiom); `page` from `$app/state`.
- Driver factory: `create<X>Driver()` → `{ init, dispose, frame(nowMs): Record<number, number> }`; registered in `animation.svelte.ts`.
- State: `*.svelte.ts` rune modules with a `$state` singleton + verb-first setters; facade/persistence split (`composition.ts` over `composition-persistence.svelte`); ring `id` keying via `ring-id`.
- Testing hooks: `data-testid` for nav/sections/layers.
- Keep formatting/lint/import-order guidance (tabs, single quotes, print width 100, `$lib` aliases), refreshed to current file examples.

- [ ] **Step 3: Verify referenced files exist**

Run: `for f in src/lib/paraglide/messages.js src/lib/components/SidebarNav.svelte src/lib/messages-parity.spec.ts .prettierrc eslint.config.js; do [ -e "$f" ] || echo "MISSING: $f"; done`
Expected: no `MISSING:` (paraglide `messages.js` exists only after `npm run paraglide`; if missing, reference the `messages/` source + generated `paraglide/` dir instead).

- [ ] **Step 4: Confirm scope** — `git status --short`; only `.planning` docs.

---

## Task 5: TESTING.md

**Files:**
- Modify: `.planning/codebase/TESTING.md`

- [ ] **Step 1: Confirm skeleton + enumerate tests**

Read `.planning/codebase/TESTING.md` headings (Test Framework, Test File Organization, Test Structure, coverage sections, Mocking, Fixtures, Coverage, Test Types, Common Patterns, footer).
Run: `find src -name '*.spec.ts' -o -name '*.e2e.ts' | sort` and re-read the `test` block in `vite.config.ts`.

- [ ] **Step 2: Rewrite the file**

Preserve headings; stamp `2026-07-06`. Content:
- **Runner:** Vitest multi-project `client` (browser/chromium) + `server` (node); `requireAssertions: true`.
- **Naming/split rule:** `*.svelte.spec.ts` → client/browser; `*.spec.ts` (non-svelte) → node; documented exception `state/animation.svelte.spec.ts` forced into node (excluded from client, included in server).
- **E2E:** Playwright `*.e2e.ts` — `(app)/workspace-nav.e2e.ts`, `about/about-nav.e2e.ts`, `paths/path-manager.e2e.ts`, `demo/playwright/page.svelte.e2e.ts`.
- Refresh the structure tree + coverage sections to current subsystems: drivers, keyframes, kaleidoscope, path-library, wave, zones, aspect-ratio, messages-parity. Replace the April animation-only coverage narrative.
- Keep Mocking / Fixtures / Common Patterns guidance, refreshed to real current examples.

- [ ] **Step 3: Verify named spec files exist**

Run: `for f in src/routes/'(app)'/workspace-nav.e2e.ts src/routes/paths/path-manager.e2e.ts src/lib/messages-parity.spec.ts src/lib/state/animation.svelte.spec.ts; do [ -e "$f" ] || echo "MISSING: $f"; done`
Expected: no `MISSING:` lines.

- [ ] **Step 4: Confirm scope** — `git status --short`; only `.planning` docs.

---

## Task 6: INTEGRATIONS.md

**Files:**
- Modify: `.planning/codebase/INTEGRATIONS.md`

- [ ] **Step 1: Confirm skeleton + read integration points**

Read `.planning/codebase/INTEGRATIONS.md` headings (APIs & External Services, Data Storage, Auth, Monitoring, CI/CD, Environment Config, Webhooks, footer).
Read: `src/lib/state/animation-drivers/audio-source.ts`, `src/lib/export/canvas-export.ts`, `.github/workflows/deploy.yml`.
Run: `grep -rn "lsSync(" src/lib/state` to list exact localStorage keys.

- [ ] **Step 2: Rewrite the file**

Preserve headings; stamp `2026-07-06`. Content:
- **In-process engines:** `paper`, `animejs`.
- **Browser APIs:** WebAudio (`audio-source`: mic/file → AnalyserNode; `getExportAudioStream` tap); MediaRecorder WebM export (`export/canvas-export`) — runtime **video** path (decision 3).
- **Browser persistence:** `localStorage` via `rune-sync` — list the exact keys found in Step 1; Paraglide localStorage locale strategy.
- **File storage:** local file input for SVG import (`geometry/svg-import`) + audio file load.
- **CI/CD:** GitHub Pages via `.github/workflows/deploy.yml`; `BASE_PATH` build var.
- No remote APIs, no auth, no webhooks (confirm).

- [ ] **Step 3: Verify named files + keys**

Run: `[ -e src/lib/export/canvas-export.ts ] && [ -e src/lib/state/animation-drivers/audio-source.ts ] && [ -e .github/workflows/deploy.yml ] && echo OK || echo MISSING`
Expected: `OK`. And confirm each localStorage key you wrote appears in `grep -rn "lsSync(" src/lib/state`.

- [ ] **Step 4: Confirm scope** — `git status --short`; only `.planning` docs.

---

## Task 7: CONCERNS.md

**Files:**
- Modify: `.planning/codebase/CONCERNS.md`

- [ ] **Step 1: Confirm skeleton + verify each concern against code**

Read `.planning/codebase/CONCERNS.md` headings (Tech Debt, Known Bugs, Security, Performance, Fragile Areas, Scaling Limits, Dependencies at Risk, Missing Features, Test Coverage Gaps, footer).
Verify each candidate concern is still real:
- `grep -n "dispose" src/lib/geometry/render-pipeline.ts` — is it still a no-op? (carry forward only if true)
- Re-read the arbitration comments in `preview-presenter.svelte.ts` and the `DRIVER_LAYERS` / `LayerKind` logic in `animation.svelte.ts`.
- Re-read the primary-reseed stopgap in `updateRingPathVariant` (`composition.ts`).
- `grep -n '"name"' package.json` — confirm `test-logo-2`; confirm scripts use `npm run`.

- [ ] **Step 2: Rewrite the file (faithful audit, with file anchors + priority)**

Preserve headings; stamp `2026-07-06`. Real current concerns:
- **Fragile:** preview-presenter single-writer arbitration (flat `$effect` ↔ kaleidoscope rAF) — correctness-critical, flicker risk if a future writer ignores the `enabled` gate. Anchor `components/preview-presenter.svelte.ts`.
- **Tech debt / coupling:** driver ↔ audio-source lifecycle (`DRIVER_LAYERS` "last driver off tears down the audio source") + `LayerKind` string special-cases across `setLayerEnabled`/`syncActiveDrivers`/`applyKeyframes`. Anchor `state/animation.svelte.ts`.
- **Tech debt:** `updateRingPathVariant` primary-reseed **stopgap**; morph editing slated to move to Animate. Anchor `state/composition.ts`.
- **Dropped feature:** kaleidoscope **parameter keyframe authoring** removed (playback-only) per PR #13; to be re-homed in a future Animate pass.
- **Tooling inconsistency:** package name `test-logo-2` + `npm run` scripts vs bun-declared PM (`bun.lock`, CLAUDE.md).
- **Export (decision 3):** static PNG/SVG export lives inline in the presenter, not a dedicated module; a future static-export path is unbuilt and must stay distinct from the video path.
- Carry forward render-pipeline `dispose()` / render-warning-drop concerns **only if Step 1 confirms** they still hold.

- [ ] **Step 3: Verify anchors exist**

Run: `for f in src/lib/components/preview-presenter.svelte.ts src/lib/state/animation.svelte.ts src/lib/state/composition.ts src/lib/geometry/render-pipeline.ts; do [ -e "$f" ] || echo "MISSING: $f"; done`
Expected: no `MISSING:` lines.

- [ ] **Step 4: Confirm scope** — `git status --short`; only `.planning` docs.

---

## Task 8: Final verification

**Files:** none (verification only).

- [ ] **Step 1: All 7 files stamped current**

Run: `grep -l "2026-07-06" .planning/codebase/*.md | wc -l`
Expected: `7`.

- [ ] **Step 2: No April dates remain**

Run: `grep -rn "2026-04-27" .planning/codebase/ || echo "CLEAN"`
Expected: `CLEAN`.

- [ ] **Step 3: Scope is docs-only**

Run: `git status --short`
Expected: modified paths limited to `.planning/codebase/*.md` and the spec/plan under `docs/superpowers/`. No `src/`, config, or other changes.

- [ ] **Step 4: Print deliverable list**

Run: `git status --short .planning/codebase/`
Report the 7 regenerated files to the user and STOP. The user commits.

---

## Self-review notes

- **Spec coverage:** each spec per-file plan maps to Tasks 1–7; verification section → Task 8; export framing (decision 3) appears in Global Constraints + Tasks 2, 6, 7; faithful-audit decision → Task 7; skeleton-preserve decision → every task Step 1/2.
- **No commits:** enforced in Global Constraints + Task 8 Step 4 (user commits).
- **Path-existence checks** stand in for TDD since output is prose, not code.
