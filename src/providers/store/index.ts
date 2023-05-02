import * as vscode from "vscode";
import * as path from "path";

import { GscStore } from "./GscStore";
import { FileStore, File, FileCache } from "./FileStore";
import { CallableDef } from "../../types/Defs";
import { CallableInstance } from "../../types/Instances";
import createStaticData from "../static";
import {
	parseIgnoredBlocks,
	parseTopLevelBlocks,
	parseCallableDefs,
	parseCallableInstances,
} from "../parse";
import {
	createFolderCompletionItem,
	createFileCompletionItem,
	createCallableCompletionItem,
	createSignatures
} from "../items";

export default class Store {
	private staticData: Awaited<ReturnType<typeof createStaticData>>;
	private disposables: vscode.Disposable[] = [];
	private gscs = new GscStore();
	private files = new FileStore();
	private cache = {
		gscPathCompletionItemsMap: new Map<string, vscode.CompletionItem[]>(),
	};

	constructor(staticData: (Store["staticData"])) {
		this.staticData = staticData;

		type GscDiskUpdateOptions = { pathRoot: string, rootIndex: number, rootUri: vscode.Uri, uri: vscode.Uri };
		const onGscDiskChange = (options: GscDiskUpdateOptions) => {
			return onGscDiskUpdate(options);
		};
		const onGscDiskCreate = (options: GscDiskUpdateOptions) => {
			return onGscDiskUpdate(options);
		};
		const onGscDiskDelete = (options: GscDiskUpdateOptions) => {
			return this.files.deleteByUri(options.uri);
		};

		const onGscDiskUpdate = async ({ pathRoot, rootIndex, rootUri, uri }: GscDiskUpdateOptions) => {
			const pathComponents = [pathRoot, ...uri.path.slice(rootUri.path.length + 1).split("/")];
			const nameComponentNoExt = path.parse(pathComponents[pathComponents.length - 1]).name;
			pathComponents[pathComponents.length - 1] = nameComponentNoExt;
			const gscPath = pathComponents.join("\\");

			const relativeGsc = this.gscs.getByPath(gscPath) || this.gscs.create(gscPath);
			const file = this.files.getByUri(uri) || this.files.create(uri, { relativeGsc });
			relativeGsc.setFile(file, rootIndex);

			try {
				// TODO: Maybe don't parse lower rootIndex files to save on RAM?
				const document = await vscode.workspace.openTextDocument(uri);
				this.onGscDocumentUpdate(document, file);
			} catch (error) {
				console.error("Could not open GSC file for processing:", error);
			}
		};

		for (const [pathRoot, rootUris] of staticData.config.rootFolders) {
			for (const [rootIndex, rootUri] of rootUris.entries()) {
				const pattern = new vscode.RelativePattern(rootUri, "**/*.{gsc,csc}");
				const watcher = vscode.workspace.createFileSystemWatcher(pattern);
				const sharedOptions = { rootUri, rootIndex, pathRoot };
				watcher.onDidChange(uri => onGscDiskChange({ ...sharedOptions, uri }));
				watcher.onDidCreate(uri => onGscDiskCreate({ ...sharedOptions, uri }));
				watcher.onDidDelete(uri => onGscDiskDelete({ ...sharedOptions, uri }));
				vscode.workspace.findFiles(pattern).then(async uris => {
					console.time(`GSC parse ${rootUri.path}`)
					await Promise.all(uris.map(uri => onGscDiskCreate({ ...sharedOptions, uri })));
					console.timeLog(`GSC parse ${rootUri.path}`, { count: uris.length })
				});
				this.disposables.push(watcher);
			}
		}
	}

	private onGscDocumentUpdate(document: vscode.TextDocument, file?: File) {
		if (!file) file = this.files.getByUri(document.uri) || this.files.create(document.uri);
		file.invalidateCache();
		const ignoredBlocks = parseIgnoredBlocks(document);
		const topLevelBlocks = parseTopLevelBlocks(document, ignoredBlocks);
		const callableDefs = parseCallableDefs(document, topLevelBlocks, ignoredBlocks);
		const callableInstances = parseCallableInstances(document, topLevelBlocks, ignoredBlocks);
		file.updateCache({ ignoredBlocks, topLevelBlocks, callableDefs, callableInstances });
	}

	onDidChangeGscDocument(event: vscode.TextDocumentChangeEvent) {
		if (!event.document.isDirty) return; // Disk events will handle it...
		this.onGscDocumentUpdate(event.document);
	}

	dispose() {
		for (const disposable of this.disposables) {
			disposable.dispose();
		}
	}

	uriToGscPath(uri: vscode.Uri) {
		const file = this.files.getByUri(uri);
		if (file?.relativeGsc) return file.relativeGsc.path;

		const matchingRootFolder = [...this.staticData.config.rootFolders.entries()]
			.flatMap(([gscPathRoot, uris]) => uris.map(uri => ({ gscPathRoot, uri })))
			.find(({ uri: rootUri }) => uri.toString().startsWith(rootUri.toString()));
		if (!matchingRootFolder) return undefined;

		const split = uri.path.slice(matchingRootFolder.uri.path.length + 1).split("/");
		split[split.length - 1] = path.parse(split[split.length - 1]).name; // remove file extension
		const relativePath = [matchingRootFolder.gscPathRoot, ...split].join("\\");
		return relativePath;
	}

	private getCached<K extends keyof FileCache>
	(document: vscode.TextDocument, key: K, fallbackFunc: (document: vscode.TextDocument) => FileCache[K]): FileCache[K] {
		const file = this.files.getByUri(document.uri) || this.files.create(document.uri);
		const cached = file.cache[key];
		if (cached) return cached;

		const result = fallbackFunc(document);
		file.updateCache({ [key]: result });
		return result;
	}

	getIgnoredBlocks(document: vscode.TextDocument) {
		return this.getCached(document, "ignoredBlocks", parseIgnoredBlocks);
	}

	getTopLevelBlocks(document: vscode.TextDocument) {
		return this.getCached(document, "topLevelBlocks", document => {
			return parseTopLevelBlocks(document, this.getIgnoredBlocks(document));
		});
	}

	getCallableDefs(document: vscode.TextDocument) {
		return this.getCached(document, "callableDefs", document => {
			return parseCallableDefs(document, this.getTopLevelBlocks(document), this.getIgnoredBlocks(document));
		});
	}

	getCallableInstances(document: vscode.TextDocument) {
		return this.getCached(document, "callableInstances", document => {
			return parseCallableInstances(document, this.getTopLevelBlocks(document), this.getIgnoredBlocks(document));
		});
	}

	getDefinedCallableInstances(document: vscode.TextDocument) {
		return this.getCached(document, "definedCallableInstances", document => {
			const defs = this.getCallableDefs(document);
			const instances = this.getCallableInstances(document);
			const result: (CallableInstance & { def: CallableDef })[] = [];

			for (const instance of instances) {
				const identLC = instance.ident.name.toLowerCase();
				const def = this.staticData.callableDefsFlat.get(identLC) || defs.get(identLC);
				if (!def) continue;
				result.push({ ...instance, def });
			}
			return result;
		});
	}

	async getPathCompletionItems(partialPath: string, token: vscode.CancellationToken) {
		const split = partialPath.split("\\");
		const pathRoot = split[0];
		const matchingRootFolders = this.staticData.config.rootFolders.get(pathRoot);
		if (!matchingRootFolders) return [];

		const pathAfterRootStr = split.slice(1, -1).join("/");
		const pathStr = pathRoot + "/" + pathAfterRootStr;
		// Try to get cached items
		let items = this.cache.gscPathCompletionItemsMap.get(pathStr);

		if (!items) {
			// Temporarily store items array as a map to easily override old entries on duplicates
			const itemsMap = new Map<string, vscode.CompletionItem>();
			for (const rootUri of matchingRootFolders) {
				const uri = vscode.Uri.joinPath(rootUri, pathAfterRootStr);
				const pathExists = await vscode.workspace.fs.stat(uri).then(() => true, () => false);
				if (!pathExists) continue;

				if (token?.isCancellationRequested) return [];

				const dir = await vscode.workspace.fs.readDirectory(uri);
				for (const [name, fileType] of dir) {
					switch (fileType) {
						case vscode.FileType.Directory:
							itemsMap.set(name, createFolderCompletionItem(name, this.staticData.config.foldersSorting === "top"));
							break;
						default:
							if ([".gsc", ".csc"].includes(path.parse(name).ext))
								itemsMap.set(name, createFileCompletionItem(name, this.staticData.config.foldersSorting === "bottom"));
					}
				}
			}
			items = [...itemsMap.values()];
			// Cache result
			this.cache.gscPathCompletionItemsMap.set(pathStr, items);
			setTimeout(() => this.cache.gscPathCompletionItemsMap.delete(pathStr), 5000);
		}

		return items;
	}

	getCallableCompletionItems(document: vscode.TextDocument) {
		const defs = this.getCallableDefs(document);
		const defsArray = [...defs.values()];
		return [...defsArray.map(decl => {
			return createCallableCompletionItem({
				ident: { name: decl.ident.name },
				params: decl.params.map(param => ({ name: param.name })),
				path: undefined
			});
		}), ...this.staticData.completionItems];
	}

	getHover(identifier: string) {
		// TODO: Create hovers from callableDefs
		const hover = this.staticData.hovers[identifier.toLowerCase()];
		if (!hover) return undefined;
		return hover;
	}

	getSignatures(identifier: string, document: vscode.TextDocument) {
		const identLc = identifier.toLowerCase();
		const staticMatch = this.staticData.signatureGroups[identLc];
		if (staticMatch) return staticMatch;

		const defs = this.getCallableDefs(document);
		const def = defs.get(identLc);
		if (!def) return [];

		return createSignatures({
			ident: { name: def.ident.name },
			params: def.params.map(param => ({ name: param.name }))
		});
	}

	getCallableDefinitionLocation(document: vscode.TextDocument, tokenRange: vscode.Range) {
		const identifier = document.getText(tokenRange);
		const defs = this.getCallableDefs(document);
		const def = defs.get(identifier.toLowerCase());

		if (!def) return undefined;
		if (tokenRange.isEqual(def.ident.range)) return undefined;
		return new vscode.Location(document.uri, def.ident.range);
	}

	getInlayHints(document: vscode.TextDocument, range: vscode.Range) {
		return this.getDefinedCallableInstances(document).flatMap(callable => {
			if (!callable.params || callable.params.length < 1) return [];
			if (!range.contains(callable.params[callable.params.length - 1].range.end)) return []; // TODO: break if after range
			const def = callable.def;
			if (!def.params) return [];

			const paramHints = [];
			for (const [i, param] of callable.params.entries()) {
				if (!def.params[i]) break;
				paramHints.push({
					position: param.range.start,
					label: `${def.params[i].name}:`,
					kind: vscode.InlayHintKind.Parameter,
					paddingRight: true
				});
			}
			return paramHints;
		});
	}
}
