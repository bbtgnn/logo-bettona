import { lsSync } from 'rune-sync/localstorage';
import type {
	AspectRatio,
	ColorModeState,
	ColorMode,
	FullPalette,
	MonochromePalette,
	Path,
	Ring,
	WaveState,
	ZoneDrive
} from '$lib/types';
import type { PrintFormatId, Orientation } from '$lib/geometry/print-format';
import { orientedDimensionsMm } from '$lib/geometry/print-format';
import { applyColors } from '$lib/color/apply';
import { validatePathCompatibility } from '$lib/geometry/path-morph';
import { composition } from './composition-persistence.svelte';
import { newRingId } from './ring-id';
import { DEFAULT_RING_PATH } from './default';

export const colorMode = lsSync<ColorModeState>('color-mode', {
	mode: 'monochrome',
	palette: 0
});

export const canvasFormat = lsSync<{ printFormat: PrintFormatId | null; orientation: Orientation }>(
	'canvas-format',
	{ printFormat: null, orientation: 'portrait' }
);

export function setPrintFormat(id: PrintFormatId | null) {
	canvasFormat.printFormat = id;
}

export function setPrintOrientation(orientation: Orientation) {
	canvasFormat.orientation = orientation;
}

/**
 * The width:height proportion the canvas is rendered at. A print format overrides
 * the screen aspect ratio with the oriented paper dimensions (in mm, used purely as
 * a proportion); otherwise the aspect-ratio preset is parsed.
 */
export function getEffectiveCanvasProportion(): { width: number; height: number } {
	if (canvasFormat.printFormat) {
		const { widthMm, heightMm } = orientedDimensionsMm(
			canvasFormat.printFormat,
			canvasFormat.orientation
		);
		return { width: widthMm, height: heightMm };
	}
	const [w, h] = composition.aspectRatio.split(':').map(Number);
	return { width: w, height: h };
}

/** Writes the active mono palette's background (replaces the array for reactivity). */
export function setPaletteBackground(color: string) {
	const i = colorMode.palette;
	composition.monochromePalettes = composition.monochromePalettes.map((p, idx) =>
		idx === i ? { ...p, background: color } : p
	);
}

const DEFAULT_RING: Omit<Ring, 'id'> = {
	color: '#000000',
	templatePath: DEFAULT_RING_PATH,
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
	palette: MonochromePalette = { primary: '#000000', secondary: '#ffffff', background: '#ffffff' }
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
	composition.rings = [...composition.rings, { ...DEFAULT_RING, id: newRingId() }];
	applyColorMode();
}

function clonePath(p: Path): Path {
	return { cmds: [...p.cmds], crds: [...p.crds] };
}

/**
 * Appends a ring seeded from a chosen curve. Used by the Tracciati landing flow:
 * picking ("Usa") or finishing an edit ("Fatto") adds a ring carrying that curve.
 * A secondary path makes it a morph pair (morphT = 1); without it the ring is static.
 */
export function addRingWithPath(path: Path, secondaryPath: Path | null = null): void {
	const ring: Ring = {
		id: newRingId(),
		color: '#000000',
		templatePath: clonePath(path),
		secondaryTemplatePath: secondaryPath ? clonePath(secondaryPath) : null,
		morphT: secondaryPath ? 1 : 0,
		ringHeight: 0.12
	};
	composition.rings = [...composition.rings, ring];
	applyColorMode();
}

/**
 * Geometry-only half of ring deletion: drops the ring from the composition but
 * leaves keyframe Tracks untouched (composition.ts never reaches keyframe state).
 * The complete door is `removeRing` in animation.svelte.ts, which also deletes the
 * ring's Tracks. Name mirrors `removeRingMorphTarget` — both are the partial half.
 */
export function removeRingFromComposition(index: number) {
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
 * Updates primary or secondary template path. Editing the secondary enforces strict
 * structural compatibility with the primary and rejects an incompatible update without
 * mutating state. Editing the primary always succeeds: a structurally incompatible
 * primary edit re-seeds the secondary from the new primary (stopgap, see the primary
 * branch), keeping the morph pair interpolatable.
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
				// Stopgap: a structural primary edit re-seeds the secondary from the new
				// primary so the morph pair stays interpolatable, instead of rejecting the
				// edit. Proper fix relocates morph editing to Animate (spec Animate #2).
				const reseeded = { cmds: [...path.cmds], crds: [...path.crds] };
				composition.rings = composition.rings.map((r, i) =>
					i === index ? { ...r, templatePath: path, secondaryTemplatePath: reseeded } : r
				);
				return { ok: true };
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

export function setCopies(value: number) {
	composition.copies = Math.max(1, Math.floor(Number.isFinite(value) ? value : 1));
}

export function setAspectRatio(ratio: AspectRatio) {
	composition.aspectRatio = ratio;
}

export function getCompositionBackgroundColor(): string {
	const mono = composition.monochromePalettes[colorMode.palette];
	return mono?.background ?? '#ffffff';
}

export function setRingExpanded(index: number, expanded: boolean) {
	uiState.expandedRings = { ...uiState.expandedRings, [index]: expanded };
}

export function isRingExpanded(index: number): boolean {
	return uiState.expandedRings[index] ?? false;
}