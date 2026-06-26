<script lang="ts">
	import './layout.css';
	import favicon from '$lib/assets/favicon.svg';
	import { onNavigate } from '$app/navigation';

	let { children } = $props();

	// Drive cross-route View Transitions so shared elements (e.g. the SidebarNav pill,
	// tagged with `view-transition-name`) morph/slide across navigations — even when the
	// component is destroyed and recreated because the two routes use different layouts
	// (/paths vs the (app) group). No-ops where the API is unsupported.
	onNavigate((navigation) => {
		if (!document.startViewTransition) return;
		return new Promise((resolve) => {
			document.startViewTransition(async () => {
				resolve();
				await navigation.complete;
			});
		});
	});
</script>

<svelte:head><link rel="icon" href={favicon} /></svelte:head>
{@render children()}
