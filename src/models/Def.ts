import type { Range } from "vscode";
import type { SegmentMap } from "./Segment";
import type { GscFile } from "../stores/GscStore/GscFile";

export type VariableDef = {
	name?: string;
	types?: string[];
	description?: string[];
	optional?: boolean;
};

export type ParamDef = VariableDef & Required<Pick<VariableDef, "name">>;

type CallableDefCommon = {
	ident: { name: string };
	description?: string[];
	receiver?: VariableDef;
	params?: ParamDef[];
	paramsRepeatable?: "last" | "all";
	return?: Omit<VariableDef, "optional">;
	example?: string[];
};

export type CallableDefGame = CallableDefCommon & {
	origin: "game";
	engine: string;
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
	body: { range: Range, variables: { params: SegmentMap<{ index: number }> } };
	file: GscFile;
};

export type CallableDef = CallableDefGame | CallableDefScript;

export type CallableDefsModule = {
	[ident: string]: CallableDefGame;
};

export type CallableDefsFeatureset = {
	[module: string]: CallableDefsModule;
};

export type CallableDefsEngine = {
	[featureset: string]: CallableDefsFeatureset;
};

export type CallableDefsTree = {
	[engine: string]: CallableDefsEngine;
};

export type KeywordDefsTree = {
	[engine: string]: string[];
};
