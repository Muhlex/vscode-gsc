import type { Position, Range } from "vscode";
import { type Segment, type SegmentNode, SegmentMap } from ".";
import { getSegmentIndexAtPos, getSegmentIndicesInRange } from "./shared";

export class SegmentTree<T = void> {
	private roots: Segment<T>[];

	constructor(roots: SegmentNode<T>[]) {
		this.roots = roots;
	}

	hasAt(position: Position, matchEnd = false) {
		return getSegmentIndexAtPos(this.roots, position, matchEnd) !== -1;
	}

	getAt(position: Position, matchEnd = false): Segment<T>[] {
		const result: Segment<T>[] = [];
		let segments: SegmentNode<T>[] | undefined = this.roots;
		while (segments) {
			const index = getSegmentIndexAtPos(segments, position, matchEnd);
			if (index === -1) break;
			const segment: SegmentNode<T> = segments[index];
			result.push(segment);
			segments = segment.children;
		}
		return result;
	}

	getIn(range: Range, matchIntersect = false): Segment<T>[] {
		const intersectingSegments: Segment<T>[] = [];
		const pushIntersectingRecursive = (segments: SegmentNode<T>[]) => {
			const indices = getSegmentIndicesInRange(segments, range, true);
			for (const index of indices) {
				const segment = segments[index];
				intersectingSegments.push(segment);
				if (!segment.children) continue;
				pushIntersectingRecursive(segment.children);
			}
		};
		pushIntersectingRecursive(this.roots);

		if (matchIntersect) return intersectingSegments;
		return intersectingSegments.filter((segment) => range.contains(segment.range));
	}

	toMap() {
		return new SegmentMap(this.roots);
	}

	*[Symbol.iterator]() {
		function* iterateRecursive(segments: SegmentNode<T>[]): Generator<Segment<T>> {
			for (const segment of segments) {
				yield segment;
				if (!segment.children) continue;
				yield* iterateRecursive(segment.children);
			}
		}

		yield* iterateRecursive(this.roots);
	}
}
