<script lang="ts">
	import { page } from '$app/state';
	import { m } from '$lib/paraglide/messages';
	import { BezierCurve, PencilSimple, FilmStrip } from 'phosphor-svelte';

	const tabs = [
		{ href: '/paths', label: () => m.nav_paths(), testid: 'nav-paths', Icon: BezierCurve },
		{ href: '/editor', label: () => m.nav_editor(), testid: 'nav-editor', Icon: PencilSimple },
		{ href: '/animate', label: () => m.nav_animate(), testid: 'nav-animate', Icon: FilmStrip }
	];

	const pathname = $derived(page.url?.pathname ?? '');
</script>

<nav
	class="flex items-center gap-1 rounded-lg border bg-muted/40 p-1"
	data-testid="workspace-nav"
>
	{#each tabs as tab (tab.href)}
		<a
			href={tab.href}
			data-testid={tab.testid}
			aria-current={pathname.startsWith(tab.href) ? 'page' : undefined}
			class="flex flex-1 items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground aria-[current=page]:bg-primary aria-[current=page]:text-primary-foreground aria-[current=page]:font-semibold"
		>
			<tab.Icon size={14} />
			{tab.label()}
		</a>
	{/each}
</nav>
