import * as vscode from "vscode";

import type { CallableDefsEngine, CallableDefGame } from "../types/Defs";

export const loadStaticData = async (engine: string, defsUri: vscode.Uri) => {
	const config: {
		featuresets: { [featureset: string]: boolean };
		intelliSense: {
			enableKeywords: boolean;
			enableCallablesGame: "off" | "non-deprecated" | "all";
			enableCallablesScript: boolean;
			conciseMode: boolean;
			foldersSorting: "top" | "bottom" | "inline";
		};
		rootUris: vscode.Uri[];
	} = await (async () => {
		return {
			featuresets:
				vscode.workspace.getConfiguration("GSC.featureSets").get(engine.toUpperCase()) ?? {},
			intelliSense: (() => {
				const config = vscode.workspace.getConfiguration("GSC.intelliSense");
				return {
					enableKeywords: config.get("components.keywords") ?? true,
					enableCallablesGame: config.get("components.callablesGame") ?? "non-deprecated",
					enableCallablesScript: config.get("components.callablesScript") ?? true,
					conciseMode: config.get("conciseMode") ?? false,
					foldersSorting: config.get("foldersSorting") ?? "inline",
				};
			})(),
			rootUris: await (async () => {
				const paths: string[] =
					vscode.workspace.getConfiguration("GSC.rootFolders").get(engine.toUpperCase()) ?? [];
				const uris = await Promise.all(
					paths.map(async (path) => {
						try {
							const uri = vscode.Uri.file(path);
							await vscode.workspace.fs.stat(uri);
							return uri;
						} catch {
							vscode.window.showWarningMessage(
								`Invalid ${engine.toUpperCase()} GSC root directory: "${path}" Review your extension settings.`,
							);
						}
					}),
				);
				return uris.filter((uri): uri is vscode.Uri => uri !== undefined);
			})(),
		};
	})();

	// Keywords
	const keywordsPath = [...defsUri.path.split("/"), engine, "keyword.json"].join("/");
	const keywordDefs: string[] = JSON.parse(
		(await vscode.workspace.fs.readFile(vscode.Uri.file(keywordsPath))).toString(),
	);

	// Functions & Methods (Callables)
	const callablesPath = [...defsUri.path.split("/"), engine, "callable.json"].join("/");
	const callableDefsEngine: CallableDefsEngine = JSON.parse(
		(await vscode.workspace.fs.readFile(vscode.Uri.file(callablesPath))).toString(),
	);
	const callableDefsEngineFiltered: CallableDefsEngine = {};

	for (const featureset in config.featuresets) {
		if (!config.featuresets[featureset]) continue;
		callableDefsEngineFiltered[featureset] = callableDefsEngine[featureset];
	}

	const callableDefs: Map<string, CallableDefGame> = new Map();

	for (const featureset in callableDefsEngineFiltered) {
		const callableDefsFeatureset = callableDefsEngineFiltered[featureset];
		for (const module in callableDefsFeatureset) {
			const callableDefsModule = callableDefsFeatureset[module];
			for (const ident in callableDefsModule) {
				const callableDef = callableDefsModule[ident];
				callableDef.origin = "game";

				const identLc = ident.toLowerCase();
				const existingDef = callableDefs.get(identLc);
				if (existingDef && (existingDef.priority ?? 0) >= (callableDef.priority ?? 0)) continue;
				callableDefs.set(identLc, callableDef);
			}
		}
	}

	return {
		config,
		defs: {
			keyword: keywordDefs,
			callable: callableDefs,
		},
	};
};

export type StaticData = Awaited<ReturnType<typeof loadStaticData>>;
