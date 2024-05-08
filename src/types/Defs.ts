import type { Range } from "vscode";
import type { GscFile } from "../providers/GscStore/GscFile";

export type VariableDef = {
	name?: string;
	type?: string;
	description?: string[];
	optional?: boolean;
};

export type ParamDef = VariableDef & {
	name: string;
};

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
	module: string;
	featureset: string;
	engine: string;
	deprecated?: boolean;
	devOnly?: boolean; // TODO
};

export type CallableDefScript = CallableDefCommon & {
	origin: "script";
	ident: CallableDefCommon["ident"] & { range: Range };
	params: (ParamDef & { range: Range })[];
	body: { range: Range };
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

export type CallableDefsHierarchy = {
	[engine: string]: CallableDefsEngine;
};

export type KeywordDefsHierarchy = {
	[engine: string]: string[];
};
