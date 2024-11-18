import type { Position, Range } from "vscode";
import type { Segment } from ".";

export const getSegmentIndexAtPos = <T>(
	segments: readonly Segment<T>[],
	position: Position,
	matchEnd = false,
) => {
	const getIsPositionInSegmentRange = matchEnd
		? (segRange: Range) => segRange.contains(position)
		: (segRange: Range) => segRange.contains(position) && !segRange.end.isEqual(position);
	let low = 0;
	let high = segments.length - 1;

	while (low <= high) {
		const mid = Math.floor((low + high) / 2);
		const midRange = segments[mid].range;

		if (getIsPositionInSegmentRange(midRange)) return mid;

		if (position.isBefore(midRange.start)) {
			high = mid - 1;
		} else {
			low = mid + 1;
		}
	}
	return -1;
};

export const getSegmentIndicesInRange = <T>(
	segments: readonly Segment<T>[],
	range: Range,
	matchIntersect = false,
) => {
	const getIsSegmentRangeInRange = matchIntersect
		? (segRange: Range) => range.contains(segRange.start) || range.contains(segRange.end)
		: (segRange: Range) => range.contains(segRange);
	let low = 0;
	let high = segments.length - 1;
	const indices: number[] = [];

	while (low <= high) {
		const mid = Math.floor((low + high) / 2);
		const midRange = segments[mid].range;

		if (getIsSegmentRangeInRange(midRange)) {
			indices.push(mid);
			for (let i = mid - 1; i >= 0; i--) {
				if (!getIsSegmentRangeInRange(segments[i].range)) break;
				indices.unshift(i);
			}
			for (let i = mid + 1; i < segments.length; i++) {
				if (!getIsSegmentRangeInRange(segments[i].range)) break;
				indices.push(i);
			}
			break;
		}

		if (range.end.isBefore(midRange.start)) {
			high = mid - 1;
		} else {
			low = mid + 1;
		}
	}
	return indices;
};
