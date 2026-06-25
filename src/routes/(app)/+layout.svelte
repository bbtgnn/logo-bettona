<script lang="ts">
	import { page } from '$app/state';
	import * as SidebarUI from '$lib/shadcn/ui/sidebar/index.js';
	import WorkspaceNav from '$lib/components/WorkspaceNav.svelte';
	import PreviewCanvas from '$lib/components/PreviewCanvas.svelte';
	import TimelinePanel from '$lib/components/TimelinePanel.svelte';
	import LanguageSwitcher from '$lib/components/LanguageSwitcher.svelte';
	import { m } from '$lib/paraglide/messages';
	import { currentLocale } from '$lib/state/locale.svelte';

	let { children } = $props();

	const isAnimate = $derived((page.url?.pathname ?? '').startsWith('/animate'));
</script>

{#key currentLocale()}
	<SidebarUI.SidebarProvider>
		<SidebarUI.Sidebar>
			<SidebarUI.SidebarContent class="divide-y divide-border" data-testid="sidebar-content">
				{@render children()}
			</SidebarUI.SidebarContent>
		</SidebarUI.Sidebar>

		<SidebarUI.SidebarInset>
			<header class="flex items-center gap-2 border-b p-4">
				<SidebarUI.SidebarTrigger />
				<WorkspaceNav />
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
			<main class="flex flex-1 items-center justify-center p-8" data-testid="app-canvas">
				<PreviewCanvas animate={isAnimate} />
			</main>
			{#if isAnimate}
				<TimelinePanel />
			{/if}
		</SidebarUI.SidebarInset>
	</SidebarUI.SidebarProvider>
{/key}
