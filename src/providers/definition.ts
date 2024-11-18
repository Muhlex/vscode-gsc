import * as vscode from "vscode";

import type { Stores } from "../stores";

export const createDefinitionProvider = (stores: Stores): vscode.DefinitionProvider => ({
	async provideDefinition(document, position, token) {
		const file = stores.gsc.getFile(document);

		const wordRange = document.getWordRangeAtPosition(position, /[A-Za-z_][A-Za-z0-9_]*/);
		if (!wordRange) return;

		const instances = await file.getCallableInstances();
		if (token.isCancellationRequested) return;

		const def = instances.byOffset.get(document.offsetAt(wordRange.start))?.def;
		if (!def || def.origin !== "script") return;

		return new vscode.Location(def.file.uri, def.ident.range);
	},
});
