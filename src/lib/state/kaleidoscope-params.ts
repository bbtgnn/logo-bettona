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
import { m } from '$lib/paraglide/messages';
import type { AnimatableParam } from './animatable-params';

// Kaleidoscope params are one registry of the generic animatable shape.
export type KaleidoParam = AnimatableParam;

// Single source of truth for every animatable kaleidoscope slider. Order = sidebar order.
// Booleans (masks, live tile) and the background color are intentionally absent: not animatable.
// `label` is a getter so it resolves the current locale lazily; the {#key currentLocale()}
// root re-render makes consumers re-read it on a language switch.
export const KALEIDO_PARAMS: KaleidoParam[] = [
	{
		id: KALEIDO_GLOBAL_ROTATION,
		get label() {
			return m.editor_kaleido_global_rotation();
		},
		min: 0,
		max: 360,
		step: 1,
		get: () => kaleidoscope.globalRotation,
		set: setGlobalRotation
	},
	{
		id: 'kaleidoscope.tileRotation',
		get label() {
			return m.editor_kaleido_tile_rotation();
		},
		min: 0,
		max: 360,
		step: 1,
		get: () => kaleidoscope.tileRotation,
		set: setTileRotation
	},
	{
		id: 'kaleidoscope.carpetRotation',
		get label() {
			return m.editor_kaleido_carpet_rotation();
		},
		min: 0,
		max: 360,
		step: 1,
		get: () => kaleidoscope.carpetRotation,
		set: setCarpetRotation
	},
	{
		id: 'kaleidoscope.scale',
		get label() {
			return m.editor_kaleido_scale();
		},
		min: 0.3,
		max: 3,
		step: 0.05,
		get: () => kaleidoscope.scale,
		set: setScale
	},
	{
		id: 'kaleidoscope.offsetDistance',
		get label() {
			return m.editor_kaleido_offset_distance();
		},
		min: 0,
		max: 1,
		step: 0.01,
		get: () => kaleidoscope.offsetDistance,
		set: setOffsetDistance
	},
	{
		id: 'kaleidoscope.tileSize',
		get label() {
			return m.editor_kaleido_tile_size();
		},
		min: 0.1,
		max: 2,
		step: 0.05,
		get: () => kaleidoscope.tileSize,
		set: setTileSize
	},
	{
		id: 'kaleidoscope.sectors',
		get label() {
			return m.editor_kaleido_sectors();
		},
		min: 4,
		max: 24,
		step: 2,
		get: () => kaleidoscope.sectors,
		set: setSectors
	},
	{
		id: 'kaleidoscope.repeat',
		get label() {
			return m.editor_kaleido_repeat();
		},
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
