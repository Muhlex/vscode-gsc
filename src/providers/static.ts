import * as vscode from "vscode";

import { CallableDefsEngine, CallableDef } from "../types/Defs";
import {
	createKeywordCompletionItem,
	createCallableCompletionItem,
	createFolderCompletionItem,
	createHover,
	createSignatures,
	createDocumentation
} from "./items";

export default async (engine: string, defsUri: vscode.Uri) => {
	const config: {
		featuresets: { [featureset: string]: boolean } | undefined
		enableKeywords: boolean
		enableCallables: boolean
		conciseMode: boolean
		foldersSorting: "top" | "bottom" | "inline"
		rootFolders: Map<string, vscode.Uri[]>
	} = await (async () => {
		const intelliSense = vscode.workspace.getConfiguration("GSC.intelliSense");
		return {
			featuresets: vscode.workspace.getConfiguration("GSC.featureSets").get(engine.toUpperCase()),
			enableKeywords: intelliSense.get("enableKeywords") ?? true,
			enableCallables: intelliSense.get("enableCallables") ?? true,
			conciseMode: intelliSense.get("conciseMode") ?? false,
			foldersSorting: intelliSense.get("foldersSorting") ?? "inline",
			rootFolders: await (async () => {
				const rootFolderPaths: string[] = vscode.workspace.getConfiguration("GSC.rootFolders").get(engine.toUpperCase()) || [];
				const rootFolders = new Map<string, vscode.Uri[]>();
				for (const folderPath of rootFolderPaths) {
					const uri = vscode.Uri.file(folderPath);
					const gscPathRoot = uri.path.split("/").at(-1) as string;
					try {
						await vscode.workspace.fs.stat(uri);

						const entry = rootFolders.get(gscPathRoot);
						if (entry) entry.push(uri);
						else rootFolders.set(gscPathRoot, [uri]);
					} catch (error) {
						vscode.window.showWarningMessage(`Error registering ${engine.toUpperCase()} GSC root directory: "${folderPath}"\\nReview your extension settings.`);
					}
				}
				return rootFolders;
			})()
		};
	})();

	const completionItems: vscode.CompletionItem[] = [];
	const hovers: { [ident: string]: vscode.Hover } = {};
	const signatureGroups: { [ident: string]: vscode.SignatureInformation[] } = {};

	// Keywords
	const keywordsPath = [...defsUri.path.split("/"), engine, "keyword.json"].join("/");
	const keywordDefsEngine: string[] = JSON.parse(
		(await vscode.workspace.fs.readFile(vscode.Uri.file(keywordsPath))).toString()
	);
	if (config.enableKeywords) {
		keywordDefsEngine.forEach(keywordDef => {
			completionItems.push(createKeywordCompletionItem(keywordDef));
		});
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

	const callableDefsFlat: Map<string, CallableDef> = new Map();

	for (const featureset in callableDefsEngineFiltered) {
		const callableDefsFeatureset = callableDefsEngineFiltered[featureset];
		for (const module in callableDefsFeatureset) {
			const callableDefsModule = callableDefsFeatureset[module];
			for (const ident in callableDefsModule) {
				const callableDef = callableDefsModule[ident];
				const identLc = ident.toLowerCase();
				const documentation = createDocumentation(callableDef, engine, Boolean(config.conciseMode));

				callableDefsFlat.set(identLc, callableDef);
				if (config.enableCallables) {
					completionItems.push(createCallableCompletionItem(callableDef, documentation));
				}
				hovers[identLc] = createHover(documentation);
				signatureGroups[identLc] = createSignatures(callableDef);
			}
		}
	}

	// GSC path roots
	for (const [gscPathRoot] of config.rootFolders) {
		completionItems.push(createFolderCompletionItem(gscPathRoot));
	}

	return {
		config,
		keywordDefs: keywordDefsEngine,
		callableDefsFlat,
		completionItems,
		hovers,
		signatureGroups
	};
};
