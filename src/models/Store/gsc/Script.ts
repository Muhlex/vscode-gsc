import { Cache } from "../../Cache/Cache";

import type { ScriptDir } from "./ScriptDir";
import type { ScriptFilesystem } from "./ScriptFilesystem";

import { SegmentBuilderLinear, type SegmentTree } from "../../Segment";
import type { CallableDefScript, CallableInstance } from "../../Callable";

type CallableInstanceDefined = { instance: CallableInstance; def?: CallableDefScript };

export class Script {
	readonly name: string;
	readonly dir: ScriptDir;
	readonly filesystem: ScriptFilesystem;

	private readonly cache: Cache<{
		includedScripts: ReadonlySet<Script>;
		callableDefsScope: ReadonlyMap<string, CallableDefScript>;
		callableInstancesDefined: Readonly<{
			byRange: SegmentTree<CallableInstanceDefined>;
			byOffset: ReadonlyMap<number, CallableInstanceDefined>;
		}>;
	}>;

	constructor(name: string, dir: ScriptDir, filesystem: ScriptFilesystem) {
		this.name = name;
		this.dir = dir;
		this.filesystem = filesystem;

		this.cache = new Cache();
	}

	get path() {
		let path = this.name;
		let dir = this.dir;
		while (dir.parent) {
			path = `${dir.name}\\${path}`;
			dir = dir.parent;
		}
		return path;
	}

	get file() {
		const file = this.filesystem.getFileByScript(this);
		if (!file) throw Error(`Script ${this.path} is not represented by a file.`);
		return file;
	}

	getIncludes() {
		return this.cache.getAsync("includedScripts", async (token) => {
			const includedPaths = await this.file?.getIncludedPaths();
			if (!includedPaths || token.isCancellationRequested) return;

			const result = new Set<Script>();
			for (const path of includedPaths) {
				this.filesystem.dependencies.add(this, path);
				const script = this.filesystem.getScriptByPath(path);
				if (!script) continue;
				result.add(script);
			}
			return result;
		});
	}

	getCallableDefsScope() {
		return this.cache.getAsync("callableDefsScope", async (token) => {
			const defs = new Map<string, CallableDefScript>();
			const includes = await this.getIncludes();
			if (token.isCancellationRequested) return;

			const scripts = [...includes.values(), this];
			const defsPerScript = await Promise.all(scripts.map(({ file }) => file?.getCallableDefs()));
			if (token.isCancellationRequested) return;

			for (const scriptDefs of defsPerScript) {
				if (!scriptDefs) continue;
				for (const [name, def] of scriptDefs.byName) defs.set(name, def);
			}
			return defs;
		});
	}

	getCallableInstancesDefined() {
		return this.cache.getAsync("callableInstancesDefined", async (token) => {
			const builder = new SegmentBuilderLinear<CallableInstanceDefined>();
			const byOffset = new Map<number, CallableInstanceDefined>();

			const file = this.file;
			const document = await file.getDocument();
			const instances = await file.getCallableInstances();

			const defsScope = await this.getCallableDefsScope();
			if (token.isCancellationRequested) return;

			const getDef = async (instance: CallableInstance) => {
				const identLc = instance.ident.name.toLowerCase();
				const path = instance.path;
				if (path === undefined) return defsScope.get(identLc);

				const file = this.filesystem.getScriptByPath(path)?.file;
				if (!file) return undefined;
				const defs = await file.getCallableDefs();
				return defs?.byName.get(identLc);
			};

			for (const { value: instance, range } of instances) {
				if (instance.path) this.filesystem.dependencies.add(this, instance.path);
				const def = await getDef(instance);
				if (token.isCancellationRequested) return;

				const instanceDefined: CallableInstanceDefined = { instance, def };
				builder.push(range, instanceDefined);
				byOffset.set(document.offsetAt(instance.ident.range.start), instanceDefined);
			}

			return { byRange: builder.toTree(), byOffset };
		});
	}

	onCreated() {
		const dependents = this.filesystem.dependencies.getDependents(this.path);
		if (dependents) {
			for (const dependent of dependents) dependent.onDependencyChanged(this);
		}
	}

	onChanged() {
		const dependents = this.filesystem.dependencies.getDependents(this.path);
		if (dependents) {
			for (const dependent of dependents) dependent.onDependencyChanged(this);
		}

		this.cache.clear();
		this.filesystem.dependencies.clear(this);
	}

	onDependencyChanged(dependency: Script) {
		this.cache.clear();
		this.filesystem.dependencies.clear(this);
	}
}
