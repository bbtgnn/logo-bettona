<script lang="ts">
	import AboutHeroRing from '$lib/components/AboutHeroRing.svelte';
</script>

<svelte:head><title>About — logo-bettona</title></svelte:head>

<div class="min-h-screen w-full bg-background text-foreground">
	<header class="border-b">
		<div class="mx-auto flex max-w-[1100px] items-center px-6 py-3">
			<a href="/" class="text-sm text-muted-foreground hover:text-foreground" data-testid="about-back-link">
				← Back
			</a>
		</div>
	</header>

	<main class="mx-auto max-w-[1100px] px-6 py-16">
		<section class="flex flex-col items-center gap-6 text-center">
			<h1 class="text-5xl font-semibold tracking-tight">logo-bettona</h1>
			<p class="max-w-xl text-muted-foreground">
				Strumento per generare loghi a forma di anello.
			</p>
			<AboutHeroRing />
		</section>
	</main>
</div>
