<script lang="ts">
	import * as Collapsible from '$lib/shadcn/ui/collapsible/index.js';
	import { CaretDown, CaretRight } from 'phosphor-svelte';
	import type { Snippet } from 'svelte';

	//

	let open = $state(true);

	type Props = {
		trigger: Snippet<[{ open: boolean }]>;
		content: Snippet<[{ open: boolean }]>;
	};

	let { trigger, content }: Props = $props();
</script>

<Collapsible.Collapsible bind:open>
	<Collapsible.CollapsibleTrigger
		class="flex w-full flex-1 items-center gap-1 px-2 py-4 text-left text-sm font-medium hover:bg-sidebar-accent hover:text-foreground"
	>
		{#if open}
			<CaretDown size={14} />
		{:else}
			<CaretRight size={14} />
		{/if}
		{@render trigger?.({ open })}
	</Collapsible.CollapsibleTrigger>

	<Collapsible.CollapsibleContent class="flex flex-col gap-3 px-3 pb-3">
		{@render content?.({ open })}
	</Collapsible.CollapsibleContent>
</Collapsible.Collapsible>
