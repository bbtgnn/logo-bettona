import { describe, it, expect, vi, afterEach } from 'vitest';
import { draggable } from './draggable';

function mount() {
	const node = document.createElement('div');
	document.body.appendChild(node);
	return node;
}

afterEach(() => {
	document.body.innerHTML = '';
});

function down(node: Element, pointerId: number) {
	node.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerId }));
}
function move(node: Element, pointerId: number) {
	node.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, pointerId }));
}
function up(node: Element, pointerId: number) {
	node.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerId }));
}

describe('draggable action', () => {
	it('calls onStart on pointerdown and onMove for the active pointer', () => {
		const node = mount();
		const onStart = vi.fn();
		const onMove = vi.fn();
		draggable(node, { onStart, onMove });
		down(node, 1);
		move(node, 1);
		expect(onStart).toHaveBeenCalledTimes(1);
		expect(onMove).toHaveBeenCalledTimes(1);
	});

	it('ignores pointermove before any pointerdown', () => {
		const node = mount();
		const onMove = vi.fn();
		draggable(node, { onMove });
		move(node, 1);
		expect(onMove).not.toHaveBeenCalled();
	});

	it('ignores a secondary pointer while one is active', () => {
		const node = mount();
		const onStart = vi.fn();
		const onMove = vi.fn();
		draggable(node, { onStart, onMove });
		down(node, 1);
		down(node, 2); // secondary — ignored
		move(node, 2); // not the active pointer — ignored
		move(node, 1);
		expect(onStart).toHaveBeenCalledTimes(1);
		expect(onMove).toHaveBeenCalledTimes(1);
	});

	it('calls onEnd on pointerup and stops moving afterwards', () => {
		const node = mount();
		const onMove = vi.fn();
		const onEnd = vi.fn();
		draggable(node, { onMove, onEnd });
		down(node, 1);
		up(node, 1);
		move(node, 1); // drag ended → ignored
		expect(onEnd).toHaveBeenCalledTimes(1);
		expect(onMove).not.toHaveBeenCalled();
	});

	it('destroy removes the listeners', () => {
		const node = mount();
		const onStart = vi.fn();
		const handle = draggable(node, { onStart, onMove: vi.fn() });
		handle?.destroy?.();
		down(node, 1);
		expect(onStart).not.toHaveBeenCalled();
	});
});
