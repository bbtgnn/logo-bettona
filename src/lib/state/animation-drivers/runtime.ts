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
	const active = new Set<AnimationDriverType>();

	function registerDriver(type: AnimationDriverType, driver: AnimationDriver): void {
		const previousDriver = drivers.get(type);
		drivers.set(type, driver);
		// Contract preserved: registering a driver whose type is already active
		// disposes the previous (if any) and inits the new exactly once.
		if (active.has(type)) {
			previousDriver?.dispose();
			driver.init();
		}
	}

	function setActive(type: AnimationDriverType, on: boolean): void {
		if (on === active.has(type)) return;
		if (on) {
			active.add(type);
			drivers.get(type)?.init();
		} else {
			active.delete(type);
			drivers.get(type)?.dispose();
		}
	}

	function tick(nowMs: number): void {
		for (const type of active) {
			const frame = drivers.get(type)?.frame(nowMs) ?? {};
			for (const [rawIndex, rawT] of Object.entries(frame)) {
				const index = Number(rawIndex);
				if (!Number.isInteger(index) || index < 0) continue;
				deps.applyRingT(index, clamp01(rawT));
			}
		}
	}

	return {
		registerDriver,
		setActive,
		tick
	};
}
