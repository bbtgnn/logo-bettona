<script lang="ts">
	import paper from 'paper';
	import * as Collapsible from '$lib/shadcn/ui/collapsible/index.js';
	import { Slider } from '$lib/shadcn/ui/slider/index.js';
	import { Button } from '$lib/shadcn/ui/button/index.js';
	import { Label } from '$lib/shadcn/ui/label/index.js';
	import { CaretDown, CaretRight } from 'phosphor-svelte';
	import {
		createRingMorphTarget,
		removeRingMorphTarget,
		updateRingPathVariant,
		setRingMorphT
	} from '$lib/state/composition';
	import { importSvg } from '$lib/geometry/svg-import';
	import { m } from '$lib/paraglide/messages';
	import LibraryPickerSheet from './LibraryPickerSheet.svelte';
	import RingCanvas from './RingCanvas.svelte';
	import type { Ring, PathLibraryEntry } from '$lib/types';
	import type { ApplySlot } from '$lib/state/path-library';

	let { ring, index }: { ring: Ring; index: number } = $props();

	let open = $state(false);
	let importError = $state<string | null>(null);
	let ringPathError = $state<string | null>(null);
	let libraryOpen = $state(false);
	let libraryApplyError = $state<string | null>(null);

	function clonePath(p: { cmds: string[]; crds: number[] }) {
		return { cmds: [...p.cmds], crds: [...p.crds] } as NonNullable<Ring['templatePath']>;
	}

	function handleApplyFromLibrary(entry: PathLibraryEntry, slot: ApplySlot) {
		libraryApplyError = null;
		if (slot === 'secondary') {
			const r = updateRingPathVariant(index, 'secondary', clonePath(entry.path));
			if (!r.ok) libraryApplyError = r.reason;
			return;
		}
		if (slot === 'both') {
			if (entry.secondaryPath) {
				const r = updateRingPathVariant(index, 'secondary', clonePath(entry.secondaryPath));
				if (!r.ok) libraryApplyError = r.reason;
			} else if (ring.secondaryTemplatePath) {
				removeRingMorphTarget(index);
			}
		}
	}

	const importScope = new paper.PaperScope();
	importScope.setup(new paper.Size(1, 1));

	async function handleFileChange(e: Event) {
		const file = (e.target as HTMLInputElement).files?.[0];
		if (!file) return;
		importError = null;
		const path = await importSvg(file, importScope);
		if (!path) {
			importError = m.editor_svg_invalid();
			return;
		}
		ringPathError = null;
		const result = updateRingPathVariant(index, 'secondary', path);
		if (!result.ok) ringPathError = result.reason;
	}

	function applyPathFromEditor(newPath: NonNullable<Ring['templatePath']>) {
		ringPathError = null;
		const result = updateRingPathVariant(index, 'secondary', newPath);
		if (!result.ok) ringPathError = result.reason;
	}
</script>

<div class="rounded border bg-background" data-testid="ring-morph-config-{index}">
	<Collapsible.Collapsible bind:open>
		<div class="flex items-center gap-1 px-2 py-1.5">
			<Collapsible.CollapsibleTrigger
				class="flex flex-1 items-center gap-1 text-left text-sm font-medium hover:text-foreground"
			>
				{#if open}
					<CaretDown size={14} />
				{:else}
					<CaretRight size={14} />
				{/if}
				{m.editor_ring_label({ index: index + 1 })}
			</Collapsible.CollapsibleTrigger>
		</div>

		<Collapsible.CollapsibleContent class="space-y-3 px-3 pb-3">
			{#if !ring.secondaryTemplatePath}
				<Button
					variant="outline"
					size="sm"
					onclick={() => {
						ringPathError = null;
						createRingMorphTarget(index);
					}}
				>
					{m.editor_create_morph()}
				</Button>
			{:else}
				<RingCanvas
					templatePath={ring.secondaryTemplatePath}
					onchange={applyPathFromEditor}
					label={m.editor_path_editor_secondary()}
				/>

				{#if ringPathError}
					<p class="text-xs text-destructive">{ringPathError}</p>
				{/if}

				<div class="flex flex-col gap-1">
					<span class="text-xs text-muted-foreground">
						{m.editor_ring_label({ index: index + 1 })} ({(ring.morphT ?? 0).toFixed(2)})
					</span>
					<Slider
						type="single"
						min={0}
						max={1}
						step={0.01}
						value={ring.morphT ?? 0}
						onValueChange={(v) => setRingMorphT(index, v)}
					/>
				</div>

				<div class="flex flex-wrap items-center gap-2">
					<Button variant="outline" size="sm" onclick={() => (libraryOpen = true)}>
						{m.editor_load_from_library()}
					</Button>
					<Button
						variant="outline"
						size="sm"
						onclick={() => {
							ringPathError = null;
							removeRingMorphTarget(index);
						}}
					>
						{m.editor_remove_morph()}
					</Button>
				</div>

				{#if libraryApplyError}
					<p class="text-xs text-destructive">{libraryApplyError}</p>
				{/if}

				<LibraryPickerSheet
					bind:open={libraryOpen}
					slots={['secondary', 'both']}
					onapply={handleApplyFromLibrary}
				/>

				<div class="flex flex-col gap-1">
					<Label for="morph-svg-upload-{index}" class="text-xs">{m.editor_import_svg()}</Label>
					<input
						id="morph-svg-upload-{index}"
						type="file"
						accept=".svg,image/svg+xml"
						onchange={handleFileChange}
						class="cursor-pointer text-xs file:mr-2 file:cursor-pointer file:rounded file:border-0 file:bg-muted file:px-2 file:py-1 file:text-xs"
					/>
					{#if importError}
						<p class="text-xs text-destructive">{importError}</p>
					{/if}
				</div>
			{/if}
		</Collapsible.CollapsibleContent>
	</Collapsible.Collapsible>
</div>
