<script lang="ts">
	import * as Sheet from '$lib/shadcn/ui/sheet/index.js';
	import { Button } from '$lib/shadcn/ui/button/index.js';
	import PathThumbnail from './PathThumbnail.svelte';
	import RingPreview from './RingPreview.svelte';
	import type { PathLibraryEntry, Ring } from '$lib/types';
	import type { ApplyTarget } from '$lib/state/path-library';
	import { composition } from '$lib/state/composition';
	import { m } from '$lib/paraglide/messages';
	import { untrack } from 'svelte';

	let {
		open = $bindable(false),
		entry,
		rings,
		onapply
	}: {
		open?: boolean;
		entry: PathLibraryEntry | null;
		rings: Ring[];
		onapply: (target: ApplyTarget) => void;
	} = $props();

	// Selected target: an existing ring index, or the 'new' sentinel.
	let selected = $state<number | 'new'>(untrack(() => (rings.length > 0 ? 0 : 'new')));

	// Reset to the default target when the sheet closes so it opens fresh.
	$effect(() => {
		if (!open) {
			selected = rings.length > 0 ? 0 : 'new';
		}
	});

	function confirm() {
		if (!entry) return;
		if (selected === 'new') {
			onapply({ kind: 'new' });
			open = false;
			return;
		}
		// Guard: rings can shrink under the sheet; a stale index would dereference
		// an undefined ring downstream.
		if (selected < 0 || selected >= rings.length) return;
		onapply({ kind: 'existing', index: selected });
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

				<div class="flex flex-col gap-2" role="radiogroup">
					{#each rings as ring, i (ring.id)}
						<label
							class="flex items-center gap-3 rounded border p-2 text-sm hover:bg-muted"
							data-testid="apply-target-existing-{i}"
						>
							<input
								type="radio"
								name="apply-target"
								value={i}
								checked={selected === i}
								onchange={() => (selected = i)}
							/>
							<span class="flex-1">{m.editor_ring_label({ index: i + 1 })}</span>
							<RingPreview
								path={entry.path}
								copies={composition.copies}
								baseRadius={composition.baseRadius}
								ringIncrement={composition.ringIncrement}
								size={72}
							/>
						</label>
					{/each}

					<label
						class="flex items-center gap-3 rounded border border-dashed p-2 text-sm hover:bg-muted"
						data-testid="apply-target-new"
					>
						<input
							type="radio"
							name="apply-target"
							value="new"
							checked={selected === 'new'}
							onchange={() => (selected = 'new')}
						/>
						<span class="flex-1">{m.apply_target_new()}</span>
						<RingPreview
							path={entry.path}
							copies={composition.copies}
							baseRadius={composition.baseRadius}
							ringIncrement={composition.ringIncrement}
							size={72}
						/>
					</label>
				</div>

				<div class="flex justify-end gap-2">
					<Button variant="outline" size="sm" onclick={() => (open = false)}>
						{m.common_back()}
					</Button>
					<Button size="sm" onclick={confirm} data-testid="apply-confirm">
						{m.common_apply()}
					</Button>
				</div>
			</div>
		{/if}
	</Sheet.Content>
</Sheet.Root>
