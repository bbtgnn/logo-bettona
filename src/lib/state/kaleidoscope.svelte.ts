import { clampSectors, clampRepeat, type KaleidoscopeParams } from '$lib/geometry/kaleidoscope';

// backgroundColor is omitted from the live state: the carpet background is sourced from
// the composition palette at render time (see preview-presenter `kaleidoParams`), not
// stored here. It stays on KaleidoscopeParams because the render layer still needs it.
export type KaleidoscopeState = Omit<KaleidoscopeParams, 'backgroundColor'> & {
	enabled: boolean;
	liveTile: boolean;
};

export const kaleidoscope = $state<KaleidoscopeState>({
	enabled: false,
	sectors: 8,
	repeat: 3,
	offsetDistance: 0,
	scale: 1,
	tileSize: 0.6,
	tileRotation: 0,
	carpetRotation: 0,
	globalRotation: 0,
	circularMask: true,
	liveTile: false,
	// The kaleidoscope always paints its own background; the source tile stays transparent
	// (the render layout reads params.drawBackground straight off this object).
	drawBackground: true
});

export function setKaleidoscopeEnabled(v: boolean) {
	kaleidoscope.enabled = v;
}
export function setSectors(n: number) {
	kaleidoscope.sectors = clampSectors(n);
}
export function setRepeat(n: number) {
	kaleidoscope.repeat = clampRepeat(n);
}
export function setOffsetDistance(n: number) {
	kaleidoscope.offsetDistance = Number.isFinite(n) ? n : 0;
}
export function setScale(n: number) {
	kaleidoscope.scale = Number.isFinite(n) && n > 0 ? n : 1;
}
export function setTileSize(n: number) {
	kaleidoscope.tileSize = Number.isFinite(n) && n > 0 ? n : 0.6;
}
export function setTileRotation(n: number) {
	kaleidoscope.tileRotation = Number.isFinite(n) ? n : 0;
}
export function setCarpetRotation(n: number) {
	kaleidoscope.carpetRotation = Number.isFinite(n) ? n : 0;
}
export function setGlobalRotation(n: number) {
	kaleidoscope.globalRotation = Number.isFinite(n) ? n : 0;
}
export function setCircularMask(v: boolean) {
	kaleidoscope.circularMask = v;
}
export function setLiveTile(v: boolean) {
	kaleidoscope.liveTile = v;
}
