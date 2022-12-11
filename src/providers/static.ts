import * as vscode from "vscode";

import { CallableDefsEngine, CallableDef, FieldDef } from "../types/Defs";
import {
	createKeywordCompletionItem,
	createCallableCompletionItem,
	createFolderCompletionItem,
	createHover,
	createSignatures
} from "./items";

const createDocumentation = (def: CallableDef, engine: string, concise: boolean) => {
	const getVariableDoc = (f: FieldDef | undefined, name: string) => {
		if (!f) return "";

		return (concise ? `${name} *` : `*${name} `)
			+ (f.name ? ("`" + f.name + "`" + (f.type ? " " : "")) : "")
			+ (f.type || "")
			+ "*"
			+ (f.description ? (" — " + f.description.join("\n")) : "");
	};

	const receiver = getVariableDoc(def.receiver, concise ? "📥️" : "@receiver");
	const params = def.params?.map(p => getVariableDoc(p, concise ? (p.optional ? "✳️" : "✴️") : "@param")).join("\n\n") || "";
	const returns = getVariableDoc(def.return, concise ? "↩️" : "@return");

	return new vscode.MarkdownString(""
		+ (def.deprecated ? "**👎 Deprecated**\n\n" : "")
		+ (def.description?.join("\n") || "")
		+ "\n***\n"
		+ receiver + (receiver ? "\n\n" : "")
		+ params + (params ? "\n\n" : "")
		+ returns + (returns ? "\n\n" : "")
		+ (def.example
			? "\n***\n"
				+ (concise ? "" : "*Example:*\n")
				+ "```gsc-" + engine + "\n" + def.example.join("\n") + "\n```"
			: ""
		)
	);
};

export default async (engine: string, defsUri: vscode.Uri) => {
	const config: {
		featuresets: { [featureset: string]: boolean } | undefined
		enableKeywords: boolean | undefined
		enableCallables: boolean | undefined
		conciseMode: boolean | undefined
		foldersSorting: "top" | "bottom" | "inline" | undefined
		rootFolders: { root: string, uri: vscode.Uri }[]
	} = await (async () => {
		const intelliSense = vscode.workspace.getConfiguration("GSC.intelliSense");
		return {
			featuresets: vscode.workspace.getConfiguration("GSC.featureSets").get(engine.toUpperCase()),
			enableKeywords: intelliSense.get("enableKeywords"),
			enableCallables: intelliSense.get("enableCallables"),
			conciseMode: intelliSense.get("conciseMode"),
			foldersSorting: intelliSense.get("foldersSorting"),
			rootFolders: await (async () => {
				const rootFoldersRaw: string[] = vscode.workspace.getConfiguration("GSC.rootFolders").get(engine.toUpperCase()) || [];
				const rootFolders = [];
				for (const folderPath of rootFoldersRaw) {
					const uri = vscode.Uri.file(folderPath);
					const root = uri.path.split("/").at(-1) as string;
					try {
						await vscode.workspace.fs.stat(uri);
						rootFolders.push({ root, uri });
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

	// GSC Paths
	const roots = new Set<string>();
	for (const path of config.rootFolders) {
		if (roots.has(path.root)) continue; // handle multiple root folders with the same name
		completionItems.push(createFolderCompletionItem(path.root));
		roots.add(path.root);
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
