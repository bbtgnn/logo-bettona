<script lang="ts">
	import { Button } from '$lib/shadcn/ui/button/index.js';
	import { kaleidoscope, setKaleidoscopeEnabled } from '$lib/state/kaleidoscope.svelte';
	import { m } from '$lib/paraglide/messages';
</script>

<div class="flex flex-col gap-2 p-2">
	<span class="text-xs font-medium">{m.composition_layout()}</span>
	<div class="flex gap-1" role="group" aria-label={m.composition_layout()}>
		<Button
			variant={kaleidoscope.enabled ? 'outline' : 'default'}
			class="flex-1"
			aria-pressed={!kaleidoscope.enabled}
			onclick={() => setKaleidoscopeEnabled(false)}
		>
			{m.composition_layout_poster()}
		</Button>
		<Button
			variant={kaleidoscope.enabled ? 'default' : 'outline'}
			class="flex-1"
			aria-pressed={kaleidoscope.enabled}
			onclick={() => setKaleidoscopeEnabled(true)}
		>
			{m.composition_layout_kaleidoscope()}
		</Button>
	</div>
	{#if !kaleidoscope.enabled}
		<p class="text-[10px] text-muted-foreground">{m.composition_poster_hint()}</p>
	{/if}
</div>
