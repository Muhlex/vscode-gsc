import type { Range } from "vscode";
import type { SegmentMap } from "../Segment";

type CallableInstanceCommon = {
	ident: { name: string; range: Range };
	path?: string;
};

export type CallableCall = CallableInstanceCommon & {
	kind: "call";
	paramList: { range: Range };
	params: SegmentMap<{ contentRange?: Range }>;
};

export type CallableReference = CallableInstanceCommon & {
	kind: "reference";
};

export type CallableInstance = CallableCall | CallableReference;
