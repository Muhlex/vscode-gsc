import type { Range } from "vscode";

export interface Segment<T> {
	readonly range: Range;
	readonly value: T;
}

export interface SegmentNode<T> extends Segment<T> {
	readonly children?: SegmentNode<T>[];
}

export { SegmentMap } from "./SegmentMap";
export { SegmentTree } from "./SegmentTree";
export { SegmentBuilder, SegmentBuilderLinear } from "./SegmentBuilder";
