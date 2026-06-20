<script lang="ts">
	import { Button } from '$lib/shadcn/ui/button/index.js';
	import { Trash, PencilSimple } from 'phosphor-svelte';
	import * as SidebarUI from '$lib/shadcn/ui/sidebar/index.js';
	import WorkspaceNav from '$lib/components/WorkspaceNav.svelte';
	import PathThumbnail from '$lib/components/PathThumbnail.svelte';
	import RingPreview from '$lib/components/RingPreview.svelte';
	import ApplyToRingSheet from '$lib/components/ApplyToRingSheet.svelte';
	import { pathLibrary, applyEntryToRing, removeEntry, renameEntry } from '$lib/state/path-library';
	import type { ApplySlot } from '$lib/state/path-library';
	import { composition } from '$lib/state/composition';

	// Which library the page is showing. 'anim' (animation presets) is a placeholder
	// for now — a future feature owns its content.
	let libraryKind = $state<'path' | 'anim'>('path');
	let selectedId = $state<string | null>(pathLibrary.entries[0]?.id ?? null);
	let applyOpen = $state(false);
	// Two-step delete: the trash button arms a per-entry confirmation rather than
	// removing immediately, since saved paths are user data.
	let pendingDeleteId = $state<string | null>(null);
	// Inline rename: the pencil arms an edit field seeded with the current name.
	let editingId = $state<string | null>(null);
	let editDraft = $state('');

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

	function confirmDelete(id: string) {
		removeEntry(id);
		if (selectedId === id) selectedId = pathLibrary.entries[0]?.id ?? null;
		pendingDeleteId = null;
	}

	function startRename(id: string, name: string) {
		editingId = id;
		editDraft = name;
		pendingDeleteId = null;
	}

	function commitRename() {
		if (editingId) renameEntry(editingId, editDraft);
		editingId = null;
	}
</script>

<svelte:head><title>Path Library — logo-bettona</title></svelte:head>

<SidebarUI.SidebarProvider>
	<SidebarUI.Sidebar>
		<SidebarUI.SidebarContent class="p-2">
			{#if libraryKind === 'path'}
				<div data-testid="paths-list">
					{#if pathLibrary.entries.length === 0}
						<p class="p-3 text-xs text-muted-foreground" data-testid="paths-empty-state">
							Nessun path salvato. Salva dal Ring Editor.
						</p>
					{:else}
						<div class="flex flex-col gap-1">
							{#each pathLibrary.entries as item (item.id)}
								{#if editingId === item.id}
									<div class="flex items-center gap-1">
										<input
											aria-label="Nuovo nome"
											class="h-8 flex-1 rounded border bg-background px-2 text-xs"
											bind:value={editDraft}
											onkeydown={(e) => {
												if (e.key === 'Enter') commitRename();
												else if (e.key === 'Escape') editingId = null;
											}}
										/>
										<Button size="sm" aria-label="Conferma rinomina" onclick={commitRename}
											>OK</Button
										>
										<Button
											variant="ghost"
											size="sm"
											aria-label="Annulla rinomina"
											onclick={() => (editingId = null)}
										>
											Annulla
										</Button>
									</div>
								{:else}
									<div class="flex items-center gap-1">
										<button
											type="button"
											data-testid="paths-card-{item.id}"
											aria-current={selected?.id === item.id ? 'true' : undefined}
											class="flex flex-1 items-center gap-2 rounded-md border p-2 text-left hover:bg-muted aria-[current=true]:border-primary aria-[current=true]:bg-muted"
											onclick={() => (selectedId = item.id)}
										>
											<PathThumbnail
												path={item.path}
												secondaryPath={item.secondaryPath}
												size={48}
											/>
											<div class="flex min-w-0 flex-1 flex-col">
												<span class="truncate text-xs font-medium">{item.name}</span>
												<span class="text-[10px] text-muted-foreground">
													{new Date(item.createdAt).toLocaleDateString()}
												</span>
											</div>
										</button>
										{#if pendingDeleteId === item.id}
											<Button
												variant="destructive"
												size="sm"
												aria-label="Conferma eliminazione"
												onclick={() => confirmDelete(item.id)}
											>
												Elimina
											</Button>
											<Button
												variant="ghost"
												size="sm"
												aria-label="Annulla eliminazione"
												onclick={() => (pendingDeleteId = null)}
											>
												Annulla
											</Button>
										{:else if !item.builtin}
											<Button
												variant="ghost"
												size="icon"
												class="text-muted-foreground hover:text-foreground"
												aria-label="Rinomina {item.name}"
												onclick={() => startRename(item.id, item.name)}
											>
												<PencilSimple size={14} />
											</Button>
											<Button
												variant="ghost"
												size="icon"
												class="text-muted-foreground hover:text-destructive"
												aria-label="Elimina {item.name}"
												onclick={() => (pendingDeleteId = item.id)}
											>
												<Trash size={14} />
											</Button>
										{/if}
									</div>
								{/if}
							{/each}
						</div>
					{/if}
				</div>
			{/if}
		</SidebarUI.SidebarContent>
	</SidebarUI.Sidebar>

	<SidebarUI.SidebarInset>
		<header data-testid="paths-header" class="flex items-center gap-2 border-b p-4">
			<SidebarUI.SidebarTrigger />
			<WorkspaceNav />
			<select
				aria-label="Library"
				class="ml-2 h-7 rounded border bg-background text-sm font-semibold"
				value={libraryKind}
				onchange={(e) => (libraryKind = (e.target as HTMLSelectElement).value as 'path' | 'anim')}
			>
				<option value="path">Path Library</option>
				<option value="anim">Anim Library</option>
			</select>
			{#if libraryKind === 'path'}
				<span class="text-xs text-muted-foreground">({pathLibrary.entries.length})</span>
			{/if}
		</header>

		<main class="flex flex-1 flex-col items-center justify-center gap-4 p-8">
			{#if libraryKind === 'path'}
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
						<p class="text-[11px] text-muted-foreground">
							Aggiungi un anello in Editor per applicare.
						</p>
					{/if}
				{:else}
					<p class="text-sm text-muted-foreground">Nessuna forma da mostrare.</p>
				{/if}
			{:else}
				<div data-testid="anim-library-placeholder" class="text-sm text-muted-foreground">
					Anim Library — preset di animazioni, in arrivo.
				</div>
			{/if}
		</main>
	</SidebarUI.SidebarInset>
</SidebarUI.SidebarProvider>

<ApplyToRingSheet
	bind:open={applyOpen}
	entry={selected}
	rings={composition.rings}
	onapply={applyToRing}
/>
