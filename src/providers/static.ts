import * as vscode from "vscode";

import type { CallableDefsEngine, CallableDefGame } from "../types/Defs";
import {
	createKeywordCompletionItem,
	createCallableCompletionItem,
	createFolderCompletionItem,
	createHover,
	createSignatures,
	createDocumentation
} from "./items";

export const loadStaticData = async (engine: string, defsUri: vscode.Uri) => {
	const config: {
		featuresets: { [featureset: string]: boolean }
		enableKeywords: boolean
		enableCallables: boolean
		conciseMode: boolean
		foldersSorting: "top" | "bottom" | "inline"
		rootUris: vscode.Uri[]
	} = await (async () => {
		const intelliSense = vscode.workspace.getConfiguration("GSC.intelliSense");
		return {
			featuresets: vscode.workspace.getConfiguration("GSC.featureSets").get(engine.toUpperCase()) ?? {},
			enableKeywords: intelliSense.get("enableKeywords") ?? true,
			enableCallables: intelliSense.get("enableCallables") ?? true,
			conciseMode: intelliSense.get("conciseMode") ?? false,
			foldersSorting: intelliSense.get("foldersSorting") ?? "inline",
			rootUris: await (async () => {
				const paths: string[] = vscode.workspace.getConfiguration("GSC.rootFolders").get(engine.toUpperCase()) ?? [];
				const uris = await Promise.all(paths.map(async (path) => {
					try {
						const uri = vscode.Uri.file(path);
						await vscode.workspace.fs.stat(uri);
						return uri;
					} catch {
						vscode.window.showWarningMessage(`Invalid ${engine.toUpperCase()} GSC root directory: "${path}" Review your extension settings.`);
					}
				}));
				return uris.filter((uri): uri is vscode.Uri => uri !== undefined);
			})(),
		};
	})();

	const completionItems: vscode.CompletionItem[] = [];
	const hovers: { [ident: string]: vscode.Hover } = {};
	const signatureGroups: { [ident: string]: vscode.SignatureInformation[] } = {};

	// Keywords
	const keywordsPath = [...defsUri.path.split("/"), engine, "keyword.json"].join("/");
	const keywordDefs: string[] = JSON.parse(
		(await vscode.workspace.fs.readFile(vscode.Uri.file(keywordsPath))).toString()
	);
	if (config.enableKeywords) {
		for (const def of keywordDefs) {
			completionItems.push(createKeywordCompletionItem(def));
		}
	}

	// Functions & Methods
	const callablesPath = [...defsUri.path.split("/"), engine, "callable.json"].join("/");
	const callableDefsEngine: CallableDefsEngine = JSON.parse(
		(await vscode.workspace.fs.readFile(vscode.Uri.file(callablesPath))).toString()
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
				const documentation = createDocumentation(callableDef, engine, Boolean(config.conciseMode));

				callableDefs.set(identLc, callableDef);
				if (config.enableCallables) {
					completionItems.push(createCallableCompletionItem(callableDef, false, documentation));
				}
				hovers[identLc] = createHover(documentation);
				signatureGroups[identLc] = createSignatures(callableDef);
			}
		}
	}

	// GSC path roots
	// TODO: Recreate with GscStore
	// for (const [gscPathRoot] of config.rootFolders) {
	// 	completionItems.push(createFolderCompletionItem(gscPathRoot));
	// }

	// TODO: remove unused stuff

	return {
		config,
		defs: {
			keyword: keywordDefs,
			callable: callableDefs,
		}
	};
};

export type StaticData = Awaited<ReturnType<typeof loadStaticData>>;
