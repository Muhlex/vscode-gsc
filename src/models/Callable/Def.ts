import type { Range } from "vscode";
import type { FeaturesetsScope, ScopesLookup } from "../Scope";
import type { SegmentMap } from "../Segment";

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
	module: string;
	deprecated?: boolean;
	devOnly?: boolean;
	scopes: ScopesLookup;
};

export type CallableDefScript = CallableDefCommon & {
	origin: "script";
	ident: CallableDefCommon["ident"] & { range: Range };
	params: (ParamDef & { range: Range })[];
	body: { range: Range; variables: { params: SegmentMap<{ index: number }> } };
};

export type CallableDef = CallableDefGame | CallableDefScript;

export type CallableDefGameRaw = Omit<
	CallableDefGame,
	"ident" | "origin" | "featuresets" | "scopes"
> & {
	scopes: FeaturesetsScope[];
};
export type CallableDefsGameRaw = { [name: string]: CallableDefGameRaw[] };
