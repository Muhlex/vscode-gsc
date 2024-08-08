import type { Range } from "vscode";
import type { CallableDef } from "./Def";
import type { SegmentMap } from "./Segment";

type CallableInstanceRawCommon = {
	ident: { name: string; range: Range };
	path?: string;
};

export type CallableCallRaw = CallableInstanceRawCommon & {
	kind: "call";
	paramList: { range: Range };
	params: SegmentMap<{ contentRange?: Range }>;
};

export type CallableReferenceRaw = CallableInstanceRawCommon & {
	kind: "reference";
};

export type CallableInstanceRaw = CallableCallRaw | CallableReferenceRaw;

export type CallableCall = CallableCallRaw & { def?: CallableDef };
export type CallableReference = CallableReferenceRaw & { def?: CallableDef };
export type CallableInstance = CallableCall | CallableReference;
