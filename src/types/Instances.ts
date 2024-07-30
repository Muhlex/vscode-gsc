import type { Range } from "vscode";
import type { CallableDef } from "./Defs";

export enum CallableInstanceKind {
	Reference = 0,
	Call = 1,
}
export type CallableInstance = {
	type: CallableInstanceKind;
	ident: { name: string; range: Range };
	params?: { range: Range }[];
};
export type CallableInstanceWithDef = CallableInstance & {
	def?: CallableDef;
};
