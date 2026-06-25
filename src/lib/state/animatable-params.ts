import type { AudioBarsConfig } from './animation-drivers/types';
import type { Ring, WaveConfig, ZoneIntensity } from '$lib/types';
import { resolveWaveConfig } from '$lib/geometry/wave';

// Everything a caller must know to drive one keyframable slider: a stable track id,
// a label, the slider bounds, and a get/set pair. Structurally identical to the old
// KaleidoParam — the kaleidoscope registry is now one consumer of this shape, not its owner.
export type AnimatableParam = {
	id: string;
	label: string;
	min: number;
	max: number;
	step: number;
	get(): number;
	set(v: number): void;
};

export type AudioBarsParamLabels = {
	inputGain: string;
	waveCrests: string;
	waveAmplitudeGain: string;
	wavePhaseSpeed: string;
	smoothing: string;
};

export type AudioZonesParamLabels = {
	bass: string;
	mid: string;
	treble: string;
};

export function buildAudioBarsParams(deps: {
	getConfig: () => AudioBarsConfig;
	setConfig: (patch: Partial<AudioBarsConfig>) => void;
	labels: AudioBarsParamLabels;
}): AnimatableParam[] {
	const { getConfig, setConfig, labels } = deps;
	return [
		{
			id: 'audioBars.inputGain',
			get label() {
				return labels.inputGain;
			},
			min: 0.5,
			max: 4,
			step: 0.1,
			get: () => getConfig().inputGain,
			set: (v) => setConfig({ inputGain: v })
		},
		{
			id: 'audioBars.waveCrests',
			get label() {
				return labels.waveCrests;
			},
			min: 1,
			max: 8,
			step: 1,
			get: () => getConfig().waveCrests,
			set: (v) => setConfig({ waveCrests: v })
		},
		{
			id: 'audioBars.waveAmplitudeGain',
			get label() {
				return labels.waveAmplitudeGain;
			},
			min: 0,
			max: 1,
			step: 0.01,
			get: () => getConfig().waveAmplitudeGain,
			set: (v) => setConfig({ waveAmplitudeGain: v })
		},
		{
			id: 'audioBars.wavePhaseSpeed',
			get label() {
				return labels.wavePhaseSpeed;
			},
			min: 0,
			max: 6,
			step: 0.1,
			get: () => getConfig().wavePhaseSpeed,
			set: (v) => setConfig({ wavePhaseSpeed: v })
		},
		{
			id: 'audioBars.smoothing',
			get label() {
				return labels.smoothing;
			},
			min: 0,
			max: 0.95,
			step: 0.05,
			get: () => getConfig().smoothing,
			set: (v) => setConfig({ smoothing: v })
		}
	];
}

export function buildAudioZonesParams(deps: {
	getIntensity: () => ZoneIntensity;
	setIntensity: (patch: Partial<ZoneIntensity>) => void;
	labels: AudioZonesParamLabels;
}): AnimatableParam[] {
	const { getIntensity, setIntensity, labels } = deps;
	const band = (key: keyof ZoneIntensity, label: () => string): AnimatableParam => ({
		id: `audioZones.${key}`,
		get label() {
			return label();
		},
		min: 0,
		max: 1,
		step: 0.01,
		get: () => getIntensity()[key],
		set: (v) => setIntensity({ [key]: v })
	});
	return [
		band('bass', () => labels.bass),
		band('mid', () => labels.mid),
		band('treble', () => labels.treble)
	];
}

// Per-ring wave overrides are DYNAMIC: a ring only contributes params while its
// `waveConfig` override is on. Ids carry the stable `ring.id`, so a track survives
// reorder/delete; the get/set closures still address the live array by index, so
// build from the current rings array every call.
export function buildRingWaveParams(
	rings: Ring[],
	deps: {
		updateRing: (index: number, patch: Partial<Ring>) => void;
		globalDefault: () => WaveConfig;
		ringLabel: (index: number) => string;
	}
): AnimatableParam[] {
	const params: AnimatableParam[] = [];
	rings.forEach((ring, index) => {
		if (ring.waveConfig == null) return;
		const label = deps.ringLabel(index);
		const resolved = () => resolveWaveConfig(rings[index], deps.globalDefault());
		const patchWave = (patch: Partial<WaveConfig>) =>
			deps.updateRing(index, { waveConfig: { ...resolved(), ...patch } });
		params.push(
			{
				id: `ring.${ring.id}.wave.crests`,
				label: `${label} · crests`,
				min: 1,
				max: 8,
				step: 1,
				get: () => resolved().crests,
				set: (v) => patchWave({ crests: v })
			},
			{
				id: `ring.${ring.id}.wave.amplitudeGain`,
				label: `${label} · amplitude`,
				min: 0,
				max: 1,
				step: 0.01,
				get: () => resolved().amplitudeGain,
				set: (v) => patchWave({ amplitudeGain: v })
			},
			{
				id: `ring.${ring.id}.wave.phaseSpeed`,
				label: `${label} · phase`,
				min: 0,
				max: 6,
				step: 0.1,
				get: () => resolved().phaseSpeed,
				set: (v) => patchWave({ phaseSpeed: v })
			}
		);
	});
	return params;
}

// Per-ring morph is DYNAMIC like wave overrides: a ring contributes a morphT param
// only while it has a morph target (`secondaryTemplatePath`). Ids carry the stable
// `ring.id`; the get/set closures address the live array by index, so build from the
// live rings array every call.
export function buildRingMorphParams(
	rings: Ring[],
	deps: {
		setMorphT: (index: number, v: number) => void;
		ringLabel: (index: number) => string;
	}
): AnimatableParam[] {
	const params: AnimatableParam[] = [];
	rings.forEach((ring, index) => {
		if (ring.secondaryTemplatePath == null) return;
		params.push({
			id: `ring.${ring.id}.morphT`,
			label: `${deps.ringLabel(index)} · morph`,
			min: 0,
			max: 1,
			step: 0.01,
			get: () => rings[index].morphT ?? 0,
			set: (v) => deps.setMorphT(index, v)
		});
	});
	return params;
}
