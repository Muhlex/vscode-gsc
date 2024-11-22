import * as vscode from "vscode";

import type { Stores } from "../stores";
import type { Settings } from "../settings";

import { createDocumentation } from "./shared";

export const createHoverProvider = (stores: Stores, settings: Settings): vscode.HoverProvider => ({
	async provideHover(document, position, token) {
		const wordRange = document.getWordRangeAtPosition(position, /[A-Za-z_][\w]*/);
		if (!wordRange) return;

		const instances = await stores.gsc.getFile(document).getCallableInstances();
		if (token.isCancellationRequested) return;
		const instance = instances.byOffset.get(document.offsetAt(wordRange.start));
		const def = instance?.def;
		if (!def) return;

		const concise = settings.intelliSense.conciseMode.value;
		return createHover(createDocumentation(def, document.languageId, { concise, example: false }));
	},
});

const createHover = (markdown: vscode.MarkdownString): vscode.Hover => {
	return new vscode.Hover(markdown);
};
