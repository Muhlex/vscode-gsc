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
	const instances = await file.getCallableInstances();
	if (token.isCancellationRequested) return;

	const defsIterable = range ? defs.byRange.getIn(range, true) : defs.byRange;
	for (const { value: def } of defsIterable) {
		const { ident, params, body } = def;
		builder.push(ident.range.start.line, ident.range.start.character, ident.name.length, 0, 0b1);
		for (const { range } of params) {
			const length = document.offsetAt(range.end) - document.offsetAt(range.start);
			builder.push(range.start.line, range.start.character, length, 2, 0b1);
		}
		for (const { range } of body.variables.params) {
			const length = document.offsetAt(range.end) - document.offsetAt(range.start);
			builder.push(range.start.line, range.start.character, length, 2);
		}
	}

	const instancesIterable = range ? instances.byRange.getIn(range) : instances.byRange;
	for (const { value: instance } of instancesIterable) {
		const def = instance.def;
		if (!def) continue;
		if (def.origin === "game") {
			const start = instance.ident.range.start;
			const length = instance.ident.name.length;
			const type = def.receiver ? 1 : 0;
			const modifiers = def.deprecated ? 0b110 : 0b010;
			builder.push(start.line, start.character, length, type, modifiers);
		}
	}

	return builder.build();
};
