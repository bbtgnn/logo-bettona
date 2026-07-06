<script lang="ts">
	import { resolve } from '$app/paths';
	import * as SidebarUI from '$lib/shadcn/ui/sidebar/index.js';
	import SidebarNav from '$lib/components/SidebarNav.svelte';
	import LanguageSwitcher from '$lib/components/LanguageSwitcher.svelte';
	import { Stack } from 'phosphor-svelte';
	import { m } from '$lib/paraglide/messages';
	import { currentLocale } from '$lib/state/locale.svelte';
</script>

<svelte:head><title>{m.composition_page_title()}</title></svelte:head>

{#key currentLocale()}
	<SidebarUI.SidebarProvider>
		<SidebarUI.Sidebar>
			<SidebarUI.SidebarContent class="flex flex-col gap-2 p-2">
				<SidebarNav />
			</SidebarUI.SidebarContent>
		</SidebarUI.Sidebar>

		<SidebarUI.SidebarInset>
			<header class="flex items-center gap-2 border-b p-4">
				<SidebarUI.SidebarTrigger />
				<div class="ml-auto flex items-center gap-3">
					<LanguageSwitcher />
					<a
						href={resolve('/about')}
						class="text-sm text-muted-foreground hover:text-foreground"
						data-testid="header-about-link"
					>
						{m.header_about()}
					</a>
				</div>
			</header>

			<main class="flex flex-1 items-center justify-center p-8">
				<div
					class="flex flex-col items-center gap-3 text-center text-muted-foreground"
					data-testid="composition-placeholder"
				>
					<Stack size={64} weight="thin" />
					<h1 class="text-lg font-semibold text-foreground">{m.nav_composition()}</h1>
					<p class="text-sm">{m.composition_under_construction()}</p>
					<p class="text-xs opacity-70">{m.composition_coming_soon()}</p>
				</div>
			</main>
		</SidebarUI.SidebarInset>
	</SidebarUI.SidebarProvider>
{/key}
