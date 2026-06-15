<script lang="ts">
	import paper from 'paper';
	import * as Collapsible from '$lib/shadcn/ui/collapsible/index.js';
	import { Slider } from '$lib/shadcn/ui/slider/index.js';
	import { Input } from '$lib/shadcn/ui/input/index.js';
	import { Button } from '$lib/shadcn/ui/button/index.js';
	import { Label } from '$lib/shadcn/ui/label/index.js';
	import { CaretDown, CaretRight, Trash, DotsSixVertical } from 'phosphor-svelte';
	import {
		updateRing,
		removeRing,
		setRingExpanded,
		isRingExpanded,
		colorMode,
		createRingMorphTarget,
		removeRingMorphTarget,
		setRingMorphT,
		updateRingPathVariant
	} from '$lib/state/composition';
	import { importSvg } from '$lib/geometry/svg-import';
	import { animationState } from '$lib/state/animation';
	import { saveEntry } from '$lib/state/path-library';
	import LibraryPickerSheet from './LibraryPickerSheet.svelte';
	import RingCanvas from './RingCanvas.svelte';
	import type { Ring } from '$lib/types';
	import type { PathLibraryEntry } from '$lib/types';
	import type { ApplySlot } from '$lib/state/path-library';

	const morphInactive = $derived(
		animationState.mode === 'audioBars' || animationState.mode === 'audioZones'
	);

	let {
		ring,
		index,
		ondragstart,
		ondragover,
		ondrop
	}: {
		ring: Ring;
		index: number;
		ondragstart?: (e: DragEvent) => void;
		ondragover?: (e: DragEvent) => void;
		ondrop?: (e: DragEvent) => void;
	} = $props();

	let open = $state(false);
	let importError = $state<string | null>(null);
	let ringPathError = $state<string | null>(null);
	let editVariant = $state<'primary' | 'secondary'>('primary');
	let saveStatus = $state<string | null>(null);
	let saveStatusTimer: ReturnType<typeof setTimeout> | null = null;
	let libraryOpen = $state(false);
	let libraryApplyError = $state<string | null>(null);

	function clonePath(p: { cmds: string[]; crds: number[] }) {
		return { cmds: [...p.cmds], crds: [...p.crds] } as NonNullable<Ring['templatePath']>;
	}

	function handleApplyFromLibrary(entry: PathLibraryEntry, slot: ApplySlot) {
		libraryApplyError = null;

		if (slot === 'template' || slot === 'both') {
			const r1 = updateRingPathVariant(index, 'primary', clonePath(entry.path));
			if (!r1.ok) {
				libraryApplyError = r1.reason;
				return;
			}
		}

		if (slot === 'secondary') {
			const r2 = updateRingPathVariant(index, 'secondary', clonePath(entry.path));
			if (!r2.ok) libraryApplyError = r2.reason;
			return;
		}

		if (slot === 'both') {
			if (entry.secondaryPath) {
				const r3 = updateRingPathVariant(index, 'secondary', clonePath(entry.secondaryPath));
				if (!r3.ok) libraryApplyError = r3.reason;
			} else if (ring.secondaryTemplatePath) {
				removeRingMorphTarget(index);
			}
		}
	}

	function showSaveStatus(msg: string) {
		saveStatus = msg;
		if (saveStatusTimer) clearTimeout(saveStatusTimer);
		saveStatusTimer = setTimeout(() => {
			saveStatus = null;
		}, 2000);
	}

	function handleSaveToLibrary() {
		if (!ring.templatePath) return;
		try {
			const entry = saveEntry(ring.templatePath, ring.secondaryTemplatePath);
			showSaveStatus(`Salvato come '${entry.name}'`);
		} catch {
			showSaveStatus('Libreria piena');
		}
	}

	$effect(() => {
		open = isRingExpanded(index);
	});

	$effect(() => {
		if (!ring.secondaryTemplatePath && editVariant === 'secondary') {
			editVariant = 'primary';
		}
	});

	// Dedicated PaperScope for SVG import (not for display — RingCanvas has its own)
	const importScope = new paper.PaperScope();
	importScope.setup(new paper.Size(1, 1));

	async function handleFileChange(e: Event) {
		const file = (e.target as HTMLInputElement).files?.[0];
		if (!file) return;

		importError = null;
		const path = await importSvg(file, importScope);

		if (!path) {
			importError = 'No valid path found. Make sure the SVG contains a single-contour path.';
			return;
		}

		ringPathError = null;
		const result = updateRingPathVariant(index, editVariant, path);
		if (!result.ok) {
			ringPathError = result.reason;
		}
	}

	function applyPathFromEditor(newPath: NonNullable<Ring['templatePath']>) {
		ringPathError = null;
		const result = updateRingPathVariant(index, editVariant, newPath);
		if (!result.ok) {
			ringPathError = result.reason;
		}
	}
</script>

<div
	class="mb-2 rounded border bg-background"
	draggable="true"
	role="listitem"
	{ondragstart}
	{ondragover}
	{ondrop}
>
	<Collapsible.Collapsible bind:open onOpenChange={(v) => setRingExpanded(index, v)}>
		<div class="flex items-center gap-1 px-2 py-1.5">
			<button
				class="cursor-grab text-muted-foreground hover:text-foreground"
				aria-label="Drag to reorder"
			>
				<DotsSixVertical size={16} />
			</button>
			<Collapsible.CollapsibleTrigger
				class="flex flex-1 items-center gap-1 text-left text-sm font-medium hover:text-foreground"
			>
				{#if open}
					<CaretDown size={14} />
				{:else}
					<CaretRight size={14} />
				{/if}
				Ring {index + 1}
			</Collapsible.CollapsibleTrigger>
			<Button
				variant="ghost"
				size="icon"
				class="h-6 w-6 text-muted-foreground hover:text-destructive"
				onclick={() => removeRing(index)}
				aria-label="Delete ring"
			>
				<Trash size={14} />
			</Button>
		</div>

		<Collapsible.CollapsibleContent class="space-y-3 px-3 pb-3">
			{#if ring.secondaryTemplatePath && !morphInactive}
				<div class="flex items-center gap-2">
					<Button
						variant={editVariant === 'primary' ? 'default' : 'outline'}
						size="sm"
						onclick={() => (editVariant = 'primary')}
					>
						Primary
					</Button>
					<Button
						variant={editVariant === 'secondary' ? 'default' : 'outline'}
						size="sm"
						onclick={() => (editVariant = 'secondary')}
					>
						Secondary
					</Button>
				</div>
			{/if}

			{#key editVariant}
				<RingCanvas
					templatePath={!morphInactive && editVariant === 'secondary'
						? ring.secondaryTemplatePath
						: ring.templatePath}
					onchange={applyPathFromEditor}
					label={`Path editor${!morphInactive && editVariant === 'secondary' ? ' (secondary)' : ''}`}
				/>
			{/key}

			{#if ringPathError}
				<p class="text-xs text-destructive">{ringPathError}</p>
			{/if}

			{#if !morphInactive}
				{#if !ring.secondaryTemplatePath}
					<Button
						variant="outline"
						size="sm"
						onclick={() => {
							ringPathError = null;
							createRingMorphTarget(index);
						}}
					>
						Create morph target
					</Button>
				{:else}
					<div class="space-y-2">
						<div class="flex items-center justify-between gap-2">
							<Button
								variant="outline"
								size="sm"
								onclick={() => {
									ringPathError = null;
									removeRingMorphTarget(index);
									editVariant = 'primary';
								}}
							>
								Remove morph target
							</Button>
							<span class="text-xs text-muted-foreground"
								>Morph t: {(ring.morphT ?? 0).toFixed(2)}</span
							>
						</div>
						<Slider
							type="single"
							min={0}
							max={1}
							step={0.01}
							value={ring.morphT ?? 0}
							onValueChange={(v) => setRingMorphT(index, v)}
						/>
					</div>
				{/if}
			{/if}

			<div class="flex flex-wrap items-center gap-2">
				<Button
					variant="outline"
					size="sm"
					onclick={handleSaveToLibrary}
					disabled={!ring.templatePath}
					data-testid="ring-save-to-library-{index}"
				>
					Salva in libreria
				</Button>
				<Button
					variant="outline"
					size="sm"
					onclick={() => (libraryOpen = true)}
					data-testid="ring-load-from-library-{index}"
				>
					Carica da libreria
				</Button>
				{#if saveStatus}
					<span class="text-xs text-muted-foreground" data-testid="ring-save-status-{index}">
						{saveStatus}
					</span>
				{/if}
			</div>

			{#if libraryApplyError}
				<p class="text-xs text-destructive" data-testid="ring-library-apply-error-{index}">
					{libraryApplyError}
				</p>
			{/if}

			<LibraryPickerSheet bind:open={libraryOpen} onapply={handleApplyFromLibrary} />

			<div class="flex flex-col gap-1">
				<Label for="svg-upload-{index}" class="text-xs">Import SVG</Label>
				<input
					id="svg-upload-{index}"
					type="file"
					accept=".svg,image/svg+xml"
					onchange={handleFileChange}
					class="cursor-pointer text-xs file:mr-2 file:cursor-pointer file:rounded file:border-0 file:bg-muted file:px-2 file:py-1 file:text-xs"
				/>
				{#if importError}
					<p class="text-xs text-destructive">{importError}</p>
				{/if}
			</div>

			<div class="flex flex-col gap-1">
				<Label for="copies-{index}" class="text-xs">Copies</Label>
				<Input
					id="copies-{index}"
					type="number"
					min="1"
					value={ring.copies}
					oninput={(e) =>
						updateRing(index, {
							copies: Math.max(1, parseInt((e.target as HTMLInputElement).value) || 1)
						})}
				/>
			</div>

			<div class="flex flex-col gap-2">
				<Label class="text-xs"
					>Ring height <span class="text-muted-foreground">{ring.ringHeight.toFixed(2)}</span
					></Label
				>
				<Slider
					type="single"
					min={0}
					max={1}
					step={0.01}
					value={ring.ringHeight}
					onValueChange={(v) => updateRing(index, { ringHeight: v })}
				/>
			</div>

			<div class="flex flex-col gap-2">
				<Label class="text-xs"
					>Rotation <span class="text-muted-foreground"
						>{(((ring.rotation ?? 0) * 360) / (ring.copies || 1)).toFixed(0)}°</span
					></Label
				>
				<Slider
					type="single"
					min={0}
					max={1}
					step={0.01}
					value={ring.rotation ?? 0}
					onValueChange={(v) => updateRing(index, { rotation: v })}
				/>
			</div>

			{#if colorMode.mode === 'manual'}
				<div class="flex flex-col gap-1">
					<Label for="color-{index}" class="text-xs">Color</Label>
					<div class="flex items-center gap-2">
						<input
							id="color-{index}"
							type="color"
							value={ring.color}
							oninput={(e) => updateRing(index, { color: (e.target as HTMLInputElement).value })}
							class="h-8 w-8 cursor-pointer rounded border border-input bg-transparent p-0.5"
						/>
						<span class="font-mono text-xs text-muted-foreground">{ring.color}</span>
					</div>
				</div>
			{/if}
		</Collapsible.CollapsibleContent>
	</Collapsible.Collapsible>
</div>