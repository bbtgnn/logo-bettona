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
