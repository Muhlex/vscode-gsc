import * as vscode from "vscode";

import type { Stores } from "../stores";

export const createInlayHintsProvider = (stores: Stores): vscode.InlayHintsProvider => ({
	async provideInlayHints(document, range, token) {
		const result: vscode.InlayHint[] = [];
		const instances = await stores.gsc.getFile(document).getCallableInstances();
		if (token.isCancellationRequested) return;

		for (const { range, value: instance } of instances.tree) {
			const def = instance.def;
			if (!def || !def.params) continue;
			if (instance.kind !== "call") continue;
			if (range.start.isAfter(instance.paramList.range.start)) continue;
			if (range.end.isBefore(instance.paramList.range.start)) break;

			for (let i = 0; i < instance.params.length; i++) {
				if (!def.params[i]) break;
				const contentRange = instance.params.atIndex(i)!.value.contentRange;
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
