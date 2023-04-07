import * as vscode from "vscode";
import * as path from "path";

import buildStaticData from "./static";
import { uriToGscPath } from "./util";
import {
	parseIgnoredBlocks,
	parseTopLevelBlocks,
	parseFunctionDefs,
	parseCallableInstances
} from "./parse";
import {
	createFolderCompletionItem,
	createFileCompletionItem,
	createCallableCompletionItem,
	createSignatures
} from "./items";

type StaticData = Awaited<ReturnType<typeof buildStaticData>>;

export default class Store {
	#staticData: StaticData;
	#cache = {
		gscPathItemsMap: new Map<string, vscode.CompletionItem[]>()
	};

	constructor(staticData: StaticData) {
		this.#staticData = staticData;
	}

	async getGscPathCompletionItems(partialPath: string, token: vscode.CancellationToken) {
		const split = partialPath.split("\\");
		const matchingRootFolders = this.#staticData.config.rootFolders.filter(({ root }) => root === split[0]);
		if (matchingRootFolders.length < 1) return [];
		const pathAfterRootStr = split.slice(1, -1).join("/");
		const pathStr = matchingRootFolders[0].root + "/" + pathAfterRootStr;

		// Try to get cached items
		let items = this.#cache.gscPathItemsMap.get(pathStr);

		if (!items) {
			// Temporarily store items array as a map to easily override old entries on duplicates
			const itemsMap = new Map<string, vscode.CompletionItem>();
			for (const { uri: rootUri } of matchingRootFolders) {
				const uri = vscode.Uri.joinPath(rootUri, pathAfterRootStr);
				const pathExists = await vscode.workspace.fs.stat(uri).then(() => true, () => false);
				if (!pathExists) continue;

				if (token?.isCancellationRequested) return [];

				const dir = await vscode.workspace.fs.readDirectory(uri);
				for (const [name, fileType] of dir) {
					switch (fileType) {
						case vscode.FileType.Directory:
							itemsMap.set(name, createFolderCompletionItem(name, this.#staticData.config.foldersSorting === "top"));
							break;
						default:
							if ([".gsc", ".csc"].includes(path.parse(name).ext))
								itemsMap.set(name, createFileCompletionItem(name, this.#staticData.config.foldersSorting === "bottom"));
					}
				}
			}
			items = [...itemsMap.values()];
			// Cache result
			this.#cache.gscPathItemsMap.set(pathStr, items);
			setTimeout(() => this.#cache.gscPathItemsMap.delete(pathStr), 5000);
		}

		return items;
	}

	getCallableCompletionItems(document: vscode.TextDocument) {
		const defs = parseFunctionDefs(document, parseTopLevelBlocks(document, parseIgnoredBlocks(document)));
		const defsArray = [...defs.values()];
		const relativePath = uriToGscPath(document.uri, this.#staticData.config.rootFolders);
		return [...defsArray.map(decl => {
			return createCallableCompletionItem({
				ident: decl.ident.name,
				params: decl.params.map(param => ({ name: param.name })),
				path: relativePath
			});
		}), ...this.#staticData.completionItems];
	}

	getHover(identifier: string) {
		const hover = this.#staticData.hovers[identifier.toLowerCase()];
		if (!hover) return undefined;
		return hover;
	}

	getSignatures(identifier: string, document: vscode.TextDocument) {
		const identLc = identifier.toLowerCase();
		const staticMatch = this.#staticData.signatureGroups[identLc];
		if (staticMatch) return staticMatch;

		const defs = parseFunctionDefs(document, parseTopLevelBlocks(document, parseIgnoredBlocks(document)));
		const def = defs.get(identLc);
		if (!def) return [];

		return createSignatures({
			ident: def.ident.name,
			params: def.params.map(param => ({ name: param.name }))
		});
	}

	getCallableDefinition(document: vscode.TextDocument, range: vscode.Range) {
		const identifier = document.getText(range);
		const ignoredBlocks = parseIgnoredBlocks(document);
		const defs = parseFunctionDefs(document, parseTopLevelBlocks(document, ignoredBlocks), ignoredBlocks);
		const def = defs.get(identifier.toLowerCase());

		if (!def) return undefined;
		if (range.isEqual(def.ident.range)) return undefined;
		return new vscode.Location(document.uri, def.ident.range);
	}

	getInlayHints(document: vscode.TextDocument, range: vscode.Range) {
		const ignoredBlocks = parseIgnoredBlocks(document);
		const topLevelBlocks = parseTopLevelBlocks(document, ignoredBlocks);
		const defs = parseFunctionDefs(document, topLevelBlocks, ignoredBlocks);
		const callableInstances = parseCallableInstances(document, topLevelBlocks, ignoredBlocks); // TODO: filter in here

		const res = callableInstances.filter(({ ident: { name: str } }) => {
			const identLC = str.toLowerCase();
			return this.#staticData.callableDefsFlat.has(identLC) || defs.has(identLC);
		}).flatMap(callable => {
			if (!callable.params) return [];
			const identLC = callable.ident.name.toLowerCase();
			const def = this.#staticData.callableDefsFlat.get(identLC) || defs.get(identLC);
			if (!def) return [];
			const paramDefs = def.params || [];
			if (!paramDefs) return [];

			const paramHints = [];
			for (const [i, param] of callable.params.entries()) {
				if (!paramDefs[i]) break;
				paramHints.push({
					position: param.range.start,
					label: `${paramDefs[i].name}:`,
					kind: vscode.InlayHintKind.Parameter,
					paddingRight: true
				});
			}
			return paramHints;
		});
		return res;
	}
}
