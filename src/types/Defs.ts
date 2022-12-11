export interface FieldDef {
	name?: string
	type?: string
	description?: string[]
}

export interface CallableDef {
	ident: string
	module?: string
	featureset?: string
	engine?: string
	path?: string
	description?: string[]
	receiver?: FieldDef
	params?: (FieldDef & {
		optional?: boolean
	})[],
	paramsRepeatable?: "last" | "all"
	return?: FieldDef
	example?: string[]
	deprecated?: boolean
	devOnly?: boolean // TODO
}

export interface CallableDefsModule {
	[ident: string]: CallableDef
}

export interface CallableDefsFeatureset {
	[module: string]: CallableDefsModule
}

export interface CallableDefsEngine {
	[featureset: string]: CallableDefsFeatureset
}

export interface CallableDefsHierarchy {
	[engine: string]: CallableDefsEngine
}

export interface KeywordDefsHierarchy {
	[engine: string]: string[]
}
