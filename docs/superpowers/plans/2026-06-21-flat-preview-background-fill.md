# Flat Preview Background Fill Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Paint the monochrome palette background behind the rings in the flat (non-kaleidoscope) path so the visible preview, SVG export, and WebM export all show it.

**Architecture:** Add a full-view paper.js `Path.Rectangle` to the visible scene on the presenter side, right after each flat `pipeline.render(...)`, sent to the back. The visible canvas shows it, the flat SVG export reads the same `scope.project`, and the WebM export captures the same canvas — all three inherit the background from one place. The render pipeline and kaleidoscope path are untouched.

**Tech Stack:** Svelte 5 (runes, `{@attach}`), paper.js, Vitest browser mode (`vitest-browser-svelte`), bun.

## Global Constraints

- Package manager: **bun**. Single spec: `bun run test:unit -- run <path>`. Type check: `bun run check`.
- Tab indentation.
- Every `.svelte` file must pass svelte-autofixer with `issues: []` (ignore known false-positive *suggestions*: `bind:this`→attachment, "stateful-var called inside `$effect`").
- Do NOT run `prettier --write .` (reforms hundreds of untouched files). Only prettier touched files.
- `bun run lint` is pre-existing RED — not a gate. Gates: `check` + unit tests + autofixer.
- Background source is `getCompositionBackgroundColor()` (already used by kaleidoscope). Do not change its semantics.
- Commit trailer: `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`.
- Browser specs that assert English UI text must pin locale (`switchLocale('en')` in `beforeEach`) — `PreviewCanvas.svelte.spec.ts` already does this.
- Test home for the attach/effect behavior is `src/lib/components/PreviewCanvas.svelte.spec.ts` (browser mode), NOT `preview-presenter.svelte.spec.ts` (node mode — cannot run the attachment).

---

### Task 1: Paint the background rect behind the flat render

**Files:**
- Modify: `src/lib/components/preview-presenter.svelte.ts:154-168` (the flat `$effect` inside `attach`)
- Test: `src/lib/components/PreviewCanvas.svelte.spec.ts`

**Interfaces:**
- Consumes: `getCompositionBackgroundColor(): string` from `$lib/state/composition` (already imported in the presenter); `paper` default import (already present); `composition`, `colorMode` from `$lib/state/composition`.
- Produces: a paper item named `'preview-background'` at the back of the visible scope's active layer whenever kaleidoscope is OFF, with `fillColor` equal to `getCompositionBackgroundColor()`. Task 2 relies on this exact name string.

- [ ] **Step 1: Write the failing tests**

Add these two tests inside the existing `describe('PreviewCanvas.svelte', ...)` block in `src/lib/components/PreviewCanvas.svelte.spec.ts`. They reuse the file's existing `lastRenderedScope` capture and `beforeEach`/`afterEach`. Add `colorMode` to the existing import from `$lib/state/composition` (currently only `composition` is imported):

```ts
	it('paints a palette-colored background rect behind the rings in flat mode', async () => {
		composition.monochromePalettes = [
			{ primary: '#000000', secondary: '#ffffff', background: '#112233' }
		];
		colorMode.palette = 0;

		render(PreviewCanvas);

		await vi.waitFor(() => {
			expect(lastRenderedScope).toBeDefined();
			const children = lastRenderedScope!.project.activeLayer.children;
			const bg = children.find((c) => c.name === 'preview-background');
			expect(bg).toBeDefined();
			// back-most item
			expect(children.indexOf(bg!)).toBe(0);
			expect((bg as paper.Path).fillColor?.toCSS(true)).toBe('#112233');
		});
	});

	it('updates the background rect color when the palette background changes', async () => {
		composition.monochromePalettes = [
			{ primary: '#000000', secondary: '#ffffff', background: '#112233' }
		];
		colorMode.palette = 0;

		render(PreviewCanvas);

		await vi.waitFor(() => {
			const bg = lastRenderedScope!.project.activeLayer.children.find(
				(c) => c.name === 'preview-background'
			);
			expect((bg as paper.Path)?.fillColor?.toCSS(true)).toBe('#112233');
		});

		composition.monochromePalettes = [
			{ primary: '#000000', secondary: '#ffffff', background: '#445566' }
		];

		await vi.waitFor(() => {
			const bg = lastRenderedScope!.project.activeLayer.children.find(
				(c) => c.name === 'preview-background'
			);
			expect((bg as paper.Path)?.fillColor?.toCSS(true)).toBe('#445566');
		});
	});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `bun run test:unit -- run src/lib/components/PreviewCanvas.svelte.spec.ts -t "background"`
Expected: FAIL — no child named `preview-background` (`bg` is undefined).

- [ ] **Step 3: Add the background rect in the flat `$effect`**

In `src/lib/components/preview-presenter.svelte.ts`, the flat `$effect` currently ends with the `pipeline!.render(...)` call (lines ~166-167). Append the background paint immediately after that call, still inside the effect:

```ts
			const restFit =
				animationState.mode === 'audioZones' ? { fraction: REST_FRACTION } : undefined;
			pipeline!.render({ composition: comp, scope: scope!, ignoreMorph, viewport, restFit });

			// Paint the palette background behind the rings. pipeline.render() cleared the
			// scope, so re-add it every render; sendToBack keeps it under the marks. The flat
			// SVG export reads this same scene and the WebM export captures this canvas, so all
			// three surfaces inherit the background from here. Tagged so exportSvg can tell the
			// background apart from real content.
			scope!.activate();
			const background = new paper.Path.Rectangle(scope!.view.bounds);
			background.fillColor = new paper.Color(getCompositionBackgroundColor());
			background.name = 'preview-background';
			background.sendToBack();
			scope!.view.update();
```

`getCompositionBackgroundColor()` reads `composition.monochromePalettes` and `colorMode.palette`; reading them inside the effect makes the effect re-run on palette changes, so the color stays live.

- [ ] **Step 4: Run tests to verify they pass**

Run: `bun run test:unit -- run src/lib/components/PreviewCanvas.svelte.spec.ts -t "background"`
Expected: PASS (both tests).

- [ ] **Step 5: Run the full PreviewCanvas spec + type check**

Run: `bun run test:unit -- run src/lib/components/PreviewCanvas.svelte.spec.ts`
Expected: PASS (all tests — the existing "draws content" test still passes; rings plus the bg rect are present).

Run: `bun run check`
Expected: 0 errors.

- [ ] **Step 6: Commit**

```bash
git add src/lib/components/preview-presenter.svelte.ts src/lib/components/PreviewCanvas.svelte.spec.ts
git commit -m "$(cat <<'EOF'
feat(preview): paint palette background behind flat render

Flat (non-kaleidoscope) path drew only rings on a transparent canvas, so
the preview showed CSS white instead of the palette background. Add a
full-view paper rect tagged 'preview-background' after each flat render,
sent to back. Visible canvas, flat SVG export, and WebM export all inherit
it from one place; pipeline and kaleidoscope untouched.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: Preserve the empty-content export guard and drop the CSS background

**Files:**
- Modify: `src/lib/components/preview-presenter.svelte.ts:136-143` (`exportSvg` flat branch)
- Modify: `src/lib/components/PreviewCanvas.svelte:19` (`<canvas>` class)
- Test: `src/lib/components/PreviewCanvas.svelte.spec.ts`

**Interfaces:**
- Consumes: the `'preview-background'` named item produced by Task 1.
- Produces: flat SVG export downloads `composition.svg` only when at least one non-background item exists.

- [ ] **Step 1: Write the failing test**

Add inside the same `describe` block in `src/lib/components/PreviewCanvas.svelte.spec.ts`. This asserts that with zero renderable rings the flat Export SVG produces no download even though the background rect is present:

```ts
	it('flat Export SVG produces no download when there are no rings', async () => {
		composition.rings = [];
		const downloads: string[] = [];
		const origClick = HTMLAnchorElement.prototype.click;
		HTMLAnchorElement.prototype.click = function (this: HTMLAnchorElement) {
			downloads.push(this.download);
		};
		try {
			render(PreviewCanvas);
			await vi.waitFor(() => expect(lastRenderedScope).toBeDefined());
			await userEvent.click(page.getByRole('button', { name: 'Export SVG' }));
			expect(downloads).not.toContain('composition.svg');
		} finally {
			HTMLAnchorElement.prototype.click = origClick;
		}
	});
```

`userEvent` and `page` are already imported in this file.

- [ ] **Step 2: Run the test to verify it fails**

Run: `bun run test:unit -- run src/lib/components/PreviewCanvas.svelte.spec.ts -t "no rings"`
Expected: FAIL — `downloads` contains `composition.svg`, because the background rect makes `activeLayer.children.length > 0` true.

- [ ] **Step 3: Update the `exportSvg` content check**

In `src/lib/components/preview-presenter.svelte.ts`, the flat branch of `exportSvg` currently reads:

```ts
		if (!scope) return;
		const hasContent = scope.project.activeLayer.children.length > 0;
		if (!hasContent) return;
```

Replace the `hasContent` line so the background rect does not count as content:

```ts
		if (!scope) return;
		const hasContent = scope.project.activeLayer.children.some(
			(child) => child.name !== 'preview-background'
		);
		if (!hasContent) return;
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `bun run test:unit -- run src/lib/components/PreviewCanvas.svelte.spec.ts -t "no rings"`
Expected: PASS.

- [ ] **Step 5: Drop the CSS background from the canvas**

In `src/lib/components/PreviewCanvas.svelte`, the `<canvas>` line is:

```svelte
	<canvas {@attach presenter.attach} width="600" height="600" class="rounded-lg border bg-white"
	></canvas>
```

Remove `bg-white` (the background is now real canvas pixels, not CSS):

```svelte
	<canvas {@attach presenter.attach} width="600" height="600" class="rounded-lg border"
	></canvas>
```

- [ ] **Step 6: Run svelte-autofixer on the component**

Run the `svelte-autofixer` MCP tool on `src/lib/components/PreviewCanvas.svelte`.
Expected: `issues: []` (ignore any suggestions). If real issues appear, fix and re-run until `issues: []`.

- [ ] **Step 7: Run the full PreviewCanvas spec + type check**

Run: `bun run test:unit -- run src/lib/components/PreviewCanvas.svelte.spec.ts`
Expected: PASS (all tests, including the existing kaleidoscope `kaleidoscope.svg` export test).

Run: `bun run check`
Expected: 0 errors.

- [ ] **Step 8: Commit**

```bash
git add src/lib/components/preview-presenter.svelte.ts src/lib/components/PreviewCanvas.svelte src/lib/components/PreviewCanvas.svelte.spec.ts
git commit -m "$(cat <<'EOF'
feat(preview): drop canvas bg-white, keep empty-SVG guard

The palette background is now painted into the scene, so the canvas no
longer needs CSS bg-white. Exclude the tagged background rect from the
flat Export SVG content check so a no-rings composition still exports
nothing.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: Full verification

**Files:** none (verification only).

- [ ] **Step 1: Run the full unit suite**

Run: `bun run test:unit -- run`
Expected: all pass (434+ tests). If message-asserting tests flake, it is the known paraglide recompile race — rerun once.

- [ ] **Step 2: Type check**

Run: `bun run check`
Expected: 0 errors.

- [ ] **Step 3: Live browser check**

Start dev (`(bun run dev &)`, port 5174 if 5173 busy). With a Playwright script placed INSIDE the repo (so `playwright` resolves from repo `node_modules`), screenshot the editor:
- Kaleidoscope OFF: the preview shows the palette background color behind the rings (not white).
- Switch palette: the preview background updates to the new palette's background.
- Kaleidoscope ON: unchanged (still correct).

Screenshot, not `select.scrollWidth`-style probes — `getContext` pixels / screenshot are decisive. `pkill -f "vite dev"` when done.

- [ ] **Step 4: Report**

Summarize results to the user (tests, check, screenshots). No commit — verification only.
```
