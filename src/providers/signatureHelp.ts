import * as vscode from "vscode";

import type { Stores } from "../stores";
import type { CallableDef } from "../models/Def";

import { getVariableString } from "./shared";

export const createSignatureHelpProvider = (stores: Stores): vscode.SignatureHelpProvider => ({
	async provideSignatureHelp(document, position, token, _context) {
		const file = stores.gsc.getFile(document);
		const callableInstances = await file.getCallableInstances();
		if (token.isCancellationRequested) return;

		const instancesAtPos = callableInstances.byRange.getAt(position);
		for (let i = instancesAtPos.length - 1; i >= 0; i--) {
			const instance = instancesAtPos[i].value;
			if (instance.kind !== "call") continue;

			const activeParameterIndex = instance.params.indexAt(position, true);
			if (activeParameterIndex === -1) continue;

			const def = instance.def;
			if (!def) return;
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
	const parameters = def.params.map((p) => ({
		label: `${p.optional ? "[" : "<"}${getVariableString(p)}${p.optional ? "]" : ">"}`,
		documentation: new vscode.MarkdownString(p.description?.join("\n") || ""),
	}));
	return [
		{
			label: `${def.ident.name}(${parameters.map(({ label }) => label).join(", ")})`,
			parameters,
		},
	];
};
