# i18n with Paraglide + ENG/ITA Language Switcher — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Unify the mixed EN/IT interface under Paraglide JS v2 and add a header `lan` dropdown (eng/ita + flags) that switches the whole tool's language in place.

**Architecture:** Paraglide JS v2 compiles typed message functions from `messages/{en,it}.json` into `src/lib/paraglide/`. The app is statically adapted (`adapter-static`), so the locale is resolved **client-side** (no server hooks). A small reactive `locale` rune drives a root-level `{#key}` so every `m.*()` call re-evaluates when the user switches language — no full page reload. Strings are extracted area by area; each area is a commit with both locales complete.

**Tech Stack:** SvelteKit 2.50 (`adapter-static`), Svelte 5.54 runes, Vite 7.3, Paraglide JS v2 (`@inlang/paraglide-js`), Vitest browser + node projects, bun.

## Global Constraints

- Package manager is **bun**. Single spec: `bun run test:unit -- run <path>`. Full unit: `bun run test:unit -- run`. Type-check: `bun run check`. Filter one test: append `-t "name"`.
- Every `.svelte` / `.svelte.ts` must pass the Svelte MCP **svelte-autofixer** with `issues: []` before commit. Known false-positive *suggestions* to ignore: `bind:this`→attachment; "function/stateful-var called inside `$effect`". Gate on `issues: []` only. Pure `.ts` files don't need it.
- Tailwind is **absent** in the vitest DOM. Assert structure / `data-testid` / ARIA / text content, never computed layout.
- Tab indentation. After wrapping markup in new containers, run `bunx prettier --write <file>` to normalise indentation.
- Commit trailer on every commit: `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`. The commit hook does NOT auto-push.
- Both `messages/en.json` and `messages/it.json` get every new key in the **same commit** — never land a key on only one side (a parity test enforces this from Task 1 onward).
- Locales: `baseLocale: 'en'`, `locales: ['en', 'it']`. Strategy (client, static app): `['localStorage', 'preferredLanguage', 'baseLocale']`. No `url` strategy, no `reroute`, no server hooks.
- Message-key convention: `area_subject[_qualifier]`, lower_snake_case, area prefix one of `header_ editor_ animate_ timeline_ preview_ paths_ about_ common_`. Parameters use Paraglide params: `m.key({ name })`.

---

### Task 1: Bootstrap Paraglide (config, plugin, scripts, seed catalog, parity test)

Installs Paraglide, wires the Vite plugin and the compile-for-check script, seeds the catalogs with one real header message, and adds the catalog-parity guard. No UI behavior changes yet beyond the header "About" text resolving through a message.

**Files:**
- Modify: `package.json` (add dep + scripts)
- Create: `project.inlang/settings.json`
- Create: `messages/en.json`
- Create: `messages/it.json`
- Modify: `vite.config.ts:1-7` (add plugin import + plugin call)
- Modify: `.gitignore` (ignore generated output)
- Modify: `src/app.html:2` (`lang="%paraglide.lang%"` placeholder handling — see step)
- Create: `src/lib/messages-parity.spec.ts` (node test)

**Interfaces:**
- Produces: generated `$lib/paraglide/messages.js` (named export `m`) and `$lib/paraglide/runtime.js` (named exports `getLocale`, `setLocale`, `locales`, `baseLocale`, `Locale` type). Consumed by all later tasks.
- Produces message key `header_about` (value "About" / "About") — Task 3 consumes it.

- [ ] **Step 1: Install Paraglide**

Run:
```bash
bun add -D @inlang/paraglide-js
```
Expected: `@inlang/paraglide-js` appears under devDependencies.

- [ ] **Step 2: Create the inlang project settings**

Create `project.inlang/settings.json`:
```json
{
	"$schema": "https://inlang.com/schema/project-settings",
	"baseLocale": "en",
	"locales": ["en", "it"],
	"modules": [
		"https://cdn.jsdelivr.net/npm/@inlang/plugin-message-format@latest/dist/index.js",
		"https://cdn.jsdelivr.net/npm/@inlang/plugin-m-function-matcher@latest/dist/index.js"
	],
	"plugin.inlang.messageFormat": {
		"pathPattern": "./messages/{locale}.json"
	}
}
```

- [ ] **Step 3: Create the seed catalogs**

Create `messages/en.json`:
```json
{
	"$schema": "https://inlang.com/schema/inlang-message-format",
	"header_about": "About"
}
```
Create `messages/it.json`:
```json
{
	"$schema": "https://inlang.com/schema/inlang-message-format",
	"header_about": "About"
}
```
(“About” is identical in both languages — that is fine; it is a real key both sides define.)

- [ ] **Step 4: Wire the Vite plugin**

Modify `vite.config.ts` — add the import and the plugin (note `strategy` has no `url`, so no hooks are needed):
```ts
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vitest/config';
import { playwright } from '@vitest/browser-playwright';
import { sveltekit } from '@sveltejs/kit/vite';
import { paraglideVitePlugin } from '@inlang/paraglide-js';

export default defineConfig({
	plugins: [
		tailwindcss(),
		sveltekit(),
		paraglideVitePlugin({
			project: './project.inlang',
			outdir: './src/lib/paraglide',
			strategy: ['localStorage', 'preferredLanguage', 'baseLocale']
		})
	],
	test: {
		// ...unchanged
```
Leave the entire `test: { ... }` block exactly as it is.

- [ ] **Step 5: Add compile script + wire into check/prepare; ignore generated output**

Modify `package.json` scripts (generated files are not committed; the Vite plugin builds them for dev/build/test, and `paraglide` builds them for `check`):
```json
"prepare": "svelte-kit sync && npm run paraglide || echo ''",
"check": "npm run paraglide && svelte-kit sync && svelte-check --tsconfig ./tsconfig.json",
"check:watch": "npm run paraglide && svelte-kit sync && svelte-check --tsconfig ./tsconfig.json --watch",
"paraglide": "paraglide-js compile --project ./project.inlang --outdir ./src/lib/paraglide",
```
Add to `.gitignore` (new line):
```
/src/lib/paraglide
```

- [ ] **Step 6: Compile once and verify the generated runtime exists**

Run:
```bash
bun run paraglide && ls src/lib/paraglide
```
Expected: directory contains `messages.js` (or `messages/`) and `runtime.js`. If the command reports it cannot fetch modules, ensure network access then re-run (modules are cached after first run).

- [ ] **Step 7: Write the failing parity test**

Create `src/lib/messages-parity.spec.ts`:
```ts
import { describe, it, expect } from 'vitest';
import en from '../../messages/en.json';
import itLocale from '../../messages/it.json';

function keys(obj: Record<string, unknown>): string[] {
	return Object.keys(obj)
		.filter((k) => k !== '$schema')
		.sort();
}

describe('message catalogs', () => {
	it('en and it define exactly the same keys', () => {
		expect(keys(en as Record<string, unknown>)).toEqual(keys(itLocale as Record<string, unknown>));
	});
});
```

- [ ] **Step 8: Run the parity test — expect PASS (seed catalogs already match)**

Run:
```bash
bun run test:unit -- run src/lib/messages-parity.spec.ts
```
Expected: PASS (both files define only `header_about`). This test now guards every later catalog edit.

- [ ] **Step 9: Verify type-check passes with the plugin wired in**

Run:
```bash
bun run check
```
Expected: 0 errors. (Confirms `paraglide` compile + svelte-check chain works.)

- [ ] **Step 10: Commit**

```bash
git add package.json vite.config.ts .gitignore project.inlang messages src/lib/messages-parity.spec.ts bun.lock
git commit -m "feat(i18n): bootstrap Paraglide JS v2 + catalog parity guard

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 2: Reactive locale module + root re-render on switch

A static app resolves locale client-side; switching must update every `m.*()` without a full reload. A `locale` rune wraps Paraglide's `setLocale`/`getLocale`; the `(app)` and `about` layouts wrap their content in `{#key currentLocale()}` so the subtree re-renders on switch.

**Files:**
- Create: `src/lib/state/locale.svelte.ts`
- Create: `src/lib/state/locale.svelte.spec.ts`
- Modify: `src/routes/(app)/+layout.svelte` (wrap `{@render children()}` region in `{#key}`)

**Interfaces:**
- Consumes: `getLocale`, `setLocale`, `Locale` from `$lib/paraglide/runtime`.
- Produces: `currentLocale(): Locale`, `switchLocale(next: Locale): void`. Task 3 consumes both.

- [ ] **Step 1: Write the failing test**

Create `src/lib/state/locale.svelte.spec.ts`:
```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { currentLocale, switchLocale } from './locale.svelte';

describe('locale rune', () => {
	beforeEach(() => switchLocale('en'));

	it('reports the current locale', () => {
		expect(currentLocale()).toBe('en');
	});

	it('updates the current locale on switch', () => {
		switchLocale('it');
		expect(currentLocale()).toBe('it');
	});
});
```

- [ ] **Step 2: Run it — expect FAIL**

Run:
```bash
bun run test:unit -- run src/lib/state/locale.svelte.spec.ts
```
Expected: FAIL — `./locale.svelte` does not exist.

- [ ] **Step 3: Implement the locale rune**

Create `src/lib/state/locale.svelte.ts`:
```ts
import { getLocale, setLocale, type Locale } from '$lib/paraglide/runtime';

let current = $state<Locale>(getLocale());

export function currentLocale(): Locale {
	return current;
}

// reload:false keeps app state alive; we drive re-render via {#key currentLocale()}.
// Also update <html lang> since no server set it for the static export.
export function switchLocale(next: Locale): void {
	setLocale(next, { reload: false });
	current = next;
	if (typeof document !== 'undefined') {
		document.documentElement.lang = next;
	}
}
```

- [ ] **Step 4: Run it — expect PASS**

Run:
```bash
bun run test:unit -- run src/lib/state/locale.svelte.spec.ts
```
Expected: PASS. If `setLocale` rejects the `{ reload: false }` option for the installed version, check the runtime's `setLocale` signature in `src/lib/paraglide/runtime.js` and use the supported form (v2 accepts `setLocale(locale, { reload })`).

- [ ] **Step 5: Run autofixer on the rune module**

Use the Svelte MCP `svelte-autofixer` on `src/lib/state/locale.svelte.ts`. Resolve until `issues: []` (ignore the known false-positive suggestions listed in Global Constraints).

- [ ] **Step 6: Wrap the app layout content for re-render**

Modify `src/routes/(app)/+layout.svelte`. Add the import and key the rendered children + canvas region on the locale. Replace the `<SidebarUI.SidebarContent ...>` children render and the `<main>`/`TimelinePanel` region so the whole inset re-renders:
```svelte
<script lang="ts">
	import { page } from '$app/state';
	import * as SidebarUI from '$lib/shadcn/ui/sidebar/index.js';
	import WorkspaceNav from '$lib/components/WorkspaceNav.svelte';
	import PreviewCanvas from '$lib/components/PreviewCanvas.svelte';
	import TimelinePanel from '$lib/components/TimelinePanel.svelte';
	import { currentLocale } from '$lib/state/locale.svelte';

	let { children } = $props();

	const isAnimate = $derived((page.url?.pathname ?? '').startsWith('/animate'));
</script>

{#key currentLocale()}
	<SidebarUI.SidebarProvider>
		<SidebarUI.Sidebar>
			<SidebarUI.SidebarContent class="divide-y divide-border" data-testid="sidebar-content">
				{@render children()}
			</SidebarUI.SidebarContent>
		</SidebarUI.Sidebar>

		<SidebarUI.SidebarInset>
			<header class="flex items-center gap-2 border-b p-4">
				<SidebarUI.SidebarTrigger />
				<WorkspaceNav />
				<a
					href="/about"
					class="ml-auto text-sm text-muted-foreground hover:text-foreground"
					data-testid="header-about-link"
				>
					About
				</a>
			</header>
			<main class="flex flex-1 items-center justify-center p-8" data-testid="app-canvas">
				<PreviewCanvas animate={isAnimate} />
			</main>
			{#if isAnimate}
				<TimelinePanel />
			{/if}
		</SidebarUI.SidebarInset>
	</SidebarUI.SidebarProvider>
{/key}
```
(The About link text becomes a message in Task 3; the switcher is added there too.)

- [ ] **Step 7: prettier + autofixer the layout**

Run:
```bash
bunx prettier --write "src/routes/(app)/+layout.svelte"
```
Then run `svelte-autofixer` on it until `issues: []`.

- [ ] **Step 8: Type-check**

Run:
```bash
bun run check
```
Expected: 0 errors.

- [ ] **Step 9: Commit**

```bash
git add src/lib/state/locale.svelte.ts src/lib/state/locale.svelte.spec.ts "src/routes/(app)/+layout.svelte"
git commit -m "feat(i18n): reactive locale rune + root re-render on switch

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 3: LanguageSwitcher component + localized header

Adds the `lan` dropdown (eng 🇬🇧 / ita 🇮🇹) just left of the About link, wired to `switchLocale`, and converts the header's "About" to a message. Proves the end-to-end switch in a component test.

**Files:**
- Create: `src/lib/components/LanguageSwitcher.svelte`
- Create: `src/lib/components/LanguageSwitcher.svelte.spec.ts`
- Modify: `messages/en.json`, `messages/it.json` (add `header_about` already exists; add `header_language`)
- Modify: `src/routes/(app)/+layout.svelte` (insert switcher, message-ize About)

**Interfaces:**
- Consumes: `currentLocale`, `switchLocale` from `$lib/state/locale.svelte`; `m` from `$lib/paraglide/messages`; `locales` from `$lib/paraglide/runtime`.
- Produces: `<LanguageSwitcher />` rendering a `<select data-testid="language-switcher">` with options `en`/`it`.

- [ ] **Step 1: Add header_language to both catalogs**

`messages/en.json` add: `"header_language": "lan"`.
`messages/it.json` add: `"header_language": "lan"`.
(The visible trigger label is the playful "lan" in both languages, per the design.)

- [ ] **Step 2: Recompile so `m.header_language` exists**

Run:
```bash
bun run paraglide
```
Expected: no error.

- [ ] **Step 3: Write the failing component test**

Create `src/lib/components/LanguageSwitcher.svelte.spec.ts`:
```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { page } from '@vitest/browser/context';
import LanguageSwitcher from './LanguageSwitcher.svelte';
import { currentLocale, switchLocale } from '$lib/state/locale.svelte';

describe('LanguageSwitcher', () => {
	beforeEach(() => switchLocale('en'));

	it('renders eng and ita options with flags', async () => {
		render(LanguageSwitcher);
		const select = page.getByTestId('language-switcher');
		await expect.element(select).toBeInTheDocument();
		await expect.element(page.getByRole('option', { name: /eng/i })).toBeInTheDocument();
		await expect.element(page.getByRole('option', { name: /ita/i })).toBeInTheDocument();
	});

	it('switches the locale when a different option is chosen', async () => {
		render(LanguageSwitcher);
		const select = page.getByTestId('language-switcher');
		await select.selectOptions('it');
		expect(currentLocale()).toBe('it');
	});
});
```
(Use the project's existing component-test imports if they differ — match a sibling `*.svelte.spec.ts` in `src/lib/components/`.)

- [ ] **Step 4: Run it — expect FAIL**

Run:
```bash
bun run test:unit -- run src/lib/components/LanguageSwitcher.svelte.spec.ts
```
Expected: FAIL — component does not exist.

- [ ] **Step 5: Implement the switcher**

Create `src/lib/components/LanguageSwitcher.svelte`:
```svelte
<script lang="ts">
	import { m } from '$lib/paraglide/messages';
	import { currentLocale, switchLocale } from '$lib/state/locale.svelte';
	import type { Locale } from '$lib/paraglide/runtime';

	const OPTIONS: { value: Locale; label: string; flag: string }[] = [
		{ value: 'en', label: 'eng', flag: '🇬🇧' },
		{ value: 'it', label: 'ita', flag: '🇮🇹' }
	];
</script>

<label class="flex items-center gap-1 text-sm text-muted-foreground">
	<span class="sr-only">{m.header_language()}</span>
	<select
		data-testid="language-switcher"
		aria-label={m.header_language()}
		class="h-7 rounded border bg-background px-1 text-xs"
		value={currentLocale()}
		onchange={(e) => switchLocale((e.currentTarget as HTMLSelectElement).value as Locale)}
	>
		{#each OPTIONS as opt (opt.value)}
			<option value={opt.value}>{opt.flag} {opt.label}</option>
		{/each}
	</select>
</label>
```

- [ ] **Step 6: Run it — expect PASS**

Run:
```bash
bun run test:unit -- run src/lib/components/LanguageSwitcher.svelte.spec.ts
```
Expected: PASS.

- [ ] **Step 7: autofixer the component**

Run `svelte-autofixer` on `src/lib/components/LanguageSwitcher.svelte` until `issues: []`.

- [ ] **Step 8: Insert switcher into header + message-ize About**

Modify `src/routes/(app)/+layout.svelte` — import the switcher and the messages module, place the switcher before the About link, and replace the literal "About":
```svelte
	import { m } from '$lib/paraglide/messages';
	import LanguageSwitcher from '$lib/components/LanguageSwitcher.svelte';
```
In the header, change the About anchor region to:
```svelte
			<header class="flex items-center gap-2 border-b p-4">
				<SidebarUI.SidebarTrigger />
				<WorkspaceNav />
				<div class="ml-auto flex items-center gap-3">
					<LanguageSwitcher />
					<a
						href="/about"
						class="text-sm text-muted-foreground hover:text-foreground"
						data-testid="header-about-link"
					>
						{m.header_about()}
					</a>
				</div>
			</header>
```

- [ ] **Step 9: prettier + autofixer the layout, then parity + type-check**

Run:
```bash
bunx prettier --write "src/routes/(app)/+layout.svelte"
bun run test:unit -- run src/lib/messages-parity.spec.ts
bun run check
```
Expected: parity PASS, check 0 errors. Run `svelte-autofixer` on the layout until `issues: []`.

- [ ] **Step 10: Commit**

```bash
git add messages "src/routes/(app)/+layout.svelte" src/lib/components/LanguageSwitcher.svelte src/lib/components/LanguageSwitcher.svelte.spec.ts
git commit -m "feat(i18n): header language switcher (eng/ita) + localized About

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Extraction tasks (4–8): shared procedure

Tasks 4–8 each localize one area. They are mechanical and identical in method; only the file set and strings differ. For **every** user-facing string in the area's files:

1. Pick a key following the convention (`area_subject`), e.g. `editor_save_to_library`.
2. Add it to **both** `messages/en.json` and `messages/it.json`. Seed the side matching the existing literal verbatim; author the other side. (Existing Italian literal → fill `it`, author `en`; existing English literal → fill `en`, author `it`.)
3. In the component, replace the literal with `m.key()` (import `import { m } from '$lib/paraglide/messages';` once per file). For attributes: `aria-label={m.key()}`, `placeholder={m.key()}`, `title={m.key()}`. For `<option>` text and interpolations, use params: `Ring {index + 1}` → message `ring_label: "Ring {index}"` (en) / `"Anello {index}"` (it), called `m.ring_label({ index: index + 1 })`.
4. After editing a file, run `bun run paraglide`, then `bunx prettier --write <file>`, then `svelte-autofixer` until `issues: []`.

**Cover ALL of these literal sources, not just text nodes:** visible text, `aria-label`, `placeholder`, `title`, `<option>` labels, and string interpolations.

Each task ends with: parity test PASS, the area's existing component specs updated if they assert on literal text (switch assertions to the locale-appropriate `m.key()` value or to `data-testid`), `bun run check` 0 errors, full unit run green for touched specs, commit.

> **Note for executor:** do not invent a different key for the same English word used in two unrelated places if the Italian differs — give each its own contextual key (e.g. `common_close` vs a context-specific one). When the same word genuinely means the same thing everywhere, reuse one `common_*` key (DRY).

---

### Task 4: Editor sidebar strings

**Files (modify each; add keys to both catalogs):**
- `src/lib/components/SettingsSection.svelte`
- `src/lib/components/CanvasSection.svelte`
- `src/lib/components/ColorsSection.svelte`
- `src/lib/components/RingEditor.svelte`
- `src/lib/components/KaleidoscopeSection.svelte`
- `src/lib/components/SidebarCollapsible.svelte` (any literal trigger fallback text)
- `src/lib/components/AnimatableSlider.svelte` (the `aria-label="Anima {param.label}"`, `title`)
- `src/lib/state/kaleidoscope-params.ts` — **special:** the `label` strings (`'Rotazione globale'`, etc.) are localized by turning `label: string` into `label: () => string` returning `m.*()`.
- Test: update `src/lib/components/KaleidoscopeSection.svelte.spec.ts`, `src/lib/components/AnimatableSlider.svelte.spec.ts`, and `src/routes/(app)/editor/page.svelte.spec.ts` where they assert literal text.

**Interfaces:**
- Produces: `KaleidoParam.label` becomes `label: () => string`. **Consumers must call `param.label()`** — update `AnimatableSlider.svelte` (`{param.label}` → `{param.label()}`, `aria-label={...param.label...}` → uses `param.label()`) and `TimelinePanel.svelte` (`p.label` → `p.label()`, handled in Task 6). Also `KALEIDO_PARAM_BY_ID` keeps the same shape.

- [ ] **Step 1: Convert the kaleidoscope param registry label to a function**

In `src/lib/state/kaleidoscope-params.ts`, import messages and change the type + each entry. Type change:
```ts
import { m } from '$lib/paraglide/messages';

export type KaleidoParam = {
	id: string;
	label: () => string;
	min: number;
	max: number;
	step: number;
	get(): number;
	set(v: number): void;
};
```
Each entry's `label` becomes a thunk, e.g.:
```ts
	{
		id: KALEIDO_GLOBAL_ROTATION,
		label: () => m.editor_kaleido_global_rotation(),
		min: 0,
		max: 360,
		step: 1,
		get: () => kaleidoscope.globalRotation,
		set: setGlobalRotation
	},
```
Add keys for all eight labels to both catalogs (en seed = current Italian meaning translated to English, it seed = the current Italian literal):
`editor_kaleido_global_rotation` ("Global rotation" / "Rotazione globale"), `editor_kaleido_tile_rotation` ("Tile rotation" / "Rotazione tessera"), `editor_kaleido_carpet_rotation` ("Carpet rotation" / "Rotazione tappeto"), `editor_kaleido_scale` ("Global scale" / "Scala globale"), `editor_kaleido_offset_distance` ("Distance from centre" / "Distanza dal centro"), `editor_kaleido_tile_size` ("Tile size" / "Dimensione tessera"), `editor_kaleido_sectors` ("Sectors" / "Settori"), `editor_kaleido_repeat` ("Repeats" / "Ripetizioni").

- [ ] **Step 2: Update label consumers to call the thunk**

In `src/lib/components/AnimatableSlider.svelte`: `{param.label}` → `{param.label()}`; `aria-label="Anima {param.label}"` → `aria-label={m.editor_animate_param({ label: param.label() })}` with catalog key `editor_animate_param: "Animate {label}"` / `"Anima {label}"`; the `<span>` `{param.label} ({param.get()})` → `{param.label()} ({param.get()})`; `title="Anima questo parametro"` → `title={m.editor_animate_this_param()}` (`"Animate this parameter"` / `"Anima questo parametro"`).

- [ ] **Step 3: Extract the remaining editor component strings**

Apply the shared procedure (above) to each editor file in the Files list. Recompile after edits:
```bash
bun run paraglide
```

- [ ] **Step 4: Update affected component specs**

Where `KaleidoscopeSection.svelte.spec.ts`, `AnimatableSlider.svelte.spec.ts`, or `editor/page.svelte.spec.ts` query by literal text (e.g. `getByText('Rotazione globale')`), switch the query to the message value for the test's locale (default `en` → "Global rotation") or to a stable `data-testid`/`aria-label`. Keep assertions meaningful.

- [ ] **Step 5: prettier + autofixer every touched `.svelte`**

Run `bunx prettier --write` on each touched `.svelte`, then `svelte-autofixer` until `issues: []` for each.

- [ ] **Step 6: Run the editor tests + parity + check**

Run:
```bash
bun run test:unit -- run src/lib/components/KaleidoscopeSection.svelte.spec.ts src/lib/components/AnimatableSlider.svelte.spec.ts "src/routes/(app)/editor/page.svelte.spec.ts" src/lib/messages-parity.spec.ts
bun run check
```
Expected: all PASS, check 0 errors.

- [ ] **Step 7: Commit**

```bash
git add messages src/lib/components/SettingsSection.svelte src/lib/components/CanvasSection.svelte src/lib/components/ColorsSection.svelte src/lib/components/RingEditor.svelte src/lib/components/KaleidoscopeSection.svelte src/lib/components/SidebarCollapsible.svelte src/lib/components/AnimatableSlider.svelte src/lib/state/kaleidoscope-params.ts src/lib/components/KaleidoscopeSection.svelte.spec.ts src/lib/components/AnimatableSlider.svelte.spec.ts "src/routes/(app)/editor/page.svelte.spec.ts"
git commit -m "feat(i18n): localize editor sidebar strings

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 5: Animate sidebar strings

**Files (modify; add keys both catalogs):**
- `src/lib/components/AnimationSection.svelte` (e.g. "Reattività audio", "I petali reagiscono al suono…", "Tipo di reattività", "Sorgente movimento", "Simple · morph tra forme", "Audio source", "Input level", "Input gain", "Wave crests", "Amplitude gain", "Phase speed", "Smoothing", "Wave per ring", "Intensità per banda", "Bassi · punta", "Medi · fianchi", "Alti · base", the yellow warning, etc.)
- `src/lib/components/RingWaveConfigItem.svelte` ("Ring {index+1}", "(custom)", "Customize wave for this ring", "Wave crests", "Amplitude gain", "Phase speed")
- `src/lib/components/AudioFilePanel.svelte`
- Test: update `src/lib/components/AnimationSection.svelte.spec.ts` and `src/routes/(app)/animate/page.svelte.spec.ts` where they assert literal text.

- [ ] **Step 1: Extract per the shared procedure**

Apply the shared procedure to each file. For `Ring {index + 1}` use a param message `animate_ring_label: "Ring {index}"` / `"Anello {index}"` called `m.animate_ring_label({ index: index + 1 })`. Recompile:
```bash
bun run paraglide
```

- [ ] **Step 2: Update affected specs**

Switch literal-text queries in `AnimationSection.svelte.spec.ts` and `animate/page.svelte.spec.ts` to the default-locale message value or a `data-testid`. Note `data-testid="audio-reactivity-toggle"` already exists — prefer those stable hooks.

- [ ] **Step 3: prettier + autofixer**

`bunx prettier --write` each touched `.svelte`, then `svelte-autofixer` to `issues: []`.

- [ ] **Step 4: Tests + parity + check**

Run:
```bash
bun run test:unit -- run src/lib/components/AnimationSection.svelte.spec.ts "src/routes/(app)/animate/page.svelte.spec.ts" src/lib/messages-parity.spec.ts
bun run check
```
Expected: PASS, 0 errors.

- [ ] **Step 5: Commit**

```bash
git add messages src/lib/components/AnimationSection.svelte src/lib/components/RingWaveConfigItem.svelte src/lib/components/AudioFilePanel.svelte src/lib/components/AnimationSection.svelte.spec.ts "src/routes/(app)/animate/page.svelte.spec.ts"
git commit -m "feat(i18n): localize animate sidebar strings

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 6: Timeline strings

**Files (modify; add keys both catalogs):**
- `src/lib/components/TimelinePanel.svelte` ("Timeline", "Play"/"Pause", "Stop", "Dur"/"s", "fps", "Graph Editor", "Mostra/nascondi timeline", "Elapsed time", "Arma un cronometro ⏱ nella sidebar…", "Parametro grafico", "Interpolazione keyframe", "Lineare"/"Bezier"/"Hold", "Elimina keyframe", zoom aria-labels "Zoom indietro"/"Zoom avanti"). **Also:** `p.label` → `p.label()` for the Task 4 thunk change (in `armedParams` rendering and the graph `<option>`).
- `src/lib/components/TimelineTrack.svelte`
- `src/lib/components/TimelineRuler.svelte`
- `src/lib/components/KeyframeGraphEditor.svelte`
- Test: `TimelinePanel.svelte.spec.ts`, `TimelineTrack.svelte.spec.ts`, `TimelineRuler.svelte.spec.ts`, `KeyframeGraphEditor.svelte.spec.ts` where they assert literal text.

- [ ] **Step 1: Apply `p.label()` change + extract strings**

In `TimelinePanel.svelte`, every `p.label` (graph `<option>` text, and any track label passed to `TimelineTrack`) becomes `p.label()`. Then extract all literals per the shared procedure. The transport `Play`/`Pause` is `{animationState.isPlaying ? m.timeline_pause() : m.timeline_play()}`. Recompile:
```bash
bun run paraglide
```

- [ ] **Step 2: Update affected specs**

Switch literal-text queries to message values (default `en`) or `data-testid` (`timeline-panel`, `timeline-empty`, `timeline-zoom`, `playhead`, `frame-tick`, `timeline-tracks` already exist — prefer them).

- [ ] **Step 3: prettier + autofixer**

`bunx prettier --write` each touched `.svelte`, then `svelte-autofixer` to `issues: []`.

- [ ] **Step 4: Tests + parity + check**

Run:
```bash
bun run test:unit -- run src/lib/components/TimelinePanel.svelte.spec.ts src/lib/components/TimelineTrack.svelte.spec.ts src/lib/components/TimelineRuler.svelte.spec.ts src/lib/components/KeyframeGraphEditor.svelte.spec.ts src/lib/messages-parity.spec.ts
bun run check
```
Expected: PASS, 0 errors.

- [ ] **Step 5: Commit**

```bash
git add messages src/lib/components/TimelinePanel.svelte src/lib/components/TimelineTrack.svelte src/lib/components/TimelineRuler.svelte src/lib/components/KeyframeGraphEditor.svelte src/lib/components/TimelinePanel.svelte.spec.ts src/lib/components/TimelineTrack.svelte.spec.ts src/lib/components/TimelineRuler.svelte.spec.ts src/lib/components/KeyframeGraphEditor.svelte.spec.ts
git commit -m "feat(i18n): localize timeline strings

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 7: Preview / canvas / export + Paths workspace strings

**Files (modify; add keys both catalogs):**
- `src/lib/components/PreviewCanvas.svelte` ("Export animation", progress copy, any labels)
- `src/lib/components/WorkspaceNav.svelte` (nav item labels: editor/animate/paths)
- Paths workspace: `src/routes/paths/+page.svelte` (or its `page.svelte` components) and any path-library UI components (entry rename/delete confirm copy, "Salva in libreria", sidebar trigger labels)
- Any shared dialog/sheet components with literals: `ApplyToRingSheet.svelte`, library list items
- Test: `PreviewCanvas.svelte.spec.ts`, `src/routes/paths/page.svelte.spec.ts`, `ApplyToRingSheet.svelte.spec.ts` where they assert literal text.

- [ ] **Step 1: Discover exact literals in this area**

Run:
```bash
grep -rnoE '>[A-Za-zÀ-ÿ][^<>{}]*<|aria-label="[^"{]+"|placeholder="[^"{]+"|title="[^"{]+"' src/lib/components/PreviewCanvas.svelte src/lib/components/WorkspaceNav.svelte src/routes/paths src/lib/components/ApplyToRingSheet.svelte
```
Use the output as the worklist; extract each per the shared procedure. Recompile after edits:
```bash
bun run paraglide
```

- [ ] **Step 2: Update affected specs**

Switch literal-text queries to message values (default `en`) or `data-testid`. Note the Paths page spec uses a desktop viewport (`await page.viewport(1280, 800)` in `beforeEach`) — keep that.

- [ ] **Step 3: prettier + autofixer**

`bunx prettier --write` each touched `.svelte`, then `svelte-autofixer` to `issues: []`.

- [ ] **Step 4: Tests + parity + check**

Run:
```bash
bun run test:unit -- run src/lib/components/PreviewCanvas.svelte.spec.ts src/routes/paths/page.svelte.spec.ts src/lib/components/ApplyToRingSheet.svelte.spec.ts src/lib/messages-parity.spec.ts
bun run check
```
Expected: PASS, 0 errors.

- [ ] **Step 5: Commit**

```bash
git add messages src/lib/components/PreviewCanvas.svelte src/lib/components/WorkspaceNav.svelte src/routes/paths src/lib/components/ApplyToRingSheet.svelte src/lib/components/PreviewCanvas.svelte.spec.ts src/routes/paths/page.svelte.spec.ts src/lib/components/ApplyToRingSheet.svelte.spec.ts
git commit -m "feat(i18n): localize preview, nav and paths strings

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 8: About page strings

**Files (modify; add keys both catalogs):**
- `src/routes/about/+page.svelte` (and any About-only components, e.g. `AboutHeroRing.svelte` if it has copy)
- Test: `src/routes/about/page.svelte.spec.ts` if present (else add a minimal render test asserting a localized heading).

- [ ] **Step 1: Extract all About prose per the shared procedure**

Each paragraph/heading/button becomes a message key (`about_*`). For multi-sentence prose, one key per logical block is fine. Recompile:
```bash
bun run paraglide
```

- [ ] **Step 2: prettier + autofixer**

`bunx prettier --write src/routes/about/+page.svelte` (and any touched component), then `svelte-autofixer` to `issues: []`.

- [ ] **Step 3: Tests + parity + check**

Run:
```bash
bun run test:unit -- run src/routes/about/page.svelte.spec.ts src/lib/messages-parity.spec.ts
bun run check
```
Expected: PASS, 0 errors. (If no About spec exists, skip that path and rely on parity + check.)

- [ ] **Step 4: Commit**

```bash
git add messages src/routes/about
git commit -m "feat(i18n): localize About page

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 9: Coverage sweep + full green

Catches stragglers (any literal missed by the area passes) and confirms the whole suite + type-check are green.

**Files:** any component still holding a user-facing literal (found by grep); their specs if affected.

- [ ] **Step 1: Grep for remaining hardcoded user-facing literals**

Run:
```bash
grep -rnoE '>[A-ZÀ-Ý][A-Za-zÀ-ÿ ]{2,}<' src/lib/components src/routes --include='*.svelte' | grep -vE 'm\.[a-z]' 
grep -rnoE '(aria-label|placeholder|title)="[A-Za-zÀ-ÿ][^"{]+"' src/lib/components src/routes --include='*.svelte'
```
Expected: ideally no output. Each remaining hit is a straggler.

- [ ] **Step 2: Fold each straggler into messages**

For every hit, apply the shared procedure (key in both catalogs, replace literal with `m.key()`), then `bun run paraglide`, `bunx prettier --write <file>`, `svelte-autofixer` to `issues: []`. If there are none, note "no stragglers" and continue.

- [ ] **Step 3: Full unit suite**

Run:
```bash
bun run test:unit -- run
```
Expected: all tests pass (the prior 428 + the new i18n tests).

- [ ] **Step 4: Parity + type-check + lint**

Run:
```bash
bun run test:unit -- run src/lib/messages-parity.spec.ts
bun run check
bun run lint
```
Expected: parity PASS, check 0 errors, lint clean (prettier + eslint).

- [ ] **Step 5: Commit (only if Step 2 changed files)**

```bash
git add -A
git commit -m "feat(i18n): coverage sweep — fold remaining literals into messages

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Self-Review notes (for the executor)

- **Spec coverage:** Paraglide setup (T1), no-URL client strategy (T1, refined from spec's cookie line because `adapter-static` has no server runtime — strategy is `['localStorage','preferredLanguage','baseLocale']`, no hooks), browser-default first visit via `preferredLanguage` (T1), switch-in-place without reload (T2 rune + `{#key}`, T3 wiring), `lan` dropdown with eng/ita + flags next to About (T3), full app extraction (T4–T7), About (T8), sweep + parity guard (T1 + T9). All spec requirements map to a task.
- **Deviation from spec, documented:** spec listed `cookie` in the strategy; this plan drops it because the static export has no server to read it — `localStorage` carries persistence client-side. If a server runtime is added later, re-introduce `cookie` + `hooks.server.ts` per the Paraglide SvelteKit guide.
- **Type consistency:** `KaleidoParam.label` changes from `string` to `() => string` in Task 4; every consumer (`AnimatableSlider` Task 4, `TimelinePanel` Task 6) is updated to call `param.label()`. `currentLocale()`/`switchLocale()` names are stable across T2/T3. `m` import path `$lib/paraglide/messages`, runtime path `$lib/paraglide/runtime` used consistently.
- **Open verification (do at T1, adjust if the installed version differs):** exact `setLocale` reload-option shape; whether the generated `messages` is a file or directory; that `paraglide-js compile` runs without interactive prompts (this plan avoids `init` entirely and writes config by hand to stay non-interactive).
