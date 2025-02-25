import * as vscode from "vscode";

import type { CallableDef } from "../models/Callable";
import type { Stores } from "../stores";

import { createParamsUsage } from "./shared";

export const createSignatureHelpProvider = (stores: Stores): vscode.SignatureHelpProvider => ({
	async provideSignatureHelp(document, position, token, _context) {
		const file = stores.gsc.getFile(document);
		const usages = await file.getCallableInstances();
		if (token.isCancellationRequested) return;

		const usagesAtPos = usages.byRange.getAt(position);
		for (let i = usagesAtPos.length - 1; i >= 0; i--) {
			const usage = usagesAtPos[i].value;
			if (usage.kind !== "call") continue;

			let activeParameterIndex = usage.params.indexAt(position, true);
			if (activeParameterIndex === -1) continue; // not inside parameter list

			const def = usage.def;
			if (!def?.params) return;

			if (def.paramsRepeatable === "last" && activeParameterIndex >= def.params.length) {
				activeParameterIndex = def.params.length - 1;
			} else if (def.paramsRepeatable === "all") {
				activeParameterIndex %= def.params.length;
			}

			return {
				signatures: createSignatures(def),
				activeSignature: 0,
				activeParameter: activeParameterIndex,
			};
		}
	},
});

const createSignatures = (def: CallableDef): vscode.SignatureInformation[] => {
	if (!def.params) return [];
	const paramsUsage = createParamsUsage(def);
	const parameters = paramsUsage.map((usage, i) => ({
		label: usage,
		documentation: new vscode.MarkdownString(def.params![i]?.description?.join("\n") ?? undefined),
	}));
	return [
		{
			label: `${def.name.text}(${parameters.map(({ label }) => label).join(", ")})`,
			parameters,
		},
	];
};
