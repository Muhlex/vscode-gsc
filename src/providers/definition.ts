import * as vscode from "vscode";

import type { Stores } from "../stores";

import { isCall, isReference } from "./shared";
import { getIsPosInsideParsedBlocks } from "../parse";

export const createDefinitionProvider = (stores: Stores): vscode.DefinitionProvider => ({
	async provideDefinition(document, position, token) {
		const file = stores.gsc.getFile(document);
		if (getIsPosInsideParsedBlocks(await file.getIgnoredBlocks(), position)) return;
		if (token.isCancellationRequested) return;

		const wordRange = document.getWordRangeAtPosition(position, /[A-Za-z_][A-Za-z0-9_]*/);
		if (!wordRange) return;
		if (!isCall(wordRange, document) && !isReference(wordRange, document)) return;

		const defs = await file.getCallableDefsInScope();
		if (token.isCancellationRequested) return;

		const ident = document.getText(wordRange);
		const def = defs.get(ident.toLowerCase());
		if (!def) return;
		if (wordRange.isEqual(def.ident.range)) return;

		return new vscode.Location(def.file.uri, def.ident.range);
	},
});
