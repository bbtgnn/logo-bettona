<script lang="ts">
	import WorkspaceNav from '$lib/components/WorkspaceNav.svelte';
	import PathThumbnail from '$lib/components/PathThumbnail.svelte';
	import RingPreview from '$lib/components/RingPreview.svelte';
	import { pathLibrary } from '$lib/state/path-library';
	import { composition } from '$lib/state/composition';

	let selectedId = $state<string | null>(pathLibrary.entries[0]?.id ?? null);

	// Resolve against live state: fall back to the first entry if the pick is stale
	// (e.g. the library hydrated after mount, or the selected entry was removed).
	const selected = $derived(
		pathLibrary.entries.find((e) => e.id === selectedId) ?? pathLibrary.entries[0] ?? null
	);
</script>

<svelte:head><title>Path Library — logo-bettona</title></svelte:head>

<div class="flex min-h-screen flex-col bg-background text-foreground">
	<header class="flex items-center gap-2 border-b p-4">
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
							{#if item.secondaryPath}
								<span class="rounded bg-muted px-1.5 py-0.5 text-[10px] uppercase">secondary</span>
							{/if}
						</button>
					{/each}
				</div>
			{/if}
		</aside>

		<main class="flex flex-1 flex-col items-center justify-center gap-4 p-8">
			{#if selected}
				<div data-testid="paths-preview">
					<RingPreview
						path={selected.path}
						secondaryPath={selected.secondaryPath}
						baseRadius={composition.baseRadius}
						ringIncrement={composition.ringIncrement}
						size={360}
					/>
				</div>
				<p class="text-sm font-medium">{selected.name}</p>
			{:else}
				<p class="text-sm text-muted-foreground">Nessuna forma da mostrare.</p>
			{/if}
		</main>
	</div>
</div>
