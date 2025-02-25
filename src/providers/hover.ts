import * as vscode from "vscode";

import type { Settings } from "../settings";
import type { Stores } from "../stores";

import { createDocumentation, createUsage } from "./shared";

export const createHoverProvider = (stores: Stores, settings: Settings): vscode.HoverProvider => ({
	async provideHover(document, position, token) {
		const wordRange = document.getWordRangeAtPosition(position, /[A-Za-z_][\w]*/);
		if (!wordRange) return;

		const usages = await stores.gsc.getFile(document).getCallableInstances();
		if (token.isCancellationRequested) return;
		const usage = usages.byOffset.get(document.offsetAt(wordRange.start));
		const def = usage?.def;
		if (!def) return;

		const concise = settings.intelliSense.conciseMode.value;
		return new vscode.Hover([
			`\
\`\`\`txt
${createUsage(def)}
\`\`\``,
			createDocumentation(def, document.languageId, { concise, example: false }),
		]);
	},
});
