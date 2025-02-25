import type { Range } from "vscode";
import type { FeaturesetsScope, FeaturesetsScopesLookup } from "../Scope";
import type { SegmentMap } from "../Segment";
import type { GscFile } from "../Store";

export type VariableDef = {
	name?: string;
	types?: string[];
	description?: string[];
};

export type ParamDef = VariableDef & { optional?: boolean } & Required<Pick<VariableDef, "name">>;

type CallableDefCommon = {
	name: { text: string };
	description?: string[];
	receiver?: VariableDef;
	params?: ParamDef[];
	paramsRepeatable?: "last" | "all";
	return?: VariableDef;
	example?: string[];
};

export type CallableDefGame = CallableDefCommon & {
	origin: "game";
	module: string;
	deprecated?: boolean;
	devOnly?: boolean;
	scopes: FeaturesetsScopesLookup;
};

export type CallableDefScript = CallableDefCommon & {
	origin: "script";
	file: GscFile;
	name: CallableDefCommon["name"] & { range: Range };
	params: (ParamDef & { range: Range })[];
	body: { range: Range; variables: { params: SegmentMap<{ index: number }> } };
};

export type CallableDef = CallableDefGame | CallableDefScript;

export type CallableDefGameRaw = Omit<
	CallableDefGame,
	"name" | "origin" | "featuresets" | "scopes"
> & {
	scopes: FeaturesetsScope[];
};
export type CallableDefsGameRaw = { [name: string]: CallableDefGameRaw[] };
