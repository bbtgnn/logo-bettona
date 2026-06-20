import { clampSectors, clampRepeat, type KaleidoscopeParams } from '$lib/geometry/kaleidoscope';

// backgroundColor is omitted from the live state: the carpet background is sourced from
// the composition palette at render time (see preview-presenter `kaleidoParams`), not
// stored here. It stays on KaleidoscopeParams because the render layer still needs it.
export type KaleidoscopeState = Omit<KaleidoscopeParams, 'backgroundColor'> & {
	enabled: boolean;
	liveTile: boolean;
	tileBackground: boolean;
	refreshNonce: number;
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
	tileBackground: false,
	refreshNonce: 0,
	// Derived, not stored: the kaleidoscope paints its own background only when the tile
	// doesn't carry one. A getter so it can never drift from tileBackground (the render
	// layout reads params.drawBackground straight off this object).
	get drawBackground() {
		return !this.tileBackground;
	}
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
export function setTileBackground(v: boolean) {
	// drawBackground follows automatically (derived getter) — no second field to sync.
	kaleidoscope.tileBackground = v;
}
// Bumped to ask PreviewCanvas for a fresh static-tile snapshot (live tile off).
export function requestTileRefresh() {
	kaleidoscope.refreshNonce++;
}
