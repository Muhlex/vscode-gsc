import type { Position, Range } from "vscode";
import type { Segment } from ".";

export const getSegmentIndex = <T>(
	segments: readonly Segment<T>[],
	position: Position,
	matchEnd = false,
) => {
	const getIsPositionInRange = matchEnd
		? (range: Range) => range.contains(position)
		: (range: Range) => range.contains(position) && !range.end.isEqual(position);
	let low = 0;
	let high = segments.length - 1;

	while (low <= high) {
		const mid = Math.floor((low + high) / 2);
		const midRange = segments[mid].range;

		if (getIsPositionInRange(midRange)) return mid;

		if (position.isBefore(midRange.start)) {
			high = mid - 1;
		} else {
			low = mid + 1;
		}
	}
	return -1;
};
