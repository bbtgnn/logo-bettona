import type { ZoneIntensity } from '$lib/types';

export function resolveZoneIntensity(
	ring: { zoneConfig?: { bass: number; mid: number; treble: number } | null },
	def: ZoneIntensity
): ZoneIntensity {
	return ring.zoneConfig ?? def;
}
