<script lang="ts">
	import * as SidebarUI from '$lib/shadcn/ui/sidebar/index.js';
	import Sidebar from '$lib/components/Sidebar.svelte';
	import PreviewCanvas from '$lib/components/PreviewCanvas.svelte';
</script>

<SidebarUI.SidebarProvider>
	<Sidebar />

	<SidebarUI.SidebarInset>
		<header class="flex items-center gap-2 border-b p-4">
			<SidebarUI.SidebarTrigger />
			<span class="text-sm font-semibold">Shape Editor</span>
			<a
				href="/about"
				class="ml-auto text-sm text-muted-foreground hover:text-foreground"
				data-testid="header-about-link"
			>
				About
			</a>
		</header>
		<main class="flex flex-1 items-center justify-center p-8">
			<PreviewCanvas />
		</main>
	</SidebarUI.SidebarInset>
</SidebarUI.SidebarProvider>
