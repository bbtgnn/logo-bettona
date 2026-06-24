import type { Action } from 'svelte/action';

export type DraggableHandlers = {
	onStart?: (e: PointerEvent) => void;
	onMove: (e: PointerEvent) => void;
	onEnd?: (e: PointerEvent) => void;
};

/**
 * Owns a drag's pointer lifecycle for one element: records the active pointer id,
 * best-effort setPointerCapture on down, routes pointermove to onMove only for that
 * pointer, releases + onEnd on up. Secondary pointers are ignored while a drag is
 * active (pointer-id awareness). The call site supplies the semantic move via the
 * handler closures; the action holds no app logic. Used as an action (not an
 * attachment) so `update` swaps the closures without re-adding listeners.
 */
export const draggable: Action<Element, DraggableHandlers> = (node, initial) => {
	let handlers = initial;
	let activePointer: number | null = null;

	function onDown(e: PointerEvent) {
		if (activePointer !== null) return; // a drag is already in progress
		activePointer = e.pointerId;
		try {
			node.setPointerCapture(e.pointerId);
		} catch {
			// Best-effort: synthetic events (and some pointer types) have no active
			// pointer to capture. The drag still works via the activePointer guard.
		}
		handlers.onStart?.(e);
	}

	function onMove(e: PointerEvent) {
		if (activePointer !== e.pointerId) return;
		handlers.onMove(e);
	}

	function onUp(e: PointerEvent) {
		if (activePointer !== e.pointerId) return;
		activePointer = null;
		if (node.hasPointerCapture(e.pointerId)) node.releasePointerCapture(e.pointerId);
		handlers.onEnd?.(e);
	}

	node.addEventListener('pointerdown', onDown as EventListener);
	node.addEventListener('pointermove', onMove as EventListener);
	node.addEventListener('pointerup', onUp as EventListener);

	return {
		update(next: DraggableHandlers) {
			handlers = next;
		},
		destroy() {
			node.removeEventListener('pointerdown', onDown as EventListener);
			node.removeEventListener('pointermove', onMove as EventListener);
			node.removeEventListener('pointerup', onUp as EventListener);
		}
	};
};
