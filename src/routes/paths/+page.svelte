<script lang="ts">
	import { pathLibrary } from '$lib/state/path-library';
	import PathThumbnail from '$lib/components/PathThumbnail.svelte';
</script>

<svelte:head><title>Path Library — logo-bettona</title></svelte:head>

<div class="min-h-screen w-full bg-background text-foreground">
	<header class="border-b">
		<div class="mx-auto flex max-w-[1100px] items-center px-6 py-3">
			<a
				href="/"
				class="text-sm text-muted-foreground hover:text-foreground"
				data-testid="paths-back-link"
			>
				← Back
			</a>
			<span class="ml-4 text-sm font-semibold">Path Library</span>
			<span class="ml-2 text-xs text-muted-foreground">
				({pathLibrary.entries.length})
			</span>
		</div>
	</header>

	<main class="mx-auto max-w-[1100px] px-6 py-8">
		{#if pathLibrary.entries.length === 0}
			<p
				class="text-sm text-muted-foreground"
				data-testid="paths-empty-state"
			>
				Nessun path salvato. Salva dal Ring Editor.
			</p>
		{:else}
			<ul
				class="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5"
				data-testid="paths-grid"
			>
				{#each pathLibrary.entries as entry (entry.id)}
					<li class="flex flex-col items-center gap-2 rounded border p-3">
						<PathThumbnail
							path={entry.path}
							secondaryPath={entry.secondaryPath}
							size={120}
						/>
						<div class="flex w-full items-center justify-between text-xs">
							<span class="font-medium">{entry.name}</span>
							{#if entry.secondaryPath}
								<span class="rounded bg-muted px-1.5 py-0.5 text-[10px] uppercase">
									secondary
								</span>
							{/if}
						</div>
						<span class="self-start text-[10px] text-muted-foreground">
							{new Date(entry.createdAt).toLocaleDateString()}
						</span>
					</li>
				{/each}
			</ul>
		{/if}
	</main>
</div>
