import type { Range } from "vscode";
import type { SegmentMap } from "../Segment";

type CallableUsageCommon = {
	name: { text: string; range: Range };
	path?: { text: string; range: Range };
};

export type CallableCall = CallableUsageCommon & {
	kind: "call";
	paramList: { range: Range };
	params: SegmentMap<{ contentRange?: Range }>;
};

export type CallableReference = CallableUsageCommon & {
	kind: "reference";
};

export type CallableUsage = CallableCall | CallableReference;
