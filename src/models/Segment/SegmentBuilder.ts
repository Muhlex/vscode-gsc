import { type Position, Range } from "vscode";
import { SegmentMap, type SegmentNode, SegmentTree } from ".";

interface SegmentNodeStart<T> {
	position: Position;
	children?: SegmentNode<T>[];
}

export class SegmentBuilder<T = void> {
	private roots: SegmentNode<T>[] = [];
	private startStack: SegmentNodeStart<T>[] = [];

	start(position: Position) {
		this.startStack.push({ position });
	}

	end(position: Position, value: T) {
		const start = this.startStack.pop();
		if (!start) throw new Error("No Segment started to be ended.");
		const segment: SegmentNode<T> = {
			range: new Range(start.position, position),
			children: start.children,
			value,
		};
		this.store(segment);
	}

	set(range: Range, value: T) {
		const segment: SegmentNode<T> = { range, value };
		this.store(segment);
	}

	private store(segment: SegmentNode<T>) {
		const parent = this.startStack.at(-1);
		if (!parent) {
			this.roots.push(segment);
			return;
		}
		if (!parent.children) parent.children = [];
		parent.children.push(segment);
	}

	toTree() {
		return new SegmentTree(this.roots);
	}

	toMap() {
		return new SegmentMap(this.roots);
	}
}

export class SegmentBuilderLinear<T = void> {
	private builder = new SegmentBuilder<T>();
	private endStack: { end: Position; value: T }[] = [];

	push(range: Range, value: T) {
		for (let i = this.endStack.length - 1; i >= 0; i--) {
			const parentCandidate = this.endStack[i];
			if (range.end.isBeforeOrEqual(parentCandidate.end)) break;
			this.endStack.splice(i, 1);
			this.builder.end(parentCandidate.end, parentCandidate.value);
		}
		this.builder.start(range.start);
		this.endStack.push({ end: range.end, value });
	}

	private finalize() {
		for (let i = this.endStack.length - 1; i >= 0; i--) {
			const segment = this.endStack[i];
			this.builder.end(segment.end, segment.value);
		}
	}

	toTree() {
		this.finalize();
		return this.builder.toTree();
	}

	toMap() {
		this.finalize();
		return this.builder.toMap();
	}
}
