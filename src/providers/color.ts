import * as vscode from "vscode";

import type { Settings } from "../settings";
import type { Stores } from "../stores";

export const createColorProvider = (
	stores: Stores,
	settings: Settings,
): vscode.DocumentColorProvider => ({
	provideColorPresentations(color, context, _token) {
		const toBase = (value: number, base = 255) => `${Math.round(value * base)}/${base}`;
		const labels = [
			`(${color.red.toFixed(2)}, ${color.green.toFixed(2)}, ${color.blue.toFixed(2)})`,
			`(${toBase(color.red)}, ${toBase(color.green)}, ${toBase(color.blue)})`,
		];
		return labels.map((label) => ({
			label,
			textEdit: vscode.TextEdit.replace(context.range, label),
		}));
	},
	async provideDocumentColors(document, token) {
		if (settings.colors.enable.value === "off") return;

		const ignoredFragments = await stores.gsc.getFile(document).getIgnoredSegments();
		if (token.isCancellationRequested) return;

		const regExp =
			/\(\s*(?<r>\d*\.?\d+)\s*(?:\/\s*(?<rb>\d+))?\s*,\s*(?<g>\d*\.?\d+)\s*(?:\/\s*(?<gb>\d+))?\s*,\s*(?<b>\d*\.?\d+)\s*(?:\/\s*(?<bb>\d+))?\s*\)/dg;
		const result: vscode.ColorInformation[] = [];

		for (const match of document.getText().matchAll(regExp)) {
			const { r, rb, g, gb, b, bb } = match.groups!;
			if (settings.colors.enable.value === "quotients") {
				if ([rb, gb, bb].some((c) => c === undefined)) continue;
			}
			const getComponent = (value: string, base?: string) =>
				Number(value) / (base ? Number(base) : 1);
			const components: [number, number, number] = [
				getComponent(r, rb),
				getComponent(g, gb),
				getComponent(b, bb),
			];
			if (components.some((c) => c < 0 || c > 1)) continue;

			const color = new vscode.Color(...components, 1);

			const startIndex = match.indices![0][0];
			const endIndex = match.indices![0][1];
			const startPos = document.positionAt(startIndex);
			if (ignoredFragments.hasAt(startPos)) continue;

			const range = new vscode.Range(startPos, document.positionAt(endIndex));

			result.push({ color, range });
		}
		return result;
	},
});
