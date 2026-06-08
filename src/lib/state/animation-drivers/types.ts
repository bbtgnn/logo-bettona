export type AnimationDriverType = 'simple' | 'audioBars' | 'dataSeries';

export type DataSeriesConfig = {
	seriesByRingIndex: Record<number, number[]>;
	speed: number;
	loop: boolean;
};

export type AudioBarsConfig = {
	smoothing: number;
	minHz: number;
	maxHz: number;
	waveCrests: number; // integer >= 1, periods along the petal
	waveAmplitudeGain: number; // band energy (0..1) → wave amplitude
	wavePhaseSpeed: number; // rad/sec, travel speed of the wave
	inputGain: number; // multiplies raw band magnitudes before clamp (boost quiet recordings)
};

export type DriverConfigByType = {
	audioBars: AudioBarsConfig;
	dataSeries: DataSeriesConfig;
};
