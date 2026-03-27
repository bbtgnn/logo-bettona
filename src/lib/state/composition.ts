import { lsSync } from 'rune-sync/localstorage';
import type { Composition, Ring } from '$lib/types';

const DEFAULT_COMPOSITION: Composition = {
	baseRadius: 100,
	ringIncrement: 50,
	rings: []
};

const DEFAULT_RING: Ring = {
	copies: 8,
	color: '#000000',
	templatePath: null,
	ringHeight: 0.12
};

export const composition = lsSync<Composition>('composition', DEFAULT_COMPOSITION);

export const uiState = lsSync<{ expandedRings: Record<number, boolean> }>('composition-ui', {
	expandedRings: {}
});

export function addRing() {
	composition.rings = [...composition.rings, { ...DEFAULT_RING }];
}

export function removeRing(index: number) {
	composition.rings = composition.rings.filter((_, i) => i !== index);
}

export function updateRing(index: number, patch: Partial<Ring>) {
	composition.rings = composition.rings.map((ring, i) =>
		i === index ? { ...ring, ...patch } : ring
	);
}

export function reorderRings(fromIndex: number, toIndex: number) {
	const rings = [...composition.rings];
	const [moved] = rings.splice(fromIndex, 1);
	rings.splice(toIndex, 0, moved);
	composition.rings = rings;
}

export function setBaseRadius(value: number) {
	composition.baseRadius = value;
}

export function setRingIncrement(value: number) {
	composition.ringIncrement = value;
}

export function setRingExpanded(index: number, expanded: boolean) {
	uiState.expandedRings = { ...uiState.expandedRings, [index]: expanded };
}

export function isRingExpanded(index: number): boolean {
	return uiState.expandedRings[index] ?? false;
}
