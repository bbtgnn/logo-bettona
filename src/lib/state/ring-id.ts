// Stable identity for a Ring, minted once at creation. crypto.randomUUID where
// available, with a non-crypto fallback for older runtimes / SSR-less contexts.
export function newRingId(): string {
	const c = (globalThis as { crypto?: Crypto }).crypto;
	if (c && 'randomUUID' in c) return c.randomUUID();
	return `ring-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}
