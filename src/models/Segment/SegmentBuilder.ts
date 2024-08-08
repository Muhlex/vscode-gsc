import { Range, type Position } from "vscode";
import { type SegmentNode, SegmentMap, SegmentTree } from ".";

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
		while (this.endStack.length > 0) {
			const parent = this.endStack.at(-1)!;
			if (range.end.isBeforeOrEqual(parent.end)) break;
			this.endStack.pop();
			this.builder.end(parent.end, parent.value);
		}
		this.builder.start(range.start);
		this.endStack.push({ end: range.end, value });
	}

	private finalize() {
		for (const segment of this.endStack) {
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
