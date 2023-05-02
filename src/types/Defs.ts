import { Range, MarkdownString } from "vscode";

export type VariableDef = {
	name?: string
	type?: string
	description?: string[]
	optional?: boolean
}

export type ParamDef = VariableDef & { name: string, range?: Range }

export type CallableDef = {
	ident: { name: string, range?: Range }
	module?: string
	featureset?: string
	engine?: string
	path?: string
	description?: string[]
	receiver?: VariableDef
	params?: ParamDef[]
	paramsRepeatable?: "last" | "all"
	return?: Omit<VariableDef, "optional">
	example?: string[]
	deprecated?: boolean
	devOnly?: boolean // TODO
	body?: { range: Range }
}

export type CallableDefCustom = CallableDef & {
	ident: { range: Range }
	params: (ParamDef & { range: Range })[]
	body: Required<CallableDef>["body"]
	documentation: MarkdownString
}

export type CallableDefsModule = {
	[ident: string]: CallableDef
}

export type CallableDefsFeatureset = {
	[module: string]: CallableDefsModule
}

export type CallableDefsEngine = {
	[featureset: string]: CallableDefsFeatureset
}

export type CallableDefsHierarchy = {
	[engine: string]: CallableDefsEngine
}

export type KeywordDefsHierarchy = {
	[engine: string]: string[]
}
