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
			{ include: "#brace" },
			{ include: "#preprocessor" },
			{ include: "#keyword-control" },
			{ include: "#variable-animation" },
			{ include: "#keyword-operator" },
			{ include: "#number" },
			{ include: "#special" },
			{ include: "#path" },
			{ include: "#function" },
			{ include: "#expression-evaluation" },
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
				begin: "{",
				beginCaptures: {
					"0": { name: "punctuation.definition.block.gsc" },
				},
				end: "}",
				endCaptures: {
					"0": { name: "punctuation.definition.block.gsc" },
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
			preprocessor: {
				name: "meta.preprocessor.gsc",
				patterns: [
					{
						match: raw`^\s*(#[a-z_]*)\b\s*(?:(?:\((.*)\))|(.*?));*\n`,
						name: "meta.preprocessor",
						captures: {
							"1": {
								name: "keyword.control.preprocessor.gsc",
							},
							"2": {
								patterns: [{ include: "$self" }],
							},
							"3": {
								patterns: [{ include: "#path" }],
							},
						},
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
						name: "storage.modifier.import.seperator.gsc",
					},
				],
			},
			path: {
				patterns: [
					{
						match: raw`\w+(?:(?=\s*::)|(?:[\\/]\w*)+)`,
						name: "storage.modifier.import.path.gsc",
						captures: {
							"0": {
								patterns: [{ match: raw`.*\/.*`, name: "invalid.illegal.import.path.gsc" }],
							},
						},
					},
				],
			},
			function: {
				// TODO: highlight braces, remove paths and :: (and make include work again)
				patterns: [
					{
						begin: raw`\b(?:([\w\\/]*)\s*(::)\s*)?\b([A-Za-z_][\w]*)\b\s*\(`,
						end: raw`\)`,
						name: "meta.function.gsc",
						beginCaptures: {
							"1": { patterns: [{ include: "#path" }] },
							"2": { name: "keyword.control.function.gsc" },
							"3": { name: "entity.name.function.gsc" },
						},
						patterns: [{ include: "$self" }],
					},
					{
						match: raw`(\b[\w\\/]*)?\s*(::)\s*\b([A-Za-z_][\w]*)\b\s*(?!\()`,
						name: "meta.function-reference.gsc",
						captures: {
							"1": { patterns: [{ include: "#path" }] },
							"2": { name: "keyword.control.function.gsc" },
							"3": { name: "entity.name.function.gsc" },
						},
					},
				],
			},
			"expression-evaluation": {
				begin: raw`\[\[`,
				end: raw`\]\]`,
				patterns: [{ include: "$self" }],
				name: "meta.expression-evaluation.gsc",
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
