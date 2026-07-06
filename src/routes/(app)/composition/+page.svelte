<script lang="ts">
	import CanvasSection from '$lib/components/CanvasSection.svelte';
	import LayoutModeSwitch from '$lib/components/LayoutModeSwitch.svelte';
	import KaleidoscopePanel from '$lib/components/KaleidoscopePanel.svelte';
	import { kaleidoscope } from '$lib/state/kaleidoscope.svelte';
	import { m } from '$lib/paraglide/messages';
</script>

<svelte:head><title>{m.composition_page_title()}</title></svelte:head>

<CanvasSection />

<LayoutModeSwitch />

{#if kaleidoscope.enabled}
	<KaleidoscopePanel />
{/if}
