import * as vscode from "vscode";

import type { Stores } from "../stores";

import { escapeRegExp } from "../util";

export const createSemanticTokensProvider = (
	stores: Stores,
): vscode.DocumentSemanticTokensProvider => ({
	async provideDocumentSemanticTokens(document, token) {
		return await provideSemanticTokens(stores, document, token);
	},
});

export const createRangeSemanticTokensProvider = (
	stores: Stores,
): vscode.DocumentRangeSemanticTokensProvider => ({
	async provideDocumentRangeSemanticTokens(document, range, token) {
		return await provideSemanticTokens(stores, document, token, range);
	},
});

export const semanticTokensLegend = (() => {
	const types = ["function", "method", "parameter"];
	const modifiers = ["definition", "defaultLibrary", "deprecated"];
	return new vscode.SemanticTokensLegend(types, modifiers);
})();

const provideSemanticTokens = async (
	stores: Stores,
	document: vscode.TextDocument,
	token: vscode.CancellationToken,
	range?: vscode.Range,
) => {
	const builder = new vscode.SemanticTokensBuilder();
	const file = stores.gsc.getFile(document);

	const defs = await file.getCallableDefs();
	if (token.isCancellationRequested) return;
	const usages = await file.getCallableInstances();
	if (token.isCancellationRequested) return;

	const defsIterable = range ? defs.byRange.getIn(range, true) : defs.byRange;
	for (const { value: def } of defsIterable) {
		const { name, params, body } = def;
		builder.push(name.range.start.line, name.range.start.character, name.name.length, 0, 0b1);
		for (const { range } of params) {
			const length = document.offsetAt(range.end) - document.offsetAt(range.start);
			builder.push(range.start.line, range.start.character, length, 2, 0b1);
		}
		for (const { range } of body.variables.params) {
			const length = document.offsetAt(range.end) - document.offsetAt(range.start);
			builder.push(range.start.line, range.start.character, length, 2);
		}
	}

	const usagesIterable = range ? usages.byRange.getIn(range) : usages.byRange;
	for (const { value: usage } of usagesIterable) {
		const def = usage.def;
		if (!def) continue;
		if (def.origin === "game") {
			const start = usage.name.range.start;
			const length = usage.name.text.length;
			const type = def.receiver ? 1 : 0;
			const modifiers = def.deprecated ? 0b110 : 0b010;
			builder.push(start.line, start.character, length, type, modifiers);
		}
	}

	return builder.build();
};
