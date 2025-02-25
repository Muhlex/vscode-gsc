import * as vscode from "vscode";

import type { Stores } from "../stores";

export const createInlayHintsProvider = (stores: Stores): vscode.InlayHintsProvider => ({
	async provideInlayHints(document, range, token) {
		const result: vscode.InlayHint[] = [];
		const usages = await stores.gsc.getFile(document).getCallableInstances();
		if (token.isCancellationRequested) return;

		for (const { range, value: usage } of usages.byRange) {
			const def = usage.def;
			if (!def || !def.params) continue;
			if (usage.kind !== "call") continue;
			if (range.start.isAfter(usage.paramList.range.start)) continue;
			if (range.end.isBefore(usage.paramList.range.start)) break;

			for (let i = 0; i < usage.params.length; i++) {
				if (!def.params[i]) break;
				const contentRange = usage.params.getByIndex(i)!.value.contentRange;
				if (!contentRange) continue;
				result.push({
					position: contentRange.start,
					label: `${def.params[i].name}:`,
					kind: vscode.InlayHintKind.Parameter,
					paddingRight: true,
				});
				i++;
			}
		}

		return result;
	},
});
