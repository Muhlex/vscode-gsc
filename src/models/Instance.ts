import type { Range } from "vscode";
import type { CallableDef } from "./Def";

export type CallableInstanceRaw = {
	kind: "call" | "reference";
	range: Range;
	ident: { name: string; range: Range };
	params?: { range: Range, trimmedRange?: Range }[];
	path?: string;
};

export type CallableInstance = CallableInstanceRaw & {
	def?: CallableDef;
};
