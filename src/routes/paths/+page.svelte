<script lang="ts">
	import { Button } from '$lib/shadcn/ui/button/index.js';
	import WorkspaceNav from '$lib/components/WorkspaceNav.svelte';
	import PathThumbnail from '$lib/components/PathThumbnail.svelte';
	import RingPreview from '$lib/components/RingPreview.svelte';
	import ApplyToRingSheet from '$lib/components/ApplyToRingSheet.svelte';
	import { pathLibrary, applyEntryToRing } from '$lib/state/path-library';
	import type { ApplySlot } from '$lib/state/path-library';
	import { composition } from '$lib/state/composition';

	let selectedId = $state<string | null>(pathLibrary.entries[0]?.id ?? null);
	let applyOpen = $state(false);

	// Resolve against live state: fall back to the first entry if the pick is stale
	// (e.g. the library hydrated after mount, or the selected entry was removed).
	const selected = $derived(
		pathLibrary.entries.find((e) => e.id === selectedId) ?? pathLibrary.entries[0] ?? null
	);

	const canApply = $derived(selected !== null && composition.rings.length > 0);

	function applyToRing(ringIndex: number, slot: ApplySlot) {
		if (!selected) return;
		applyEntryToRing(composition.rings[ringIndex], selected, slot);
	}
</script>

<svelte:head><title>Path Library — logo-bettona</title></svelte:head>

<div class="flex min-h-screen flex-col bg-background text-foreground">
	<header data-testid="paths-header" class="flex items-center gap-2 border-b p-4 pl-72">
		<WorkspaceNav />
		<span class="ml-2 text-sm font-semibold">Path Library</span>
		<span class="text-xs text-muted-foreground">({pathLibrary.entries.length})</span>
	</header>

	<div class="flex flex-1">
		<aside class="w-72 shrink-0 overflow-y-auto border-r p-2" data-testid="paths-list">
			{#if pathLibrary.entries.length === 0}
				<p class="p-3 text-xs text-muted-foreground" data-testid="paths-empty-state">
					Nessun path salvato. Salva dal Ring Editor.
				</p>
			{:else}
				<div class="flex flex-col gap-1">
					{#each pathLibrary.entries as item (item.id)}
						<button
							type="button"
							data-testid="paths-card-{item.id}"
							aria-current={selected?.id === item.id ? 'true' : undefined}
							class="flex items-center gap-2 rounded-md border p-2 text-left hover:bg-muted aria-[current=true]:border-primary aria-[current=true]:bg-muted"
							onclick={() => (selectedId = item.id)}
						>
							<PathThumbnail path={item.path} secondaryPath={item.secondaryPath} size={48} />
							<div class="flex min-w-0 flex-1 flex-col">
								<span class="truncate text-xs font-medium">{item.name}</span>
								<span class="text-[10px] text-muted-foreground">
									{new Date(item.createdAt).toLocaleDateString()}
								</span>
							</div>
						</button>
					{/each}
				</div>
			{/if}
		</aside>

		<main class="flex flex-1 flex-col items-center justify-center gap-4 p-8">
			{#if selected}
				<div data-testid="paths-preview">
					<!-- Key on the entry id: RingPreview renders once on mount and does not
					     react to prop changes, so remount it when the selection changes. -->
					{#key selected.id}
						<RingPreview
							path={selected.path}
							secondaryPath={selected.secondaryPath}
							baseRadius={composition.baseRadius}
							ringIncrement={composition.ringIncrement}
							size={360}
						/>
					{/key}
				</div>
				<p class="text-sm font-medium">{selected.name}</p>
				<Button
					size="sm"
					data-testid="paths-apply"
					disabled={!canApply}
					onclick={() => (applyOpen = true)}
				>
					Applica al marchio
				</Button>
				{#if composition.rings.length === 0}
					<p class="text-[11px] text-muted-foreground">Aggiungi un anello in Editor per applicare.</p>
				{/if}
			{:else}
				<p class="text-sm text-muted-foreground">Nessuna forma da mostrare.</p>
			{/if}
		</main>
	</div>
</div>

<ApplyToRingSheet bind:open={applyOpen} entry={selected} rings={composition.rings} onapply={applyToRing} />
