<script lang="ts">
	import * as Sheet from '$lib/shadcn/ui/sheet/index.js';
	import { Button } from '$lib/shadcn/ui/button/index.js';
	import PathThumbnail from './PathThumbnail.svelte';
	import { pathLibrary } from '$lib/state/path-library';
	import type { PathLibraryEntry } from '$lib/types';
	import type { ApplySlot } from '$lib/state/path-library';
	import { composition } from '$lib/state/composition';
	import RingPreview from './RingPreview.svelte';
	import { m } from '$lib/paraglide/messages';
	import { untrack } from 'svelte';

	let {
		open = $bindable(false),
		onapply,
		slots = ['template', 'secondary', 'both']
	}: {
		open?: boolean;
		onapply: (entry: PathLibraryEntry, slot: ApplySlot) => void;
		slots?: ApplySlot[];
	} = $props();

	let selected = $state<PathLibraryEntry | null>(null);
	let slotRaw = $state<ApplySlot>(untrack(() => slots[0] ?? 'template'));
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
			slotRaw = slots[0] ?? 'template';
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
			<Sheet.Title>{m.library_title()}</Sheet.Title>
			<Sheet.Description>{m.library_desc()}</Sheet.Description>
		</Sheet.Header>

		<div class="mt-4 space-y-4">
			{#if pathLibrary.entries.length === 0}
				<p class="text-sm text-muted-foreground" data-testid="library-picker-empty">
					{m.library_empty()}
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
								<PathThumbnail path={entry.path} secondaryPath={entry.secondaryPath} size={80} />
								<span class="text-xs">{entry.name}</span>
							</button>
							{#if hoveredId === entry.id}
								<div
									class="absolute top-0 left-full z-20 ml-2 rounded border bg-popover p-2 shadow-lg"
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

					{#if slots.length > 1}
						<fieldset class="space-y-2">
							<legend class="text-xs font-medium">{m.common_slot()}</legend>
							{#if slots.includes('template')}
								<label class="flex items-center gap-2 text-sm">
									<input
										type="radio"
										name="apply-slot"
										value="template"
										checked={slot === 'template'}
										onchange={() => (slotRaw = 'template')}
									/>
									{m.slot_primary()}
								</label>
							{/if}
							{#if slots.includes('secondary')}
								<label class="flex items-center gap-2 text-sm">
									<input
										type="radio"
										name="apply-slot"
										value="secondary"
										checked={slot === 'secondary'}
										onchange={() => (slotRaw = 'secondary')}
									/>
									{m.slot_secondary()}
								</label>
							{/if}
							{#if slots.includes('both')}
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
									{m.slot_both()}
								</label>
							{/if}
						</fieldset>
					{/if}

					<div class="flex justify-end gap-2">
						<Button variant="outline" size="sm" onclick={() => (selected = null)}
							>{m.common_back()}</Button
						>
						<Button size="sm" onclick={confirm} data-testid="library-picker-confirm">
							{m.common_apply()}
						</Button>
					</div>
				</div>
			{/if}
		</div>
	</Sheet.Content>
</Sheet.Root>
