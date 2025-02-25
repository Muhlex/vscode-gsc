import * as vscode from "vscode";

import type { Stores } from "../models/Store";

const nullRange = new vscode.Range(0, 0, 0, 0);

export const createDefinitionProvider = (stores: Stores): vscode.DefinitionProvider => ({
	async provideDefinition(document, position, token) {
		const file = stores.gsc.getFile(document);
		if (!file) return;
		const filesystem = await stores.gsc.getFilesystem(document);
		if (token.isCancellationRequested) return;
		const script = filesystem.getScriptByFile(file);
		if (!script) return;

		const wordRange = document.getWordRangeAtPosition(position, /[\w\\]+/);
		if (!wordRange) return;

		const getIncludeLink = async (): Promise<vscode.DefinitionLink | undefined> => {
			const includes = await file.getIncludes();
			if (token.isCancellationRequested) return;
			const include = includes.byRange.getAt(position)?.value;
			if (!include || !include.path.range.isEqual(wordRange)) return;

			const includedScripts = await script.getIncludedScripts();
			if (token.isCancellationRequested) return;
			const includedScript = includedScripts.get(include.path.text);
			if (!includedScript) return;

			return {
				targetUri: includedScript.file.uri,
				targetRange: nullRange,
				originSelectionRange: wordRange,
			};
		};

		const getCallableLink = async (): Promise<vscode.DefinitionLink | undefined> => {
			const usages = await file.getCallableUsages();
			if (token.isCancellationRequested) return;
			const defs = await script.getCallableUsageDefs();
			if (token.isCancellationRequested) return;

			const usage = usages.getAt(position).at(-1)?.value;
			if (!usage) return;
			const def = defs.get(usage);
			if (!def || def.origin !== "script") return;

			const isName = usage.name.range.isEqual(wordRange);
			if (!(isName || usage.path?.range.isEqual(wordRange))) return;

			return {
				targetUri: def.file.uri,
				targetRange: isName ? def.name.range : nullRange,
				originSelectionRange: wordRange,
			};
		}

		const link = await getIncludeLink() ?? await getCallableLink();
		if (!link) return;
		return [link]
	},
});
