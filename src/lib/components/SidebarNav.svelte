<script lang="ts">
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
	import { m } from '$lib/paraglide/messages';
	import { BezierCurve, PencilSimple, FilmStrip } from 'phosphor-svelte';

	const tabs = [
		{ href: resolve('/paths'), label: () => m.nav_paths(), testid: 'nav-paths', Icon: BezierCurve },
		{ href: resolve('/editor'), label: () => m.nav_editor(), testid: 'nav-editor', Icon: PencilSimple },
		{ href: resolve('/animate'), label: () => m.nav_animate(), testid: 'nav-animate', Icon: FilmStrip }
	];

	const pathname = $derived(page.url?.pathname ?? '');
	const activeIndex = $derived(tabs.findIndex((t) => pathname.startsWith(t.href)));
</script>

<nav
	class="relative flex rounded-lg border bg-muted/40 p-1"
	data-testid="workspace-nav"
>
	<!-- Sliding pill: one shared indicator that animates to the active tab instead of
	     each tab toggling its own background on/off. Tabs are equal-width (flex-1) and
	     flush (no gap), so its position is a clean fraction of the padded track. -->
	<span
		aria-hidden="true"
		class="pointer-events-none absolute inset-y-1 rounded-md bg-primary shadow-sm transition-[left] duration-300 ease-out motion-reduce:transition-none"
		class:opacity-0={activeIndex < 0}
		style="width: calc((100% - 0.5rem) / {tabs.length}); left: calc(0.25rem + {Math.max(
			activeIndex,
			0
		)} * ((100% - 0.5rem) / {tabs.length})); view-transition-name: sidebar-nav-pill;"
	></span>

	{#each tabs as tab (tab.href)}
		<a
			href={tab.href}
			data-testid={tab.testid}
			aria-current={pathname.startsWith(tab.href) ? 'page' : undefined}
			class="relative z-10 flex flex-1 items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground aria-[current=page]:font-semibold aria-[current=page]:text-primary-foreground"
		>
			<tab.Icon size={14} />
			{tab.label()}
		</a>
	{/each}
</nav>
