import type * as vscode from "vscode";

export function rangeEnclosesPosition(range: vscode.Range, position: vscode.Position) {
	return range.contains(position) && !range.end.isEqual(position);
}

function binarySearchRanges(
	sortedRanges: readonly vscode.Range[],
	position: vscode.Position,
	mustEnclose = true, // TODO: replace by offering to search for a range instead?
) {
	const getIsPositionInRange = mustEnclose
		? (range: vscode.Range) => rangeEnclosesPosition(range, position)
		: (range: vscode.Range) => range.contains(position);
	let low = 0;
	let high = sortedRanges.length - 1;

	while (low <= high) {
		const mid = Math.floor((low + high) / 2);
		const midRange = sortedRanges[mid];

		if (getIsPositionInRange(midRange)) return mid;

		if (position.isBefore(midRange.start)) {
			high = mid - 1;
		} else {
			low = mid + 1;
		}
	}
	return undefined;
}

export function hasRangeAtPos<T>(
	sortedObjects: readonly T[],
	position: vscode.Position,
	getRange: (object: T) => vscode.Range,
	mustEnclose = true,
) {
	const getPositionInRange = mustEnclose
		? (range: vscode.Range) => rangeEnclosesPosition(range, position)
		: (range: vscode.Range) => range.contains(position);
	let low = 0;
	let high = sortedObjects.length - 1;

	while (low <= high) {
		const mid = Math.floor((low + high) / 2);
		const object = sortedObjects[mid];
		const range = getRange(object);

		if (!getPositionInRange(range)) {
			if (position.isBefore(range.start)) {
				high = mid - 1;
			} else {
				low = mid + 1;
			}
			continue;
		}

		return true;
	}
	return false;
}

export function getRangeIndicesAtPos<T>(
	sortedObjects: readonly T[],
	position: vscode.Position,
	getRange: (object: T) => vscode.Range,
	mustEnclose = true,
) {
	const getPositionInRange = mustEnclose
		? (range: vscode.Range) => rangeEnclosesPosition(range, position)
		: (range: vscode.Range) => range.contains(position);
	const result: number[] = [];
	let low = 0;
	let high = sortedObjects.length - 1;

	while (low <= high) {
		const mid = Math.floor((low + high) / 2);
		const object = sortedObjects[mid];
		const range = getRange(object);

		if (!getPositionInRange(range)) {
			if (position.isBefore(range.start)) {
				high = mid - 1;
			} else {
				low = mid + 1;
			}
			continue;
		}

		result.push(mid);
		for (let i = mid - 1; i >= 0; i--) {
			const object = sortedObjects[i];
			const range = getRange(object);
			if (!getPositionInRange(range)) break;
			result.unshift(mid);
		}
		for (let i = mid + 1; i < sortedObjects.length; i++) {
			const object = sortedObjects[i];
			const range = getRange(object);
			if (!getPositionInRange(range)) break;
			result.push(mid);
		}
		break;
	}
	return result;
}

export function getRangesAtPos<T>(
	sortedObjects: readonly T[],
	position: vscode.Position,
	getRange: (object: T) => vscode.Range,
	mustEnclose = true,
) {
	return getRangeIndicesAtPos(sortedObjects, position, getRange, mustEnclose).map(
		(i) => sortedObjects[i],
	);
}
