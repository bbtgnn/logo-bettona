# Sezione Tracciati — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Trasformare la sezione Tracciati (`/paths`) nella schermata di atterraggio: una griglia di 10 curve default + le curve dell'utente, con anteprima in hover, scelta Usa/Edita in popover, ed editing in una sidebar a sinistra con anteprima live al centro.

**Architecture:** Logica e stato (curve builtin, varianti, seeding, helper di composizione) vivono in moduli puri e testabili sotto `src/lib/state` e `src/lib/geometry`. La UI è scomposta in componenti focalizzati (`CurveCard`, `CurveGrid`, `CurveEditorPanel`) orchestrati da `src/routes/paths/+page.svelte`. Si riusano `RingCanvas` (editor a punti), `RingPreview` (anello), `PathThumbnail` (miniatura). Lo stato `pathLibrary` (localStorage) ospita sia le builtin sia le varianti utente.

**Tech Stack:** SvelteKit + Svelte 5 (runes), TypeScript, paper.js, TailwindCSS, shadcn/svelte, phosphor-svelte, paraglide (i18n), Vitest (browser + node), rune-sync (localStorage).

## Global Constraints

- Package manager: **bun** (eseguire i comandi con `bun run`/`bunx`).
- Test in browser (DOM/PointerEvent) → file `*.svelte.spec.ts`; test in node (logica pura) → `*.spec.ts` (vedi memoria `vitest-browser-vs-node-routing`).
- Tipizzare un PaperScope come `paper.PaperScope` via `import paper from 'paper'` (memoria `paper-paperscope-type-import`).
- Tutte le stringhe UI passano da paraglide: aggiungere chiavi in **entrambi** `messages/en.json` e `messages/it.json`; usare `m.<key>()`.
- Le curve `builtin` non sono mai modificabili o cancellabili in place: editarle **duplica** sempre in una nuova entry utente.
- Componenti Svelte: validare con `svelte-autofixer` (MCP) prima di considerarli finiti; ricontrollare finché non restituisce zero problemi.
- Verifiche: `bun run check` (svelte-check) e `bun run test:unit -- --run` devono restare verdi.

---

### Task 1: Helper `addRingWithPath` nella composizione

Aggiunge un anello partendo da una curva scelta (la primaria, opzionalmente una secondaria). Oggi `addRing()` usa un template hardcoded e non accetta una curva: serve un nuovo helper per il flusso "Usa/Fatto".

**Files:**
- Modify: `src/lib/state/composition.ts` (aggiungere export `addRingWithPath`, vicino a `addRing` riga 126-129)
- Test: `src/lib/state/composition.add-ring-with-path.spec.ts` (Create)

**Interfaces:**
- Consumes: `composition` (da `composition-persistence.svelte`), `newRingId` (da `./ring-id`), tipo `Path` (da `$lib/types`).
- Produces: `addRingWithPath(path: Path, secondaryPath?: Path | null): void` — appende un Ring con `templatePath` = copia di `path`, `secondaryTemplatePath` = copia di `secondaryPath` o `null`, gli altri campi dai default (`copies: 8`, `color: '#000000'`, `morphT: 0` se nessuna secondaria altrimenti `1`, `ringHeight: 0.12`), e applica il color mode corrente.

- [ ] **Step 1: Scrivere il test che fallisce**

Create `src/lib/state/composition.add-ring-with-path.spec.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { composition } from '$lib/state/composition-persistence.svelte';
import { addRingWithPath } from '$lib/state/composition';
import type { Path } from '$lib/types';

const PRIMARY: Path = { cmds: ['M', 'L'], crds: [0, 0, 10, 10] };
const SECONDARY: Path = { cmds: ['M', 'L'], crds: [0, 0, 20, 20] };

describe('addRingWithPath', () => {
	beforeEach(() => {
		composition.rings = [];
	});

	it('appends a ring carrying a copy of the given primary path', () => {
		addRingWithPath(PRIMARY);
		expect(composition.rings).toHaveLength(1);
		expect(composition.rings[0].templatePath).toEqual(PRIMARY);
		// must be a copy, not the same reference
		expect(composition.rings[0].templatePath).not.toBe(PRIMARY);
		expect(composition.rings[0].secondaryTemplatePath).toBeNull();
		expect(composition.rings[0].morphT).toBe(0);
		expect(typeof composition.rings[0].id).toBe('string');
	});

	it('carries a secondary path and sets morphT to 1 when provided', () => {
		addRingWithPath(PRIMARY, SECONDARY);
		expect(composition.rings[0].secondaryTemplatePath).toEqual(SECONDARY);
		expect(composition.rings[0].secondaryTemplatePath).not.toBe(SECONDARY);
		expect(composition.rings[0].morphT).toBe(1);
	});

	it('appends without dropping existing rings', () => {
		addRingWithPath(PRIMARY);
		addRingWithPath(PRIMARY);
		expect(composition.rings).toHaveLength(2);
		expect(composition.rings[0].id).not.toBe(composition.rings[1].id);
	});
});
```

- [ ] **Step 2: Eseguire il test e verificare che fallisca**

Run: `bun run test:unit -- --run src/lib/state/composition.add-ring-with-path.spec.ts`
Expected: FAIL — `addRingWithPath is not a function` / import non risolto.

- [ ] **Step 3: Implementare l'helper minimo**

In `src/lib/state/composition.ts`, subito dopo `addRing` (riga 129), aggiungere:

```ts
function clonePath(p: Path): Path {
	return { cmds: [...p.cmds], crds: [...p.crds] };
}

/**
 * Appends a ring seeded from a chosen curve. Used by the Tracciati landing flow:
 * picking ("Usa") or finishing an edit ("Fatto") adds a ring carrying that curve.
 * A secondary path makes it a morph pair (morphT = 1); without it the ring is static.
 */
export function addRingWithPath(path: Path, secondaryPath: Path | null = null): void {
	const ring: Ring = {
		id: newRingId(),
		copies: 8,
		color: '#000000',
		templatePath: clonePath(path),
		secondaryTemplatePath: secondaryPath ? clonePath(secondaryPath) : null,
		morphT: secondaryPath ? 1 : 0,
		ringHeight: 0.12
	};
	composition.rings = [...composition.rings, ring];
	applyColorMode();
}
```

Aggiungere `Path` all'import di tipi in cima al file (l'import `from '$lib/types'` esiste già — aggiungere `Path` alla lista).

- [ ] **Step 4: Eseguire il test e verificare che passi**

Run: `bun run test:unit -- --run src/lib/state/composition.add-ring-with-path.spec.ts`
Expected: PASS (3 test verdi).

- [ ] **Step 5: Verificare il type-check**

Run: `bun run check`
Expected: nessun errore nuovo.

- [ ] **Step 6: Commit**

```bash
git add src/lib/state/composition.ts src/lib/state/composition.add-ring-with-path.spec.ts
git commit -m "feat(composition): add addRingWithPath helper for Tracciati flow"
```

---

### Task 2: Trasformazioni pure di Path (per le varianti delle curve)

Funzioni pure per generare varianti di forma genuinamente diverse (non scala uniforme, che la pipeline normalizzerebbe via). Servono mirror orizzontale e squash non uniforme attorno al centro del bounding box.

**Files:**
- Create: `src/lib/geometry/path-transform.ts`
- Test: `src/lib/geometry/path-transform.spec.ts` (Create)

**Interfaces:**
- Consumes: tipo `Path` (da `$lib/types`).
- Produces:
  - `scalePath(path: Path, sx: number, sy: number): Path` — scala ogni coppia (x,y) attorno al centro del bounding box.
  - `mirrorX(path: Path): Path` — riflette orizzontalmente attorno al centro (equivale a `scalePath(path, -1, 1)`).
  - Ogni coppia consecutiva in `crds` è un punto (x,y): vale per M/L (1 punto), Q (2 punti), C (3 punti). Le funzioni operano su tutte le coppie indistintamente.

- [ ] **Step 1: Scrivere il test che fallisce**

Create `src/lib/geometry/path-transform.spec.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { scalePath, mirrorX } from '$lib/geometry/path-transform';
import type { Path } from '$lib/types';

// Square corners 0,0 .. 10,10 → bbox center (5,5)
const SQUARE: Path = { cmds: ['M', 'L', 'L'], crds: [0, 0, 10, 0, 10, 10] };

describe('scalePath', () => {
	it('keeps cmds and crds length', () => {
		const out = scalePath(SQUARE, 0.5, 0.5);
		expect(out.cmds).toEqual(SQUARE.cmds);
		expect(out.crds).toHaveLength(SQUARE.crds.length);
	});

	it('scales around the bbox center', () => {
		// center (5,5); sx=2 → x' = 5 + (x-5)*2
		const out = scalePath(SQUARE, 2, 1);
		expect(out.crds[0]).toBeCloseTo(-5); // x 0 → 5 + (0-5)*2 = -5
		expect(out.crds[2]).toBeCloseTo(15); // x 10 → 5 + (10-5)*2 = 15
		expect(out.crds[1]).toBeCloseTo(0); // y untouched (sy=1)
	});

	it('does not mutate the input', () => {
		const before = JSON.stringify(SQUARE);
		scalePath(SQUARE, 3, 3);
		expect(JSON.stringify(SQUARE)).toBe(before);
	});
});

describe('mirrorX', () => {
	it('reflects x around the bbox center, leaves y', () => {
		const out = mirrorX(SQUARE);
		expect(out.crds[0]).toBeCloseTo(10); // x 0 → 10
		expect(out.crds[2]).toBeCloseTo(0); // x 10 → 0
		expect(out.crds[5]).toBeCloseTo(10); // y unchanged
	});
});
```

- [ ] **Step 2: Eseguire il test e verificare che fallisca**

Run: `bun run test:unit -- --run src/lib/geometry/path-transform.spec.ts`
Expected: FAIL — modulo inesistente.

- [ ] **Step 3: Implementare le funzioni**

Create `src/lib/geometry/path-transform.ts`:

```ts
import type { Path } from '$lib/types';

function bboxCenter(crds: number[]): { cx: number; cy: number } {
	let minX = Infinity;
	let minY = Infinity;
	let maxX = -Infinity;
	let maxY = -Infinity;
	for (let i = 0; i + 1 < crds.length; i += 2) {
		minX = Math.min(minX, crds[i]);
		maxX = Math.max(maxX, crds[i]);
		minY = Math.min(minY, crds[i + 1]);
		maxY = Math.max(maxY, crds[i + 1]);
	}
	return { cx: (minX + maxX) / 2, cy: (minY + maxY) / 2 };
}

/** Scales every (x,y) pair around the path's bounding-box center. Pure. */
export function scalePath(path: Path, sx: number, sy: number): Path {
	const { cx, cy } = bboxCenter(path.crds);
	const crds = path.crds.map((v, i) =>
		i % 2 === 0 ? cx + (v - cx) * sx : cy + (v - cy) * sy
	);
	return { cmds: [...path.cmds], crds };
}

/** Horizontal mirror around the bounding-box center. Pure. */
export function mirrorX(path: Path): Path {
	return scalePath(path, -1, 1);
}
```

- [ ] **Step 4: Eseguire il test e verificare che passi**

Run: `bun run test:unit -- --run src/lib/geometry/path-transform.spec.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/geometry/path-transform.ts src/lib/geometry/path-transform.spec.ts
git commit -m "feat(geometry): pure scalePath/mirrorX transforms for curve variations"
```

---

### Task 3: Definizione delle 10 curve builtin

Le 10 curve default come dati statici: le 8 forme distinte già presenti in `default.ts` (primaria + secondaria dei 4 anelli base) più 2 varianti (squash, mirror). Ogni curva è una preset a singolo tracciato (`secondaryPath: null`).

**Files:**
- Create: `src/lib/state/builtin-curves.ts`
- Test: `src/lib/state/builtin-curves.spec.ts` (Create)

**Interfaces:**
- Consumes: `scalePath`, `mirrorX` (da `$lib/geometry/path-transform`), tipi `Path`, `PathLibraryEntry`.
- Produces: `BUILTIN_CURVES: PathLibraryEntry[]` — esattamente 10 entry, `builtin: true`, `id` stabile `'builtin-0'..'builtin-9'`, `createdAt: 0`, `secondaryPath: null`, `name` leggibile.

- [ ] **Step 1: Scrivere il test che fallisce**

Create `src/lib/state/builtin-curves.spec.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { BUILTIN_CURVES } from '$lib/state/builtin-curves';

describe('BUILTIN_CURVES', () => {
	it('exposes exactly 10 curves', () => {
		expect(BUILTIN_CURVES).toHaveLength(10);
	});

	it('all are builtin, single-path, with stable sequential ids', () => {
		BUILTIN_CURVES.forEach((c, i) => {
			expect(c.builtin).toBe(true);
			expect(c.secondaryPath).toBeNull();
			expect(c.id).toBe(`builtin-${i}`);
			expect(c.createdAt).toBe(0);
			expect(c.path.cmds.length).toBeGreaterThan(0);
			expect(c.path.crds.length % 2).toBe(0);
			expect(c.name.trim().length).toBeGreaterThan(0);
		});
	});

	it('has unique ids', () => {
		const ids = new Set(BUILTIN_CURVES.map((c) => c.id));
		expect(ids.size).toBe(10);
	});
});
```

- [ ] **Step 2: Eseguire il test e verificare che fallisca**

Run: `bun run test:unit -- --run src/lib/state/builtin-curves.spec.ts`
Expected: FAIL — modulo inesistente.

- [ ] **Step 3: Implementare il modulo**

Create `src/lib/state/builtin-curves.ts` (i tracciati base sono copiati verbatim dalle 4 ring di `src/lib/state/default.ts`):

```ts
import type { Path, PathLibraryEntry } from '$lib/types';
import { scalePath, mirrorX } from '$lib/geometry/path-transform';

const CMDS3: Path['cmds'] = ['M', 'C', 'C'];

// Le 8 forme base = primaria + secondaria dei 4 anelli in default.ts.
const BASE: Path[] = [
	// ring-default-0 primary
	{ cmds: CMDS3, crds: [20, 134.8309709191255, 52, 134.72570776123075, 39.43817613081838, 95.94731430356411, 68.68899521531102, 75.99677928888472, 90.43200751345759, 61.16694744979107, 146, 62.76723670515267, 180, 65.60443479127704] },
	// ring-default-0 secondary
	{ cmds: CMDS3, crds: [22, 78.31347501774673, 54, 78.20821185985199, 126.43817613081838, 157.42981840218536, 155.68899521531102, 137.47928338750597, 177.4320075134576, 122.64945154841232, 146, 53.24974080377392, 180, 56.08693888989829] },
	// ring-default-1 primary
	{ cmds: CMDS3, crds: [22, 62.792538944554764, 61, 62.687275786660024, 64.43817613081838, 157.9088823289934, 93.68899521531102, 137.958347314314, 115.43200751345759, 123.12851547522035, 116, 85.72880473058197, 180, 87.56600281670634] },
	// ring-default-1 secondary
	{ cmds: CMDS3, crds: [20, 134.993013591891, 59, 134.88775043399627, 39.43817613081838, 81.10935697632965, 68.68899521531102, 61.15882196165026, 90.43200751345759, 46.328990122556604, 116, 131.92927937791822, 180, 84.7664774640426] },
	// ring-default-2 primary
	{ cmds: CMDS3, crds: [20, 114.03641266166139, 59, 113.93114950376665, 42.43817613081838, 92.15275604610002, 71.68899521531102, 72.20222103142063, 93.43200751345759, 57.37238919232698, 101, 62.972678447688594, 180, 63.80987653381297] },
	// ring-default-2 secondary
	{ cmds: CMDS3, crds: [20, 130.27643523882892, 59, 130.17117208093418, 94.43817613081838, 166.39277862326756, 123.68899521531102, 146.44224360858817, 145.4320075134576, 131.6124117694945, 101, 79.21270102485613, 180, 80.0498991109805] },
	// ring-default-3 primary
	{ cmds: CMDS3, crds: [20, 141.03095181744004, 59, 140.9256886595453, 24.438176130818377, 93.14729520187869, 53.688995215311024, 73.1967601871993, 75.43200751345759, 58.366928348105645, 180, 30.75451657861113, 180, 90.80441568959164] },
	// ring-default-3 secondary
	{ cmds: CMDS3, crds: [20, 130.27643523882892, 59, 130.17117208093418, 27.438176130818377, 81.39277862326756, 56.688995215311024, 61.44224360858817, 78.43200751345759, 46.612411769494514, 101, 79.21270102485613, 180, 80.0498991109805] }
];

// 2 varianti che cambiano la forma (la pipeline normalizza la scala uniforme,
// quindi servono trasformazioni non uniformi: squash verticale + mirror).
const VARIATIONS: Path[] = [scalePath(BASE[0], 1, 0.6), mirrorX(BASE[2])];

const ALL: Path[] = [...BASE, ...VARIATIONS];

export const BUILTIN_CURVES: PathLibraryEntry[] = ALL.map((path, i) => ({
	id: `builtin-${i}`,
	name: `Curva ${i + 1}`,
	createdAt: 0,
	path,
	secondaryPath: null,
	builtin: true
}));
```

- [ ] **Step 4: Eseguire il test e verificare che passi**

Run: `bun run test:unit -- --run src/lib/state/builtin-curves.spec.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/state/builtin-curves.ts src/lib/state/builtin-curves.spec.ts
git commit -m "feat(state): define 10 builtin default curves from base shapes + variations"
```

---

### Task 4: Seeding idempotente delle builtin nella libreria

All'avvio, inserire le 10 builtin in `pathLibrary` se mancano, senza duplicarle e senza toccare le curve utente. Aggiungere anche un helper per duplicare una curva (builtin o no) in una nuova entry utente editabile.

**Files:**
- Modify: `src/lib/state/path-library.ts` (aggiungere `seedBuiltinCurves` e `duplicateEntry`)
- Test: `src/lib/state/path-library.seed.svelte.spec.ts` (Create) — segue il pattern di `path-library.svelte.spec.ts`

**Interfaces:**
- Consumes: `pathLibrary`, tipo `PathLibraryEntry`, `BUILTIN_CURVES` (da `./builtin-curves`).
- Produces:
  - `seedBuiltinCurves(): void` — per ogni `BUILTIN_CURVES`, se nessuna entry con quell'`id` esiste, la inserisce in testa; idempotente; non tocca le entry utente.
  - `duplicateEntry(source: PathLibraryEntry): PathLibraryEntry` — crea e salva una entry utente (`builtin` assente) con nuovo `id` (`crypto.randomUUID()`), `name` = `"<source.name> (copia)"`, copia profonda di `path`/`secondaryPath`, `createdAt: Date.now()`; la appende e la restituisce.

- [ ] **Step 1: Scrivere il test che fallisce**

Create `src/lib/state/path-library.seed.svelte.spec.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { pathLibrary, seedBuiltinCurves, duplicateEntry } from '$lib/state/path-library';
import { BUILTIN_CURVES } from '$lib/state/builtin-curves';

describe('seedBuiltinCurves', () => {
	beforeEach(() => {
		pathLibrary.entries = [];
	});

	it('inserts all 10 builtins when library is empty', () => {
		seedBuiltinCurves();
		const ids = pathLibrary.entries.map((e) => e.id);
		BUILTIN_CURVES.forEach((c) => expect(ids).toContain(c.id));
		expect(pathLibrary.entries.filter((e) => e.builtin)).toHaveLength(10);
	});

	it('is idempotent — running twice does not duplicate', () => {
		seedBuiltinCurves();
		seedBuiltinCurves();
		expect(pathLibrary.entries.filter((e) => e.id === 'builtin-0')).toHaveLength(1);
		expect(pathLibrary.entries.filter((e) => e.builtin)).toHaveLength(10);
	});

	it('preserves existing user entries', () => {
		pathLibrary.entries = [
			{ id: 'u1', name: 'Mia', createdAt: 1, path: { cmds: ['M'], crds: [0, 0] }, secondaryPath: null }
		];
		seedBuiltinCurves();
		expect(pathLibrary.entries.find((e) => e.id === 'u1')).toBeDefined();
		expect(pathLibrary.entries.filter((e) => e.builtin)).toHaveLength(10);
	});
});

describe('duplicateEntry', () => {
	beforeEach(() => {
		pathLibrary.entries = [];
	});

	it('creates a user copy with a new id and "(copia)" name', () => {
		const src = BUILTIN_CURVES[0];
		const copy = duplicateEntry(src);
		expect(copy.id).not.toBe(src.id);
		expect(copy.builtin).toBeFalsy();
		expect(copy.name).toBe(`${src.name} (copia)`);
		expect(copy.path).toEqual(src.path);
		expect(copy.path).not.toBe(src.path);
		expect(pathLibrary.entries).toContainEqual(copy);
	});
});
```

- [ ] **Step 2: Eseguire il test e verificare che fallisca**

Run: `bun run test:unit -- --run src/lib/state/path-library.seed.svelte.spec.ts`
Expected: FAIL — `seedBuiltinCurves`/`duplicateEntry` non esportati.

- [ ] **Step 3: Implementare gli helper**

In `src/lib/state/path-library.ts`, aggiungere in cima l'import:

```ts
import { BUILTIN_CURVES } from './builtin-curves';
```

e in fondo al file:

```ts
/**
 * Seeds the 10 builtin default curves into the library if missing. Idempotent:
 * a builtin already present (matched by id) is skipped, user entries are untouched.
 * Called once on the Tracciati landing.
 */
export function seedBuiltinCurves(): void {
	const present = new Set(pathLibrary.entries.map((e) => e.id));
	const missing = BUILTIN_CURVES.filter((c) => !present.has(c.id));
	if (missing.length === 0) return;
	pathLibrary.entries = [...missing, ...pathLibrary.entries];
}

/**
 * Duplicates a curve (builtin or user) into a fresh, editable user entry.
 * The source — notably a protected builtin — is never mutated. Used by "Edita".
 */
export function duplicateEntry(source: PathLibraryEntry): PathLibraryEntry {
	const copy: PathLibraryEntry = {
		id: crypto.randomUUID(),
		name: `${source.name} (copia)`,
		createdAt: Date.now(),
		path: clonePath(source.path),
		secondaryPath: source.secondaryPath ? clonePath(source.secondaryPath) : null
	};
	pathLibrary.entries = [...pathLibrary.entries, copy];
	return copy;
}
```

(`clonePath` esiste già nel file, riga 6.)

- [ ] **Step 4: Eseguire il test e verificare che passi**

Run: `bun run test:unit -- --run src/lib/state/path-library.seed.svelte.spec.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/state/path-library.ts src/lib/state/path-library.seed.svelte.spec.ts
git commit -m "feat(state): idempotent builtin seeding + duplicateEntry for edit flow"
```

---

### Task 5: Helper per aggiornare il path di una entry (editing live)

Editare la curva duplicata salva live le modifiche sulla entry utente. Serve un setter mirato.

**Files:**
- Modify: `src/lib/state/path-library.ts` (aggiungere `updateEntryPath`)
- Test: `src/lib/state/path-library.update-path.svelte.spec.ts` (Create)

**Interfaces:**
- Consumes: `pathLibrary`, tipo `Path`.
- Produces: `updateEntryPath(id: string, path: Path): void` — sostituisce `path` (copia profonda) della entry utente con quell'`id`; no-op sulle builtin e su id inesistenti.

- [ ] **Step 1: Scrivere il test che fallisce**

Create `src/lib/state/path-library.update-path.svelte.spec.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { pathLibrary, updateEntryPath } from '$lib/state/path-library';
import type { Path } from '$lib/types';

const NEW: Path = { cmds: ['M', 'L'], crds: [1, 2, 3, 4] };

describe('updateEntryPath', () => {
	beforeEach(() => {
		pathLibrary.entries = [
			{ id: 'u1', name: 'Mia', createdAt: 1, path: { cmds: ['M'], crds: [0, 0] }, secondaryPath: null },
			{ id: 'builtin-0', name: 'B', createdAt: 0, path: { cmds: ['M'], crds: [0, 0] }, secondaryPath: null, builtin: true }
		];
	});

	it('updates a user entry path with a deep copy', () => {
		updateEntryPath('u1', NEW);
		const e = pathLibrary.entries.find((x) => x.id === 'u1')!;
		expect(e.path).toEqual(NEW);
		expect(e.path).not.toBe(NEW);
	});

	it('never mutates a builtin entry', () => {
		updateEntryPath('builtin-0', NEW);
		const e = pathLibrary.entries.find((x) => x.id === 'builtin-0')!;
		expect(e.path).toEqual({ cmds: ['M'], crds: [0, 0] });
	});

	it('is a no-op for unknown id', () => {
		expect(() => updateEntryPath('nope', NEW)).not.toThrow();
	});
});
```

- [ ] **Step 2: Eseguire il test e verificare che fallisca**

Run: `bun run test:unit -- --run src/lib/state/path-library.update-path.svelte.spec.ts`
Expected: FAIL — `updateEntryPath` non esportato.

- [ ] **Step 3: Implementare l'helper**

In fondo a `src/lib/state/path-library.ts`:

```ts
/** Replaces the path of a user entry (deep-copied). Builtins and unknown ids: no-op. */
export function updateEntryPath(id: string, path: Path): void {
	pathLibrary.entries = pathLibrary.entries.map((e) =>
		e.id === id && !e.builtin ? { ...e, path: clonePath(path) } : e
	);
}
```

- [ ] **Step 4: Eseguire il test e verificare che passi**

Run: `bun run test:unit -- --run src/lib/state/path-library.update-path.svelte.spec.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/state/path-library.ts src/lib/state/path-library.update-path.svelte.spec.ts
git commit -m "feat(state): updateEntryPath for live curve editing"
```

---

### Task 6: Logo vuoto all'avvio + triage dei test impattati

Rendere vuota la composizione default (atterraggio senza anelli). Effetto a catena condiviso con Editor/Animazione: i test che assumono i 4 anelli vanno aggiornati.

**Files:**
- Modify: `src/lib/state/default.ts` (sostituire `rings: [...4 anelli...]` con `rings: []`, mantenendo `baseRadius`, `ringIncrement`, `aspectRatio`, `monochromePalettes`, `fullPalettes` invariati)
- Modify: i file di test che falliscono dopo la modifica (da individuare allo Step 2 — candidati noti: `src/lib/state/composition.svelte.spec.ts`, `src/lib/state/composition.aspect-ratio.spec.ts`, `src/routes/(app)/editor/page.svelte.spec.ts`, `src/routes/(app)/animate/page.svelte.spec.ts`)

**Interfaces:**
- Consumes: nulla di nuovo.
- Produces: `DEFAULT_COMPOSITION.rings` ora `[]`. I consumatori che servono anelli pre-esistenti devono crearseli nel proprio setup (`composition.rings = [...]` nel `beforeEach`).

- [ ] **Step 1: Applicare la modifica al default**

In `src/lib/state/default.ts`, sostituire l'intero array `rings: [ ... ]` (righe 6-100, i 4 oggetti anello) con:

```ts
	rings: [],
```

Lasciare invariati `baseRadius: 5`, `ringIncrement: 2`, `aspectRatio: '1:1'`, `monochromePalettes`, `fullPalettes`.

- [ ] **Step 2: Eseguire l'intera suite e raccogliere i fallimenti**

Run: `bun run test:unit -- --run`
Expected: alcuni test falliscono perché assumevano 4 anelli. Annotare i file/test rossi.

- [ ] **Step 3: Aggiornare ogni test rosso a seminare i propri anelli**

Per ciascun test che dipendeva dai 4 anelli default, aggiungere nel suo setup (es. `beforeEach`) la creazione esplicita degli anelli che gli servono, invece di affidarsi al default. Esempio di pattern da applicare:

```ts
import { composition } from '$lib/state/composition-persistence.svelte';
// ...
beforeEach(() => {
	composition.rings = [
		{ id: 'r0', copies: 8, color: '#000000', templatePath: { cmds: ['M', 'L'], crds: [0, 0, 10, 10] }, secondaryTemplatePath: null, morphT: 0, ringHeight: 0.12 }
	];
});
```

Adattare numero/forma degli anelli a ciò che ogni test verifica. Non indebolire le asserzioni: ricreare le precondizioni, non rimuoverle.

- [ ] **Step 4: Rieseguire la suite fino al verde**

Run: `bun run test:unit -- --run`
Expected: PASS (intera suite verde).

- [ ] **Step 5: Type-check**

Run: `bun run check`
Expected: nessun errore.

- [ ] **Step 6: Commit**

```bash
git add src/lib/state/default.ts src/lib/state/ 'src/routes/**'
git commit -m "feat(composition): empty default rings for blank-logo landing; fix dependent tests"
```

---

### Task 7: Routing — Tracciati come atterraggio, prima nella nav

`/` reindirizza a `/paths`; in `WorkspaceNav` la voce Tracciati diventa la prima.

**Files:**
- Modify: `src/routes/+page.ts` (redirect `'/editor'` → `'/paths'`)
- Modify: `src/lib/components/WorkspaceNav.svelte` (riordino tabs)
- Test: `src/lib/components/WorkspaceNav.svelte.spec.ts` (Modify — esiste già; aggiornare l'asserzione sull'ordine)

**Interfaces:**
- Consumes: nulla di nuovo.
- Produces: ordine nav = Tracciati, Editor, Animazione.

- [ ] **Step 1: Aggiornare/aggiungere il test sull'ordine**

In `src/lib/components/WorkspaceNav.svelte.spec.ts`, assicurarsi che esista un test che verifica l'ordine dei link. Aggiungere/aggiornare:

```ts
it('renders Tracciati first in the nav order', () => {
	render(WorkspaceNav);
	const links = page.getByRole('link').all();
	// first workspace tab is Paths/Tracciati
	expect(links[0]).toHaveAttribute('href', '/paths');
});
```

(Adattare l'helper di query a quello già usato nel file: se usa `data-testid`, verificare che `nav-paths` preceda `nav-editor` nel DOM.)

- [ ] **Step 2: Eseguire il test e verificare che fallisca**

Run: `bun run test:unit -- --run src/lib/components/WorkspaceNav.svelte.spec.ts`
Expected: FAIL — oggi l'ordine è editor, animate, paths.

- [ ] **Step 3: Riordinare le tabs**

In `src/lib/components/WorkspaceNav.svelte`, riordinare l'array `tabs`:

```ts
const tabs = [
	{ href: '/paths', label: () => m.nav_paths(), testid: 'nav-paths' },
	{ href: '/editor', label: () => m.nav_editor(), testid: 'nav-editor' },
	{ href: '/animate', label: () => m.nav_animate(), testid: 'nav-animate' }
];
```

- [ ] **Step 4: Cambiare il redirect di root**

In `src/routes/+page.ts`, cambiare la destinazione:

```ts
import { redirect } from '@sveltejs/kit';

export function load() {
	redirect(307, '/paths');
}
```

- [ ] **Step 5: Eseguire i test e verificare che passino**

Run: `bun run test:unit -- --run src/lib/components/WorkspaceNav.svelte.spec.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/routes/+page.ts src/lib/components/WorkspaceNav.svelte src/lib/components/WorkspaceNav.svelte.spec.ts
git commit -m "feat(nav): land on Tracciati and list it first"
```

---

### Task 8: Stringhe i18n della nuova sezione

Aggiungere le chiavi paraglide usate dalla UI dei task successivi, in `en.json` e `it.json`.

**Files:**
- Modify: `messages/en.json`
- Modify: `messages/it.json`

**Interfaces:**
- Produces: chiavi (con questi nomi esatti, usate nei Task 9-11):
  `tracciati_default_group`, `tracciati_mine_group`, `tracciati_use`, `tracciati_edit`, `tracciati_preview_on_ring`, `tracciati_ring_count` (con `{count}`), `tracciati_go_to_editor`, `tracciati_edit_title`, `tracciati_curve_name`, `tracciati_cancel`, `tracciati_done`, `tracciati_empty_mine`.

- [ ] **Step 1: Aggiungere le chiavi inglesi**

In `messages/en.json`, aggiungere (mantenendo l'ordinamento/format del file):

```json
	"tracciati_default_group": "Default curves",
	"tracciati_mine_group": "My curves",
	"tracciati_use": "Use",
	"tracciati_edit": "Edit",
	"tracciati_preview_on_ring": "Preview on ring",
	"tracciati_ring_count": "{count} rings",
	"tracciati_go_to_editor": "Go to editor",
	"tracciati_edit_title": "Edit curve",
	"tracciati_curve_name": "Curve name",
	"tracciati_cancel": "Cancel",
	"tracciati_done": "Done",
	"tracciati_empty_mine": "Your edited curves will appear here."
```

- [ ] **Step 2: Aggiungere le chiavi italiane**

In `messages/it.json`, aggiungere le stesse chiavi tradotte:

```json
	"tracciati_default_group": "Curve di default",
	"tracciati_mine_group": "Le mie curve",
	"tracciati_use": "Usa",
	"tracciati_edit": "Edita",
	"tracciati_preview_on_ring": "Anteprima sull'anello",
	"tracciati_ring_count": "{count} anelli",
	"tracciati_go_to_editor": "Vai all'editor",
	"tracciati_edit_title": "Modifica curva",
	"tracciati_curve_name": "Nome curva",
	"tracciati_cancel": "Annulla",
	"tracciati_done": "Fatto",
	"tracciati_empty_mine": "Le tue curve modificate compariranno qui."
```

- [ ] **Step 3: Compilare i messaggi e type-check**

Run: `bun run paraglide && bun run check`
Expected: compila senza errori; `m.tracciati_*` disponibili.

- [ ] **Step 4: Commit**

```bash
git add messages/en.json messages/it.json
git commit -m "i18n: add Tracciati section strings (en, it)"
```

---

### Task 9: Componente `CurveCard` — miniatura, hover-preview, popover Usa/Edita

Una card della griglia: miniatura della curva, anteprima flottante sull'anello in hover, e al click un popover con i bottoni Usa/Edita.

**Files:**
- Create: `src/lib/components/CurveCard.svelte`
- Test: `src/lib/components/CurveCard.svelte.spec.ts` (Create, browser)

**Interfaces:**
- Consumes: `PathThumbnail`, `RingPreview`, shadcn `Popover` (`$lib/shadcn/ui/popover`), `Button`, `m` (messaggi), tipo `PathLibraryEntry`, `composition` (per `baseRadius`/`ringIncrement`).
- Produces: props `{ entry: PathLibraryEntry; onuse: (entry: PathLibraryEntry) => void; onedit: (entry: PathLibraryEntry) => void }`. Espone `data-testid="curve-card-{entry.id}"`; bottoni con `data-testid="curve-use-{entry.id}"` e `curve-edit-{entry.id}`.

- [ ] **Step 1: Scrivere il test che fallisce**

Create `src/lib/components/CurveCard.svelte.spec.ts`:

```ts
import { describe, it, expect, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { page } from '@vitest/browser/context';
import CurveCard from './CurveCard.svelte';
import type { PathLibraryEntry } from '$lib/types';

const ENTRY: PathLibraryEntry = {
	id: 'builtin-0',
	name: 'Curva 1',
	createdAt: 0,
	path: { cmds: ['M', 'C', 'C'], crds: [20, 134, 52, 134, 39, 95, 68, 75, 90, 61, 146, 62, 180, 65] },
	secondaryPath: null,
	builtin: true
};

describe('CurveCard', () => {
	it('calls onuse when Use is clicked in the popover', async () => {
		const onuse = vi.fn();
		render(CurveCard, { entry: ENTRY, onuse, onedit: vi.fn() });
		await page.getByTestId('curve-card-builtin-0').click();
		await page.getByTestId('curve-use-builtin-0').click();
		expect(onuse).toHaveBeenCalledWith(ENTRY);
	});

	it('calls onedit when Edit is clicked in the popover', async () => {
		const onedit = vi.fn();
		render(CurveCard, { entry: ENTRY, onuse: vi.fn(), onedit });
		await page.getByTestId('curve-card-builtin-0').click();
		await page.getByTestId('curve-edit-builtin-0').click();
		expect(onedit).toHaveBeenCalledWith(ENTRY);
	});
});
```

- [ ] **Step 2: Eseguire il test e verificare che fallisca**

Run: `bun run test:unit -- --run src/lib/components/CurveCard.svelte.spec.ts`
Expected: FAIL — componente inesistente.

- [ ] **Step 3: Implementare il componente**

Create `src/lib/components/CurveCard.svelte`:

```svelte
<script lang="ts">
	import * as Popover from '$lib/shadcn/ui/popover/index.js';
	import { Button } from '$lib/shadcn/ui/button/index.js';
	import PathThumbnail from './PathThumbnail.svelte';
	import RingPreview from './RingPreview.svelte';
	import { composition } from '$lib/state/composition';
	import { m } from '$lib/paraglide/messages';
	import type { PathLibraryEntry } from '$lib/types';

	let {
		entry,
		onuse,
		onedit
	}: {
		entry: PathLibraryEntry;
		onuse: (entry: PathLibraryEntry) => void;
		onedit: (entry: PathLibraryEntry) => void;
	} = $props();

	let hovered = $state(false);
	let open = $state(false);
</script>

<Popover.Root bind:open>
	<Popover.Trigger
		data-testid="curve-card-{entry.id}"
		class="relative flex aspect-square items-center justify-center rounded-md border bg-background p-2 hover:border-primary"
		onmouseenter={() => (hovered = true)}
		onmouseleave={() => (hovered = false)}
	>
		<PathThumbnail path={entry.path} secondaryPath={entry.secondaryPath} size={56} />
		{#if hovered && !open}
			<div
				class="pointer-events-none absolute bottom-[104%] left-1/2 z-10 -translate-x-1/2 rounded-lg border border-primary bg-popover p-2 shadow-lg"
				data-testid="curve-hover-{entry.id}"
			>
				{#key entry.id}
					<RingPreview
						path={entry.path}
						secondaryPath={entry.secondaryPath}
						baseRadius={composition.baseRadius}
						ringIncrement={composition.ringIncrement}
						size={120}
					/>
				{/key}
				<p class="mt-1 text-center text-[10px] text-muted-foreground">
					{m.tracciati_preview_on_ring()}
				</p>
			</div>
		{/if}
	</Popover.Trigger>
	<Popover.Content class="flex w-44 flex-col items-center gap-2">
		{#key entry.id}
			<RingPreview
				path={entry.path}
				secondaryPath={entry.secondaryPath}
				baseRadius={composition.baseRadius}
				ringIncrement={composition.ringIncrement}
				size={120}
			/>
		{/key}
		<span class="text-xs font-medium">{entry.name}</span>
		<Button
			size="sm"
			class="w-full"
			data-testid="curve-use-{entry.id}"
			onclick={() => {
				open = false;
				onuse(entry);
			}}
		>
			{m.tracciati_use()}
		</Button>
		<Button
			size="sm"
			variant="outline"
			class="w-full"
			data-testid="curve-edit-{entry.id}"
			onclick={() => {
				open = false;
				onedit(entry);
			}}
		>
			{m.tracciati_edit()}
		</Button>
	</Popover.Content>
</Popover.Root>
```

- [ ] **Step 4: Generare il componente shadcn popover (manca nel repo)**

Il modulo `src/lib/shadcn/ui/popover` NON esiste ancora (verificato). Generarlo prima di tutto:

Run: `bunx shadcn-svelte@latest add popover`
Expected: crea `src/lib/shadcn/ui/popover/`.

- [ ] **Step 5: Validare con svelte-autofixer**

Usare il tool MCP `svelte-autofixer` sul contenuto di `CurveCard.svelte`; applicare le correzioni finché non restituisce zero problemi.

- [ ] **Step 6: Eseguire il test e verificare che passi**

Run: `bun run test:unit -- --run src/lib/components/CurveCard.svelte.spec.ts`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/lib/components/CurveCard.svelte src/lib/components/CurveCard.svelte.spec.ts 'src/lib/shadcn/ui/popover/**'
git commit -m "feat(tracciati): CurveCard with hover preview and Use/Edit popover"
```

---

### Task 10: Componente `CurveEditorPanel` — sidebar di editing

Pannello sinistro: editor a punti (`RingCanvas`, niente importa-SVG), campo nome, Annulla/Fatto. Salva live le modifiche del path sulla entry.

**Files:**
- Create: `src/lib/components/CurveEditorPanel.svelte`
- Test: `src/lib/components/CurveEditorPanel.svelte.spec.ts` (Create, browser)

**Interfaces:**
- Consumes: `RingCanvas`, `Button`, `Input` (`$lib/shadcn/ui/input`), `Label`, `m`, `updateEntryPath`, `renameEntry` (da `path-library`), tipi `PathLibraryEntry`, `Path`.
- Produces: props `{ entry: PathLibraryEntry; oncancel: () => void; ondone: (entry: PathLibraryEntry) => void }`. Su ogni modifica del path chiama `updateEntryPath(entry.id, path)`; sul nome chiama `renameEntry(entry.id, name)`. Testid: `curve-editor-done`, `curve-editor-cancel`.

- [ ] **Step 1: Scrivere il test che fallisce**

Create `src/lib/components/CurveEditorPanel.svelte.spec.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { page } from '@vitest/browser/context';
import CurveEditorPanel from './CurveEditorPanel.svelte';
import { pathLibrary } from '$lib/state/path-library';
import type { PathLibraryEntry } from '$lib/types';

const ENTRY: PathLibraryEntry = {
	id: 'u1',
	name: 'Curva 1 (copia)',
	createdAt: 1,
	path: { cmds: ['M', 'C', 'C'], crds: [20, 134, 52, 134, 39, 95, 68, 75, 90, 61, 146, 62, 180, 65] },
	secondaryPath: null
};

describe('CurveEditorPanel', () => {
	beforeEach(() => {
		pathLibrary.entries = [{ ...ENTRY }];
	});

	it('calls ondone with the entry when Done is clicked', async () => {
		const ondone = vi.fn();
		render(CurveEditorPanel, { entry: ENTRY, oncancel: vi.fn(), ondone });
		await page.getByTestId('curve-editor-done').click();
		expect(ondone).toHaveBeenCalledWith(ENTRY);
	});

	it('calls oncancel when Cancel is clicked', async () => {
		const oncancel = vi.fn();
		render(CurveEditorPanel, { entry: ENTRY, oncancel, ondone: vi.fn() });
		await page.getByTestId('curve-editor-cancel').click();
		expect(oncancel).toHaveBeenCalled();
	});
});
```

- [ ] **Step 2: Eseguire il test e verificare che fallisca**

Run: `bun run test:unit -- --run src/lib/components/CurveEditorPanel.svelte.spec.ts`
Expected: FAIL — componente inesistente.

- [ ] **Step 3: Implementare il componente**

Create `src/lib/components/CurveEditorPanel.svelte`:

```svelte
<script lang="ts">
	import RingCanvas from './RingCanvas.svelte';
	import { Button } from '$lib/shadcn/ui/button/index.js';
	import { Input } from '$lib/shadcn/ui/input/index.js';
	import { Label } from '$lib/shadcn/ui/label/index.js';
	import { updateEntryPath, renameEntry } from '$lib/state/path-library';
	import { m } from '$lib/paraglide/messages';
	import type { PathLibraryEntry, Path } from '$lib/types';

	let {
		entry,
		oncancel,
		ondone
	}: {
		entry: PathLibraryEntry;
		oncancel: () => void;
		ondone: (entry: PathLibraryEntry) => void;
	} = $props();

	let name = $state(entry.name);

	function handlePathChange(path: Path) {
		updateEntryPath(entry.id, path);
	}

	function handleNameInput(e: Event) {
		name = (e.target as HTMLInputElement).value;
		renameEntry(entry.id, name);
	}
</script>

<div class="flex flex-col gap-3 p-3">
	<span class="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
		{m.tracciati_edit_title()}
	</span>

	<div class="flex flex-col gap-1">
		<Label for="curve-name" class="text-xs">{m.tracciati_curve_name()}</Label>
		<Input id="curve-name" value={name} oninput={handleNameInput} />
	</div>

	<RingCanvas
		templatePath={entry.path}
		onchange={handlePathChange}
		label={m.tracciati_edit_title()}
	/>

	<div class="flex gap-2">
		<Button
			variant="outline"
			class="flex-1"
			data-testid="curve-editor-cancel"
			onclick={oncancel}
		>
			{m.tracciati_cancel()}
		</Button>
		<Button class="flex-1" data-testid="curve-editor-done" onclick={() => ondone(entry)}>
			{m.tracciati_done()}
		</Button>
	</div>
</div>
```

- [ ] **Step 4: Validare con svelte-autofixer**

Eseguire `svelte-autofixer` su `CurveEditorPanel.svelte` finché non restituisce zero problemi.

- [ ] **Step 5: Eseguire il test e verificare che passi**

Run: `bun run test:unit -- --run src/lib/components/CurveEditorPanel.svelte.spec.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/lib/components/CurveEditorPanel.svelte src/lib/components/CurveEditorPanel.svelte.spec.ts
git commit -m "feat(tracciati): CurveEditorPanel (points editor, live save, no SVG import)"
```

---

### Task 11: Riscrittura della pagina `/paths` — orchestrazione

La pagina assembla il flusso: seeding builtin all'avvio, griglia (gruppi default/mine), contatore anelli + "Vai all'editor", e modalità editing (sidebar a sinistra + anteprima live al centro). Sostituisce il vecchio layout sidebar-lista e l'`ApplyToRingSheet`.

**Files:**
- Modify (riscrittura): `src/routes/paths/+page.svelte`
- Modify: `src/routes/paths/page.svelte.spec.ts` (aggiornare le asserzioni al nuovo layout)

**Interfaces:**
- Consumes: `seedBuiltinCurves`, `duplicateEntry`, `pathLibrary`, `removeEntry`, `renameEntry` (path-library); `addRingWithPath`, `composition` (composition); `CurveCard`, `CurveEditorPanel`, `RingPreview`, `WorkspaceNav`, `LanguageSwitcher`; shadcn `Sidebar`, `Button`; `m`; `goto` (`$app/navigation`).
- Produces: pagina con due modalità: `mode: 'grid' | 'editing'`. Testid chiave: `tracciati-grid`, `tracciati-ring-count`, `tracciati-go-editor`, `tracciati-editing`.

- [ ] **Step 1: Aggiornare il test della pagina (atteso fallire)**

Riscrivere `src/routes/paths/page.svelte.spec.ts` per il nuovo layout. Asserzioni minime:

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { page } from '@vitest/browser/context';
import PathsPage from './+page.svelte';
import { pathLibrary } from '$lib/state/path-library';
import { composition } from '$lib/state/composition-persistence.svelte';

describe('Tracciati page', () => {
	beforeEach(() => {
		pathLibrary.entries = [];
		composition.rings = [];
	});

	it('seeds the 10 builtin curves and renders them in the grid', async () => {
		render(PathsPage);
		await expect.element(page.getByTestId('curve-card-builtin-0')).toBeInTheDocument();
		await expect.element(page.getByTestId('curve-card-builtin-9')).toBeInTheDocument();
	});

	it('adds a ring and updates the counter when a curve is used', async () => {
		render(PathsPage);
		await page.getByTestId('curve-card-builtin-0').click();
		await page.getByTestId('curve-use-builtin-0').click();
		expect(composition.rings).toHaveLength(1);
		await expect.element(page.getByTestId('tracciati-ring-count')).toBeInTheDocument();
	});
});
```

- [ ] **Step 2: Eseguire il test e verificare che fallisca**

Run: `bun run test:unit -- --run src/routes/paths/page.svelte.spec.ts`
Expected: FAIL — vecchio layout / testid assenti.

- [ ] **Step 3: Riscrivere la pagina**

Sostituire interamente `src/routes/paths/+page.svelte`:

```svelte
<script lang="ts">
	import * as SidebarUI from '$lib/shadcn/ui/sidebar/index.js';
	import { Button } from '$lib/shadcn/ui/button/index.js';
	import WorkspaceNav from '$lib/components/WorkspaceNav.svelte';
	import LanguageSwitcher from '$lib/components/LanguageSwitcher.svelte';
	import CurveCard from '$lib/components/CurveCard.svelte';
	import CurveEditorPanel from '$lib/components/CurveEditorPanel.svelte';
	import RingPreview from '$lib/components/RingPreview.svelte';
	import { pathLibrary, seedBuiltinCurves, duplicateEntry } from '$lib/state/path-library';
	import { addRingWithPath, composition } from '$lib/state/composition';
	import { m } from '$lib/paraglide/messages';
	import { currentLocale } from '$lib/state/locale.svelte';
	import { goto } from '$app/navigation';
	import type { PathLibraryEntry } from '$lib/types';

	// Seed builtins once on mount.
	$effect(() => {
		seedBuiltinCurves();
	});

	let mode = $state<'grid' | 'editing'>('grid');
	let editingEntry = $state<PathLibraryEntry | null>(null);

	const builtins = $derived(pathLibrary.entries.filter((e) => e.builtin));
	const mine = $derived(pathLibrary.entries.filter((e) => !e.builtin));

	function handleUse(entry: PathLibraryEntry) {
		addRingWithPath(entry.path, entry.secondaryPath);
	}

	function handleEdit(entry: PathLibraryEntry) {
		// A builtin edit duplicates into an editable user copy; a user curve edits in place.
		editingEntry = entry.builtin ? duplicateEntry(entry) : entry;
		mode = 'editing';
	}

	function handleCancelEdit() {
		// The copy persists (draft); just return to the grid.
		mode = 'grid';
		editingEntry = null;
	}

	function handleDoneEdit(entry: PathLibraryEntry) {
		addRingWithPath(entry.path, entry.secondaryPath);
		mode = 'grid';
		editingEntry = null;
	}
</script>

<svelte:head><title>{m.paths_page_title()}</title></svelte:head>

{#key currentLocale()}
	<SidebarUI.SidebarProvider>
		<SidebarUI.Sidebar>
			<SidebarUI.SidebarContent class="p-2">
				{#if mode === 'editing' && editingEntry}
					<div data-testid="tracciati-editing">
						{#key editingEntry.id}
							<CurveEditorPanel
								entry={editingEntry}
								oncancel={handleCancelEdit}
								ondone={handleDoneEdit}
							/>
						{/key}
					</div>
				{/if}
			</SidebarUI.SidebarContent>
		</SidebarUI.Sidebar>

		<SidebarUI.SidebarInset>
			<header class="flex items-center gap-2 border-b p-4">
				<SidebarUI.SidebarTrigger />
				<WorkspaceNav />
				<span class="text-xs text-muted-foreground" data-testid="tracciati-ring-count">
					{m.tracciati_ring_count({ count: composition.rings.length })}
				</span>
				<div class="ml-auto flex items-center gap-3">
					<Button
						size="sm"
						data-testid="tracciati-go-editor"
						disabled={composition.rings.length === 0}
						onclick={() => goto('/editor')}
					>
						{m.tracciati_go_to_editor()}
					</Button>
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

			<main class="flex-1 overflow-auto p-8">
				{#if mode === 'editing' && editingEntry}
					<div class="flex flex-col items-center gap-2" data-testid="tracciati-editing-preview">
						{#key editingEntry.id}
							<RingPreview
								path={editingEntry.path}
								secondaryPath={editingEntry.secondaryPath}
								baseRadius={composition.baseRadius}
								ringIncrement={composition.ringIncrement}
								size={360}
							/>
						{/key}
					</div>
				{:else}
					<div data-testid="tracciati-grid" class="flex flex-col gap-6">
						<section>
							<h2 class="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
								{m.tracciati_default_group()}
							</h2>
							<div class="grid grid-cols-5 gap-3">
								{#each builtins as entry (entry.id)}
									<CurveCard {entry} onuse={handleUse} onedit={handleEdit} />
								{/each}
							</div>
						</section>
						<section>
							<h2 class="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
								{m.tracciati_mine_group()}
							</h2>
							{#if mine.length === 0}
								<p class="text-xs text-muted-foreground">{m.tracciati_empty_mine()}</p>
							{:else}
								<div class="grid grid-cols-5 gap-3">
									{#each mine as entry (entry.id)}
										<CurveCard {entry} onuse={handleUse} onedit={handleEdit} />
									{/each}
								</div>
							{/if}
						</section>
					</div>
				{/if}
			</main>
		</SidebarUI.SidebarInset>
	</SidebarUI.SidebarProvider>
{/key}
```

- [ ] **Step 4: Validare con svelte-autofixer**

Eseguire `svelte-autofixer` su `+page.svelte` finché non restituisce zero problemi.

- [ ] **Step 5: Eseguire i test della pagina e verificare che passino**

Run: `bun run test:unit -- --run src/routes/paths/page.svelte.spec.ts`
Expected: PASS.

- [ ] **Step 6: Rimuovere i riferimenti morti**

Verificare che `ApplyToRingSheet` e le vecchie utility (`applyEntryToRing`) non siano più referenziate dalla pagina. Se `ApplyToRingSheet` non è usato altrove (`grep -rn "ApplyToRingSheet" src`), lasciarlo in repo (potrebbe servire all'Editor) ma rimuovere import inutilizzati dalla pagina. Eseguire `bun run lint` per intercettare import morti.

Run: `bun run lint`
Expected: nessun errore di import inutilizzati nella pagina.

- [ ] **Step 7: Commit**

```bash
git add src/routes/paths/+page.svelte src/routes/paths/page.svelte.spec.ts
git commit -m "feat(tracciati): rewrite /paths as grid landing with edit sidebar"
```

---

### Task 12: Verifica end-to-end del flusso + suite completa

Aggiornare/aggiungere un e2e che copre il percorso utente e far girare tutta la suite.

**Files:**
- Modify: `src/routes/paths/path-manager.e2e.ts` (aggiornare al nuovo flusso) — oppure Create se il vecchio non è più pertinente.

**Interfaces:**
- Consumes: il flusso completo della pagina.
- Produces: copertura e2e di: atterraggio su `/paths`, presenza griglia, "Usa" aggiunge anello, "Vai all'editor" naviga.

- [ ] **Step 1: Aggiornare l'e2e**

Riscrivere `src/routes/paths/path-manager.e2e.ts` con (adattare ai selettori/helper Playwright già usati nel file):

```ts
import { test, expect } from '@playwright/test';

test('lands on Tracciati and uses a curve to add a ring', async ({ page }) => {
	await page.goto('/');
	await expect(page).toHaveURL(/\/paths/);
	await expect(page.getByTestId('tracciati-grid')).toBeVisible();

	await page.getByTestId('curve-card-builtin-0').click();
	await page.getByTestId('curve-use-builtin-0').click();

	await page.getByTestId('tracciati-go-editor').click();
	await expect(page).toHaveURL(/\/editor/);
});
```

- [ ] **Step 2: Eseguire l'e2e**

Run: `bun run test:e2e -- path-manager`
Expected: PASS. (Se l'ambiente non ha i browser Playwright, eseguire `bunx playwright install` prima.)

- [ ] **Step 3: Eseguire l'intera suite + check + lint**

Run: `bun run test:unit -- --run && bun run check && bun run lint`
Expected: tutto verde.

- [ ] **Step 4: Commit**

```bash
git add src/routes/paths/path-manager.e2e.ts
git commit -m "test(tracciati): e2e for landing → use curve → editor"
```

---

## Self-Review

**Spec coverage:**
- Atterraggio Tracciati come prima schermata → Task 7 (routing) + Task 11 (pagina). ✓
- Logo vuoto all'avvio → Task 6. ✓
- Griglia con 10 default + "le mie curve" → Task 3 (curve), Task 11 (gruppi). ✓
- 10 default = 4 base + variazioni → Task 2 (transforms) + Task 3. ✓
- Seeding idempotente → Task 4. ✓
- Hover-card preview sull'anello → Task 9. ✓
- Click → popover Usa/Edita → Task 9. ✓
- "Usa" aggiunge anello, resti in Tracciati, contatore, "Vai all'editor" → Task 1 + Task 11. ✓
- "Edita" duplica (builtin intatta), sidebar a punti senza SVG, anteprima live al centro, salva live → Task 4 (duplicate), Task 5 (updateEntryPath), Task 10 (panel), Task 11 (preview centrale). ✓
- "Annulla" conserva la bozza, "Fatto" aggiunge anello → Task 11 (handlers). ✓
- Builtin mai modificabili/cancellabili in place → Task 4/5 (no-op su builtin), Task 11 (edit builtin → duplicate). ✓
- Editor/Animazione invariati (SVG import resta nel loro RingEditor) → fuori scope, non toccato. ✓
- i18n en+it → Task 8. ✓

**Placeholder scan:** nessun TBD/TODO; ogni step di codice mostra il codice. Le uniche parti "da scoprire a runtime" (test rotti dal logo vuoto in Task 6; selettori e2e in Task 12) sono procedurali e includono il comando per individuarli, non codice mancante.

**Type consistency:** firme coerenti tra task — `addRingWithPath(path, secondaryPath?)` (T1) usata in T11; `seedBuiltinCurves()`/`duplicateEntry(entry)` (T4) usate in T11; `updateEntryPath(id, path)` (T5) usata in T10; `BUILTIN_CURVES` (T3) usata in T4; `scalePath`/`mirrorX` (T2) usate in T3; props `CurveCard {entry,onuse,onedit}` (T9) e `CurveEditorPanel {entry,oncancel,ondone}` (T10) usate in T11. Chiavi i18n `tracciati_*` (T8) usate in T9/T10/T11. Coerenti.
