<script lang="ts">
	import SidebarCollapsible from './SidebarCollapsible.svelte';
	import AnimatableSlider from './AnimatableSlider.svelte';
	import { kaleidoscope, setCircularMask } from '$lib/state/kaleidoscope.svelte';
	import { KALEIDO_PARAMS } from '$lib/state/kaleidoscope-params';
	import { m } from '$lib/paraglide/messages';

	const checked = (e: Event) => (e.target as HTMLInputElement).checked;
</script>

<SidebarCollapsible>
	{#snippet trigger()}
		{m.editor_kaleidoscope()}
	{/snippet}

	{#snippet content()}
		<div class="flex flex-col gap-3">
			{#each KALEIDO_PARAMS as param (param.id)}
				<AnimatableSlider {param} animatable={false} />
			{/each}

			<label class="flex items-center gap-2 text-xs">
				<input
					type="checkbox"
					aria-label={m.editor_kaleido_circular_mask()}
					checked={kaleidoscope.circularMask}
					onchange={(e) => setCircularMask(checked(e))}
				/>
				{m.editor_kaleido_circular_mask()}
			</label>
		</div>
	{/snippet}
</SidebarCollapsible>
