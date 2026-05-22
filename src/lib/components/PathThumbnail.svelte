<script lang="ts">
	import type { Path } from '$lib/types';
	import { pathToSvgD, pathBoundingBox } from '$lib/geometry/path-to-svg';

	let {
		path,
		secondaryPath = null,
		size = 96
	}: { path: Path; secondaryPath?: Path | null; size?: number } = $props();

	type Rendered = { viewBox: string; d: string; secondaryD: string | null };

	const rendered = $derived.by<Rendered | null>(() => {
		try {
			const bbox = pathBoundingBox(path);
			const pad = Math.max(bbox.w, bbox.h, 1) * 0.1;
			const viewBox = `${bbox.x - pad} ${bbox.y - pad} ${bbox.w + pad * 2} ${bbox.h + pad * 2}`;
			const d = pathToSvgD(path);
			const secondaryD = secondaryPath ? pathToSvgD(secondaryPath) : null;
			return { viewBox, d, secondaryD };
		} catch {
			return null;
		}
	});
</script>

{#if rendered}
	<svg
		width={size}
		height={size}
		viewBox={rendered.viewBox}
		class="text-foreground"
		aria-hidden="true"
	>
		<path d={rendered.d} fill="none" stroke="currentColor" stroke-width="2" vector-effect="non-scaling-stroke" />
		{#if rendered.secondaryD}
			<path
				d={rendered.secondaryD}
				fill="none"
				stroke="currentColor"
				stroke-opacity="0.4"
				stroke-width="2"
				vector-effect="non-scaling-stroke"
			/>
		{/if}
	</svg>
{:else}
	<div
		style:width="{size}px"
		style:height="{size}px"
		class="flex items-center justify-center border border-dashed text-muted-foreground text-sm"
	>
		?
	</div>
{/if}
