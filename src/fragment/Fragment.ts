import { Range, type Position } from "vscode";

// TODO: Readonly variant?
interface Fragment<T> {
	range: Range;
	data: T;
	children?: Fragment<T>[];
}

class Fragments<T> {
	private roots: Fragment<T>[];

	constructor(roots: Fragment<T>[]) {
		this.roots = roots;
	}

	hasFragmentAt(position: Position, mustEnclose = true) {
		return getFragmentIndex(this.roots, position, mustEnclose) !== -1;
	}

	getFragmentIndicesAt(position: Position, mustEnclose = true) {
		const result: number[] = [];
		let fragments = this.roots;
		while (true) {
			const index = getFragmentIndex(fragments, position, mustEnclose);
			if (index === -1) break;
			result.push(index);
			const children = fragments[index].children;
			if (!children) break;
			fragments = children;
		}
		return result;
	}

	getFragmentsAt(position: Position, mustEnclose = true) {
		const indices = this.getFragmentIndicesAt(position, mustEnclose);
		const result: Fragment<T>[] = [];
		let fragments = this.roots;
		for (const index of indices) {
			const fragment = fragments[index];
			result.push(fragment);
			fragments = fragment.children!;
		}
	}
}

const getFragmentIndex = <T>(
	fragments: readonly Fragment<T>[],
	position: Position,
	mustEnclose = true, // TODO: replace by offering to search for a range instead?
) => {
	const getIsPositionInRange = mustEnclose
		? (range: Range) => range.contains(position) && !range.end.isEqual(position)
		: (range: Range) => range.contains(position);
	let low = 0;
	let high = fragments.length - 1;

	while (low <= high) {
		const mid = Math.floor((low + high) / 2);
		const midRange = fragments[mid].range;

		if (getIsPositionInRange(midRange)) return mid;

		if (position.isBefore(midRange.start)) {
			high = mid - 1;
		} else {
			low = mid + 1;
		}
	}
	return -1;
};

class FragmentsBuilder<T> {
	private roots: Fragment<T>[] = [];
	private stack: Fragment<T>[] = [];

	start(position: Position) {
		const fragment = { range: new Range(position, position) };
		const parent = this.stack.at(-1);

		if (parent) {
			if (!parent.children) parent.children = [];
			parent.children.push(fragment);
		}
		if (this.stack.length === 0) this.roots.push(fragment);
		this.stack.push(fragment);
	}

	end(position: Position) {
		const fragment = this.stack.pop();
		if (!fragment) throw new Error("No started fragment to be ended.");
		fragment.range = fragment.range.with(undefined, position);
	}

	build() {
		return new Fragments(this.roots);
	}
}
