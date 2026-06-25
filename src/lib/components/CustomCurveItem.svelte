<script lang="ts">
	import * as Collapsible from '$lib/shadcn/ui/collapsible/index.js';
	import { Button } from '$lib/shadcn/ui/button/index.js';
	import { Input } from '$lib/shadcn/ui/input/index.js';
	import { CaretDown, CaretRight, Trash, Copy } from 'phosphor-svelte';
	import RingCanvas from './RingCanvas.svelte';
	import {
		updateEntryPath,
		renameEntry,
		removeEntry,
		duplicateEntry
	} from '$lib/state/path-library';
	import { m } from '$lib/paraglide/messages';
	import type { PathLibraryEntry, Path } from '$lib/types';

	let {
		entry,
		selected,
		onselect
	}: {
		entry: PathLibraryEntry;
		selected: boolean;
		onselect: (id: string) => void;
	} = $props();

	let editorOpen = $state(false);
	let pendingDelete = $state(false);

	function handlePathChange(path: Path) {
		updateEntryPath(entry.id, path);
	}
</script>

<div
	class="rounded-md border"
	class:border-primary={selected}
	data-testid="custom-curve-{entry.id}"
>
	<div class="flex items-center gap-1 p-1.5">
		<Input
			data-testid="custom-name-{entry.id}"
			value={entry.name}
			aria-label={m.tracciati_curve_name()}
			class="h-7 flex-1 text-xs"
			oninput={(e) => renameEntry(entry.id, (e.target as HTMLInputElement).value)}
			onfocus={() => onselect(entry.id)}
			onclick={() => onselect(entry.id)}
		/>
		<Button
			variant="ghost"
			size="icon"
			class="h-7 w-7 text-muted-foreground hover:text-foreground"
			aria-label={m.tracciati_duplicate()}
			data-testid="custom-duplicate-{entry.id}"
			onclick={() => duplicateEntry(entry)}
		>
			<Copy size={14} />
		</Button>
		{#if pendingDelete}
			<Button
				variant="destructive"
				size="sm"
				data-testid="custom-delete-confirm-{entry.id}"
				onclick={() => removeEntry(entry.id)}
			>
				{m.common_delete()}
			</Button>
			<Button
				variant="ghost"
				size="sm"
				data-testid="custom-delete-cancel-{entry.id}"
				onclick={() => (pendingDelete = false)}
			>
				{m.common_cancel()}
			</Button>
		{:else}
			<Button
				variant="ghost"
				size="icon"
				class="h-7 w-7 text-muted-foreground hover:text-destructive"
				aria-label={m.common_delete()}
				data-testid="custom-delete-{entry.id}"
				onclick={() => (pendingDelete = true)}
			>
				<Trash size={14} />
			</Button>
		{/if}
	</div>

	<Collapsible.Collapsible bind:open={editorOpen}>
		<Collapsible.CollapsibleTrigger
			class="flex w-full items-center gap-1 px-2 pb-1.5 text-[10px] text-muted-foreground hover:text-foreground"
		>
			{#if editorOpen}
				<CaretDown size={12} />
			{:else}
				<CaretRight size={12} />
			{/if}
			{m.tracciati_points_editor()}
		</Collapsible.CollapsibleTrigger>
		<Collapsible.CollapsibleContent class="px-2 pb-2" data-testid="custom-editor-{entry.id}">
			<RingCanvas
				templatePath={entry.path}
				onchange={handlePathChange}
				label={m.tracciati_points_editor()}
			/>
		</Collapsible.CollapsibleContent>
	</Collapsible.Collapsible>
</div>
