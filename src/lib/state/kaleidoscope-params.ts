import {
	kaleidoscope,
	setGlobalRotation,
	setTileRotation,
	setCarpetRotation,
	setScale,
	setOffsetDistance,
	setTileSize,
	setSectors,
	setRepeat
} from './kaleidoscope.svelte';
import { KALEIDO_GLOBAL_ROTATION } from './keyframes.svelte';

export type KaleidoParam = {
	id: string;
	label: string;
	min: number;
	max: number;
	step: number;
	get(): number;
	set(v: number): void;
};

// Single source of truth for every animatable kaleidoscope slider. Order = sidebar order.
// Booleans (masks, live tile) and the background color are intentionally absent: not animatable.
export const KALEIDO_PARAMS: KaleidoParam[] = [
	{
		id: KALEIDO_GLOBAL_ROTATION,
		label: 'Rotazione globale',
		min: 0,
		max: 360,
		step: 1,
		get: () => kaleidoscope.globalRotation,
		set: setGlobalRotation
	},
	{
		id: 'kaleidoscope.tileRotation',
		label: 'Rotazione tessera',
		min: 0,
		max: 360,
		step: 1,
		get: () => kaleidoscope.tileRotation,
		set: setTileRotation
	},
	{
		id: 'kaleidoscope.carpetRotation',
		label: 'Rotazione tappeto',
		min: 0,
		max: 360,
		step: 1,
		get: () => kaleidoscope.carpetRotation,
		set: setCarpetRotation
	},
	{
		id: 'kaleidoscope.scale',
		label: 'Scala globale',
		min: 0.3,
		max: 3,
		step: 0.05,
		get: () => kaleidoscope.scale,
		set: setScale
	},
	{
		id: 'kaleidoscope.offsetDistance',
		label: 'Distanza dal centro',
		min: 0,
		max: 1,
		step: 0.01,
		get: () => kaleidoscope.offsetDistance,
		set: setOffsetDistance
	},
	{
		id: 'kaleidoscope.tileSize',
		label: 'Dimensione tessera',
		min: 0.1,
		max: 2,
		step: 0.05,
		get: () => kaleidoscope.tileSize,
		set: setTileSize
	},
	{
		id: 'kaleidoscope.sectors',
		label: 'Settori',
		min: 4,
		max: 24,
		step: 2,
		get: () => kaleidoscope.sectors,
		set: setSectors
	},
	{
		id: 'kaleidoscope.repeat',
		label: 'Ripetizioni',
		min: 1,
		max: 10,
		step: 1,
		get: () => kaleidoscope.repeat,
		set: setRepeat
	}
];

export const KALEIDO_PARAM_BY_ID: Record<string, KaleidoParam> = Object.fromEntries(
	KALEIDO_PARAMS.map((p) => [p.id, p])
);
