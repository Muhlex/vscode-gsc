const raw = String.raw;

export default (options: { engine: string; keywords: string[] }) => {
	const { engine, keywords } = options;

	return {
		$schema: "https://raw.githubusercontent.com/martinring/tmlanguage/master/tmlanguage.json",
		name: `Game Script (${engine.toUpperCase()})`,
		patterns: [
			{ include: "#comment" },
			{ include: "#string" },
			{ include: "#block" },
			{ include: "#variable-call" },
			{ include: "#brace" },
			{ include: "#directive" },
			{ include: "#keyword-control" },
			{ include: "#variable-animation" },
			{ include: "#keyword-operator" },
			{ include: "#number" },
			{ include: "#special" },
			{ include: "#path" },
			{ include: "#function" },
			{ include: "#punctuation" },
			{ include: "#variable" },
		],
		repository: {
			comment: {
				patterns: [
					{
						begin: raw`//`,
						end: raw`\n`,
						name: "comment.line.double-slash.gsc",
					},
					{
						begin: raw`\/\*`,
						end: raw`\*\/`,
						name: "comment.block.gsc",
					},
					{
						begin: raw`/#`,
						end: raw`#/`,
						name: "comment.block.developer.gsc",
						patterns: [{ include: "$self" }],
					},
				],
			},
			string: {
				begin: raw`(&?)"`,
				beginCaptures: {
					"1": { name: "storage.type.literal.gsc" },
				},
				end: raw`"`,
				name: "string.quoted.double.gsc",
				patterns: [
					{
						match: raw`\\.`,
						name: "constant.character.escape.gsc",
					},
				],
			},
			block: {
				name: "meta.block.gsc",
				begin: raw`{`,
				end: raw`}`,
				captures: {
					"0": { name: "punctuation.definition.block.gsc" },
				},
				patterns: [{ include: "$self" }],
			},
			"variable-call": {
				begin: raw`\[\[`,
				end: raw`\]\]`,
				name: "meta.variable-call.gsc",
				captures: {
					"0": { name: "punctuation.definition.variable-call.gsc" },
				},
				patterns: [{ include: "$self" }],
			},
			brace: {
				patterns: [
					{
						match: raw`\(|\)`,
						name: "meta.brace.round.gsc",
					},
					{
						match: raw`\[|\]`,
						name: "meta.brace.square.gsc",
					},
				],
			},
			directive: {
				name: "meta.directive.gsc",
				patterns: [
					{
						match: raw`^\s*(#)([a-z_]+)(?:\s+(\w[\w\\/]*))?`,
						captures: {
							"1": { name: "punctuation.definition.directive.gsc" },
							"2": { name: "keyword.control.directive.gsc" },
							"3": {
								name: "entity.name.scope-resolution.gsc",
								patterns: [{ match: raw`.*\/.*`, name: "invalid.illegal.import.path.gsc" }],
							},
						},
					},
					{
						begin: raw`^\s*(#)([a-z_]*)\s*\(`,
						end: raw`\)`,
						beginCaptures: {
							"1": { name: "punctuation.definition.directive.gsc" },
							"2": { name: "keyword.control.directive.gsc" },
						},
						patterns: [{ include: "$self" }],
					},
				],
			},
			"keyword-control": {
				match: raw`\b(${keywords.join("|")})\b`,
				name: "keyword.control.gsc",
			},
			"variable-animation": {
				match: raw`%[A-Za-z_][\w]*\b`,
				name: "variable.other.constant.animation.gsc",
			},
			"keyword-operator": {
				patterns: [
					{
						match: raw`(!|&&|\|\|)`,
						name: "keyword.operator.logical.gsc",
					},
					{
						match: raw`(&|\||\^|<<|>>)=`,
						name: "keyword.operator.assignment.bitwise.gsc",
					},
					{
						match: raw`(&|\||\^|<<|>>|~)`,
						name: "keyword.operator.bitwise.gsc",
					},
					{
						match: raw`(--|\+\+)`,
						name: "keyword.operator.increment-decrement.gsc",
					},
					{
						match: raw`[-+*/%]=`,
						name: "keyword.operator.assignment.arithmetic.gsc",
					},
					{
						match: raw`[-+*/%]`,
						name: "keyword.operator.arithmetic.gsc",
					},
					{
						match: raw`(==|!=|<=|>=|<|>)`,
						name: "keyword.operator.comparison.gsc",
					},
					{
						match: raw`=`,
						name: "keyword.operator.assignment.gsc",
					},
				],
			},
			number: {
				match: raw`(\b|\.)\d+\b`,
				name: "constant.numeric.decimal.gsc",
			},
			special: {
				patterns: [
					{
						match: raw`\b(true|false|undefined)\b`,
						name: "constant.language.gsc",
					},
					{
						match: raw`\b(?<=\.)size\b`,
						name: "support.constant.property.gsc",
					},
					{
						match: raw`\b\.(self|level|game|anim)\b`,
						captures: {
							"1": { name: "invalid.illegal.field.gsc" },
						},
					},
					{
						match: raw`\b(self|level|game|anim)\b`,
						name: "support.constant.gsc",
					},
					{
						match: "::",
						name: "punctuation.separator.scope-resolution.gsc",
					},
				],
			},
			path: {
				match: raw`\w+(?:(?=\s*::)|(?:[\\/]\w*)+)`,
				name: "entity.name.scope-resolution.gsc",
				captures: {
					"0": {
						patterns: [{ match: raw`.*\/.*`, name: "invalid.illegal.import.path.gsc" }],
					},
				},
			},
			function: {
				patterns: [
					{
						begin: raw`([A-Za-z_][\w]*)\s*(\()`,
						end: raw`\)`,
						beginCaptures: {
							"1": { name: "entity.name.function.gsc" },
							"2": { name: "meta.brace.round.gsc" },
						},
						endCaptures: {
							"0": { name: "meta.brace.round.gsc" },
						},
						patterns: [{ include: "$self" }],
					},
					{
						match: raw`(?<=::\s*)[A-Za-z_][\w]*`,
						name: "entity.name.function.gsc",
					},
				],
			},
			punctuation: {
				patterns: [
					{
						match: raw`\b(\.)\b`,
						captures: { 1: { name: "punctuation.accessor.gsc" } },
					},
					{
						match: ",",
						name: "punctuation.separator.comma.gsc",
					},
					{
						match: ";",
						name: "punctuation.terminator.statement.gsc",
					},
				],
			},
			variable: {
				patterns: [
					{
						match: raw`\b[A-Z_][A-Z0-9_]*\b`,
						name: "variable.other.constant.gsc",
					},
					{
						match: raw`\b[A-Za-z_][\w]*\b`,
						name: "variable.other.readwrite.gsc",
					},
				],
			},
		},
		scopeName: `source.gsc.${engine}`,
	};
};
