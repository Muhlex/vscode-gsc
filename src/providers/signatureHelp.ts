import * as vscode from "vscode";

import type { CallableDef } from "../models/Def";
import type { Stores } from "../stores";

import { createParamsUsage } from "./shared";

export const createSignatureHelpProvider = (stores: Stores): vscode.SignatureHelpProvider => ({
	async provideSignatureHelp(document, position, token, _context) {
		const file = stores.gsc.getFile(document);
		const callableInstances = await file.getCallableInstances();
		if (token.isCancellationRequested) return;

		const instancesAtPos = callableInstances.byRange.getAt(position);
		for (let i = instancesAtPos.length - 1; i >= 0; i--) {
			const instance = instancesAtPos[i].value;
			if (instance.kind !== "call") continue;

			let activeParameterIndex = instance.params.indexAt(position, true);
			if (activeParameterIndex === -1) continue; // not inside parameter list

			const def = instance.def;
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
			label: `${def.ident.name}(${parameters.map(({ label }) => label).join(", ")})`,
			parameters,
		},
	];
};
