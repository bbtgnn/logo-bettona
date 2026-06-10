import { lsSync } from 'rune-sync/localstorage';
import type {
	ColorModeState,
	ColorMode,
	FullPalette,
	MonochromePalette,
	Ring,
	WaveState,
	ZoneDrive
} from '$lib/types';
import { applyColors } from '$lib/color/apply';
import { validatePathCompatibility } from '$lib/geometry/path-morph';
import { composition } from './composition-persistence.svelte';

export const colorMode = lsSync<ColorModeState>('color-mode', {
	mode: 'monochrome',
	palette: 0
});

const DEFAULT_RING: Ring = {
	copies: 8,
	color: '#000000',
	templatePath: {
		cmds: ['M', 'C', 'C'],
		crds: [
			20, 117.61326806392421, 59, 117.50800490602947, 32.43817613081838, 82.72961144836285,
			61.688995215311024, 62.77907643368346, 83.43200751345759, 47.9492445945898, 101,
			66.54953384995142, 180, 67.38673193607579
		]
	},
	secondaryTemplatePath: null,
	morphT: 0,
	ringHeight: 0.12
};

function clamp01(value: number): number {
	return Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
}

export { composition };

export const uiState = lsSync<{ expandedRings: Record<number, boolean> }>('composition-ui', {
	expandedRings: {}
});

function applyColorMode() {
	const { mode, palette } = colorMode;
	const monoPalette = composition.monochromePalettes[palette];
	const fullPalette = composition.fullPalettes[palette];
	const currentColors = composition.rings.map((r) => r.color);
	const newColors = applyColors(
		mode,
		monoPalette,
		fullPalette,
		currentColors,
		composition.rings.length
	);
	composition.rings = composition.rings.map((ring, i) => ({ ...ring, color: newColors[i] }));
}

export function reshuffle() {
	if (colorMode.mode === 'palette') applyColorMode();
}

export function setColorMode(mode: ColorMode) {
	const maxIndex =
		mode === 'monochrome'
			? composition.monochromePalettes.length - 1
			: mode === 'palette'
				? composition.fullPalettes.length - 1
				: 0;
	colorMode.mode = mode;
	colorMode.palette = Math.min(colorMode.palette, Math.max(0, maxIndex));
	applyColorMode();
}

export function setActivePalette(index: number) {
	colorMode.palette = index;
	applyColorMode();
}

export function addMonochromePalette(
	palette: MonochromePalette = { main: '#000000', bg: '#ffffff' }
) {
	composition.monochromePalettes = [...composition.monochromePalettes, palette];
	colorMode.palette = composition.monochromePalettes.length - 1;
	applyColorMode();
}

export function updateMonochromePalette(index: number, patch: Partial<MonochromePalette>) {
	composition.monochromePalettes = composition.monochromePalettes.map((p, i) =>
		i === index ? { ...p, ...patch } : p
	);
	if (colorMode.palette === index) applyColorMode();
}

export function removeMonochromePalette(index: number) {
	if (composition.monochromePalettes.length <= 1) return;
	composition.monochromePalettes = composition.monochromePalettes.filter((_, i) => i !== index);
	colorMode.palette = Math.min(colorMode.palette, composition.monochromePalettes.length - 1);
	applyColorMode();
}

export function addFullPalette(palette: FullPalette = { colors: ['#000000', '#ffffff'] }) {
	composition.fullPalettes = [...composition.fullPalettes, palette];
	colorMode.palette = composition.fullPalettes.length - 1;
	applyColorMode();
}

export function updateFullPalette(index: number, patch: Partial<FullPalette>) {
	composition.fullPalettes = composition.fullPalettes.map((p, i) =>
		i === index ? { ...p, ...patch } : p
	);
	if (colorMode.palette === index) applyColorMode();
}

export function removeFullPalette(index: number) {
	if (composition.fullPalettes.length <= 1) return;
	composition.fullPalettes = composition.fullPalettes.filter((_, i) => i !== index);
	colorMode.palette = Math.min(colorMode.palette, composition.fullPalettes.length - 1);
	applyColorMode();
}

export function addRing() {
	composition.rings = [...composition.rings, { ...DEFAULT_RING }];
	applyColorMode();
}

export function removeRing(index: number) {
	composition.rings = composition.rings.filter((_, i) => i !== index);
	applyColorMode();
}

export function updateRing(index: number, patch: Partial<Ring>) {
	composition.rings = composition.rings.map((ring, i) =>
		i === index ? { ...ring, ...patch } : ring
	);
}

export function setRingMorphT(index: number, t: number) {
	composition.rings = composition.rings.map((ring, i) =>
		i === index ? { ...ring, morphT: clamp01(t) } : ring
	);
}

export function setRingWave(index: number, wave: WaveState | null) {
	composition.rings = composition.rings.map((ring, i) => (i === index ? { ...ring, wave } : ring));
}

export function setRingZoneDrive(index: number, drive: ZoneDrive | null) {
	composition.rings = composition.rings.map((ring, i) =>
		i === index ? { ...ring, zoneDrive: drive } : ring
	);
}

export function createRingMorphTarget(index: number) {
	const ring = composition.rings[index];
	if (!ring || !ring.templatePath) return;
	const templatePath = ring.templatePath;
	composition.rings = composition.rings.map((candidate, i) =>
		i === index
			? {
					...candidate,
					morphT: clamp01(candidate.morphT ?? 0),
					secondaryTemplatePath: {
						cmds: [...templatePath.cmds],
						crds: [...templatePath.crds]
					}
				}
			: candidate
	);
}

export function removeRingMorphTarget(index: number) {
	composition.rings = composition.rings.map((ring, i) =>
		i === index ? { ...ring, secondaryTemplatePath: null, morphT: 0 } : ring
	);
}

export type UpdateRingPathVariantResult = { ok: true } | { ok: false; reason: string };

/**
 * Updates primary or secondary template path. When both paths exist, enforces strict
 * structural compatibility; rejects the update without mutating state if incompatible.
 */
export function updateRingPathVariant(
	index: number,
	variant: 'primary' | 'secondary',
	path: Ring['templatePath']
): UpdateRingPathVariantResult {
	const ring = composition.rings[index];
	if (!ring) {
		return { ok: false, reason: 'Ring not found' };
	}

	if (variant === 'primary') {
		if (!path && ring.secondaryTemplatePath) {
			return { ok: false, reason: 'Primary path cannot be empty while a morph target exists' };
		}
		if (path && ring.secondaryTemplatePath) {
			const compatibility = validatePathCompatibility(path, ring.secondaryTemplatePath);
			if (!compatibility.ok) {
				return compatibility;
			}
		}
		composition.rings = composition.rings.map((r, i) =>
			i === index ? { ...r, templatePath: path } : r
		);
		return { ok: true };
	}

	// secondary
	if (!path) {
		return { ok: false, reason: 'Use Remove morph target to clear the secondary path' };
	}
	if (!ring.templatePath) {
		return { ok: false, reason: 'Primary path is required to edit a morph target' };
	}
	const compatibility = validatePathCompatibility(ring.templatePath, path);
	if (!compatibility.ok) {
		return compatibility;
	}
	composition.rings = composition.rings.map((r, i) =>
		i === index ? { ...r, secondaryTemplatePath: path } : r
	);
	return { ok: true };
}

export function reorderRings(fromIndex: number, toIndex: number) {
	const rings = [...composition.rings];
	const [moved] = rings.splice(fromIndex, 1);
	rings.splice(toIndex, 0, moved);
	composition.rings = rings;
	applyColorMode();
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