<script lang="ts">
	import { m } from '$lib/paraglide/messages';
	import SidebarCollapsible from './SidebarCollapsible.svelte';
</script>

<SidebarCollapsible>
	{#snippet trigger()}
		{m.animate_layer_data_series()}
	{/snippet}

	{#snippet content()}
		<div class="space-y-2">
			<label class="flex items-center gap-2 text-xs font-medium text-muted-foreground">
				<input
					type="checkbox"
					data-testid="layer-toggle-dataSeries"
					aria-label={m.animate_layer_toggle()}
					checked={false}
					disabled
				/>
				{m.animate_layer_data_series()}
			</label>
			<p class="text-[11px] text-muted-foreground">{m.animate_data_series_unavailable()}</p>
		</div>
	{/snippet}
</SidebarCollapsible>
