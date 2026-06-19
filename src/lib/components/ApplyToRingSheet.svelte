<script lang="ts">
	import * as Sheet from '$lib/shadcn/ui/sheet/index.js';
	import { Button } from '$lib/shadcn/ui/button/index.js';
	import PathThumbnail from './PathThumbnail.svelte';
	import type { PathLibraryEntry, Ring } from '$lib/types';
	import type { ApplySlot } from '$lib/state/path-library';

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
			<Sheet.Title>Applica al marchio</Sheet.Title>
			<Sheet.Description>Scegli l'anello e lo slot su cui applicare la forma.</Sheet.Description>
		</Sheet.Header>

		{#if entry}
			<div class="mt-4 space-y-4">
				<div class="flex items-center gap-3 rounded border p-2">
					<PathThumbnail path={entry.path} secondaryPath={entry.secondaryPath} size={64} />
					<div class="text-sm font-medium">{entry.name}</div>
				</div>

				<div class="flex flex-col gap-1">
					<label for="apply-ring" class="text-xs font-medium">Anello</label>
					<select
						id="apply-ring"
						data-testid="apply-ring-select"
						class="h-9 rounded-md border border-input bg-background px-3 text-xs"
						value={ringIndex}
						onchange={(e) => (ringIndex = Number((e.target as HTMLSelectElement).value))}
					>
						{#each rings as _ring, i (i)}
							<option value={i}>Anello {i + 1}</option>
						{/each}
					</select>
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
						Principale
					</label>
					<label class="flex items-center gap-2 text-sm">
						<input
							type="radio"
							name="apply-slot"
							value="secondary"
							checked={slot === 'secondary'}
							onchange={() => (slotRaw = 'secondary')}
						/>
						Secondaria
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
						Entrambe
					</label>
				</fieldset>

				<div class="flex justify-end">
					<Button size="sm" onclick={confirm} data-testid="apply-confirm">Applica</Button>
				</div>
			</div>
		{/if}
	</Sheet.Content>
</Sheet.Root>
