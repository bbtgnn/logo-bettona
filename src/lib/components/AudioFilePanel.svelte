<script lang="ts">
	import { Button } from '$lib/shadcn/ui/button/index.js';
	import { Label } from '$lib/shadcn/ui/label/index.js';
	import { animationState, audioSource, togglePlay } from '$lib/state/animation';

	// ── canvas ref and rAF state ─────────────────────────────────────────────
	let canvasEl: HTMLCanvasElement | undefined = $state();
	let currentTime = $state(0);
	let regionStart = $state(0);
	let durationDisplay = $state('0.0');
	let durationFocused = $state(false);
	let isLooping = $state(false);

	// ── file load UX state ───────────────────────────────────────────────────
	let fileInputEl: HTMLInputElement | undefined = $state();
	let isLoading = $state(false);
	let isDragOver = $state(false);
	let loadError = $state<string | null>(null);

	// ── derived ──────────────────────────────────────────────────────────────
	// audioSource is a plain closure object (getFileName() reads a non-reactive
	// `let`), so a $derived over it never recomputes after loadFile. Mirror the
	// name into local $state and flip it on load/clear so the UI actually reacts.
	// Seeded from the source so a remount with a file already loaded shows it.
	let loadedName = $state<string | null>(audioSource.getFileName());
	let loadedDuration = $state(audioSource.getDuration());
	const hasFile = $derived(loadedName !== null);
	const isPlaying = $derived(animationState.isPlaying);
	const inputLevelPercent = $derived(
		Math.round(Math.max(0, Math.min(1, audioSource.readLevel())) * 100)
	);

	// ── rAF loop: poll currentTime, region, level ────────────────────────────
	$effect(() => {
		let raf: number;
		function loop() {
			currentTime = audioSource.getCurrentTime();
			isLooping = audioSource.isLoopRegion();
			const r = audioSource.getRegion();
			if (!durationFocused) {
				regionStart = r.start;
				durationDisplay = (r.end - r.start).toFixed(1);
			}
			drawCanvas();
			raf = requestAnimationFrame(loop);
		}
		raf = requestAnimationFrame(loop);
		return () => cancelAnimationFrame(raf);
	});

	// ── canvas resize observer ───────────────────────────────────────────────
	$effect(() => {
		if (!canvasEl) return;
		const observer = new ResizeObserver(() => {
			if (!canvasEl) return;
			canvasEl.width = canvasEl.offsetWidth || 400;
			canvasEl.height = canvasEl.offsetHeight || 64;
			drawCanvas();
		});
		observer.observe(canvasEl);
		return () => observer.disconnect();
	});

	function drawCanvas() {
		if (!canvasEl) return;
		const ctx = canvasEl.getContext('2d');
		if (!ctx) return;
		const { width, height } = canvasEl;
		ctx.clearRect(0, 0, width, height);

		const peaks = audioSource.getPeaks();
		const duration = audioSource.getDuration();
		if (peaks.length === 0 || duration === 0) return;

		const region = audioSource.getRegion();
		const rs = (region.start / duration) * width;
		const re = (region.end / duration) * width;

		// region highlight
		ctx.fillStyle = 'rgba(99,102,241,0.15)';
		ctx.fillRect(rs, 0, re - rs, height);

		// waveform peaks
		const midY = height / 2;
		const bucketW = width / peaks.length;
		ctx.fillStyle = '#a1a1aa';
		for (let b = 0; b < peaks.length; b++) {
			const x = Math.floor(b * bucketW);
			const topY = midY * (1 - peaks[b].max);
			const botY = midY * (1 - peaks[b].min);
			ctx.fillRect(x, topY, Math.max(1, Math.ceil(bucketW)), botY - topY);
		}

		// playhead
		const px = (currentTime / duration) * width;
		ctx.strokeStyle = '#f43f5e';
		ctx.lineWidth = 1.5;
		ctx.beginPath();
		ctx.moveTo(px, 0);
		ctx.lineTo(px, height);
		ctx.stroke();

		// region handles
		const handleW = 3;
		ctx.fillStyle = 'rgba(99,102,241,0.8)';
		ctx.fillRect(rs - handleW / 2, 0, handleW, height);
		ctx.fillRect(re - handleW / 2, 0, handleW, height);
	}

	// ── canvas pointer interaction ───────────────────────────────────────────
	const HANDLE_HIT_PX = 10;
	let dragMode: 'start' | 'end' | 'seek' | null = null;

	function canvasXToTime(clientX: number): number {
		if (!canvasEl) return 0;
		const rect = canvasEl.getBoundingClientRect();
		const x = ((clientX - rect.left) / rect.width) * canvasEl.width;
		return (x / canvasEl.width) * audioSource.getDuration();
	}

	function handlePointerDown(e: PointerEvent) {
		const duration = audioSource.getDuration();
		if (duration === 0 || !canvasEl) return;
		const rect = canvasEl.getBoundingClientRect();
		const x = ((e.clientX - rect.left) / rect.width) * canvasEl.width;
		const region = audioSource.getRegion();
		const startX = (region.start / duration) * canvasEl.width;
		const endX = (region.end / duration) * canvasEl.width;
		if (Math.abs(x - startX) <= HANDLE_HIT_PX) {
			dragMode = 'start';
		} else if (Math.abs(x - endX) <= HANDLE_HIT_PX) {
			dragMode = 'end';
		} else {
			dragMode = 'seek';
			audioSource.seek(canvasXToTime(e.clientX));
		}
		canvasEl.setPointerCapture(e.pointerId);
	}

	function handlePointerMove(e: PointerEvent) {
		if (!dragMode) return;
		const t = canvasXToTime(e.clientX);
		const region = audioSource.getRegion();
		if (dragMode === 'start') {
			audioSource.setRegion(t, region.end);
		} else if (dragMode === 'end') {
			audioSource.setRegion(region.start, t);
		} else {
			audioSource.seek(t);
		}
	}

	function handlePointerUp() {
		dragMode = null;
	}

	// ── transport ────────────────────────────────────────────────────────────
	async function handlePlay() {
		await audioSource.play();
		if (!animationState.isPlaying) togglePlay();
	}

	function handlePause() {
		audioSource.pause();
		if (animationState.isPlaying) togglePlay();
	}

	// ── loop toggle ──────────────────────────────────────────────────────────
	function handleLoopChange(e: Event) {
		audioSource.setLoopRegion((e.target as HTMLInputElement).checked);
	}

	// ── file load ────────────────────────────────────────────────────────────
	async function handleFileSelected(file: File) {
		isLoading = true;
		loadError = null;
		try {
			await audioSource.loadFile(file);
			loadedName = audioSource.getFileName();
			loadedDuration = audioSource.getDuration();
		} catch {
			loadError = 'Could not decode audio. Try a different file (MP3, WAV, AAC).';
		} finally {
			isLoading = false;
		}
	}

	function handleFileInputChange(e: Event) {
		const file = (e.target as HTMLInputElement).files?.[0];
		if (file) handleFileSelected(file);
	}

	function handleDrop(e: DragEvent) {
		e.preventDefault();
		isDragOver = false;
		const file = e.dataTransfer?.files[0];
		if (file) handleFileSelected(file);
	}

	function handleRemove() {
		audioSource.clearFile();
		loadedName = null;
		loadedDuration = 0;
		if (animationState.isPlaying) togglePlay();
	}
</script>

<!-- File source area -->
<div class="flex flex-col gap-2">
	<!-- Drop zone -->
	{#if !hasFile}
		<label
			for="audio-file-input"
			class="flex cursor-pointer flex-col items-center justify-center gap-1 rounded border-2 border-dashed px-3 py-4 text-xs transition-colors {isDragOver
				? 'border-primary bg-primary/5'
				: 'border-border hover:border-muted-foreground'}"
			ondragover={(e) => {
				e.preventDefault();
				isDragOver = true;
			}}
			ondragleave={() => (isDragOver = false)}
			ondrop={handleDrop}
		>
			{#if isLoading}
				<span class="text-muted-foreground">Loading…</span>
			{:else}
				<span class="text-muted-foreground">Drop audio file here or browse</span>
			{/if}
		</label>
		{#if loadError}
			<p class="text-[11px] text-destructive">{loadError}</p>
		{/if}
	{:else}
		<!-- Loaded state -->
		<div class="flex items-center justify-between gap-2 rounded border border-border px-2 py-1.5">
			<div class="min-w-0 flex-1">
				<p class="truncate text-xs font-medium">{loadedName}</p>
				<p class="text-[10px] text-muted-foreground">{loadedDuration.toFixed(1)} s</p>
			</div>
			<div class="flex shrink-0 gap-1">
				<Button variant="ghost" class="h-6 px-2 text-[11px]" onclick={() => fileInputEl?.click()}>
					Replace
				</Button>
				<Button variant="ghost" class="h-6 px-2 text-[11px]" onclick={handleRemove}>
					Remove
				</Button>
			</div>
		</div>

		<!-- Waveform canvas -->
		<canvas
			bind:this={canvasEl}
			class="h-16 w-full cursor-crosshair rounded border border-border bg-muted/30"
			onpointerdown={handlePointerDown}
			onpointermove={handlePointerMove}
			onpointerup={handlePointerUp}
		></canvas>

		<!-- Transport + region controls -->
		<div class="flex items-center gap-2">
			{#if isPlaying}
				<Button class="h-7 text-xs" onclick={handlePause}>Pause</Button>
			{:else}
				<Button class="h-7 text-xs" onclick={handlePlay}>Play</Button>
			{/if}

			<label class="flex items-center gap-1 text-xs">
				<input
					type="checkbox"
					checked={isLooping}
					onchange={handleLoopChange}
					aria-label="Loop region"
				/>
				Loop
			</label>

			<div class="ml-auto flex items-center gap-1">
				<Label for="region-duration" class="whitespace-nowrap text-xs">Region (s)</Label>
				<input
					id="region-duration"
					type="number"
					min="0.1"
					step="0.1"
					class="h-7 w-20 rounded-md border border-input bg-background px-2 text-xs"
					value={durationDisplay}
					onfocus={() => (durationFocused = true)}
					onblur={(e) => {
						durationFocused = false;
						const len = parseFloat((e.target as HTMLInputElement).value);
						if (Number.isFinite(len) && len >= 0.1) {
							audioSource.setRegion(regionStart, regionStart + len);
						}
					}}
					oninput={(e) => {
						const len = parseFloat((e.target as HTMLInputElement).value);
						if (Number.isFinite(len) && len >= 0.1) {
							audioSource.setRegion(regionStart, regionStart + len);
						}
					}}
				/>
			</div>
		</div>

		<!-- Input level -->
		<div
			class="h-1.5 rounded bg-muted"
			role="meter"
			aria-label="Audio input level"
			aria-valuemin={0}
			aria-valuemax={100}
			aria-valuenow={inputLevelPercent}
		>
			<div class="h-full rounded bg-green-500" style:width="{inputLevelPercent}%"></div>
		</div>
	{/if}

	<input
		id="audio-file-input"
		bind:this={fileInputEl}
		type="file"
		accept="audio/*"
		class="hidden"
		onchange={handleFileInputChange}
	/>
</div>
