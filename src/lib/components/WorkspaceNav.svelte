<script lang="ts">
	import { page } from '$app/state';
	import { m } from '$lib/paraglide/messages';

	const tabs = [
		{ href: '/editor', label: () => m.nav_editor(), testid: 'nav-editor' },
		{ href: '/animate', label: () => m.nav_animate(), testid: 'nav-animate' },
		{ href: '/paths', label: () => m.nav_paths(), testid: 'nav-paths' }
	];

	const pathname = $derived(page.url?.pathname ?? '');
</script>

<nav class="flex items-center gap-1" data-testid="workspace-nav">
	{#each tabs as tab (tab.href)}
		<a
			href={tab.href}
			data-testid={tab.testid}
			aria-current={pathname.startsWith(tab.href) ? 'page' : undefined}
			class="rounded px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground aria-[current=page]:bg-muted aria-[current=page]:text-foreground"
		>
			{tab.label()}
		</a>
	{/each}
</nav>
