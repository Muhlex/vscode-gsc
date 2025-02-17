import type { Script } from "./Script";

export class ScriptDir {
	readonly name: string;
	readonly parent?: ScriptDir;
	readonly children: Map<string, ScriptDir>;
	readonly scripts: Map<string, Script>;

	constructor(name: string, parent?: ScriptDir) {
		this.name = name;
		this.parent = parent;
		this.children = new Map();
		this.scripts = new Map();
	}
}
