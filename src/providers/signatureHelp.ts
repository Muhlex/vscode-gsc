import * as vscode from "vscode";

import type { Stores } from "../stores";
import type { CallableDef } from "../models/Def";

import { getRangesAtPos, getRangeIndicesAtPos } from "../ranges";
import { getVariableString } from "./shared";
import { rangeEnclosesPosition } from "../util";

export const createSignatureHelpProvider = (stores: Stores): vscode.SignatureHelpProvider => ({
	async provideSignatureHelp(document, position, token, _context) {
		const file = stores.gsc.getFile(document);
		const callableInstances = await file.getCallableInstances();
		if (token.isCancellationRequested) return;

		const instancesAtPos = getRangesAtPos(
			callableInstances.list,
			position,
			(instance) => instance.range,
		);
		// Math.floor(Math.ceil(123));
		console.log(
			instancesAtPos.map((i) => ({
				text: document.getText(i.range),
				range: i.range,
				encloses: rangeEnclosesPosition(i.range, position)
			})),
		);

		for (let i = instancesAtPos.length - 1; i >= 0; i--) {
			const instance = instancesAtPos[i];
			if (!instance?.params) continue;

			const activeParameter = getRangeIndicesAtPos(
				instance.params,
				position,
				(param) => param.range,
				false,
			)[0];
			if (activeParameter === undefined) continue;

			const def = instance?.def;
			if (!def) return;
			return {
				signatures: createSignatures(def),
				activeSignature: 0,
				activeParameter,
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
