<script lang="ts">
	import AboutHeroRing from '$lib/components/AboutHeroRing.svelte';
	import { m } from '$lib/paraglide/messages';
</script>

<svelte:head><title>{m.about_page_title()}</title></svelte:head>

<div class="min-h-screen w-full bg-background text-foreground">
	<header class="border-b">
		<div class="mx-auto flex max-w-[1100px] items-center px-6 py-3">
			<a
				href="/editor"
				class="text-sm text-muted-foreground hover:text-foreground"
				data-testid="about-back-link"
			>
				{m.about_back()}
			</a>
		</div>
	</header>

	<main class="mx-auto max-w-[1100px] px-6 py-16">
		<section class="flex flex-col items-center gap-6 text-center">
			<h1 class="text-5xl font-semibold tracking-tight">logo-bettona</h1>
			<p class="max-w-xl text-muted-foreground">{m.about_tagline()}</p>
			<AboutHeroRing />
		</section>

		<section class="mt-20 grid grid-cols-1 gap-8 md:grid-cols-2">
			<article class="rounded-lg border p-6">
				<h2 class="text-xl font-semibold">{m.about_what_title()}</h2>
				<p class="mt-3 text-sm text-muted-foreground">
					{m.about_what_body()}
				</p>
			</article>

			<article class="rounded-lg border p-6">
				<h2 class="text-xl font-semibold">{m.about_how_title()}</h2>
				<ul class="mt-3 space-y-3 text-sm text-muted-foreground">
					<li>
						<span class="font-medium text-foreground">{m.editor_colors()}</span> — {m.about_how_colors()}
					</li>
					<li>
						<span class="font-medium text-foreground">{m.animate_animation()}</span> —
						{m.about_how_animation()}
					</li>
					<li>
						<span class="font-medium text-foreground">{m.editor_settings()}</span> —
						{m.about_how_settings()}
					</li>
				</ul>
			</article>
		</section>
	</main>
</div>
