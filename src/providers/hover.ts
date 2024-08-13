import * as vscode from "vscode";

import type { Stores } from "../stores";
import type { Settings } from "../settings";

import { getDef, isCall, isReference, createDocumentation } from "./shared";
import { getIsPosInsideParsedBlocks } from "../parse";

export const createHoverProvider = (stores: Stores, settings: Settings): vscode.HoverProvider => ({
	async provideHover(document, position, token) {
		if (getIsPosInsideParsedBlocks(await stores.gsc.getFile(document).getIgnoredBlocks(), position))
			return;
		if (token.isCancellationRequested) return;

		const wordRange = document.getWordRangeAtPosition(position, /[A-Za-z_][A-Za-z0-9_]*/);
		if (!wordRange) return;
		if (!isCall(wordRange, document) && !isReference(wordRange, document)) return;

		const word = document.getText(wordRange);
		const def = await getDef(word, document, stores);
		if (token.isCancellationRequested) return;
		if (!def) return;

		const concise = settings.intelliSense.conciseMode.value;
		return createHover(createDocumentation(def, document.languageId, { concise, example: false }));
	},
});

const createHover = (markdown: vscode.MarkdownString): vscode.Hover => {
	return new vscode.Hover(markdown);
};
