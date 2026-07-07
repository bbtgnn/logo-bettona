<script lang="ts">
	import { Input } from '$lib/shadcn/ui/input/index.js';
	import { Label } from '$lib/shadcn/ui/label/index.js';
	import { composition, setBaseRadius, setRingIncrement, setCopies } from '$lib/state/composition';
	import { m } from '$lib/paraglide/messages';
	import SidebarCollapsible from './SidebarCollapsible.svelte';
</script>

<SidebarCollapsible>
	{#snippet trigger()}
		{m.editor_settings()}
	{/snippet}

	{#snippet content()}
		<div class="grid grid-cols-2 gap-3">
			<div class="flex flex-col gap-1">
				<Label for="base-radius" class="text-xs">{m.editor_base_radius()}</Label>
				<Input
					id="base-radius"
					type="number"
					min="1"
					value={composition.baseRadius}
					oninput={(e) => setBaseRadius(Number((e.target as HTMLInputElement).value))}
				/>
			</div>
			<div class="flex flex-col gap-1">
				<Label for="ring-increment" class="text-xs">{m.editor_ring_increment()}</Label>
				<Input
					id="ring-increment"
					type="number"
					min="1"
					value={composition.ringIncrement}
					oninput={(e) => setRingIncrement(Number((e.target as HTMLInputElement).value))}
				/>
			</div>
			<div class="flex flex-col gap-1">
				<Label for="copies" class="text-xs">{m.editor_copies()}</Label>
				<Input
					id="copies"
					type="number"
					min="1"
					value={composition.copies}
					oninput={(e) => setCopies(Number((e.target as HTMLInputElement).value))}
				/>
			</div>
		</div>
	{/snippet}
</SidebarCollapsible>
