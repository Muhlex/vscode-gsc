import type { GscScript } from "./GscScript";

export class GscScriptDir {
	name: string;
	parent?: GscScriptDir;
	children: Map<string, GscScriptDir>;
	scripts: Map<string, GscScript>;

	constructor(name: string, parent?: GscScriptDir) {
		this.name = name;
		this.parent = parent;
		this.children = new Map();
		this.scripts = new Map();
	}
}
