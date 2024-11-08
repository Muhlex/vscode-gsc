import type { Position } from "vscode";
import { type Segment, type SegmentNode, SegmentMap } from ".";
import { getSegmentIndex } from "./shared";

export class SegmentTree<T = void> {
	private roots: Segment<T>[];

	constructor(roots: SegmentNode<T>[]) {
		this.roots = roots;
	}

	has(position: Position, matchEnd = false) {
		return getSegmentIndex(this.roots, position, matchEnd) !== -1;
	}

	// getIndices(position: Position, matchEnd = false): number[] {
	// 	const result: number[] = [];
	// 	let segments = this.roots;
	// 	while (true) {
	// 		const index = getSegmentIndex(segments, position, matchEnd);
	// 		if (index === -1) break;
	// 		result.push(index);
	// 		const children = segments[index].children;
	// 		if (!children) break;
	// 		segments = children;
	// 	}
	// 	return result;
	// }

	// get(position: Position, matchEnd = false): T[] {
	// 	const indices = this.getIndices(position, matchEnd);
	// 	const result: T[] = [];
	// 	let segments = this.roots;
	// 	for (const index of indices) {
	// 		const segment = segments[index];
	// 		result.push(segment.value);
	// 		segments = segment.children!;
	// 	}
	// 	return result;
	// }

	get(position: Position, matchEnd = false): Segment<T>[] {
		const result: Segment<T>[] = [];
		let segments: SegmentNode<T>[] | undefined = this.roots;
		while (segments) {
			const index = getSegmentIndex(segments, position, matchEnd);
			if (index === -1) break;
			const segment: SegmentNode<T> = segments[index];
			result.push(segment);
			segments = segment.children;
		}
		return result;
	}

	toMap() {
		return new SegmentMap(this.roots);
	}

	*[Symbol.iterator]() {
		function* iterateSegments(segments: SegmentNode<T>[]): Generator<Segment<T>> {
			for (const segment of segments) {
				yield segment;
				if (!segment.children) continue;
				yield* iterateSegments(segment.children);
			}
		}

		yield* iterateSegments(this.roots);
	}
}
