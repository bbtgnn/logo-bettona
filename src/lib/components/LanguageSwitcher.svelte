<script lang="ts">
	import { m } from '$lib/paraglide/messages';
	import { currentLocale, switchLocale } from '$lib/state/locale.svelte';
	import type { Locale } from '$lib/paraglide/runtime';

	const OPTIONS: { value: Locale; label: string; flag: string }[] = [
		{ value: 'en', label: 'eng', flag: '🇬🇧' },
		{ value: 'it', label: 'ita', flag: '🇮🇹' }
	];
</script>

<label class="flex items-center gap-1 text-sm text-muted-foreground">
	<span class="sr-only">{m.header_language()}</span>
	<select
		data-testid="language-switcher"
		aria-label={m.header_language()}
		class="h-8 w-auto min-w-[5.5rem] rounded border bg-background py-1 text-sm"
		value={currentLocale()}
		onchange={(e) => switchLocale((e.currentTarget as HTMLSelectElement).value as Locale)}
	>
		{#each OPTIONS as opt (opt.value)}
			<option value={opt.value}>{opt.flag} {opt.label}</option>
		{/each}
	</select>
</label>
