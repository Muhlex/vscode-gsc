import type { Range } from "vscode";
import type { SegmentMap } from "./Segment";
import type { GscFile } from "../stores/GscStore/GscFile";

export type VariableDef = {
	name?: string;
	types?: string[];
	description?: string[];
};

export type ParamDef = VariableDef & { optional?: boolean } & Required<Pick<VariableDef, "name">>;

type CallableDefCommon = {
	ident: { name: string };
	description?: string[];
	receiver?: VariableDef;
	params?: ParamDef[];
	paramsRepeatable?: "last" | "all";
	return?: VariableDef;
	example?: string[];
};

export type CallableDefGame = CallableDefCommon & {
	origin: "game";
	featureset: string;
	module: string;
	priority?: number;
	deprecated?: boolean;
	devOnly?: boolean;
};

export type CallableDefScript = CallableDefCommon & {
	origin: "script";
	ident: CallableDefCommon["ident"] & { range: Range };
	params: (ParamDef & { range: Range })[];
	body: { range: Range; variables: { params: SegmentMap<{ index: number }> } };
	file: GscFile;
};

export type CallableDef = CallableDefGame | CallableDefScript;

export type CallableDefsEngine = {
	[featureset: string]: { [module: string]: { [ident: string]: CallableDefGame } };
};
