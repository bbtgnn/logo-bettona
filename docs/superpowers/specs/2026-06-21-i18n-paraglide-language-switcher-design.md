# i18n: unified language with a Paraglide-powered ENG/ITA switcher

**Date:** 2026-06-21
**Branch:** `feat/kaleidoscope`
**Status:** approved — ready for planning
**Order:** do this **before** `2026-06-21-animate-concurrent-layers-design.md` so the new
animate windows are authored bilingual from the start.

## Context

The UI mixes languages: some labels are English ("Wave crests", "Amplitude gain"), some
Italian ("Reattività audio", "Salva in libreria"). There is **no i18n library** in the
project. ~84 Svelte components contain ~150–300 user-facing strings once aria-labels,
placeholders, `<option>` text and `title` attributes are counted, not just text nodes.

We unify the language and add a switcher: a small **"lan" dropdown** in the header next to the
About link, with options **eng** / **ita**, each shown with a country flag. Selecting an
option switches the whole tool's language in place (no page reload, no URL change). The chosen
language persists across visits.

## Goals

1. Introduce **Paraglide JS** (inlang) as the i18n system: typed, compile-time messages.
2. Extract **every user-facing string** (app UI + the About page) into `en` / `it` messages.
3. Add a **header language switcher** (`lan`) next to About: `eng` / `ita` labels with flags.
4. **Default language = browser language** on first visit (Italian browser → ITA, else ENG);
   the user's explicit choice overrides and persists.
5. Switch language **in place** — no URL prefix, no full reload.

## Non-goals

- More than two locales (the system must *allow* growth, but only `en` + `it` are authored).
- Localizing numbers/dates/currencies (not needed by this tool today).
- Right-to-left support.
- Translating developer-only / test strings, code comments, commit text.

## Design decisions (resolved during brainstorming)

| Decision | Choice |
|---|---|
| Mechanism | Paraglide JS v2 (the professional SvelteKit standard). |
| Order vs concurrent-layers | i18n first; layer windows built bilingual afterwards. |
| Locale strategy | No URL prefix. `localStorage` + `cookie` + browser preference + base locale. |
| Default on first visit | Browser language (`preferredLanguage`): IT browser → `it`, else `en`. |
| Translation scope | Entire app **and** the About page, this pass. |
| Switcher UI | Header dropdown labelled `lan`, options `eng`/`ita` with flags, next to About. |

## Architecture

### Paraglide setup

- Initialize Paraglide JS v2 (`@inlang/paraglide-js`): creates `project.inlang/settings.json`,
  message catalogs `messages/en.json` and `messages/it.json`, and compiles typed message
  functions into `src/lib/paraglide/` (imported as `import * as m from '$lib/paraglide/messages'`,
  used as `m.some_key()`).
- Wire the Vite plugin in `vite.config.ts` (`paraglideVitePlugin({ project, outdir, strategy })`).
- `baseLocale: 'en'`, `locales: ['en', 'it']`.
- **Strategy** (no URL): `['localStorage', 'cookie', 'preferredLanguage', 'baseLocale']`.
  - `localStorage`/`cookie` carry the explicit user choice across visits.
  - `preferredLanguage` provides the first-visit default from the browser (Accept-Language on
    the server, `navigator.language` on the client).
  - `baseLocale` (`en`) is the final fallback.
- Generated `src/lib/paraglide/` output: follow Paraglide's recommendation (typically
  git-ignored and regenerated on build/`postinstall`); add a `postinstall`/`prepare` or build
  step so `bun run check`, vitest and CI have the generated files. The planner confirms the
  exact v2 API surface (`getLocale`/`setLocale`/`deLocalizeHref`, plugin option names) against
  the installed version during implementation — treat the names here as indicative.
- Server hooks: with a non-URL strategy these are minimal/optional. Add `src/hooks.ts` /
  `src/hooks.server.ts` only if the installed Paraglide version requires it for
  `preferredLanguage` / cookie handling (verify during planning). No `reroute` needed.

### Message catalog conventions

- Keys are namespaced by area, snake/dot style consistent with Paraglide (e.g.
  `timeline_play`, `animate_audio_reactivity`, `editor_save_to_library`). Pick one convention
  in phase 1 and apply it throughout.
- Parameterized strings use Paraglide message params (e.g. `ring_label` with `{index}`),
  replacing string interpolation like `Ring {index + 1}`.
- Both `en.json` and `it.json` are filled for every key in the same commit — no half-translated
  keys land. Existing Italian labels seed `it`, existing English labels seed `en`; the missing
  side is authored.

### Language switcher component

- New `LanguageSwitcher.svelte`: a compact dropdown rendered in the header of
  `src/routes/(app)/+layout.svelte`, placed **before** the About link (About keeps `ml-auto`;
  the switcher sits just left of it).
- Reads the current locale from Paraglide's runtime (`getLocale`) and sets it with `setLocale`
  on change. `setLocale` persists via the configured strategy and updates the UI in place.
- Options: `eng` (flag 🇬🇧) and `ita` (flag 🇮🇹). Label/trigger reads `lan`. Flags via emoji to
  avoid asset/build overhead; revisit if emoji flags render poorly on the target platform.
- Accessible: the control has an aria-label (itself a translated message,
  e.g. `header_language`); options are reachable by keyboard.
- About also gets translated (`header_about`), so the header is fully localized.

### Where strings live

Every literal currently in markup/attributes across the app moves into messages. Inventory by
area (each becomes a phase): header/nav, editor sidebar sections (Settings, Canvas, Colors,
Rings/RingEditor, Kaleidoscope), animate sidebar (AnimationSection & friends), timeline
(TimelinePanel, ruler, tracks, inspector), preview/canvas + export, paths workspace, About
page, and shared components (dialogs, sheets, library items).

## Phases (each a single commit, tested)

1. **Bootstrap Paraglide** — init, Vite plugin, `settings.json`, `en/it` catalogs, generated
   output wired into build/`check`/tests, strategy configured. Migrate the **header**
   (About + switcher) as the first real surface: add `LanguageSwitcher.svelte`, translate the
   header strings, prove switching works end-to-end (default from browser, persists on reload).
2. **Editor sidebar** — Settings, Canvas, Colors, Rings/RingEditor, Kaleidoscope section
   strings → messages (both locales).
3. **Animate sidebar** — AnimationSection and related components → messages.
4. **Timeline** — TimelinePanel, ruler, tracks, inspector, transport → messages.
5. **Preview / canvas / export + Paths workspace** → messages.
6. **About page** — full prose translated → messages.
7. **Sweep** — grep for any remaining hardcoded user-facing literal (aria-labels, placeholders,
   `<option>` text, `title`); fold stragglers into messages. A short checklist/grep confirms
   coverage.

Phase boundaries may merge/split per the planner; each phase keeps both locales complete.

## Testing

- **Switcher behavior (component, vitest browser):** default locale derives from browser
  preference; selecting `ita`/`eng` updates rendered text and the choice survives a remount
  (persistence). Assert the switcher exposes both options with their labels.
- **Message rendering:** for representative components, set locale via Paraglide runtime and
  assert the rendered text matches the expected `en` vs `it` message (assert text/aria, never
  computed layout — Tailwind is absent in vitest DOM).
- **Catalog integrity:** a test (or lint step) asserts `en.json` and `it.json` have identical
  key sets — no key translated on only one side.
- Every `.svelte`/`.svelte.ts` passes svelte-autofixer (`issues:[]`); `bun run check` 0 errors;
  full `bun run test:unit -- run` green. Ensure generated `src/lib/paraglide/` exists before
  `check`/tests run (build/postinstall step).

## Risks / notes

- **Generated output in CI/tests:** the `src/lib/paraglide/` directory must exist before
  type-check and tests. Add a `prepare`/`postinstall` (or `pretest`/`precheck`) that runs the
  Paraglide compile, or commit the generated files — decide in phase 1 and document it.
- **SSR + adapter:** confirm the configured adapter serves the cookie/localStorage strategy
  without a server `reroute`. If `preferredLanguage` needs the request on the server, a tiny
  `hooks.server.ts` may be required — verify against the installed version.
- **Volume:** the extraction is the bulk of the effort (~150–300 strings). Phasing by area
  keeps each commit reviewable and keeps both locales complete at every step.
- **Emoji flags** may render inconsistently on some platforms; acceptable for now, swap to SVG
  later if needed.
- **Coupling with concurrent-layers spec:** once this lands, the layer windows (Simple, Data
  Series, Audio Bars, Audio Zones placeholder copy, switches) are authored directly as `m.*()`
  messages — that spec's UI strings go into the catalogs, not back into literals.
