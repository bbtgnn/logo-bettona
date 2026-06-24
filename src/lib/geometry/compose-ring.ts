import type { Path, Ring } from '$lib/types';
import { interpolatePath, validatePathCompatibility } from './path-morph';
import { applyWaveToPath } from './wave';

export type ComposedRingTemplate = {
	path: Path | null;
	morphWarning: string | null;
};

/**
 * Template-space prep for one ring: morph-interpolate toward its secondary path
 * (when present and compatible), then apply the cymatic wave. PURE — no paper.js,
 * so the morph→wave ordering is unit-testable without a render scope.
 *
 * Zone deformation is deliberately NOT here: it lives in polar space inside
 * buildRingPath (driven by ring.zoneDrive). A template-space zone transform is
 * re-absorbed by bend's bbox normalization — see ADR-0001.
 *
 * morphWarning carries the reason morph was requested (secondary present,
 * !ignoreMorph) but skipped due to path incompatibility; the primary template is
 * then used unchanged before the wave step. The render pipeline maps it to a
 * RenderResult warning; previews ignore it.
 */
export function composeRingTemplate(
	ring: Ring,
	opts?: { ignoreMorph?: boolean }
): ComposedRingTemplate {
	let path = ring.templatePath;
	if (!path) return { path: null, morphWarning: null };

	let morphWarning: string | null = null;
	if (!opts?.ignoreMorph && ring.secondaryTemplatePath) {
		const compatibility = validatePathCompatibility(path, ring.secondaryTemplatePath);
		if (compatibility.ok) {
			path = interpolatePath(path, ring.secondaryTemplatePath, ring.morphT ?? 0);
		} else {
			morphWarning = compatibility.reason;
		}
	}

	if (ring.wave && ring.wave.amplitude > 0) {
		path = applyWaveToPath(path, ring.wave);
	}

	return { path, morphWarning };
}
