import type { GscFile } from "./GscFile";
import type { GscScriptDir } from "./GscScriptDir";

export class GscScript {
	name: string;
	dir: GscScriptDir;
	private files: GscFile[];
	private filePriorities: Map<GscFile, number>;

	constructor(name: string, dir: GscScriptDir) {
		this.name = name;
		this.dir = dir;
		this.files = [];
		this.filePriorities = new Map();
	}

	get fileCount() {
		return this.filePriorities.size;
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

	getFile(priority?: number): GscFile | undefined {
		return priority !== undefined ? this.files[priority] : this.files.findLast((file) => file);
	}

	addFile(file: GscFile, priority: number) {
		this.files[priority] = file;
		this.filePriorities.set(file, priority);
	}

	removeFile(file: GscFile): boolean;
	removeFile(priority: number): boolean;
	removeFile(identifier: GscFile | number) {
		let priority: number | undefined;
		let file: GscFile | undefined;

		if (typeof identifier === "number") {
			priority = identifier;
			file = this.files[priority];
			if (!file) return false;
		} else {
			file = identifier;
			priority = this.filePriorities.get(file);
			if (priority === undefined) return false;
		}
		delete this.files[priority];
		this.filePriorities.delete(file);
		return true;
	}
}
