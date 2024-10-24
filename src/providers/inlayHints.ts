import * as vscode from "vscode";

import type { Stores } from "../stores";

export const createInlayHintsProvider = (stores: Stores): vscode.InlayHintsProvider => ({
	async provideInlayHints(document, range, token) {
		const result: vscode.InlayHint[] = [];
		const instances = await stores.gsc.getFile(document).getCallableInstances();
		if (token.isCancellationRequested) return;

		for (const instance of instances.list) {
			const def = instance.def;
			if (!def || !def.params) continue;
			if (!instance.params || instance.params.length < 1) continue;
			if (range.start.isAfter(instance.params[instance.params.length - 1].range.start)) continue;
			if (range.end.isBefore(instance.params[0].range.start)) break;

			for (const [i, param] of instance.params.entries()) {
				if (!def.params[i]) break;
				result.push({
					position: param.range.start,
					label: `${def.params[i].name}:`,
					kind: vscode.InlayHintKind.Parameter,
					paddingRight: true,
				});
			}
		}

		return result;
	},
});
