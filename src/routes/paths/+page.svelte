<script lang="ts">
	import * as SidebarUI from '$lib/shadcn/ui/sidebar/index.js';
	import * as Collapsible from '$lib/shadcn/ui/collapsible/index.js';
	import { Button } from '$lib/shadcn/ui/button/index.js';
	import { CaretDown, CaretRight, Plus } from 'phosphor-svelte';
	import SidebarNav from '$lib/components/SidebarNav.svelte';
	import LanguageSwitcher from '$lib/components/LanguageSwitcher.svelte';
	import CustomCurveItem from '$lib/components/CustomCurveItem.svelte';
	import RingPreview from '$lib/components/RingPreview.svelte';
	import PathThumbnail from '$lib/components/PathThumbnail.svelte';
	import { pathLibrary, seedBuiltinCurves, createCurveFromArc } from '$lib/state/path-library';
	import { composition } from '$lib/state/composition';
	import { m } from '$lib/paraglide/messages';
	import { currentLocale } from '$lib/state/locale.svelte';

	// Seed the 10 builtin curves once. This intentionally mutates pathLibrary.entries
	// (a localStorage-backed store) as a side effect — it cannot be a $derived because
	// $derived must stay pure. seedBuiltinCurves() is itself idempotent (skips ids
	// already present), so re-running on every effect flush is a no-op.
	$effect(() => {
		seedBuiltinCurves();
	});

	let baseOpen = $state(true);
	let customOpen = $state(true);
	let selectedId = $state<string | null>(null);

	const builtins = $derived(pathLibrary.entries.filter((e) => e.builtin));
	const mine = $derived(pathLibrary.entries.filter((e) => !e.builtin));
	// Resolve the selected curve live by id, falling back to the first builtin.
	const selected = $derived(
		pathLibrary.entries.find((e) => e.id === selectedId) ?? builtins[0] ?? null
	);

	function handleCreate() {
		const entry = createCurveFromArc();
		selectedId = entry.id;
		customOpen = true;
	}
</script>

<svelte:head><title>{m.paths_page_title()}</title></svelte:head>

{#key currentLocale()}
	<SidebarUI.SidebarProvider>
		<SidebarUI.Sidebar>
			<SidebarUI.SidebarContent class="flex flex-col gap-2 p-2">
				<SidebarNav />

				<Collapsible.Collapsible bind:open={baseOpen}>
					<Collapsible.CollapsibleTrigger
						class="flex w-full items-center gap-1 rounded-md bg-muted/40 px-2 py-1.5 text-xs font-semibold"
					>
						{#if baseOpen}<CaretDown size={12} />{:else}<CaretRight size={12} />{/if}
						{m.tracciati_default_group()}
					</Collapsible.CollapsibleTrigger>
					<Collapsible.CollapsibleContent
						class="flex flex-col gap-1 p-1"
						data-testid="tracciati-base-list"
					>
						{#each builtins as entry (entry.id)}
							<button
								type="button"
								data-testid="base-curve-{entry.id}"
								aria-current={selected?.id === entry.id ? 'true' : undefined}
								class="flex items-center gap-2 rounded-md border p-1.5 text-left text-xs hover:bg-muted aria-[current=true]:border-primary aria-[current=true]:bg-muted"
								onclick={() => (selectedId = entry.id)}
							>
								<PathThumbnail path={entry.path} secondaryPath={entry.secondaryPath} size={28} />
								<span class="truncate">{entry.name}</span>
							</button>
						{/each}
					</Collapsible.CollapsibleContent>
				</Collapsible.Collapsible>

				<Collapsible.Collapsible bind:open={customOpen}>
					<Collapsible.CollapsibleTrigger
						class="flex w-full items-center gap-1 rounded-md bg-muted/40 px-2 py-1.5 text-xs font-semibold"
					>
						{#if customOpen}<CaretDown size={12} />{:else}<CaretRight size={12} />{/if}
						{m.tracciati_mine_group()}
					</Collapsible.CollapsibleTrigger>
					<Collapsible.CollapsibleContent
						class="flex flex-col gap-1.5 p-1"
						data-testid="tracciati-custom-list"
					>
						<Button
							variant="outline"
							size="sm"
							class="w-full"
							data-testid="tracciati-create"
							onclick={handleCreate}
						>
							<Plus size={14} />
							{m.tracciati_create_curve()}
						</Button>
						{#each mine as entry (entry.id)}
							<CustomCurveItem
								{entry}
								selected={selected?.id === entry.id}
								onselect={(id) => (selectedId = id)}
							/>
						{/each}
					</Collapsible.CollapsibleContent>
				</Collapsible.Collapsible>
			</SidebarUI.SidebarContent>
		</SidebarUI.Sidebar>

		<SidebarUI.SidebarInset>
			<header class="flex items-center gap-2 border-b p-4">
				<SidebarUI.SidebarTrigger />
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

			<main class="flex flex-1 items-center justify-center p-8">
				{#if selected}
					<div data-testid="tracciati-preview">
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
				{/if}
			</main>
		</SidebarUI.SidebarInset>
	</SidebarUI.SidebarProvider>
{/key}
