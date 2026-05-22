<script lang="ts">
	import * as Sheet from '$lib/shadcn/ui/sheet/index.js';
	import { Button } from '$lib/shadcn/ui/button/index.js';
	import PathThumbnail from './PathThumbnail.svelte';
	import { pathLibrary } from '$lib/state/path-library';
	import type { PathLibraryEntry } from '$lib/types';
	import type { ApplySlot } from '$lib/state/path-library';
	import { composition } from '$lib/state/composition';
	import RingPreview from './RingPreview.svelte';

	let {
		open = $bindable(false),
		onapply
	}: {
		open?: boolean;
		onapply: (entry: PathLibraryEntry, slot: ApplySlot) => void;
	} = $props();

	let selected = $state<PathLibraryEntry | null>(null);
	let slotRaw = $state<ApplySlot>('template');
	let hoveredId = $state<string | null>(null);

	// Auto-correct: if selected entry has no secondaryPath, 'both' is invalid
	const slot = $derived<ApplySlot>(
		slotRaw === 'both' && selected && !selected.secondaryPath ? 'template' : slotRaw
	);

	// Reset picker state when the sheet is closed so it starts fresh on next open.
	// Intentional imperative reset — not replaceable with $derived.
	$effect(() => {
		if (!open) {
			selected = null;
			slotRaw = 'template';
		}
	});

	function confirm() {
		if (!selected) return;
		onapply(selected, slot);
		open = false;
	}
</script>

<Sheet.Root bind:open>
	<Sheet.Content side="right" class="w-[420px] sm:w-[480px]">
		<Sheet.Header>
			<Sheet.Title>Carica da libreria</Sheet.Title>
			<Sheet.Description>Scegli un path salvato e lo slot da sovrascrivere.</Sheet.Description>
		</Sheet.Header>

		<div class="mt-4 space-y-4">
			{#if pathLibrary.entries.length === 0}
				<p class="text-sm text-muted-foreground" data-testid="library-picker-empty">
					Libreria vuota. Salva prima dal Ring Editor.
				</p>
			{:else if !selected}
				<ul class="grid grid-cols-2 gap-3 sm:grid-cols-3" data-testid="library-picker-grid">
					{#each pathLibrary.entries as entry (entry.id)}
						<li
							class="relative"
							onmouseenter={() => (hoveredId = entry.id)}
							onmouseleave={() => (hoveredId = null)}
						>
							<button
								type="button"
								class="flex w-full flex-col items-center gap-1 rounded border p-2 hover:bg-muted"
								onclick={() => (selected = entry)}
								data-testid="library-picker-entry-{entry.id}"
							>
								<PathThumbnail
									path={entry.path}
									secondaryPath={entry.secondaryPath}
									size={80}
								/>
								<span class="text-xs">{entry.name}</span>
							</button>
							{#if hoveredId === entry.id}
								<div
									class="absolute left-full top-0 z-20 ml-2 rounded border bg-popover p-2 shadow-lg"
									data-testid="path-preview-popover"
								>
									<RingPreview
										path={entry.path}
										secondaryPath={entry.secondaryPath}
										baseRadius={composition.baseRadius}
										ringIncrement={composition.ringIncrement}
										size={220}
									/>
								</div>
							{/if}
						</li>
					{/each}
				</ul>
			{:else}
				<div class="space-y-3">
					<div class="flex items-center gap-3 rounded border p-2">
						<PathThumbnail path={selected.path} secondaryPath={selected.secondaryPath} size={64} />
						<div class="text-sm font-medium">{selected.name}</div>
					</div>

					<fieldset class="space-y-2">
						<legend class="text-xs font-medium">Slot</legend>
						<label class="flex items-center gap-2 text-sm">
							<input
								type="radio"
								name="apply-slot"
								value="template"
								checked={slot === 'template'}
								onchange={() => (slotRaw = 'template')}
							/>
							Template
						</label>
						<label class="flex items-center gap-2 text-sm">
							<input
								type="radio"
								name="apply-slot"
								value="secondary"
								checked={slot === 'secondary'}
								onchange={() => (slotRaw = 'secondary')}
							/>
							Secondary
						</label>
						<label
							class="flex items-center gap-2 text-sm"
							class:opacity-50={!selected.secondaryPath}
						>
							<input
								type="radio"
								name="apply-slot"
								value="both"
								disabled={!selected.secondaryPath}
								checked={slot === 'both'}
								onchange={() => (slotRaw = 'both')}
							/>
							Entrambi
						</label>
					</fieldset>

					<div class="flex justify-end gap-2">
						<Button variant="outline" size="sm" onclick={() => (selected = null)}>Indietro</Button>
						<Button size="sm" onclick={confirm} data-testid="library-picker-confirm">
							Applica
						</Button>
					</div>
				</div>
			{/if}
		</div>
	</Sheet.Content>
</Sheet.Root>
