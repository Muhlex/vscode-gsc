import * as vscode from "vscode";

import type { Stores } from "../models/Store";

export const createDefinitionProvider = (stores: Stores): vscode.DefinitionProvider => ({
	async provideDefinition(document, position, token) {
		const filesystem = await stores.gsc.getFilesystem(document);
		const script = filesystem.getScriptByResource(document);
		if (!script) return;

		const wordRange = document.getWordRangeAtPosition(position, /[A-Za-z_][\w]*/);
		if (!wordRange) return;

		const instances = await script.getCallableInstancesDefined();
		if (token.isCancellationRequested) return;

		const def = instances.byOffset.get(document.offsetAt(wordRange.start))?.def;
		if (!def || def.origin !== "script") return;

		return new vscode.Location(def.file.uri, def.ident.range);
	},
});
