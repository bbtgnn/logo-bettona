<script lang="ts">
	import * as Sheet from '$lib/shadcn/ui/sheet/index.js';
	import { Button } from '$lib/shadcn/ui/button/index.js';
	import PathThumbnail from './PathThumbnail.svelte';
	import type { PathLibraryEntry, Ring } from '$lib/types';
	import type { ApplySlot } from '$lib/state/path-library';
	import { m } from '$lib/paraglide/messages';

	let {
		open = $bindable(false),
		entry,
		rings,
		onapply
	}: {
		open?: boolean;
		entry: PathLibraryEntry | null;
		rings: Ring[];
		onapply: (ringIndex: number, slot: ApplySlot) => void;
	} = $props();

	let ringIndex = $state(0);
	let slotRaw = $state<ApplySlot>('template');

	// Mirror LibraryPickerSheet: only 'both' needs a secondary path; auto-correct it.
	const slot = $derived<ApplySlot>(
		slotRaw === 'both' && entry && !entry.secondaryPath ? 'template' : slotRaw
	);

	// Reset to defaults when the sheet closes so it opens fresh next time.
	$effect(() => {
		if (!open) {
			ringIndex = 0;
			slotRaw = 'template';
		}
	});

	function confirm() {
		// Guard the index too: rings can shrink under the sheet (prop change), and a
		// stale ringIndex would otherwise dereference an undefined ring downstream.
		if (!entry || ringIndex < 0 || ringIndex >= rings.length) return;
		onapply(ringIndex, slot);
		open = false;
	}
</script>

<Sheet.Root bind:open>
	<Sheet.Content side="right" class="w-[420px] sm:w-[480px]">
		<Sheet.Header>
			<Sheet.Title>{m.apply_title()}</Sheet.Title>
			<Sheet.Description>{m.apply_desc()}</Sheet.Description>
		</Sheet.Header>

		{#if entry}
			<div class="mt-4 space-y-4">
				<div class="flex items-center gap-3 rounded border p-2">
					<PathThumbnail path={entry.path} secondaryPath={entry.secondaryPath} size={64} />
					<div class="text-sm font-medium">{entry.name}</div>
				</div>

				<div class="flex flex-col gap-1">
					<label for="apply-ring" class="text-xs font-medium">{m.apply_ring_label()}</label>
					<select
						id="apply-ring"
						data-testid="apply-ring-select"
						class="h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-xs"
						value={ringIndex}
						onchange={(e) => (ringIndex = Number((e.target as HTMLSelectElement).value))}
					>
						{#each rings as _ring, i (i)}
							<option value={i}>{m.editor_ring_label({ index: i + 1 })}</option>
						{/each}
					</select>
				</div>

				<fieldset class="space-y-2">
					<legend class="text-xs font-medium">{m.common_slot()}</legend>
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
					<label class="flex items-center gap-2 text-sm" class:opacity-50={!entry.secondaryPath}>
						<input
							type="radio"
							name="apply-slot"
							value="both"
							disabled={!entry.secondaryPath}
							checked={slot === 'both'}
							onchange={() => (slotRaw = 'both')}
						/>
						{m.slot_both()}
					</label>
				</fieldset>

				<div class="flex justify-end">
					<Button size="sm" onclick={confirm} data-testid="apply-confirm">{m.common_apply()}</Button
					>
				</div>
			</div>
		{/if}
	</Sheet.Content>
</Sheet.Root>
