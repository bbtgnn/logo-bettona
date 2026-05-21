<script lang="ts">
	import AboutHeroRing from '$lib/components/AboutHeroRing.svelte';
</script>

<svelte:head><title>About — logo-bettona</title></svelte:head>

<div class="min-h-screen w-full bg-background text-foreground">
	<header class="border-b">
		<div class="mx-auto flex max-w-[1100px] items-center px-6 py-3">
			<a
				href="/"
				class="text-sm text-muted-foreground hover:text-foreground"
				data-testid="about-back-link"
			>
				← Back
			</a>
		</div>
	</header>

	<main class="mx-auto max-w-[1100px] px-6 py-16">
		<section class="flex flex-col items-center gap-6 text-center">
			<h1 class="text-5xl font-semibold tracking-tight">logo-bettona</h1>
			<p class="max-w-xl text-muted-foreground">Strumento per generare loghi a forma di anello.</p>
			<AboutHeroRing />
		</section>

		<section class="mt-20 grid grid-cols-1 gap-8 md:grid-cols-2">
			<article class="rounded-lg border p-6">
				<h2 class="text-xl font-semibold">Cos'è</h2>
				<p class="mt-3 text-sm text-muted-foreground">
					Editor interattivo per creare loghi circolari. Configura colori, anima percorsi, esporta.
					Pensato per designer che vogliono iterare velocemente su identità visive radiali.
				</p>
			</article>

			<article class="rounded-lg border p-6">
				<h2 class="text-xl font-semibold">Come si usa</h2>
				<ul class="mt-3 space-y-3 text-sm text-muted-foreground">
					<li>
						<span class="font-medium text-foreground">Colors</span> — Imposta palette monocromatica o
						piena. Definisce colori anello e sfondo.
					</li>
					<li>
						<span class="font-medium text-foreground">Animation</span> — Anima percorsi anello. Scegli
						driver (es. anime.js) e parametri.
					</li>
					<li>
						<span class="font-medium text-foreground">Settings</span> — Geometria anello: raggio, spessore,
						segmenti.
					</li>
				</ul>
			</article>
		</section>
	</main>
</div>
