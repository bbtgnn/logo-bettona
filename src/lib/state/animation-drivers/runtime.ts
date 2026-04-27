import type { AnimationDriverType } from './types';

type AnimationDriver = {
	init: () => void;
	dispose: () => void;
	frame: (nowMs: number) => Record<number, number>;
};

type RuntimeDeps = {
	applyRingT: (index: number, t: number) => void;
};

function clamp01(value: number): number {
	return Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
}

export function createAnimationRuntime(deps: RuntimeDeps) {
	const drivers = new Map<AnimationDriverType, AnimationDriver>();
	let mode: AnimationDriverType | null = null;

	function registerDriver(type: AnimationDriverType, driver: AnimationDriver): void {
		drivers.set(type, driver);
		// Contract: activating a mode before registration is allowed;
		// registering that active mode later initializes it immediately.
		if (mode === type) {
			driver.init();
		}
	}

	function setMode(nextMode: AnimationDriverType | null): void {
		if (mode === nextMode) return;
		if (mode) {
			drivers.get(mode)?.dispose();
		}
		mode = nextMode;
		if (mode) {
			drivers.get(mode)?.init();
		}
	}

	function tick(nowMs: number): void {
		if (!mode) return;

		const frame = drivers.get(mode)?.frame(nowMs) ?? {};
		for (const [rawIndex, rawT] of Object.entries(frame)) {
			const index = Number(rawIndex);
			if (!Number.isInteger(index) || index < 0) continue;
			deps.applyRingT(index, clamp01(rawT));
		}
	}

	return {
		registerDriver,
		setMode,
		tick
	};
}
