import { Position, Range, type TextDocument } from "vscode";
import { type Segment, SegmentBuilder } from ".";
import { getSegmentIndex } from "./shared";

export class SegmentMap<T = void> {
	private segments: Segment<T>[];

	constructor(segments: Segment<T>[]) {
		this.segments = segments;
	}

	get length() {
		return this.segments.length;
	}

	has(position: Position, matchEnd = false) {
		return getSegmentIndex(this.segments, position, matchEnd) !== -1;
	}

	getIndex(position: Position, matchEnd = false): number {
		return getSegmentIndex(this.segments, position, matchEnd);
	}

	get(position: Position, matchEnd = false): Segment<T> | undefined {
		return this.atIndex(this.getIndex(position, matchEnd));
	}

	atIndex(index: number): Segment<T> | undefined {
		return this.segments[index];
	}

	invert(document: TextDocument): SegmentMap {
		const bofPos = new Position(0, 0);
		const eofPos = document.lineAt(document.lineCount - 1).range.end;

		if (this.segments.length < 1) {
			return new SegmentMap([{ range: new Range(bofPos, eofPos), value: undefined }]);
		}

		const builder = new SegmentBuilder();
		const firstSegment = this.segments[0];
		const lastSegment = this.segments[this.segments.length - 1];

		if (!firstSegment.range.start.isEqual(bofPos)) {
			builder.set(new Range(bofPos, firstSegment.range.start));
		}
		for (let i = 0; i < this.segments.length - 1; i++) {
			const segment = this.segments[i];
			const start = segment.range.end;
			const end = this.segments[i + 1]?.range.start ?? eofPos;
			builder.set(new Range(start, end));
		}
		if (!lastSegment.range.end.isEqual(eofPos)) {
			builder.set(new Range(lastSegment.range.end, eofPos));
		}

		return builder.toMap();
	}

	*[Symbol.iterator]() {
		for (const segment of this.segments) {
			yield segment;
		}
	}
}
