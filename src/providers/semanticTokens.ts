import * as vscode from "vscode";

import type { Stores } from "../stores";

import { getIsPosInsideParsedBlocks } from "../parse";
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
	const ignoredBlocks = await file.getIgnoredBlocks();
	if (token.isCancellationRequested) return;

	const provideFromGame = () => {
		const text = document.getText(range);
		const callOrRef = /::\s*\b([A-Za-z_][A-Za-z0-9_]*)\b|\b([A-Za-z_][A-Za-z0-9_]*)\b\s*\(/dg;

		// Typescript doesn't yet know about .indices in RegExpMatchArray
		for (const match of text.matchAll(callOrRef) as IterableIterator<
			RegExpMatchArray & { indices: Array<[number, number]> }
		>) {
			const ident = match[1] || match[2];
			const def = stores.static.callables.get(ident.toLowerCase());
			if (!def) continue;

			const offset = range ? document.offsetAt(range.start) : 0;
			const index = (match.indices[1] || match.indices[2])[0];
			const startPos = document.positionAt(index + offset);

			if (getIsPosInsideParsedBlocks(ignoredBlocks, startPos)) continue;

			const type = def.receiver ? 1 : 0;
			const modifiers = def.deprecated ? 0b110 : 0b010;
			builder.push(startPos.line, startPos.character, ident.length, type, modifiers);
		}
	};

	const provideFromScript = async () => {
		const defs = await file.getCallableDefs();
		if (token.isCancellationRequested) return;

		for (const [, { ident, params, body }] of defs) {
			if (range && range.end.compareTo(ident.range.start) < 0) break;
			builder.push(ident.range.start.line, ident.range.start.character, ident.name.length, 0, 0b1);

			for (const param of params) {
				builder.push(
					param.range.start.line,
					param.range.start.character,
					param.name.length,
					2,
					0b1,
				);

				// Only respect the requested range for the function body as otherwise the checks
				// would be more expensive than just providing the semantic tokens out of range:
				if (range && !range.intersection(body.range)) continue;

				const extBody = {
					...body,
					text: document.getText(body.range),
					offset: document.offsetAt(body.range.start),
				};

				// Params in body
				// TODO: Parse these centrally to allow refactoring?
				const regexp = new RegExp(String.raw`\b(?<!\.)${escapeRegExp(param.name)}(?!\s*\()\b`, "g");
				const matches = extBody.text.matchAll(regexp) as IterableIterator<
					RegExpMatchArray & { index: number }
				>;
				for (const match of matches) {
					const startPos = document.positionAt(extBody.offset + match.index);
					if (getIsPosInsideParsedBlocks(ignoredBlocks, startPos)) continue;
					builder.push(startPos.line, startPos.character, param.name.length, 2);
				}
			}
		}
	};

	provideFromGame();
	await provideFromScript();

	return builder.build();
};
