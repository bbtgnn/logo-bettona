import { getLocale, setLocale, type Locale } from '$lib/paraglide/runtime';

let current = $state<Locale>(getLocale());

export function currentLocale(): Locale {
	return current;
}

// reload:false keeps app state alive; we drive re-render via {#key currentLocale()}.
// Also update <html lang> since no server set it for the static export.
export function switchLocale(next: Locale): void {
	setLocale(next, { reload: false });
	current = next;
	if (typeof document !== 'undefined') {
		document.documentElement.lang = next;
	}
}
