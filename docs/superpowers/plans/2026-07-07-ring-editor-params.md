# Ring Editor Params Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Riprogettare la sezione Editor come sezione "Anelli": `copies` diventa globale, l'incremento diventa globale con override per-anello (geometria cumulativa), gli anelli si rinominano e si duplicano, e sparisce il pulsante "nuovo anello".

**Architecture:** La configurazione persistente vive in `composition` (localStorage via rune-sync). Si sposta `copies` da `Ring` a `Composition`, si aggiungono `Ring.name` e `Ring.incrementOverride`, e il raggio di ogni anello diventa una somma cumulativa calcolata da un helper puro. La UI della sidebar riflette la separazione globale/dedicato. Nessun tocco allo stato transitorio d'animazione né alla logica delle cuciture morph/wave/zone (solo swap meccanico `ring.copies` → `composition.copies`).

**Tech Stack:** SvelteKit, Svelte 5 runes, TypeScript, paper.js, rune-sync (localStorage), vitest (node + browser), Paraglide (i18n), shadcn/svelte.

## Global Constraints

- **Package manager:** bun, ma gli script si lanciano con `npm run <script>` (come da spec/test).
- **Copies default = 8** ovunque (identità del marchio a otto).
- **`src/lib/paraglide` è gitignored** e rigenerato da `npm run paraglide` (già dentro `npm run check`). Le chiavi `m.*` si aggiungono a `messages/en.json` + `messages/it.json`, MAI ai file generati in `src/lib/paraglide`.
- **Config vs runtime:** si tocca solo la configurazione persistente (`baseRadius`, `copies`, `ringIncrement`, `incrementOverride`, `ringHeight`, `color`, `name`, `templatePath`). Mai `wave`/`zoneDrive` (transient, già stripped).
- **Non toccare la logica** delle cuciture morph/wave/zone/keyframe: solo swap meccanico del riferimento a `copies`.
- **Svelte:** dopo aver scritto/modificato un `.svelte`, passarlo a `mcp__svelte__svelte-autofixer` finché pulito (regola CLAUDE.md).
- **Verifica per task:** `npm run test:unit -- --run` verde e `npm run check` = 0 errori/0 warning.
- **Commit piccoli**; il commit finale lo fa l'utente — l'ultimo task si ferma senza mergiare/PR.

---

## File Structure

- `src/lib/types.ts` — `Ring` perde `copies`, guadagna `name?` e `incrementOverride?`; `Composition` guadagna `copies`.
- `src/lib/state/default.ts` — `DEFAULT_COMPOSITION.copies = 8`; il ring seed perde `copies`.
- `src/lib/state/composition.ts` — `DEFAULT_RING`/`addRingWithPath` senza `copies`; nuove funzioni `setCopies`, `setRingIncrementOverride`, `renameRing`, `duplicateRing`.
- `src/lib/state/composition-persistence.svelte.ts` — `normalizeComposition` backfilla `copies` globale e droppa `copies` per-anello.
- `src/lib/geometry/ring-radii.ts` — **nuovo**: helper puro `computeRingRadii` (somma cumulativa).
- `src/lib/geometry/render-pipeline.ts` — usa `computeRingRadii` e `composition.copies`.
- `src/lib/geometry/bend.ts` — `buildRingPath` prende `copies` come parametro.
- `src/lib/components/SettingsSection.svelte` — pannello "Parametri globali": aggiunge input Copie curva.
- `src/lib/components/RingEditor.svelte` — nome, blocco incremento override, duplica; rimuove input copies per-anello.
- `src/routes/(app)/editor/+page.svelte` — rimuove il bottone "nuovo anello".
- Cuciture (swap `ring.copies` → `composition.copies`): `RingPreview.svelte`, `RingMorphPreview.svelte`, `WavePreview.svelte`, `ZonePreview.svelte`, `RingWaveConfigItem.svelte`, `RingZoneConfigItem.svelte`, `RingMorphConfigItem.svelte`, `ApplyToRingSheet.svelte`, `LibraryPickerSheet.svelte`, `src/routes/paths/+page.svelte`.
- `messages/en.json` + `messages/it.json` — nuove chiavi.

---

## Task 1: Sposta `copies` a globale (+ campi `name`/`incrementOverride` nel tipo)

Cambio di tipo atomico: rimuovere `Ring.copies` rompe la compilazione ovunque, quindi tutti i consumatori si aggiornano in questo task. Il comportamento visibile resta identico (raggio ancora piatto). Aggiungiamo anche `name?` e `incrementOverride?` al tipo qui (tutte le modifiche di tipo insieme), consumati nei task successivi.

**Files:**
- Modify: `src/lib/types.ts:30-42` (Ring), `:63-70` (Composition)
- Modify: `src/lib/state/default.ts:16-33`
- Modify: `src/lib/state/composition.ts:64-71` (DEFAULT_RING), `:175-187` (addRingWithPath), + nuova `setCopies`
- Modify: `src/lib/state/composition-persistence.svelte.ts:61-73` (normalizeComposition)
- Modify: `src/lib/geometry/bend.ts:26-35,143-146`
- Modify: `src/lib/geometry/render-pipeline.ts:163-186`
- Modify: `src/lib/components/RingPreview.svelte:29-46`, `RingMorphPreview.svelte:45-55`, `WavePreview.svelte:52-80`, `ZonePreview.svelte:26-52`
- Modify: `src/lib/components/RingWaveConfigItem.svelte:75`, `RingZoneConfigItem.svelte:76`, `RingMorphConfigItem.svelte:78,101`, `ApplyToRingSheet.svelte:82`
- Modify: `src/lib/components/SettingsSection.svelte` (input Copie curva)
- Modify: `src/lib/components/RingEditor.svelte:213-225` (rimuovi input copies)
- Test: `src/lib/state/composition.copies-global.spec.ts` (nuovo)

**Interfaces:**
- Produces: `Composition.copies: number`; `Ring.name?: string`; `Ring.incrementOverride?: number | null`; `setCopies(value: number): void`; `buildRingPath(ring: Ring, radius: number, copies: number, scope: paper.PaperScope): paper.Path | null`.

- [ ] **Step 1: Scrivi i test di migrazione + setCopies (falliscono)**

Create `src/lib/state/composition.copies-global.spec.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { composition } from '$lib/state/composition-persistence.svelte';
import { normalizeComposition } from '$lib/state/composition-persistence.svelte';
import { setCopies } from '$lib/state/composition';
import type { Composition } from '$lib/types';

function baseComposition(overrides: Partial<Composition> = {}): Composition {
	return {
		baseRadius: 5,
		ringIncrement: 2,
		copies: 8,
		aspectRatio: '1:1',
		rings: [],
		monochromePalettes: [{ primary: '#000', secondary: '#fff', background: '#fff' }],
		fullPalettes: [],
		...overrides
	};
}

describe('copies is global', () => {
	beforeEach(() => {
		composition.copies = 8;
	});

	it('setCopies writes the global value clamped to >= 1', () => {
		setCopies(12);
		expect(composition.copies).toBe(12);
		setCopies(0);
		expect(composition.copies).toBe(1);
	});
});

describe('normalizeComposition copies backfill', () => {
	it('adds copies from the first legacy ring when the global field is missing', () => {
		const legacy = baseComposition() as unknown as Record<string, unknown>;
		delete legacy.copies;
		(legacy.rings as unknown[]) = [{ id: 'a', copies: 6, color: '#000', templatePath: null, secondaryTemplatePath: null, morphT: 0, ringHeight: 0.12 }];
		const out = normalizeComposition(legacy as unknown as Composition);
		expect(out.copies).toBe(6);
	});

	it('defaults copies to 8 when neither global nor any ring carries it', () => {
		const legacy = baseComposition() as unknown as Record<string, unknown>;
		delete legacy.copies;
		const out = normalizeComposition(legacy as unknown as Composition);
		expect(out.copies).toBe(8);
	});

	it('keeps an already-present global copies value (idempotent)', () => {
		const out = normalizeComposition(baseComposition({ copies: 10 }));
		expect(out.copies).toBe(10);
	});
});
```

- [ ] **Step 2: Verifica fallimento**

Run: `npm run test:unit -- --run src/lib/state/composition.copies-global.spec.ts`
Expected: FAIL (`setCopies` non esportato / `copies` assente dal tipo).

- [ ] **Step 3: Aggiorna i tipi**

In `src/lib/types.ts`, `Ring`: rimuovi la riga `copies: number;`, aggiungi dopo `id`:

```ts
	name?: string; // etichetta autore; vuoto/assente → fallback posizionale "Anello N"
	incrementOverride?: number | null; // null/assente = eredita composition.ringIncrement
```

In `Composition` aggiungi accanto a `ringIncrement`:

```ts
	copies: number; // globale: numero di copie della curva attorno al cerchio (default 8)
```

- [ ] **Step 4: Default globali**

In `src/lib/state/default.ts`, aggiungi a `DEFAULT_COMPOSITION` (accanto a `ringIncrement: 2,`):

```ts
	copies: 8,
```

e rimuovi `copies: 8,` dal ring seed dentro `rings: [...]`.

- [ ] **Step 5: DEFAULT_RING, addRingWithPath, setCopies**

In `src/lib/state/composition.ts`, in `DEFAULT_RING` rimuovi `copies: 8,`. In `addRingWithPath` rimuovi `copies: 8,` dall'oggetto `ring`. Aggiungi la funzione (accanto a `setRingIncrement`):

```ts
export function setCopies(value: number) {
	composition.copies = Math.max(1, Math.floor(Number.isFinite(value) ? value : 1));
}
```

- [ ] **Step 6: Migrazione persistenza**

In `src/lib/state/composition-persistence.svelte.ts`, in `normalizeComposition`, prima del `return ensureRingIds(...)`, calcola copies e droppalo dai ring:

```ts
	const copies =
		typeof (c as { copies?: unknown }).copies === 'number'
			? (c as { copies: number }).copies
			: typeof (c.rings?.[0] as { copies?: unknown })?.copies === 'number'
				? (c.rings[0] as { copies: number }).copies
				: 8;
	const ringsWithoutCopies = c.rings?.map((r) => {
		const rest = { ...r } as Record<string, unknown>;
		delete rest.copies;
		return rest as (typeof c.rings)[number];
	});
	const withCopies = {
		...(ringsWithoutCopies ? { ...c, rings: ringsWithoutCopies } : c),
		copies
	} as Composition;
	return ensureRingIds(withCopies);
```

(sostituisci `const withPalettes = ...; return ensureRingIds(withPalettes);` incorporando `palettes` in `withCopies`: parti da `const src = palettes ? { ...c, monochromePalettes: palettes } : c;` e usa `src` al posto di `c` per rings/copies.)

- [ ] **Step 7: `buildRingPath` prende `copies`**

In `src/lib/geometry/bend.ts` cambia la firma e i tre usi:

```ts
export function buildRingPath(
	ring: Ring,
	radius: number,
	copies: number,
	scope: paper.PaperScope
): paper.Path | null {
```

Riga ~35: `const alpha = Math.PI / copies;`
Riga ~143: `const fullCopyAngle = (2 * Math.PI) / copies;`
Riga ~146: `for (let k = 0; k < copies; k++) {`

- [ ] **Step 8: render-pipeline usa `composition.copies`**

In `src/lib/geometry/render-pipeline.ts`, sostituisci il guard su `ring.copies`:

```ts
				if (composition.copies <= 0) {
					throw new Error('composition copies must be greater than zero');
				}
```

e la chiamata (riga ~186):

```ts
				const ringPath = buildRingPath(effectiveRing, radius, composition.copies, scope);
```

- [ ] **Step 9: Preview sintetiche → copies globale**

`RingPreview.svelte`: nel `composition` sintetico sposta `copies` dal ring al top-level: aggiungi `copies,` accanto a `baseRadius,` e rimuovi `copies,` dall'oggetto ring.
`RingMorphPreview.svelte`: idem nel `comp` sintetico (aggiungi `copies,` a livello composition, rimuovi dal ring).
`WavePreview.svelte`: rimuovi `copies: Math.max(1, Math.floor(copies)),` da `baseRing`; passa copies a entrambe le chiamate: `buildRingPath(..., Math.max(1, Math.floor(copies)), scope)` (reach e rest).
`ZonePreview.svelte`: idem — rimuovi `copies` da `baseRing`, passa `Math.max(1, Math.floor(copies))` come 3° argomento in entrambe le `buildRingPath`.

- [ ] **Step 10: Cuciture che passano il prop copies**

`RingWaveConfigItem.svelte:75`, `RingZoneConfigItem.svelte:76`: `copies={ring.copies ?? 1}` → `copies={composition.copies}` (importa `composition` da `$lib/state/composition` se non già presente).
`RingMorphConfigItem.svelte:78,101`: `copies={ring.copies}` → `copies={composition.copies}`.
`ApplyToRingSheet.svelte:82`: `copies={ring.copies}` → `copies={composition.copies}`.
`LibraryPickerSheet.svelte`: passa già `copies`? Se no, lascia il default 8 della preview; nessun cambio.

- [ ] **Step 11: SettingsSection — input Copie curva globale**

In `src/lib/components/SettingsSection.svelte`, importa `setCopies`:

```ts
	import { composition, setBaseRadius, setRingIncrement, setCopies } from '$lib/state/composition';
```

Dentro la griglia `grid-cols-2`, aggiungi un terzo campo (la griglia diventa `grid-cols-2` con 3 celle, va bene; o `grid-cols-3`):

```svelte
			<div class="flex flex-col gap-1">
				<Label for="copies" class="text-xs">{m.editor_copies()}</Label>
				<Input
					id="copies"
					type="number"
					min="1"
					value={composition.copies}
					oninput={(e) => setCopies(Number((e.target as HTMLInputElement).value))}
				/>
			</div>
```

- [ ] **Step 12: RingEditor — rimuovi input copies per-anello**

In `src/lib/components/RingEditor.svelte` elimina l'intero blocco (righe ~213-225):

```svelte
				<div class="flex flex-col gap-1">
					<Label for="copies-{index}" class="text-xs">{m.editor_copies()}</Label>
					<Input .../>
				</div>
```

- [ ] **Step 13: svelte-autofixer sui .svelte toccati**

Passa `SettingsSection.svelte`, `RingEditor.svelte`, `RingPreview.svelte`, `RingMorphPreview.svelte`, `WavePreview.svelte`, `ZonePreview.svelte`, e i ConfigItem a `mcp__svelte__svelte-autofixer`. Applica i fix finché pulito.

- [ ] **Step 14: Verifica suite + check**

Run: `npm run test:unit -- --run`
Expected: PASS (inclusi i nuovi test; gli esistenti restano verdi).
Run: `npm run check`
Expected: 0 errori, 0 warning.

- [ ] **Step 15: Commit**

```bash
git add -A
git commit -m "feat: move copies to a global composition parameter"
```

---

## Task 2: Raggio cumulativo + override incremento (geometria)

Il raggio passa da piatto (`baseRadius + ringIncrement*i`) a cumulativo, dove l'incremento di ogni anello è `incrementOverride ?? ringIncrement`. Retrocompatibile a override nulli.

**Files:**
- Create: `src/lib/geometry/ring-radii.ts`
- Test: `src/lib/geometry/ring-radii.spec.ts`
- Modify: `src/lib/geometry/render-pipeline.ts:163-186`
- Modify: `src/lib/state/composition.ts` (nuova `setRingIncrementOverride`)
- Test: `src/lib/state/composition.increment-override.spec.ts`

**Interfaces:**
- Consumes: `Composition`, `Ring.incrementOverride` (Task 1).
- Produces: `computeRingRadii(composition: Composition): number[]`; `setRingIncrementOverride(index: number, value: number | null): void`.

- [ ] **Step 1: Test dell'helper (fallisce)**

Create `src/lib/geometry/ring-radii.spec.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { computeRingRadii } from './ring-radii';
import type { Composition, Ring } from '$lib/types';

function ring(overrides: Partial<Ring> = {}): Ring {
	return {
		id: Math.random().toString(),
		color: '#000',
		templatePath: null,
		secondaryTemplatePath: null,
		morphT: 0,
		ringHeight: 0.12,
		...overrides
	};
}

function comp(rings: Ring[]): Composition {
	return {
		baseRadius: 5,
		ringIncrement: 2,
		copies: 8,
		aspectRatio: '1:1',
		rings,
		monochromePalettes: [],
		fullPalettes: []
	};
}

describe('computeRingRadii', () => {
	it('places the innermost ring at baseRadius', () => {
		expect(computeRingRadii(comp([ring()]))[0]).toBe(5);
	});

	it('reduces to baseRadius + ringIncrement*i without overrides', () => {
		expect(computeRingRadii(comp([ring(), ring(), ring(), ring()]))).toEqual([5, 7, 9, 11]);
	});

	it('applies a per-ring override and shifts itself and every later ring', () => {
		const rings = [ring(), ring(), ring({ incrementOverride: 3 }), ring()];
		expect(computeRingRadii(comp(rings))).toEqual([5, 7, 10, 12]);
	});

	it('ignores the override on the innermost ring (no previous ring)', () => {
		const rings = [ring({ incrementOverride: 99 }), ring()];
		expect(computeRingRadii(comp(rings))).toEqual([5, 7]);
	});
});
```

- [ ] **Step 2: Verifica fallimento**

Run: `npm run test:unit -- --run src/lib/geometry/ring-radii.spec.ts`
Expected: FAIL (`computeRingRadii` non esiste).

- [ ] **Step 3: Implementa l'helper**

Create `src/lib/geometry/ring-radii.ts`:

```ts
import type { Composition } from '$lib/types';

/**
 * Raggi cumulativi degli anelli. L'anello più interno (indice 0) sta a
 * `baseRadius`; ogni anello successivo somma al precedente il proprio incremento,
 * dove l'incremento è `incrementOverride ?? ringIncrement`. Senza override si
 * riduce a `baseRadius + ringIncrement * i`, identico alla spaziatura piatta
 * precedente.
 */
export function computeRingRadii(composition: Composition): number[] {
	const radii: number[] = [];
	let r = composition.baseRadius;
	for (let i = 0; i < composition.rings.length; i++) {
		if (i > 0) {
			r += composition.rings[i].incrementOverride ?? composition.ringIncrement;
		}
		radii.push(r);
	}
	return radii;
}
```

- [ ] **Step 4: Verifica pass**

Run: `npm run test:unit -- --run src/lib/geometry/ring-radii.spec.ts`
Expected: PASS.

- [ ] **Step 5: render-pipeline usa i raggi cumulativi**

In `src/lib/geometry/render-pipeline.ts` importa in cima:

```ts
import { computeRingRadii } from './ring-radii';
```

Prima del `for (let i = composition.rings.length - 1; ...)` calcola una volta:

```ts
			const radii = computeRingRadii(composition);
```

Sostituisci `const radius = composition.baseRadius + composition.ringIncrement * i;` con:

```ts
					const radius = radii[i];
```

- [ ] **Step 6: Test dello state setter (fallisce)**

Create `src/lib/state/composition.increment-override.spec.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { composition } from '$lib/state/composition-persistence.svelte';
import { addRingWithPath, setRingIncrementOverride } from '$lib/state/composition';
import type { Path } from '$lib/types';

const P: Path = { cmds: ['M', 'L'], crds: [0, 0, 10, 10] };

describe('setRingIncrementOverride', () => {
	beforeEach(() => {
		composition.rings = [];
		addRingWithPath(P);
		addRingWithPath(P);
	});

	it('sets a numeric override on a ring', () => {
		setRingIncrementOverride(1, 4);
		expect(composition.rings[1].incrementOverride).toBe(4);
	});

	it('clears the override back to null', () => {
		setRingIncrementOverride(1, 4);
		setRingIncrementOverride(1, null);
		expect(composition.rings[1].incrementOverride).toBeNull();
	});
});
```

- [ ] **Step 7: Verifica fallimento**

Run: `npm run test:unit -- --run src/lib/state/composition.increment-override.spec.ts`
Expected: FAIL (`setRingIncrementOverride` non esportato).

- [ ] **Step 8: Implementa il setter**

In `src/lib/state/composition.ts`, accanto a `setRingIncrement`:

```ts
export function setRingIncrementOverride(index: number, value: number | null) {
	const next = value === null ? null : Math.max(0, Number.isFinite(value) ? value : 0);
	composition.rings = composition.rings.map((ring, i) =>
		i === index ? { ...ring, incrementOverride: next } : ring
	);
}
```

- [ ] **Step 9: Verifica suite + check**

Run: `npm run test:unit -- --run`
Expected: PASS.
Run: `npm run check`
Expected: 0/0.

- [ ] **Step 10: Commit**

```bash
git add -A
git commit -m "feat: cumulative ring radius with per-ring increment override"
```

---

## Task 3: Rinomina anello

`Ring.name` (già nel tipo da Task 1). Creazione NON persiste un nome literal (i18n): l'header mostra `ring.name` non vuoto, altrimenti il fallback posizionale `m.editor_ring_label`.

**Files:**
- Modify: `src/lib/state/composition.ts` (nuova `renameRing`)
- Test: `src/lib/state/composition.rename-ring.spec.ts`
- Modify: `src/lib/components/RingEditor.svelte` (header fallback + campo Nome)
- Modify: `messages/en.json`, `messages/it.json`
- Test: `src/lib/components/RingEditor.svelte.spec.ts` (estendi)

**Interfaces:**
- Produces: `renameRing(index: number, name: string): void`.

- [ ] **Step 1: Test renameRing (fallisce)**

Create `src/lib/state/composition.rename-ring.spec.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { composition } from '$lib/state/composition-persistence.svelte';
import { addRingWithPath, renameRing } from '$lib/state/composition';
import type { Path } from '$lib/types';

const P: Path = { cmds: ['M', 'L'], crds: [0, 0, 10, 10] };

describe('renameRing', () => {
	beforeEach(() => {
		composition.rings = [];
		addRingWithPath(P);
	});

	it('stores a trimmed custom name', () => {
		renameRing(0, '  Corona  ');
		expect(composition.rings[0].name).toBe('Corona');
	});

	it('stores empty string when cleared', () => {
		renameRing(0, 'X');
		renameRing(0, '   ');
		expect(composition.rings[0].name).toBe('');
	});
});
```

- [ ] **Step 2: Verifica fallimento**

Run: `npm run test:unit -- --run src/lib/state/composition.rename-ring.spec.ts`
Expected: FAIL.

- [ ] **Step 3: Implementa renameRing**

In `src/lib/state/composition.ts`:

```ts
export function renameRing(index: number, name: string) {
	const trimmed = name.trim();
	composition.rings = composition.rings.map((ring, i) =>
		i === index ? { ...ring, name: trimmed } : ring
	);
}
```

- [ ] **Step 4: Verifica pass**

Run: `npm run test:unit -- --run src/lib/state/composition.rename-ring.spec.ts`
Expected: PASS.

- [ ] **Step 5: Chiavi messaggi**

In `messages/en.json` aggiungi:

```json
	"editor_ring_name": "Name",
```

In `messages/it.json`:

```json
	"editor_ring_name": "Nome",
```

- [ ] **Step 6: RingEditor — header fallback + campo Nome**

In `src/lib/components/RingEditor.svelte` importa `renameRing` accanto a `updateRing`. Nell'header, sostituisci `{m.editor_ring_label({ index: index + 1 })}` con:

```svelte
					{ring.name?.trim() ? ring.name : m.editor_ring_label({ index: index + 1 })}
```

Come prima cosa dentro `CollapsibleContent` (sopra `<RingCanvas .../>`), aggiungi:

```svelte
				<div class="flex flex-col gap-1">
					<Label for="ring-name-{index}" class="text-xs">{m.editor_ring_name()}</Label>
					<Input
						id="ring-name-{index}"
						type="text"
						value={ring.name ?? ''}
						placeholder={m.editor_ring_label({ index: index + 1 })}
						oninput={(e) => renameRing(index, (e.target as HTMLInputElement).value)}
					/>
				</div>
```

- [ ] **Step 7: Test UI rename (fallisce)**

In `src/lib/components/RingEditor.svelte.spec.ts` aggiungi un test che monta un ring, scrive nel campo nome e verifica che l'header rifletta il nome; e che con nome vuoto l'header mostri "Anello N". (Segui lo stile dei test browser esistenti nello stesso file — render + query per `data-testid`/label, `fireEvent.input`.) Aggiungi `data-testid="ring-name-{index}"` all'`Input` se serve per la query.

- [ ] **Step 8: svelte-autofixer + verifica**

Passa `RingEditor.svelte` all'autofixer finché pulito.
Run: `npm run test:unit -- --run`
Expected: PASS.
Run: `npm run check`
Expected: 0/0.

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "feat: rename rings in the editor"
```

---

## Task 4: Duplica anello

Clona forma + colore + altezza + `incrementOverride` + `name`, con nuovo id, inserito subito dopo l'originale.

**Files:**
- Modify: `src/lib/state/composition.ts` (nuova `duplicateRing`)
- Test: `src/lib/state/composition.duplicate-ring.spec.ts`
- Modify: `src/lib/components/RingEditor.svelte` (bottone Duplica nell'header)
- Modify: `messages/en.json`, `messages/it.json`

**Interfaces:**
- Consumes: `newRingId` (esistente), `Path` clone helper.
- Produces: `duplicateRing(index: number): void`.

- [ ] **Step 1: Test duplicateRing (fallisce)**

Create `src/lib/state/composition.duplicate-ring.spec.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { composition } from '$lib/state/composition-persistence.svelte';
import { addRingWithPath, duplicateRing, renameRing, setRingIncrementOverride } from '$lib/state/composition';
import type { Path } from '$lib/types';

const P: Path = { cmds: ['M', 'L'], crds: [0, 0, 10, 10] };

describe('duplicateRing', () => {
	beforeEach(() => {
		composition.rings = [];
		addRingWithPath(P);
		addRingWithPath(P);
	});

	it('inserts a clone right after the source with a new id', () => {
		const sourceId = composition.rings[0].id;
		duplicateRing(0);
		expect(composition.rings).toHaveLength(3);
		expect(composition.rings[1].id).not.toBe(sourceId);
	});

	it('clones dedicated params and the increment override', () => {
		renameRing(0, 'Corona');
		setRingIncrementOverride(0, 3);
		composition.rings = composition.rings.map((r, i) => (i === 0 ? { ...r, ringHeight: 0.4, color: '#abc' } : r));
		duplicateRing(0);
		const clone = composition.rings[1];
		expect(clone.name).toBe('Corona');
		expect(clone.incrementOverride).toBe(3);
		expect(clone.ringHeight).toBe(0.4);
		expect(clone.color).toBe('#abc');
	});

	it('deep-copies the template path (no shared reference)', () => {
		duplicateRing(0);
		expect(composition.rings[1].templatePath).toEqual(composition.rings[0].templatePath);
		expect(composition.rings[1].templatePath).not.toBe(composition.rings[0].templatePath);
	});
});
```

- [ ] **Step 2: Verifica fallimento**

Run: `npm run test:unit -- --run src/lib/state/composition.duplicate-ring.spec.ts`
Expected: FAIL.

- [ ] **Step 3: Implementa duplicateRing**

In `src/lib/state/composition.ts` (riusa `clonePath` già presente nel file):

```ts
export function duplicateRing(index: number) {
	const src = composition.rings[index];
	if (!src) return;
	const clone: Ring = {
		...src,
		id: newRingId(),
		templatePath: src.templatePath ? clonePath(src.templatePath) : null,
		secondaryTemplatePath: src.secondaryTemplatePath ? clonePath(src.secondaryTemplatePath) : null
	};
	const rings = [...composition.rings];
	rings.splice(index + 1, 0, clone);
	composition.rings = rings;
	applyColorMode();
}
```

- [ ] **Step 4: Verifica pass**

Run: `npm run test:unit -- --run src/lib/state/composition.duplicate-ring.spec.ts`
Expected: PASS.

- [ ] **Step 5: Chiavi messaggi**

`messages/en.json`: `"editor_ring_duplicate": "Duplicate ring",`
`messages/it.json`: `"editor_ring_duplicate": "Duplica anello",`

- [ ] **Step 6: RingEditor — bottone Duplica**

In `src/lib/components/RingEditor.svelte` importa `duplicateRing` e l'icona `Copy` da `phosphor-svelte`. Nell'header, prima del bottone Trash, aggiungi:

```svelte
				<Button
					variant="ghost"
					size="icon"
					class="h-6 w-6 text-muted-foreground hover:text-foreground"
					onclick={() => duplicateRing(index)}
					aria-label={m.editor_ring_duplicate()}
					data-testid="ring-duplicate-{index}"
				>
					<Copy size={14} />
				</Button>
```

- [ ] **Step 7: svelte-autofixer + verifica**

Autofixer su `RingEditor.svelte` finché pulito.
Run: `npm run test:unit -- --run`
Expected: PASS.
Run: `npm run check`
Expected: 0/0.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat: duplicate a ring in the editor"
```

---

## Task 5: Blocco override incremento nel pannello anello

Checkbox "Override incremento" + input numerico; nascosto sull'anello più interno (indice 0). Deselezionare → `setRingIncrementOverride(index, null)`.

**Files:**
- Modify: `src/lib/components/RingEditor.svelte`
- Modify: `messages/en.json`, `messages/it.json`
- Test: `src/lib/components/RingEditor.svelte.spec.ts` (estendi)

**Interfaces:**
- Consumes: `setRingIncrementOverride` (Task 2), `composition.ringIncrement`.

- [ ] **Step 1: Chiavi messaggi**

`messages/en.json`:

```json
	"editor_increment_override": "Override increment",
	"editor_increment_global_hint": "uses global ({value})",
```

`messages/it.json`:

```json
	"editor_increment_override": "Override incremento",
	"editor_increment_global_hint": "usa globale ({value})",
```

- [ ] **Step 2: RingEditor — importa dipendenze**

In `src/lib/components/RingEditor.svelte` aggiungi agli import di stato `setRingIncrementOverride`, `composition`, e importa `Checkbox` da `$lib/shadcn/ui/checkbox/index.js` (verifica il path esatto con gli altri import shadcn nel file; se il componente non esiste nel progetto, usa un `<input type="checkbox">` nativo con classi coerenti).

- [ ] **Step 3: Blocco UI (nascosto su index 0)**

In `CollapsibleContent`, dopo il blocco Colore, aggiungi:

```svelte
				{#if index > 0}
					<div class="flex flex-col gap-1">
						<Label class="text-xs">{m.editor_ring_increment()}</Label>
						<div class="flex items-center gap-2">
							<input
								id="increment-override-{index}"
								type="checkbox"
								data-testid="ring-increment-override-toggle-{index}"
								checked={ring.incrementOverride != null}
								onchange={(e) =>
									setRingIncrementOverride(
										index,
										(e.target as HTMLInputElement).checked ? composition.ringIncrement : null
									)}
							/>
							<Label for="increment-override-{index}" class="text-xs"
								>{m.editor_increment_override()}</Label
							>
							{#if ring.incrementOverride != null}
								<Input
									type="number"
									min="0"
									class="w-20"
									data-testid="ring-increment-override-input-{index}"
									value={ring.incrementOverride}
									oninput={(e) =>
										setRingIncrementOverride(index, Number((e.target as HTMLInputElement).value))}
								/>
							{:else}
								<span class="text-xs text-muted-foreground">
									{m.editor_increment_global_hint({ value: composition.ringIncrement })}
								</span>
							{/if}
						</div>
					</div>
				{/if}
```

- [ ] **Step 4: Test UI (fallisce)**

In `src/lib/components/RingEditor.svelte.spec.ts` aggiungi:
- monta un `RingEditor` con `index={0}` → il toggle `ring-increment-override-toggle-0` NON è nel DOM.
- monta con `index={1}` → toggle presente; `click` sul toggle → appare `ring-increment-override-input-1`; il valore iniziale = `composition.ringIncrement`.
Segui lo stile browser dei test esistenti nel file (render, `screen.queryByTestId`, `fireEvent.click`).

- [ ] **Step 5: Verifica fallimento poi pass**

Run: `npm run test:unit -- --run src/lib/components/RingEditor.svelte.spec.ts`
Expected: prima FAIL (se scritti prima della UI), poi PASS dopo lo Step 3.

- [ ] **Step 6: svelte-autofixer + verifica**

Autofixer su `RingEditor.svelte` finché pulito.
Run: `npm run test:unit -- --run` → PASS.
Run: `npm run check` → 0/0.

- [ ] **Step 7: Check visivo (transizione rischiosa)**

Avvia il dev server e ispeziona `/editor`:

```bash
npm run dev   # background; poi apri http://localhost:5173/editor
```

Verifica: pannello "Parametri globali" con Raggio base + Copie curva; un anello espanso mostra Nome, Forma, Altezza, (Colore se manual) e il blocco Incremento con checkbox; il primo anello NON mostra il blocco Incremento; spuntando l'override compare l'input. Screenshot via Playwright se disponibile. Poi `pkill -f "vite dev"`.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat: per-ring increment override control"
```

---

## Task 6: Rimuovi il pulsante "nuovo anello" + aggiorna l'empty-state

La creazione è compito di Tracciati; qui si edita soltanto.

**Files:**
- Modify: `src/routes/(app)/editor/+page.svelte`
- Modify: `messages/en.json`, `messages/it.json`
- Test: `src/routes/(app)/editor/page.svelte.spec.ts` (estendi)

- [ ] **Step 1: Aggiorna il messaggio empty-state**

`messages/en.json`: `"editor_no_rings": "No rings yet. Create one from Tracciati.",`
`messages/it.json`: `"editor_no_rings": "Nessun anello. Creane uno dai Tracciati.",`

- [ ] **Step 2: Rimuovi bottone e import inutilizzato**

In `src/routes/(app)/editor/+page.svelte` elimina:

```svelte
			<Button onclick={addRing} class="w-full">{m.editor_add_ring()}</Button>
```

e rimuovi `addRing` dall'import `import { composition, addRing, reorderRings } from '$lib/state/composition';` → `import { composition, reorderRings } from '$lib/state/composition';`. Se `Button` non è più usato altrove nel file, rimuovi anche il suo import.

- [ ] **Step 3: Test (fallisce)**

In `src/routes/(app)/editor/page.svelte.spec.ts` aggiungi/aggiorna: montata la pagina, NON esiste alcun bottone con il testo `m.editor_add_ring()`. Con `composition.rings = []`, l'empty-state mostra il nuovo testo. Segui lo stile dei test esistenti nel file.

- [ ] **Step 4: Verifica fallimento poi pass**

Run: `npm run test:unit -- --run src/routes/\(app\)/editor/page.svelte.spec.ts`
Expected: PASS dopo la rimozione.

- [ ] **Step 5: svelte-autofixer + verifica finale**

Autofixer su `+page.svelte` finché pulito.
Run: `npm run test:unit -- --run` → PASS (tutta la suite).
Run: `npm run check` → 0/0.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: remove new-ring button from the rings editor"
```

---

## Fine

Dopo il Task 6, mostra all'utente l'elenco dei file toccati:

```bash
git diff --stat "$(git merge-base main HEAD)"..HEAD -- ':!docs' ':!.superpowers'
```

e **fermati**: il commit/merge/PR finale lo fa l'utente. Non aprire PR, non mergiare.

## Self-Review (coverage vs spec)

- Copie globale default 8 → Task 1. ✓
- Incremento globale + override, geometria cumulativa, nascosto su ring 0 → Task 2 (geometria/stato) + Task 5 (UI). ✓
- Forma/colore/altezza dedicati → invariati (già per-anello). ✓
- Rinomina → Task 3. ✓
- Duplica → Task 4. ✓
- Riordina/elimina → già esistenti (`reorderRings`, `removeRing`), invariati. ✓
- No pulsante "nuovo anello" → Task 6. ✓
- Cuciture morph/wave/zone solo swap meccanico copies → Task 1. ✓
- Config vs runtime: nessun tocco a `wave`/`zoneDrive`. ✓
- Migrazione persistenza copies → Task 1. ✓
