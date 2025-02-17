import { Position, Range, type TextDocument } from "vscode";
import type { Segment } from ".";
import { getSegmentIndexAtPos, getSegmentIndicesInRange } from "./shared";

export class SegmentMap<T = void> {
	private segments: Segment<T>[];

	constructor(segments: Segment<T>[]) {
		this.segments = segments;
	}

	get length(): number {
		return this.segments.length;
	}

	indexAt(position: Position, matchEnd = false): number {
		return getSegmentIndexAtPos(this.segments, position, matchEnd);
	}

	hasAt(position: Position, matchEnd = false): boolean {
		return this.indexAt(position, matchEnd) !== -1;
	}

	getAt(position: Position, matchEnd = false): Segment<T> | undefined {
		return this.getByIndex(this.indexAt(position, matchEnd));
	}

	getIn(range: Range, matchIntersect = false): Segment<T>[] {
		const result: Segment<T>[] = [];
		const indices = getSegmentIndicesInRange(this.segments, range, matchIntersect);
		for (const index of indices) result.push(this.segments[index]);
		return result;
	}

	getByIndex(index: number): Segment<T> | undefined {
		return this.segments[index];
	}

	*[Symbol.iterator]() {
		for (const segment of this.segments) {
			yield segment;
		}
	}

	*inverted(document: TextDocument): Generator<Range> {
		const bofPos = new Position(0, 0);
		const eofPos = document.lineAt(document.lineCount - 1).range.end;

		if (this.segments.length === 0) {
			yield new Range(bofPos, eofPos);
			return;
		}

		const firstSegment = this.segments[0];
		if (!firstSegment.range.start.isEqual(bofPos)) {
			yield new Range(bofPos, firstSegment.range.start);
		}

		for (let i = 0; i < this.segments.length - 1; i++) {
			const segment = this.segments[i];
			const start = segment.range.end;
			const end = this.segments[i + 1].range.start;
			yield new Range(start, end);
		}

		const lastSegment = this.segments[this.segments.length - 1];
		if (!lastSegment.range.end.isEqual(eofPos)) {
			yield new Range(lastSegment.range.end, eofPos);
		}
	}
}
