<script lang="ts">
	import { Button } from '$lib/shadcn/ui/button/index.js';
	import { Trash, PencilSimple } from 'phosphor-svelte';
	import * as SidebarUI from '$lib/shadcn/ui/sidebar/index.js';
	import WorkspaceNav from '$lib/components/WorkspaceNav.svelte';
	import LanguageSwitcher from '$lib/components/LanguageSwitcher.svelte';
	import PathThumbnail from '$lib/components/PathThumbnail.svelte';
	import RingPreview from '$lib/components/RingPreview.svelte';
	import ApplyToRingSheet from '$lib/components/ApplyToRingSheet.svelte';
	import { pathLibrary, applyEntryToRing, removeEntry, renameEntry } from '$lib/state/path-library';
	import type { ApplySlot } from '$lib/state/path-library';
	import { composition } from '$lib/state/composition';
	import { m } from '$lib/paraglide/messages';
	import { currentLocale } from '$lib/state/locale.svelte';

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

<svelte:head><title>{m.paths_page_title()}</title></svelte:head>

{#key currentLocale()}
	<SidebarUI.SidebarProvider>
		<SidebarUI.Sidebar>
			<SidebarUI.SidebarContent class="p-2">
				{#if libraryKind === 'path'}
					<div data-testid="paths-list">
						{#if pathLibrary.entries.length === 0}
							<p class="p-3 text-xs text-muted-foreground" data-testid="paths-empty-state">
								{m.paths_empty_saved()}
							</p>
						{:else}
							<div class="flex flex-col gap-1">
								{#each pathLibrary.entries as item (item.id)}
									{#if editingId === item.id}
										<div class="flex items-center gap-1">
											<input
												aria-label={m.paths_new_name()}
												class="h-8 flex-1 rounded border bg-background px-2 text-xs"
												bind:value={editDraft}
												onkeydown={(e) => {
													if (e.key === 'Enter') commitRename();
													else if (e.key === 'Escape') editingId = null;
												}}
											/>
											<Button size="sm" aria-label={m.paths_confirm_rename()} onclick={commitRename}
												>{m.common_ok()}</Button
											>
											<Button
												variant="ghost"
												size="sm"
												aria-label={m.paths_cancel_rename()}
												onclick={() => (editingId = null)}
											>
												{m.common_cancel()}
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
													aria-label={m.paths_confirm_delete()}
													onclick={() => confirmDelete(item.id)}
												>
													{m.common_delete()}
												</Button>
												<Button
													variant="ghost"
													size="sm"
													aria-label={m.paths_cancel_delete()}
													onclick={() => (pendingDeleteId = null)}
												>
													{m.common_cancel()}
												</Button>
											{:else if !item.builtin}
												<Button
													variant="ghost"
													size="icon"
													class="text-muted-foreground hover:text-foreground"
													aria-label={m.paths_rename_entry({ name: item.name })}
													onclick={() => startRename(item.id, item.name)}
												>
													<PencilSimple size={14} />
												</Button>
												<Button
													variant="ghost"
													size="icon"
													class="text-muted-foreground hover:text-destructive"
													aria-label={m.paths_delete_entry({ name: item.name })}
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
					aria-label={m.paths_library_select()}
					class="ml-2 h-8 rounded border bg-background px-2 py-1 text-sm font-semibold"
					value={libraryKind}
					onchange={(e) => (libraryKind = (e.target as HTMLSelectElement).value as 'path' | 'anim')}
				>
					<option value="path">{m.paths_library_path()}</option>
					<option value="anim">{m.paths_library_anim()}</option>
				</select>
				{#if libraryKind === 'path'}
					<span class="text-xs text-muted-foreground">({pathLibrary.entries.length})</span>
				{/if}
				<div class="ml-auto flex items-center gap-3">
					<LanguageSwitcher />
					<a
						href="/about"
						class="text-sm text-muted-foreground hover:text-foreground"
						data-testid="header-about-link"
					>
						{m.header_about()}
					</a>
				</div>
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
							{m.apply_title()}
						</Button>
						{#if composition.rings.length === 0}
							<p class="text-[11px] text-muted-foreground">
								{m.paths_add_ring_hint()}
							</p>
						{/if}
					{:else}
						<p class="text-sm text-muted-foreground">{m.paths_nothing_to_show()}</p>
					{/if}
				{:else}
					<div data-testid="anim-library-placeholder" class="text-sm text-muted-foreground">
						{m.paths_anim_placeholder()}
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
{/key}
