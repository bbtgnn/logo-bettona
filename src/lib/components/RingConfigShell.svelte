<script lang="ts">
	import * as Collapsible from '$lib/shadcn/ui/collapsible/index.js';
	import { CaretDown, CaretRight } from 'phosphor-svelte';
	import { m } from '$lib/paraglide/messages';
	import type { Snippet } from 'svelte';

	let {
		index,
		badge = false,
		testid,
		content
	}: {
		index: number;
		badge?: boolean;
		testid?: string;
		content: Snippet;
	} = $props();

	let open = $state(false);
</script>

<div class="rounded border bg-background" data-testid={testid}>
	<Collapsible.Collapsible bind:open>
		<div class="flex items-center gap-1 px-2 py-1.5">
			<Collapsible.CollapsibleTrigger
				class="flex flex-1 items-center gap-1 text-left text-sm font-medium hover:text-foreground"
			>
				{#if open}
					<CaretDown size={14} />
				{:else}
					<CaretRight size={14} />
				{/if}
				{m.editor_ring_label({ index: index + 1 })}
				{#if badge}
					<span
						class="ml-1 rounded bg-muted px-1 py-0.5 text-[10px] font-normal text-muted-foreground"
						>{m.animate_custom()}</span
					>
				{/if}
			</Collapsible.CollapsibleTrigger>
		</div>

		<Collapsible.CollapsibleContent class="space-y-3 px-3 pb-3">
			{@render content()}
		</Collapsible.CollapsibleContent>
	</Collapsible.Collapsible>
</div>
