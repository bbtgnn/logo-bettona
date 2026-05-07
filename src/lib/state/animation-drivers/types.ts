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
};

export type DriverConfigByType = {
	audioBars: AudioBarsConfig;
	dataSeries: DataSeriesConfig;
};
