<script lang="ts">
	import { keyframes } from '$lib/state/keyframes.svelte';
	import { animationState, applyKaleidoscopeKeyframes } from '$lib/state/animation';
	import type { KaleidoParam } from '$lib/state/kaleidoscope-params';

	let { param, animatable = true }: { param: KaleidoParam; animatable?: boolean } = $props();

	$effect(() => {
		if (animatable) keyframes.ensureTrack(param.id);
	});
	const armed = $derived(animatable && (keyframes.tracks[param.id]?.enabled ?? false));

	function onInput(e: Event) {
		const value = Number((e.target as HTMLInputElement).value);
		if (armed) {
			keyframes.upsertKeyframeAtTime(param.id, animationState.progress, value);
			// tick only applies while playing; refresh the paused preview immediately.
			if (!animationState.isPlaying) applyKaleidoscopeKeyframes(animationState.progress);
		} else {
			param.set(value);
		}
	}
</script>

<div class="flex flex-col gap-1">
	<div class="flex items-center gap-2">
		{#if animatable}
			<button
				type="button"
				aria-label="Anima {param.label}"
				aria-pressed={armed}
				title="Anima questo parametro"
				class="grid h-5 w-5 shrink-0 place-items-center rounded text-xs {armed
					? 'bg-primary text-primary-foreground'
					: 'bg-muted text-muted-foreground'}"
				onclick={() => keyframes.setTrackEnabled(param.id, !armed)}
			>
				⏱
			</button>
		{/if}
		<!-- Plain span (NOT a <label for>) so the input's accessible name is the aria-label
		     EXACTLY (param.label), with no value text appended. Keeps exact-match label
		     queries unambiguous against the "Anima {label}" stopwatch button. -->
		<span class="text-xs">{param.label} ({param.get()})</span>
	</div>
	<input
		id="k-{param.id}"
		aria-label={param.label}
		type="range"
		min={param.min}
		max={param.max}
		step={param.step}
		value={param.get()}
		oninput={onInput}
	/>
</div>
