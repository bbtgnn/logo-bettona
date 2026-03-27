import paper from 'paper';

export function setup(canvas: HTMLCanvasElement) {
	const _ = new paper.PaperScope();
	_.setup(canvas);

	const pointA = new _.Path.Circle({ x: 0, y: 100, radius: 10 });
	pointA.fillColor = new _.Color('red');

	pointA.onMouseDrag = moveOnDrag([lockX(0), clampPoint(_.view.bounds)]);
}

//

type MouseDragEvent = {
	type: 'mousedrag';
	event: {
		isTrusted: boolean;
	};
	point: paper.Point;
	delta: paper.Point;
	target: paper.Path;
};

type PointTransform = (point: paper.Point) => paper.Point;

function lockX(value: number): PointTransform {
	return function (point: paper.Point): paper.Point {
		return new paper.Point({ x: value, y: point.y });
	};
}

function clampPoint(bounds: paper.Rectangle): PointTransform {
	return function (point: paper.Point): paper.Point {
		return new paper.Point(
			Math.max(bounds.left, Math.min(point.x, bounds.right)),
			Math.max(bounds.top, Math.min(point.y, bounds.bottom))
		);
	};
}

function moveOnDrag(transforms: PointTransform[]) {
	return function (ev: MouseDragEvent) {
		let newPosition = ev.target.position.add(ev.delta);
		for (const transform of transforms) {
			newPosition = transform(newPosition);
		}
		ev.target.position = newPosition;
	};
}
