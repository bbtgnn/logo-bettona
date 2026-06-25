# Sezione Tracciati v2 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Semplificare i Tracciati in una libreria nella sidebar (due accordion: curve di base + personalizzate, editor punti annidato, canvas = solo preview) e spostare la navigazione in un segmented control a pillole in cima alla sidebar di tutte le sezioni.

**Architecture:** Una nuova nav condivisa (`SidebarNav`) sostituisce `WorkspaceNav` e vive in cima alla sidebar nei due layout (`(app)/+layout.svelte` e la pagina `/paths`); gli header si riducono a lingua + About. La pagina `/paths` viene riscritta come libreria: lista builtin (sola preview) + lista personalizzate (riga ricca: rinomina/duplica/elimina + editor punti `RingCanvas` annidato, salvataggio live). Lo stato riusa `pathLibrary`; si aggiunge `createCurveFromArc`. I componenti del v1 (CurveCard, CurveEditorPanel, popover, WorkspaceNav) vengono rimossi.

**Tech Stack:** SvelteKit + Svelte 5 (runes), TypeScript, paper.js, TailwindCSS, shadcn/svelte (Collapsible/Sidebar/Button/Input), phosphor-svelte, paraglide (i18n), Vitest (browser + node).

## Global Constraints

- Package manager: **bun** (`bun run test:unit -- --run <file>`, `bun run check`).
- Test in browser (DOM/eventi) → `*.svelte.spec.ts`; logica pura → `*.spec.ts` (node).
- PaperScope tipizzato come `paper.PaperScope` via `import paper from 'paper'`.
- Stringhe UI via paraglide in **entrambi** `messages/en.json` e `messages/it.json` (test di parità le controlla).
- Curve `builtin` mai modificabili/rinominabili/eliminabili in place.
- Il nuovo editor riusa `RingCanvas` e **non** include importa-SVG.
- Componenti Svelte: validare con `svelte-autofixer` (MCP) fino a zero problemi prima di considerarli finiti.
- Gate: `bun run check` e `bun run test:unit -- --run` verdi. `bun run lint` è **già rosso pre-branch** (regola `svelte/no-navigation-without-resolve` + drift Prettier): non è introdotto qui e non blocca; non tentare di sistemare il debito di lint repo-wide.
- I testid della nav restano `nav-paths`, `nav-editor`, `nav-animate` (l'e2e esistente li usa).

---

### Task 1: `SidebarNav` — segmented control a pillole

Sostituisce `WorkspaceNav`. Tre tab (Tracciati / Editor / Animazione) come pillole; la sezione attiva è una pillola piena. Stessi href/testid/ordine di prima così l'e2e resta valido.

**Files:**
- Create: `src/lib/components/SidebarNav.svelte`
- Test: `src/lib/components/SidebarNav.svelte.spec.ts` (Create, browser)

**Interfaces:**
- Consumes: `page` da `$app/state`; `m` da `$lib/paraglide/messages`; icone da `phosphor-svelte`.
- Produces: componente senza props. Rende un `<nav data-testid="workspace-nav">` con tre `<a>`: `data-testid` `nav-paths`/`nav-editor`/`nav-animate`, href `/paths`/`/editor`/`/animate`, in quest'ordine. La tab attiva (pathname che inizia con l'href) ha `aria-current="page"`.

- [ ] **Step 1: Scrivere il test che fallisce**

Create `src/lib/components/SidebarNav.svelte.spec.ts`:

```ts
import { page } from 'vitest/browser';
import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import SidebarNav from './SidebarNav.svelte';

describe('SidebarNav', () => {
	it('renders the three section tabs with hrefs in order', async () => {
		render(SidebarNav);
		await expect.element(page.getByTestId('nav-paths')).toHaveAttribute('href', '/paths');
		await expect.element(page.getByTestId('nav-editor')).toHaveAttribute('href', '/editor');
		await expect.element(page.getByTestId('nav-animate')).toHaveAttribute('href', '/animate');
		const links = Array.from(document.querySelectorAll('a[data-testid^="nav-"]'));
		expect(links.map((l) => l.getAttribute('data-testid'))).toEqual([
			'nav-paths',
			'nav-editor',
			'nav-animate'
		]);
	});
});
```

- [ ] **Step 2: Eseguire il test e verificare che fallisca**

Run: `bun run test:unit -- --run src/lib/components/SidebarNav.svelte.spec.ts`
Expected: FAIL — componente inesistente.

- [ ] **Step 3: Implementare il componente**

Create `src/lib/components/SidebarNav.svelte`:

```svelte
<script lang="ts">
	import { page } from '$app/state';
	import { m } from '$lib/paraglide/messages';
	import { BezierCurve, PencilSimple, FilmStrip } from 'phosphor-svelte';

	const tabs = [
		{ href: '/paths', label: () => m.nav_paths(), testid: 'nav-paths', Icon: BezierCurve },
		{ href: '/editor', label: () => m.nav_editor(), testid: 'nav-editor', Icon: PencilSimple },
		{ href: '/animate', label: () => m.nav_animate(), testid: 'nav-animate', Icon: FilmStrip }
	];

	const pathname = $derived(page.url?.pathname ?? '');
</script>

<nav
	class="flex items-center gap-1 rounded-lg border bg-muted/40 p-1"
	data-testid="workspace-nav"
>
	{#each tabs as tab (tab.href)}
		<a
			href={tab.href}
			data-testid={tab.testid}
			aria-current={pathname.startsWith(tab.href) ? 'page' : undefined}
			class="flex flex-1 items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground aria-[current=page]:bg-primary aria-[current=page]:text-primary-foreground aria-[current=page]:font-semibold"
		>
			<tab.Icon size={14} />
			{tab.label()}
		</a>
	{/each}
</nav>
```

- [ ] **Step 4: Validare con svelte-autofixer**

Eseguire il tool MCP `svelte-autofixer` su `SidebarNav.svelte` fino a zero problemi. Se uno dei nomi icona (`BezierCurve`/`PencilSimple`/`FilmStrip`) non si risolve da `phosphor-svelte`, sostituirlo con un'icona valida del pacchetto (es. `Path`, `Pen`, `FilmSlate`); le icone confermate presenti nel repo includono `CaretDown`, `Plus`, `Trash`.

- [ ] **Step 5: Eseguire il test e verificare che passi**

Run: `bun run test:unit -- --run src/lib/components/SidebarNav.svelte.spec.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/lib/components/SidebarNav.svelte src/lib/components/SidebarNav.svelte.spec.ts
git commit -m "feat(nav): SidebarNav segmented pill control"
```

---

### Task 2: `createCurveFromArc` — crea curva personalizzata da arco

Helper di stato: crea e salva una nuova entry utente seminata da un arco semplice.

**Files:**
- Modify: `src/lib/state/path-library.ts` (aggiungere costante `SEED_ARC` + funzione `createCurveFromArc`)
- Test: `src/lib/state/path-library.create-arc.svelte.spec.ts` (Create, browser — segue il pattern dei test path-library)

**Interfaces:**
- Consumes: `pathLibrary`, `clonePath` (già presenti), tipi `Path`, `PathLibraryEntry`.
- Produces: `createCurveFromArc(): PathLibraryEntry` — crea una entry utente (no `builtin`) con `id` `crypto.randomUUID()`, `name` `"Nuova curva N"` (N = numero progressivo basato sul conteggio delle personalizzate +1), `createdAt: Date.now()`, `path` = copia di `SEED_ARC`, `secondaryPath: null`; la appende a `pathLibrary.entries` e la restituisce.

- [ ] **Step 1: Scrivere il test che fallisce**

Create `src/lib/state/path-library.create-arc.svelte.spec.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { pathLibrary, createCurveFromArc } from '$lib/state/path-library';

describe('createCurveFromArc', () => {
	beforeEach(() => {
		pathLibrary.entries = [];
	});

	it('creates a non-builtin user entry seeded from an arc', () => {
		const e = createCurveFromArc();
		expect(e.builtin).toBeFalsy();
		expect(e.secondaryPath).toBeNull();
		expect(e.path.cmds.length).toBeGreaterThan(0);
		expect(e.path.crds.length % 2).toBe(0);
		expect(pathLibrary.entries).toContainEqual(e);
	});

	it('numbers new curves by custom-entry count', () => {
		const a = createCurveFromArc();
		const b = createCurveFromArc();
		expect(a.name).toBe('Nuova curva 1');
		expect(b.name).toBe('Nuova curva 2');
		expect(a.id).not.toBe(b.id);
	});

	it('each entry carries an independent copy of the seed path', () => {
		const a = createCurveFromArc();
		const b = createCurveFromArc();
		expect(a.path).not.toBe(b.path);
		expect(a.path).toEqual(b.path);
	});
});
```

- [ ] **Step 2: Eseguire il test e verificare che fallisca**

Run: `bun run test:unit -- --run src/lib/state/path-library.create-arc.svelte.spec.ts`
Expected: FAIL — `createCurveFromArc` non esportato.

- [ ] **Step 3: Implementare**

In `src/lib/state/path-library.ts`, in fondo al file:

```ts
// Seed shape for a brand-new custom curve: a simple arch in the same coordinate
// space (~0..180) as the builtin curves. Q is fine for display; once edited the
// RingCanvas emits L/C segments.
const SEED_ARC: Path = { cmds: ['M', 'Q'], crds: [20, 100, 100, 40, 180, 100] };

/** Creates and saves a new custom curve seeded from a simple arc. */
export function createCurveFromArc(): PathLibraryEntry {
	const count = pathLibrary.entries.filter((e) => !e.builtin).length;
	const entry: PathLibraryEntry = {
		id: crypto.randomUUID(),
		name: `Nuova curva ${count + 1}`,
		createdAt: Date.now(),
		path: clonePath(SEED_ARC),
		secondaryPath: null
	};
	pathLibrary.entries = [...pathLibrary.entries, entry];
	return entry;
}
```

(`Path` è già importato in cima al file; se non lo fosse, aggiungerlo all'import da `$lib/types`.)

- [ ] **Step 4: Eseguire il test e verificare che passi**

Run: `bun run test:unit -- --run src/lib/state/path-library.create-arc.svelte.spec.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/state/path-library.ts src/lib/state/path-library.create-arc.svelte.spec.ts
git commit -m "feat(state): createCurveFromArc for new custom curves"
```

---

### Task 3: Stringhe i18n v2

Aggiungere/aggiornare le chiavi paraglide della nuova UI.

**Files:**
- Modify: `messages/en.json`
- Modify: `messages/it.json`

**Interfaces:**
- Produces: chiavi con questi nomi esatti, usate nei task 5-6:
  - **Revalue** (le chiavi esistono già dal v1 ma cambia il significato):
    - `tracciati_default_group` → EN `"Base curves"`, IT `"Curve di base"`
    - `tracciati_mine_group` → EN `"Custom curves"`, IT `"Curve personalizzate"`
  - **Nuove:**
    - `tracciati_create_curve` → EN `"Create curve"`, IT `"Crea curva"`
    - `tracciati_points_editor` → EN `"Points editor"`, IT `"Editor punti"`
    - `tracciati_duplicate` → EN `"Duplicate"`, IT `"Duplica"`
  - Riusate (già presenti, non toccare): `tracciati_curve_name`, `common_delete`, `common_cancel`, `nav_paths`, `nav_editor`, `nav_animate`, `header_about`, `paths_page_title`.

- [ ] **Step 1: Aggiornare en.json**

In `messages/en.json`: cambiare i valori di `tracciati_default_group` in `"Base curves"` e `tracciati_mine_group` in `"Custom curves"`; aggiungere:

```json
	"tracciati_create_curve": "Create curve",
	"tracciati_points_editor": "Points editor",
	"tracciati_duplicate": "Duplicate"
```

- [ ] **Step 2: Aggiornare it.json**

In `messages/it.json`: cambiare i valori di `tracciati_default_group` in `"Curve di base"` e `tracciati_mine_group` in `"Curve personalizzate"`; aggiungere:

```json
	"tracciati_create_curve": "Crea curva",
	"tracciati_points_editor": "Editor punti",
	"tracciati_duplicate": "Duplica"
```

- [ ] **Step 3: Compilare e verificare parità + check**

Run: `bun run paraglide && bun run test:unit -- --run src/lib/messages-parity.spec.ts && bun run check`
Expected: parità verde (stesse chiavi in en/it), check 0 errori.

- [ ] **Step 4: Commit**

```bash
git add messages/en.json messages/it.json
git commit -m "i18n: Tracciati v2 strings (base/custom groups, create, points editor, duplicate)"
```

---

### Task 4: Nav nella sidebar di Editor/Animazione + header ridotto

Spostare la nav nel layout condiviso `(app)`: `SidebarNav` in cima alla sidebar, header senza nav.

**Files:**
- Modify: `src/routes/(app)/+layout.svelte`
- Test: `src/routes/(app)/layout.svelte.spec.ts` (Modify — aggiornare le asserzioni se verificano la posizione della nav)

**Interfaces:**
- Consumes: `SidebarNav` (Task 1).
- Produces: nella sidebar `SidebarNav` è reso sopra `{@render children()}`; l'header non contiene più `WorkspaceNav` (resta `SidebarTrigger` + a destra `LanguageSwitcher` + link About).

- [ ] **Step 1: Aggiornare il test (atteso fallire se verifica la nav nell'header)**

Aprire `src/routes/(app)/layout.svelte.spec.ts`. Se asserisce che la nav/`workspace-nav` è dentro l'header, aggiornare per asserire che `workspace-nav` è presente nella sidebar (`data-testid="sidebar-content"`). Esempio di asserzione robusta da garantire presente:

```ts
it('renders the section nav inside the sidebar', async () => {
	render(Layout, { children: noopChildren });
	const sidebar = page.getByTestId('sidebar-content');
	await expect.element(sidebar.getByTestId('workspace-nav')).toBeInTheDocument();
});
```

(Adattare `noopChildren`/setup a come il file già monta il layout. Se il file non testa la nav, aggiungere questo test.)

- [ ] **Step 2: Eseguire e verificare RED (o assenza copertura)**

Run: `bun run test:unit -- --run src/routes/(app)/layout.svelte.spec.ts`
Expected: FAIL finché la nav non è spostata nella sidebar.

- [ ] **Step 3: Modificare il layout**

In `src/routes/(app)/+layout.svelte`:
- Importare `SidebarNav` al posto di `WorkspaceNav`:
  ```ts
  import SidebarNav from '$lib/components/SidebarNav.svelte';
  ```
  (rimuovere l'import di `WorkspaceNav`).
- Dentro `SidebarUI.SidebarContent`, rendere `SidebarNav` sopra i children:
  ```svelte
  <SidebarUI.SidebarContent class="divide-y divide-border" data-testid="sidebar-content">
  	<div class="p-2">
  		<SidebarNav />
  	</div>
  	{@render children()}
  </SidebarUI.SidebarContent>
  ```
- Nell'`<header>`, rimuovere `<WorkspaceNav />`, lasciando:
  ```svelte
  <header class="flex items-center gap-2 border-b p-4">
  	<SidebarUI.SidebarTrigger />
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

- [ ] **Step 4: Validare con svelte-autofixer**

Eseguire `svelte-autofixer` su `(app)/+layout.svelte` fino a zero problemi.

- [ ] **Step 5: Eseguire i test e verificare GREEN**

Run: `bun run test:unit -- --run src/routes/(app)/layout.svelte.spec.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add 'src/routes/(app)/+layout.svelte' 'src/routes/(app)/layout.svelte.spec.ts'
git commit -m "feat(chrome): SidebarNav in (app) sidebar, trim header"
```

---

### Task 5: `CustomCurveItem` — riga curva personalizzata

Riga ricca dell'accordion personalizzate: nome editabile (rinomina live), Duplica, Elimina (con micro-conferma), e sotto-accordion "Editor punti" con `RingCanvas` (salvataggio live). Selezionarla la imposta come elemento in preview.

**Files:**
- Create: `src/lib/components/CustomCurveItem.svelte`
- Test: `src/lib/components/CustomCurveItem.svelte.spec.ts` (Create, browser)

**Interfaces:**
- Consumes: `RingCanvas`, shadcn `Collapsible`/`Button`/`Input`, icone `CaretDown`/`CaretRight`/`Trash` + un'icona per duplica (es. `Copy`; se non risolve usare `Plus`); `updateEntryPath`/`renameEntry`/`removeEntry`/`duplicateEntry` da `$lib/state/path-library`; `m`; tipi `PathLibraryEntry`, `Path`.
- Produces: props `{ entry: PathLibraryEntry; selected: boolean; onselect: (id: string) => void }`. Testid: contenitore `custom-curve-{entry.id}`; nome `custom-name-{id}`; bottoni `custom-duplicate-{id}`, `custom-delete-{id}`, `custom-delete-confirm-{id}`, `custom-delete-cancel-{id}`; sotto-accordion editor `custom-editor-{id}`.

- [ ] **Step 1: Scrivere il test che fallisce**

Create `src/lib/components/CustomCurveItem.svelte.spec.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { page } from '@vitest/browser/context';
import CustomCurveItem from './CustomCurveItem.svelte';
import { pathLibrary } from '$lib/state/path-library';
import type { PathLibraryEntry } from '$lib/types';

const ENTRY: PathLibraryEntry = {
	id: 'u1',
	name: 'Nuova curva 1',
	createdAt: 1,
	path: { cmds: ['M', 'Q'], crds: [20, 100, 100, 40, 180, 100] },
	secondaryPath: null
};

describe('CustomCurveItem', () => {
	beforeEach(() => {
		pathLibrary.entries = [{ ...ENTRY }];
	});

	it('calls onselect with the id when the row is clicked', async () => {
		const onselect = vi.fn();
		render(CustomCurveItem, { entry: ENTRY, selected: false, onselect });
		await page.getByTestId('custom-name-u1').click();
		expect(onselect).toHaveBeenCalledWith('u1');
	});

	it('deletes only after confirm', async () => {
		render(CustomCurveItem, { entry: ENTRY, selected: true, onselect: vi.fn() });
		await page.getByTestId('custom-delete-u1').click();
		// still present (armed, not removed)
		expect(pathLibrary.entries.find((e) => e.id === 'u1')).toBeDefined();
		await page.getByTestId('custom-delete-confirm-u1').click();
		expect(pathLibrary.entries.find((e) => e.id === 'u1')).toBeUndefined();
	});

	it('duplicates the entry', async () => {
		render(CustomCurveItem, { entry: ENTRY, selected: true, onselect: vi.fn() });
		await page.getByTestId('custom-duplicate-u1').click();
		expect(pathLibrary.entries.filter((e) => !e.builtin)).toHaveLength(2);
	});
});
```

- [ ] **Step 2: Eseguire il test e verificare che fallisca**

Run: `bun run test:unit -- --run src/lib/components/CustomCurveItem.svelte.spec.ts`
Expected: FAIL — componente inesistente.

- [ ] **Step 3: Implementare il componente**

Create `src/lib/components/CustomCurveItem.svelte`:

```svelte
<script lang="ts">
	import * as Collapsible from '$lib/shadcn/ui/collapsible/index.js';
	import { Button } from '$lib/shadcn/ui/button/index.js';
	import { Input } from '$lib/shadcn/ui/input/index.js';
	import { CaretDown, CaretRight, Trash, Copy } from 'phosphor-svelte';
	import RingCanvas from './RingCanvas.svelte';
	import {
		updateEntryPath,
		renameEntry,
		removeEntry,
		duplicateEntry
	} from '$lib/state/path-library';
	import { m } from '$lib/paraglide/messages';
	import type { PathLibraryEntry, Path } from '$lib/types';

	let {
		entry,
		selected,
		onselect
	}: {
		entry: PathLibraryEntry;
		selected: boolean;
		onselect: (id: string) => void;
	} = $props();

	let editorOpen = $state(false);
	let pendingDelete = $state(false);

	function handlePathChange(path: Path) {
		updateEntryPath(entry.id, path);
	}
</script>

<div
	class="rounded-md border"
	class:border-primary={selected}
	data-testid="custom-curve-{entry.id}"
>
	<div class="flex items-center gap-1 p-1.5">
		<Input
			data-testid="custom-name-{entry.id}"
			value={entry.name}
			aria-label={m.tracciati_curve_name()}
			class="h-7 flex-1 text-xs"
			oninput={(e) => renameEntry(entry.id, (e.target as HTMLInputElement).value)}
			onfocus={() => onselect(entry.id)}
			onclick={() => onselect(entry.id)}
		/>
		<Button
			variant="ghost"
			size="icon"
			class="h-7 w-7 text-muted-foreground hover:text-foreground"
			aria-label={m.tracciati_duplicate()}
			data-testid="custom-duplicate-{entry.id}"
			onclick={() => duplicateEntry(entry)}
		>
			<Copy size={14} />
		</Button>
		{#if pendingDelete}
			<Button
				variant="destructive"
				size="sm"
				data-testid="custom-delete-confirm-{entry.id}"
				onclick={() => removeEntry(entry.id)}
			>
				{m.common_delete()}
			</Button>
			<Button
				variant="ghost"
				size="sm"
				data-testid="custom-delete-cancel-{entry.id}"
				onclick={() => (pendingDelete = false)}
			>
				{m.common_cancel()}
			</Button>
		{:else}
			<Button
				variant="ghost"
				size="icon"
				class="h-7 w-7 text-muted-foreground hover:text-destructive"
				aria-label={m.common_delete()}
				data-testid="custom-delete-{entry.id}"
				onclick={() => (pendingDelete = true)}
			>
				<Trash size={14} />
			</Button>
		{/if}
	</div>

	<Collapsible.Collapsible bind:open={editorOpen}>
		<Collapsible.CollapsibleTrigger
			class="flex w-full items-center gap-1 px-2 pb-1.5 text-[10px] text-muted-foreground hover:text-foreground"
		>
			{#if editorOpen}
				<CaretDown size={12} />
			{:else}
				<CaretRight size={12} />
			{/if}
			{m.tracciati_points_editor()}
		</Collapsible.CollapsibleTrigger>
		<Collapsible.CollapsibleContent class="px-2 pb-2" data-testid="custom-editor-{entry.id}">
			<RingCanvas
				templatePath={entry.path}
				onchange={handlePathChange}
				label={m.tracciati_points_editor()}
			/>
		</Collapsible.CollapsibleContent>
	</Collapsible.Collapsible>
</div>
```

- [ ] **Step 4: Validare con svelte-autofixer**

Eseguire `svelte-autofixer` su `CustomCurveItem.svelte` fino a zero problemi. Se `Copy` non si risolve da `phosphor-svelte`, usare `Plus` o `CopySimple`.

- [ ] **Step 5: Eseguire il test e verificare che passi**

Run: `bun run test:unit -- --run src/lib/components/CustomCurveItem.svelte.spec.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/lib/components/CustomCurveItem.svelte src/lib/components/CustomCurveItem.svelte.spec.ts
git commit -m "feat(tracciati): CustomCurveItem (rename/duplicate/delete + nested points editor)"
```

---

### Task 6: Riscrittura pagina `/paths` come libreria

Sidebar: `SidebarNav` + due accordion (Curve di base con righe builtin selezionabili; Curve personalizzate con "Crea curva" + `CustomCurveItem`). Header ridotto. Canvas: `RingPreview` della curva selezionata (risolta **live** per id).

**Files:**
- Modify (riscrittura): `src/routes/paths/+page.svelte`
- Modify: `src/routes/paths/page.svelte.spec.ts`

**Interfaces:**
- Consumes: `SidebarNav`, `CustomCurveItem`, `RingPreview`, `PathThumbnail`, `LanguageSwitcher`; shadcn `Sidebar`/`Collapsible`/`Button`; `pathLibrary`, `seedBuiltinCurves`, `createCurveFromArc` da `$lib/state/path-library`; `composition` da `$lib/state/composition`; `m`; `currentLocale`.
- Produces: pagina libreria. Testid: `tracciati-base-list`, `tracciati-custom-list`, `tracciati-create`, `tracciati-preview`, righe builtin `base-curve-{id}`.

- [ ] **Step 1: Aggiornare il test (atteso fallire)**

Riscrivere `src/routes/paths/page.svelte.spec.ts`:

```ts
import { page } from 'vitest/browser';
import { describe, it, expect, beforeEach } from 'vitest';
import { render } from 'vitest-browser-svelte';
import PathsPage from './+page.svelte';
import { pathLibrary } from '$lib/state/path-library';

describe('Tracciati v2 page', () => {
	beforeEach(() => {
		pathLibrary.entries = [];
	});

	it('seeds builtins and lists them as selectable base curves', async () => {
		render(PathsPage);
		await expect.element(page.getByTestId('base-curve-builtin-0')).toBeInTheDocument();
		await expect.element(page.getByTestId('base-curve-builtin-9')).toBeInTheDocument();
	});

	it('creates a custom curve from the Create button', async () => {
		render(PathsPage);
		await page.getByTestId('tracciati-create').click();
		expect(pathLibrary.entries.filter((e) => !e.builtin)).toHaveLength(1);
	});

	it('shows a preview of the selected curve', async () => {
		render(PathsPage);
		await expect.element(page.getByTestId('tracciati-preview')).toBeInTheDocument();
	});
});
```

- [ ] **Step 2: Eseguire e verificare RED**

Run: `bun run test:unit -- --run src/routes/paths/page.svelte.spec.ts`
Expected: FAIL — vecchio layout / testid assenti.

- [ ] **Step 3: Riscrivere la pagina**

Sostituire interamente `src/routes/paths/+page.svelte`:

```svelte
<script lang="ts">
	import * as SidebarUI from '$lib/shadcn/ui/sidebar/index.js';
	import * as Collapsible from '$lib/shadcn/ui/collapsible/index.js';
	import { Button } from '$lib/shadcn/ui/button/index.js';
	import { CaretDown, CaretRight, Plus } from 'phosphor-svelte';
	import SidebarNav from '$lib/components/SidebarNav.svelte';
	import LanguageSwitcher from '$lib/components/LanguageSwitcher.svelte';
	import CustomCurveItem from '$lib/components/CustomCurveItem.svelte';
	import RingPreview from '$lib/components/RingPreview.svelte';
	import PathThumbnail from '$lib/components/PathThumbnail.svelte';
	import { pathLibrary, seedBuiltinCurves, createCurveFromArc } from '$lib/state/path-library';
	import { composition } from '$lib/state/composition';
	import { m } from '$lib/paraglide/messages';
	import { currentLocale } from '$lib/state/locale.svelte';

	// Seed the 10 builtin curves once (idempotent).
	$effect(() => {
		seedBuiltinCurves();
	});

	let baseOpen = $state(true);
	let customOpen = $state(true);
	let selectedId = $state<string | null>(null);

	const builtins = $derived(pathLibrary.entries.filter((e) => e.builtin));
	const mine = $derived(pathLibrary.entries.filter((e) => !e.builtin));
	// Resolve the selected curve live by id, falling back to the first builtin.
	const selected = $derived(
		pathLibrary.entries.find((e) => e.id === selectedId) ?? builtins[0] ?? null
	);

	function handleCreate() {
		const entry = createCurveFromArc();
		selectedId = entry.id;
		customOpen = true;
	}
</script>

<svelte:head><title>{m.paths_page_title()}</title></svelte:head>

{#key currentLocale()}
	<SidebarUI.SidebarProvider>
		<SidebarUI.Sidebar>
			<SidebarUI.SidebarContent class="flex flex-col gap-2 p-2">
				<SidebarNav />

				<Collapsible.Collapsible bind:open={baseOpen}>
					<Collapsible.CollapsibleTrigger
						class="flex w-full items-center gap-1 rounded-md bg-muted/40 px-2 py-1.5 text-xs font-semibold"
					>
						{#if baseOpen}<CaretDown size={12} />{:else}<CaretRight size={12} />{/if}
						{m.tracciati_default_group()}
					</Collapsible.CollapsibleTrigger>
					<Collapsible.CollapsibleContent
						class="flex flex-col gap-1 p-1"
						data-testid="tracciati-base-list"
					>
						{#each builtins as entry (entry.id)}
							<button
								type="button"
								data-testid="base-curve-{entry.id}"
								aria-current={selected?.id === entry.id ? 'true' : undefined}
								class="flex items-center gap-2 rounded-md border p-1.5 text-left text-xs hover:bg-muted aria-[current=true]:border-primary aria-[current=true]:bg-muted"
								onclick={() => (selectedId = entry.id)}
							>
								<PathThumbnail path={entry.path} secondaryPath={entry.secondaryPath} size={28} />
								<span class="truncate">{entry.name}</span>
							</button>
						{/each}
					</Collapsible.CollapsibleContent>
				</Collapsible.Collapsible>

				<Collapsible.Collapsible bind:open={customOpen}>
					<Collapsible.CollapsibleTrigger
						class="flex w-full items-center gap-1 rounded-md bg-muted/40 px-2 py-1.5 text-xs font-semibold"
					>
						{#if customOpen}<CaretDown size={12} />{:else}<CaretRight size={12} />{/if}
						{m.tracciati_mine_group()}
					</Collapsible.CollapsibleTrigger>
					<Collapsible.CollapsibleContent
						class="flex flex-col gap-1.5 p-1"
						data-testid="tracciati-custom-list"
					>
						<Button
							variant="outline"
							size="sm"
							class="w-full"
							data-testid="tracciati-create"
							onclick={handleCreate}
						>
							<Plus size={14} />
							{m.tracciati_create_curve()}
						</Button>
						{#each mine as entry (entry.id)}
							<CustomCurveItem
								{entry}
								selected={selected?.id === entry.id}
								onselect={(id) => (selectedId = id)}
							/>
						{/each}
					</Collapsible.CollapsibleContent>
				</Collapsible.Collapsible>
			</SidebarUI.SidebarContent>
		</SidebarUI.Sidebar>

		<SidebarUI.SidebarInset>
			<header class="flex items-center gap-2 border-b p-4">
				<SidebarUI.SidebarTrigger />
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

			<main class="flex flex-1 items-center justify-center p-8">
				{#if selected}
					<div data-testid="tracciati-preview">
						{#key selected.id}
							<RingPreview
								path={selected.path}
								secondaryPath={selected.secondaryPath}
								baseRadius={composition.baseRadius}
								ringIncrement={composition.ringIncrement}
								size={360}
							/>
						{/key}
					</div>
				{/if}
			</main>
		</SidebarUI.SidebarInset>
	</SidebarUI.SidebarProvider>
{/key}
```

- [ ] **Step 4: Validare con svelte-autofixer**

Eseguire `svelte-autofixer` su `+page.svelte` fino a zero problemi.

- [ ] **Step 5: Eseguire i test della pagina e verificare GREEN**

Run: `bun run test:unit -- --run src/routes/paths/page.svelte.spec.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/routes/paths/+page.svelte src/routes/paths/page.svelte.spec.ts
git commit -m "feat(tracciati): rewrite /paths as sidebar library with base/custom accordions"
```

---

### Task 7: Rimozione dei componenti v1 + gate finali

Rimuovere i componenti del v1 non più usati, sostituire `WorkspaceNav`, e portare al verde l'intera suite + e2e.

**Files:**
- Delete: `src/lib/components/CurveCard.svelte` (+ `.svelte.spec.ts`)
- Delete: `src/lib/components/CurveEditorPanel.svelte` (+ `.svelte.spec.ts`)
- Delete: `src/lib/components/WorkspaceNav.svelte` (+ `.svelte.spec.ts`)
- Delete (se orfano): `src/lib/shadcn/ui/popover/` (verificare prima)
- Verify/Modify: e2e e altri riferimenti

**Interfaces:**
- Consumes: nulla.
- Produces: nessun riferimento residuo a `CurveCard`, `CurveEditorPanel`, `WorkspaceNav`; suite/check/e2e verdi.

- [ ] **Step 1: Verificare l'assenza di riferimenti residui**

Run:
```bash
grep -rn "CurveCard\|CurveEditorPanel\|WorkspaceNav" src
grep -rn "shadcn/ui/popover" src
```
Expected: dopo i task 4 e 6, gli unici match a `CurveCard`/`CurveEditorPanel`/`WorkspaceNav` devono essere i loro stessi file + spec; `shadcn/ui/popover` solo dentro la sua cartella (popover ora orfano). Se un altro file li referenzia ancora, **fermarsi e segnalare** (NEEDS_CONTEXT) — il task 4/6 dev'essere completato prima.

- [ ] **Step 2: Eliminare i file**

```bash
git rm src/lib/components/CurveCard.svelte src/lib/components/CurveCard.svelte.spec.ts \
       src/lib/components/CurveEditorPanel.svelte src/lib/components/CurveEditorPanel.svelte.spec.ts \
       src/lib/components/WorkspaceNav.svelte src/lib/components/WorkspaceNav.svelte.spec.ts
```
Se `grep -rn "shadcn/ui/popover" src` non trova usi fuori dalla cartella popover:
```bash
git rm -r src/lib/shadcn/ui/popover
```

- [ ] **Step 3: Eseguire l'intera suite + check**

Run: `bun run test:unit -- --run && bun run check`
Expected: verde. Se un test residuo importa un file rimosso, aggiornarlo/rimuoverlo (es. un eventuale spec che ancora monta `WorkspaceNav`). Gli e2e `workspace-nav.e2e.ts` non vanno toccati: usano i testid `nav-*` che `SidebarNav` conserva.

- [ ] **Step 4: Eseguire gli e2e**

Run: `bun run test:e2e`
Expected: verde (il flusso nav usa i testid invariati; la landing su `/paths` resta). Se manca l'install dei browser: `bunx playwright install` prima.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "chore(tracciati): remove v1 grid components (CurveCard, CurveEditorPanel, WorkspaceNav, popover)"
```

---

## Self-Review

**Spec coverage:**
- Nav segmented control a pillole in cima alla sidebar → Task 1 (componente) + Task 4 ((app)) + Task 6 (paths). ✓
- Header ridotto a lang + About → Task 4 + Task 6. ✓
- Cornice applicata a tutte le sezioni → Task 4 (editor/animate) + Task 6 (tracciati). ✓
- Tracciati = libreria pura (no ring-building) → Task 6 (nessun addRingWithPath/contatore/go-editor). ✓
- Accordion #1 base (10 builtin, permanenti, selezionabili, non editabili) → Task 6 (righe builtin sola selezione). ✓
- Accordion #2 personalizzate (vuoto, "Crea curva" da arco) → Task 2 + Task 6. ✓
- Personalizzate: rinomina/duplica/elimina-con-conferma + editor punti annidato, salvataggio live → Task 5. ✓
- Canvas = preview live per id → Task 6 (`selected` derivato per id). ✓
- Builtin intoccabili → riuso guard esistenti (removeEntry/renameEntry/updateEntryPath no-op su builtin) + Task 6 non offre edit sulle builtin. ✓
- Pulizia v1 (CurveCard/CurveEditorPanel/popover/WorkspaceNav) → Task 7. ✓
- `addRingWithPath` resta in composition.ts → non rimosso da alcun task. ✓
- i18n en+it → Task 3. ✓

**Placeholder scan:** nessun TBD/TODO; ogni step di codice mostra il codice. Le icone phosphor hanno fallback espliciti se un nome non risolve (non sono placeholder).

**Type consistency:** `createCurveFromArc(): PathLibraryEntry` (T2) usata in T6; `CustomCurveItem` props `{ entry, selected, onselect }` (T5) usate in T6; `SidebarNav` senza props (T1) in T4/T6; chiavi i18n `tracciati_default_group`/`tracciati_mine_group`/`tracciati_create_curve`/`tracciati_points_editor`/`tracciati_duplicate` (T3) usate in T5/T6; testid `nav-paths/editor/animate` invariati per gli e2e. Coerenti.
