import type * as vscode from "vscode";

import type { CallableDef, CallableDefScript } from "../../models/Def";
import type { Ignored } from "../../models/Ignored";
import type { CallableInstance, CallableInstanceRaw } from "../../models/Instance";
import type { SegmentMap, SegmentTree } from "../../models/Segment";

import type { GscStore } from "../../stores/GscStore";
import type { StaticStore } from "../../stores/StaticStore";
import type { GscScript } from "./GscScript";

import { AsyncDocumentCache } from "../../models/Cache/AsyncDocumentCache";

import { parseCallableDefs } from "../../parse/callableDefs";
import { parseCallableInstances } from "../../parse/callableInstances";
import { parseGlobalSegments } from "../../parse/globalSegments";
import { parseIgnoredSegments } from "../../parse/ignoredSegments";
import { parseIncludes } from "../../parse/includes";

export class GscFile {
	uri: vscode.Uri;
	script?: GscScript;

	private readonly stores;
	private readonly cache: AsyncDocumentCache<{
		ignoredSegments: SegmentMap<Ignored>;
		globalSegments: SegmentMap;
		includedPaths: readonly string[];
		includedFiles: ReadonlySet<GscFile>;
		callableDefs: Readonly<{
			byRange: SegmentMap<CallableDefScript>;
			byName: ReadonlyMap<string, CallableDefScript>;
		}>;
		callableDefsScope: ReadonlyMap<string, CallableDefScript>;
		callableInstancesRaw: Readonly<{
			referencedPaths: ReadonlySet<string>;
			byRange: SegmentTree<CallableInstanceRaw>;
		}>;
		callableInstances: Readonly<{
			referencedFiles: ReadonlySet<GscFile>;
			byRange: SegmentTree<CallableInstance>;
			byOffset: Map<number, CallableInstance>;
		}>;
	}>;

	constructor(stores: { static: StaticStore; gsc: GscStore }, uri: vscode.Uri, script?: GscScript) {
		this.uri = uri;
		this.script = script;
		this.stores = stores;
		this.cache = new AsyncDocumentCache(uri);
	}

	get filename() {
		const path = this.uri.path;
		const lastSlashIndex = path.lastIndexOf("/");
		if (lastSlashIndex === -1) return path;
		return path.slice(lastSlashIndex + 1);
	}

	// TODO: Use CancellationTokens?
	// TODO: Perf: Parse only segments in a provided range?
	// TODO: Consider using a worker thread for parsing.

	getIgnoredSegments() {
		return this.cache.getWithDocument("ignoredSegments", async (doc) => parseIgnoredSegments(doc));
	}

	getGlobalSegments() {
		return this.cache.getWithDocument("globalSegments", async (doc) => {
			const ignoredFragments = await this.getIgnoredSegments();
			return parseGlobalSegments(doc, ignoredFragments);
		});
	}

	getIncludes() {
		return this.cache.get("includedFiles", async () => {
			const paths = await this.cache.getWithDocument("includedPaths", async (doc) => {
				return parseIncludes(doc, await this.getGlobalSegments(), await this.getIgnoredSegments());
			});

			const files = new Set<GscFile>();
			for (const path of paths) {
				const file = this.stores.gsc.getScript(path)?.getFile();
				if (!file) continue;
				if (files.has(file)) files.delete(file); // prioritize last file
				files.add(file);
			}
			return files;
		});
	}

	getCallableDefs() {
		return this.cache.getWithDocument("callableDefs", async (doc) => {
			const defs = parseCallableDefs(
				doc,
				await this.getGlobalSegments(),
				await this.getIgnoredSegments(),
				this,
			);

			const byName = new Map<string, CallableDefScript>();
			for (const { value: def } of defs) {
				byName.set(def.ident.name.toLowerCase(), def);
			}

			return {
				byRange: defs,
				byName,
			};
		});
	}

	getCallableDefsScope() {
		return this.cache.get("callableDefsScope", async () => {
			const defs = new Map<string, CallableDefScript>();
			const includes = await this.getIncludes();
			const files = [...includes.values(), this];
			const defsPerFile = await Promise.all(files.map(async (file) => file.getCallableDefs()));
			for (const fileDefs of defsPerFile) {
				for (const [name, def] of fileDefs.byName) defs.set(name, def);
			}
			return defs;
		});
	}

	getCallableInstances() {
		return this.cache.getWithDocument("callableInstances", async (doc) => {
			const { byRange: instancesRaw } = await this.cache.getWithDocument(
				"callableInstancesRaw",
				async (doc) => {
					const instancesRaw = parseCallableInstances(
						doc,
						await this.getGlobalSegments(),
						await this.getIgnoredSegments(),
					);
					const referencedPaths = new Set<string>();
					for (const { value: instance } of instancesRaw) {
						if (!instance.path) continue;
						referencedPaths.add(instance.path);
					}
					return { referencedPaths, byRange: instancesRaw };
				},
			);
			const referencedFiles = new Set<GscFile>();

			const defsGame = this.stores.static.callables;
			const defsScope = await this.getCallableDefsScope();

			const getDef = async (instanceRaw: CallableInstanceRaw): Promise<CallableDef | undefined> => {
				const identLc = instanceRaw.ident.name.toLowerCase();
				const { path } = instanceRaw;
				if (!path) return defsGame.get(identLc) ?? defsScope.get(identLc);

				const file = this.stores.gsc.getScript(path)?.getFile();
				if (!file) return undefined;
				referencedFiles.add(file);
				const defsFile = await file.getCallableDefs();
				return defsFile?.byName.get(identLc);
			};

			const attachDef = async (instanceRaw: CallableInstanceRaw): Promise<void> => {
				const def = await getDef(instanceRaw);
				if (!def) return;

				const instance: CallableInstance = instanceRaw;
				instance.def = def;
			};

			const attachDefs = async () => {
				const promises: Promise<void>[] = [];
				for (const { value: instanceRaw } of instancesRaw) {
					promises.push(attachDef(instanceRaw));
				}
				await Promise.all(promises);
				return instancesRaw as SegmentTree<CallableInstance>;
			};

			const instances = await attachDefs();

			const byOffset = new Map<number, CallableInstance>();
			for (const { value: instance } of instances) {
				byOffset.set(doc.offsetAt(instance.ident.range.start), instance);
			}

			return { referencedFiles, byRange: instances, byOffset };
		});
	}

	onChange() {
		this.cache.clear();
	}

	onOtherFileCreate(otherFile: GscFile) {
		const { cache } = this;
		const path = otherFile.script?.path;
		if (!path) return;

		if (cache.getCached("includedPaths")?.includes(path)) {
			cache.clear("includedFiles");
			cache.clear("callableDefsScope");
			cache.clear("callableInstances");
		} else if (cache.getCached("callableInstancesRaw")?.referencedPaths.has(path)) {
			cache.clear("callableInstances");
		}
	}
	onOtherFileChange(otherFile: GscFile) {
		const { cache } = this;
		if (cache.getCached("includedFiles")?.has(otherFile)) {
			cache.clear("callableDefsScope");
			cache.clear("callableInstances");
		} else if (cache.getCached("callableInstances")?.referencedFiles.has(otherFile)) {
			cache.clear("callableInstances");
		}
	}
	onOtherFileRemove(otherFile: GscFile) {
		const { cache } = this;
		if (cache.getCached("includedFiles")?.has(otherFile)) {
			cache.clear("includedFiles");
			cache.clear("callableDefsScope");
			cache.clear("callableInstances");
		} else if (cache.getCached("callableInstances")?.referencedFiles.has(otherFile)) {
			cache.clear("callableInstances");
		}
	}
}
