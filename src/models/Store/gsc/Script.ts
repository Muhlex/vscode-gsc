import { Cache } from "../../Cache/Cache";

import type { ScriptDir } from "./ScriptDir";
import type { ScriptFilesystem } from "./ScriptFilesystem";

import { SegmentBuilderLinear } from "../../Segment";
import type { CallableDefScript, CallableUsage } from "../../Callable";

export class Script {
	readonly name: string;
	readonly dir: ScriptDir;
	readonly filesystem: ScriptFilesystem;

	private readonly cache: Cache<{
		includedScriptsByPath: ReadonlyMap<string, Script>;
		callableDefsScope: ReadonlyMap<string, CallableDefScript>;
		callableDefsScriptByUsage: ReadonlyMap<CallableUsage, CallableDefScript>
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

	getIncludedScripts() {
		return this.cache.getAsync("includedScriptsByPath", async (token) => {
			const includes = await this.file.getIncludes();
			if (token.isCancellationRequested) return;

			const result = new Map<string, Script>();
			for (const path of includes.paths) {
				this.filesystem.dependencies.add(this, path);
				const script = this.filesystem.getScriptByPath(path);
				if (!script) continue;
				result.set(path, script);
			}
			return result;
		});
	}

	getCallableDefsScope() {
		return this.cache.getAsync("callableDefsScope", async (token) => {
			const defs = new Map<string, CallableDefScript>();
			const includes = await this.getIncludedScripts();
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

	getCallableUsageDefs() {
		return this.cache.getAsync("callableDefsScriptByUsage", async (token) => {
			const result = new Map<CallableUsage, CallableDefScript>();

			const file = this.file;
			const usages = await file.getCallableUsages();

			const defsScope = await this.getCallableDefsScope();
			if (token.isCancellationRequested) return;

			const getDef = async (usage: CallableUsage) => {
				const nameLc = usage.name.text.toLowerCase();
				const path = usage.path?.text;
				if (path === undefined) return defsScope.get(nameLc);

				const file = this.filesystem.getScriptByPath(path)?.file;
				if (!file) return undefined;
				const defs = await file.getCallableDefs();
				return defs?.byName.get(nameLc);
			};

			for (const { value: usage } of usages) {
				if (usage.path) this.filesystem.dependencies.add(this, usage.path.text);
				const def = await getDef(usage);
				if (token.isCancellationRequested) return;
				if (!def) continue;

				result.set(usage, def);
			}

			return result;
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
