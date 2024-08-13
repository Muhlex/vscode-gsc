import * as vscode from "vscode";

import type { GscStore } from ".";
import type { GscScript } from "./GscScript";
import type { CallableDefScript } from "../../types/Defs";
import type { CallableInstance, CallableInstanceWithDef } from "../../types/Instances";

import {
	parseCallableDefs,
	parseCallableInstances,
	parseIgnoredBlocks,
	parseIncludes,
	parseTopLevelBlocks,
	type ParsedBlock,
} from "../../parse";

type Cache = {
	ignoredBlocks?: ParsedBlock[];
	topLevelBlocks?: ParsedBlock[];
	includes?: string[];
	callableDefs?: Map<string, CallableDefScript>;
	callableInstances?: CallableInstance[];
};

export class GscFile {
	store: GscStore;
	uri: vscode.Uri;
	script?: GscScript;

	private cache: Cache;

	constructor(store: GscStore, uri: vscode.Uri, script?: GscScript) {
		this.store = store;
		this.uri = uri;
		this.script = script;
		this.cache = {};
	}

	get filename() {
		const path = this.uri.path;
		const lastSlashIndex = path.lastIndexOf("/");
		if (lastSlashIndex === -1) return path;
		return path.slice(lastSlashIndex + 1);
	}

	clearCache() {
		this.cache = {};
	}

	private async getCached<K extends keyof Cache>(
		key: K,
		parseFn: (document: vscode.TextDocument) => Promise<NonNullable<Cache[K]>>,
	): Promise<NonNullable<Cache[K]>> {
		const cached = this.cache[key];
		if (cached) return cached;

		const openDocument = await vscode.workspace.openTextDocument(this.uri);
		const result = await parseFn(openDocument);
		this.cache[key] = result;
		return result;
	}

	getIgnoredBlocks() {
		return this.getCached("ignoredBlocks", async (doc) => parseIgnoredBlocks(doc));
	}

	getTopLevelBlocks() {
		return this.getCached("topLevelBlocks", async (doc) => {
			return parseTopLevelBlocks(doc, await this.getIgnoredBlocks());
		});
	}

	getIncludes() {
		return this.getCached("includes", async (doc) => {
			return parseIncludes(doc, await this.getTopLevelBlocks(), await this.getIgnoredBlocks());
		});
	}

	getCallableDefs() {
		return this.getCached("callableDefs", async (doc) => {
			return parseCallableDefs(
				doc,
				this,
				await this.getTopLevelBlocks(),
				await this.getIgnoredBlocks(),
			);
		});
	}

	async getCallableDefsInScope() {
		const defs = new Map<string, CallableDefScript>();

		const addDefs = async (file: GscFile) => {
			for (const [name, def] of await file.getCallableDefs()) {
				if (defs.has(name)) continue;
				defs.set(name, def);
			}
		};

		await addDefs(this);

		for (const includePath of await this.getIncludes()) {
			const includedScript = this.store.getScript(includePath);
			const includedFile = includedScript?.getFile();
			if (!includedFile) continue;

			await addDefs(includedFile);
		}

		return defs;
	}

	getCallableInstances() {
		return this.getCached("callableInstances", async (doc) => {
			return parseCallableInstances(
				doc,
				await this.getTopLevelBlocks(),
				await this.getIgnoredBlocks(),
			);
		});
	}

	async getCallableInstancesDefined() {
		const instances: CallableInstanceWithDef[] = await this.getCallableInstances();
		const defsGame = this.store.staticStore.callables;
		const defsScript = await this.getCallableDefsInScope();
		for (const instance of instances) {
			const identLc = instance.ident.name.toLowerCase();
			const def = defsGame.get(identLc) ?? defsScript.get(identLc);
			if (def) instance.def = def;
		}
		return instances;
	}
}
