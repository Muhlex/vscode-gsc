/* eslint-disable @typescript-eslint/naming-convention */
const raw = String.raw;

export default (engine: string, keywords: string[]) => ({
	"$schema": "https://raw.githubusercontent.com/martinring/tmlanguage/master/tmlanguage.json",
	name: `Game Script Code (${engine.toUpperCase()})`,
	patterns: [
		{ include: "#preprocessor" },
		{ include: "#comment" },
		{ include: "#string" },
		{ include: "#keyword-control" },
		{ include: "#variable-animation" },
		{ include: "#keyword-operator" },
		{ include: "#number" },
		{ include: "#special" },
		{ include: "#functions" },
		{ include: "#expression-evaluation" },
		{ include: "#punctuation" },
		{ include: "#variable" }
	],
	repository: {
		"preprocessor": {
			name: "meta.preprocessor.gsc",
			patterns: [{
				match: raw`^(#[a-z_]*)\b\s*(?:(?:\((.*)\))|(.*?));*\n`,
				name: "meta.preprocessor",
				captures: {
					"1": {
						name: "keyword.control.preprocessor.gsc"
					},
					"2": {
						patterns: [{ include: "$self" }]
					},
					"3": {
						patterns: [{ include: "#path" }]
					}
				}
			}]
		},
		"comment": {
			patterns: [{
				begin: raw`//`,
				end: raw`\n`,
				name: "comment.line.double-slash.gsc"
			}, {
				begin: raw`\/\*`,
				end: raw`\*\/`,
				name: "comment.block.gsc"
			}, {
				begin: raw`/#`,
				end: raw`#/`,
				name: "comment.block.developer.gsc",
				patterns: [{ include: "$self" }]
			}]
		},
		"string": {
			begin: raw`(&?)"`,
			beginCaptures: {
				"1": { name: "storage.type.literal.gsc" }
			},
			end: raw`"`,
			name: "string.quoted.double.gsc",
			patterns: [{
				match: raw`\\.`,
				name: "constant.character.escape.gsc"
			}]
		},
		"keyword-control": {
			match: raw`\b(${keywords.join("|")})\b`,
			name: "keyword.control.gsc"
		},
		"variable-animation": {
			match: raw`%[A-Za-z_][A-Za-z0-9_]*\b`,
			name: "variable.other.constant.animation.gsc"
		},
		"keyword-operator": {
			patterns: [{
				match: raw`(!|&&|\|\|)`,
				name: "keyword.operator.logical.gsc"
			}, {
				match: raw`(&|\||\^|<<|>>)=`,
				name: "keyword.operator.assignment.bitwise.gsc"
			}, {
				match: raw`(&|\||\^|<<|>>|~)`,
				name: "keyword.operator.bitwise.gsc"
			}, {
				match: raw`(--|\+\+)`,
				name: "keyword.operator.increment-decrement.gsc"
			}, {
				match: raw`[-+*/%]=`,
				name: "keyword.operator.assignment.arithmetic.gsc"
			}, {
				match: raw`[-+*/%]`,
				name: "keyword.operator.arithmetic.gsc"
			}, {
				match: raw`(==|!=|<=|>=|<|>)`,
				name: "keyword.operator.comparison.gsc"
			}, {
				match: raw`=`,
				name: "keyword.operator.assignment.gsc"
			}]
		},
		"number": {
			match: raw`(\b|\.)\d+\b`,
			name: "constant.numeric.decimal.gsc"
		},
		"special": {
			patterns: [{
				match: raw`\b(true|false|undefined)\b`,
				name: "constant.language.gsc"
			}, {
				match: raw`\b(?<=\.)size\b`,
				name: "support.constant.property.gsc"
			}, {
				match: raw`\b\.(self|level|game|anim)\b`,
				captures: {
					"1": { name: "invalid.illegal.field.gsc" }
				}
			}, {
				match: raw`\b(self|level|game|anim)\b`,
				name: "support.constant.gsc"
			}]
		},
		"functions": {
			patterns: [
				{ include: "#function-reference" },
				{ include: "#function" }
			]
		},
		// Handled via semantic highlighting now:
		// "function-declaration": {
		// 	// To somewhat accomodate root-level function calls (usually invalid but good for code examples):
		// 	// Prevent if `;` is in same line: Won't work for multiline function calls but better than nothing.
		// 	begin: raw`^\b([A-Za-z_][A-Za-z0-9_]*)\b\s*\((?!.*;)`,
		// 	end: raw`\)`,
		// 	name: "meta.function.gsc",
		// 	beginCaptures: {
		// 		"1": { name: "entity.name.function.gsc" }
		// 	},
		// 	patterns: [{
		// 		include: "#comment"
		// 	}, {
		// 		match: raw`\b[A-Za-z_][A-Za-z0-9_]*\b`,
		// 		name: "variable.parameter.gsc"
		// 	}]
		// },
		"function": {
			begin: raw`\b(?:([\w\\/]*)\s*(::)\s*)?\b([A-Za-z_][A-Za-z0-9_]*)\b\s*\(`,
			end: raw`\)`,
			name: "meta.function.gsc",
			beginCaptures: {
				"1": { patterns: [{ include: "#path" }] },
				"2": { name: "keyword.control.function.gsc" },
				"3": { name: "entity.name.function.gsc" }
			},
			patterns: [{ include: "$self" }]
		},
		"function-reference": {
			match: raw`(\b[\w\\/]*)?\s*(::)\s*\b([A-Za-z_][A-Za-z0-9_]*)\b\s*(?!\()`,
			name: "meta.function-reference.gsc",
			captures: {
				"1": { patterns: [{ include: "#path" }] },
				"2": { name: "keyword.control.function.gsc" },
				"3": { name: "entity.name.function.gsc" }
			}
		},
		"expression-evaluation": {
			begin: raw`\[\[`,
			end: raw`\]\]`,
			patterns: [{ include: "$self" }],
			name: "meta.expression-evaluation.gsc"
		},
		"punctuation": {
			patterns: [{
				match: raw`\b(\.)\b`,
				captures: { 1: { name: "punctuation.accessor.gsc" } }
			}, {
				match: ",",
				name: "punctuation.separator.comma.gsc"
			}, {
				match: ";",
				name: "punctuation.terminator.statement.gsc"
			}]
		},
		"variable": {
			patterns: [{
				match: raw`\b[A-Z_][A-Z0-9_]*\b`,
				name: "variable.other.constant.gsc"
			}, {
				match: raw`\b[A-Za-z_][A-Za-z0-9_]*\b`,
				name: "variable.other.readwrite.gsc"
			}]
		},
		"path": {
			patterns: [{
				match: raw`.*[^A-Za-z0-9_\\].*`,
				name: "invalid.illegal.import.path.gsc"
			}, {
				match: ".*",
				name: "storage.modifier.import.path.gsc"
			}]
		}
	},
	scopeName: `source.gsc.${engine}`
});
