import { clampSectors, clampRepeat, type KaleidoscopeParams } from '$lib/geometry/kaleidoscope';

export type KaleidoscopeState = KaleidoscopeParams & {
	enabled: boolean;
	liveTile: boolean;
	tileBackground: boolean;
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
	backgroundColor: '#ffffff',
	drawBackground: true, // mirrors !tileBackground; see setTileBackground
	liveTile: false,
	tileBackground: false
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
	kaleidoscope.tileBackground = v;
	// When the tile carries its own background, the kaleidoscope must NOT paint its own.
	kaleidoscope.drawBackground = !v;
}
export function setKaleidoscopeBackgroundColor(c: string) {
	kaleidoscope.backgroundColor = c;
}
