<script lang="ts">
	import RingCanvas from './RingCanvas.svelte';
	import { Button } from '$lib/shadcn/ui/button/index.js';
	import { Input } from '$lib/shadcn/ui/input/index.js';
	import { Label } from '$lib/shadcn/ui/label/index.js';
	import { updateEntryPath, renameEntry } from '$lib/state/path-library';
	import { m } from '$lib/paraglide/messages';
	import type { PathLibraryEntry, Path } from '$lib/types';

	let {
		entry,
		oncancel,
		ondone
	}: {
		entry: PathLibraryEntry;
		oncancel: () => void;
		ondone: (entry: PathLibraryEntry) => void;
	} = $props();

	let name = $derived(entry.name);

	function handlePathChange(path: Path) {
		updateEntryPath(entry.id, path);
	}

	function handleNameChange(value: string) {
		renameEntry(entry.id, value);
	}
</script>

<div class="flex flex-col gap-3 p-3">
	<span class="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
		{m.tracciati_edit_title()}
	</span>

	<div class="flex flex-col gap-1">
		<Label for="curve-name" class="text-xs">{m.tracciati_curve_name()}</Label>
		<Input
			id="curve-name"
			bind:value={name}
			oninput={() => handleNameChange(name)}
		/>
	</div>

	<RingCanvas templatePath={entry.path} onchange={handlePathChange} label={m.tracciati_edit_title()} />

	<div class="flex gap-2">
		<Button variant="outline" class="flex-1" data-testid="curve-editor-cancel" onclick={oncancel}>
			{m.tracciati_cancel()}
		</Button>
		<Button class="flex-1" data-testid="curve-editor-done" onclick={() => ondone(entry)}>
			{m.tracciati_done()}
		</Button>
	</div>
</div>
