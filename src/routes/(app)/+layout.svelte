<script lang="ts">
	import { page } from '$app/state';
	import * as SidebarUI from '$lib/shadcn/ui/sidebar/index.js';
	import WorkspaceNav from '$lib/components/WorkspaceNav.svelte';
	import PreviewCanvas from '$lib/components/PreviewCanvas.svelte';
	import TimelinePanel from '$lib/components/TimelinePanel.svelte';
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
				<a
					href="/about"
					class="ml-auto text-sm text-muted-foreground hover:text-foreground"
					data-testid="header-about-link"
				>
					About
				</a>
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
