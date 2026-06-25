<script lang="ts">
	import * as SidebarUI from '$lib/shadcn/ui/sidebar/index.js';
	import { Button } from '$lib/shadcn/ui/button/index.js';
	import WorkspaceNav from '$lib/components/WorkspaceNav.svelte';
	import LanguageSwitcher from '$lib/components/LanguageSwitcher.svelte';
	import CurveCard from '$lib/components/CurveCard.svelte';
	import CurveEditorPanel from '$lib/components/CurveEditorPanel.svelte';
	import RingPreview from '$lib/components/RingPreview.svelte';
	import { pathLibrary, seedBuiltinCurves, duplicateEntry } from '$lib/state/path-library';
	import { addRingWithPath, composition } from '$lib/state/composition';
	import { m } from '$lib/paraglide/messages';
	import { currentLocale } from '$lib/state/locale.svelte';
	import { goto } from '$app/navigation';
	import type { PathLibraryEntry } from '$lib/types';

	// Seed builtins once on mount. This intentionally mutates pathLibrary.entries
	// (a localStorage-backed store) as a side effect — it cannot be a $derived
	// because $derived must stay pure. seedBuiltinCurves() is itself idempotent
	// (skips ids already present), so re-running on every effect flush is a no-op.
	$effect(() => {
		seedBuiltinCurves();
	});

	let mode = $state<'grid' | 'editing'>('grid');
	let editingId = $state<string | null>(null);

	const builtins = $derived(pathLibrary.entries.filter((e) => e.builtin));
	const mine = $derived(pathLibrary.entries.filter((e) => !e.builtin));
	// Re-points to the live store entry by id, instead of caching a snapshot object,
	// so edits made through CurveEditorPanel (which replaces entries immutably) are
	// reflected here without going stale.
	const editingEntry = $derived(
		editingId ? (pathLibrary.entries.find((e) => e.id === editingId) ?? null) : null
	);

	function handleUse(entry: PathLibraryEntry) {
		addRingWithPath(entry.path, entry.secondaryPath);
	}

	function handleEdit(entry: PathLibraryEntry) {
		// A builtin edit duplicates into an editable user copy; a user curve edits in place.
		editingId = entry.builtin ? duplicateEntry(entry).id : entry.id;
		mode = 'editing';
	}

	function handleCancelEdit() {
		// The copy persists (draft); just return to the grid.
		mode = 'grid';
		editingId = null;
	}

	function handleDoneEdit() {
		// Read the live derived entry rather than trusting a passed snapshot, so the
		// committed ring always carries the latest edited path.
		if (editingEntry) {
			addRingWithPath(editingEntry.path, editingEntry.secondaryPath);
		}
		mode = 'grid';
		editingId = null;
	}
</script>

<svelte:head><title>{m.paths_page_title()}</title></svelte:head>

{#key currentLocale()}
	<SidebarUI.SidebarProvider>
		<SidebarUI.Sidebar>
			<SidebarUI.SidebarContent class="p-2">
				{#if mode === 'editing' && editingEntry}
					<div data-testid="tracciati-editing">
						{#key editingEntry.id}
							<CurveEditorPanel
								entry={editingEntry}
								oncancel={handleCancelEdit}
								ondone={handleDoneEdit}
							/>
						{/key}
					</div>
				{/if}
			</SidebarUI.SidebarContent>
		</SidebarUI.Sidebar>

		<SidebarUI.SidebarInset>
			<header class="flex items-center gap-2 border-b p-4">
				<SidebarUI.SidebarTrigger />
				<WorkspaceNav />
				<span class="text-xs text-muted-foreground" data-testid="tracciati-ring-count">
					{m.tracciati_ring_count({ count: composition.rings.length })}
				</span>
				<div class="ml-auto flex items-center gap-3">
					<Button
						size="sm"
						data-testid="tracciati-go-editor"
						disabled={composition.rings.length === 0}
						onclick={() => goto('/editor')}
					>
						{m.tracciati_go_to_editor()}
					</Button>
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

			<main class="flex-1 overflow-auto p-8">
				{#if mode === 'editing' && editingEntry}
					<div class="flex flex-col items-center gap-2" data-testid="tracciati-editing-preview">
						{#key editingEntry.id}
							<RingPreview
								path={editingEntry.path}
								secondaryPath={editingEntry.secondaryPath}
								baseRadius={composition.baseRadius}
								ringIncrement={composition.ringIncrement}
								size={360}
							/>
						{/key}
					</div>
				{:else}
					<div data-testid="tracciati-grid" class="flex flex-col gap-6">
						<section>
							<h2 class="mb-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
								{m.tracciati_default_group()}
							</h2>
							<div class="grid grid-cols-5 gap-3">
								{#each builtins as entry (entry.id)}
									<CurveCard {entry} onuse={handleUse} onedit={handleEdit} />
								{/each}
							</div>
						</section>
						<section>
							<h2 class="mb-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
								{m.tracciati_mine_group()}
							</h2>
							{#if mine.length === 0}
								<p class="text-xs text-muted-foreground">{m.tracciati_empty_mine()}</p>
							{:else}
								<div class="grid grid-cols-5 gap-3">
									{#each mine as entry (entry.id)}
										<CurveCard {entry} onuse={handleUse} onedit={handleEdit} />
									{/each}
								</div>
							{/if}
						</section>
					</div>
				{/if}
			</main>
		</SidebarUI.SidebarInset>
	</SidebarUI.SidebarProvider>
{/key}
