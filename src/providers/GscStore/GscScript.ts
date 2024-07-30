import type { GscScriptDir } from "./GscScriptDir";
import type { GscFile } from "./GscFile";

export class GscScript {
	name: string;
	dir: GscScriptDir;
	private files: GscFile[];

	constructor(name: string, dir: GscScriptDir) {
		this.name = name;
		this.dir = dir;
		this.files = [];
	}

	get fileCount() {
		return this.files.length;
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
		return typeof priority === "number" ? this.files[priority] : this.files.find((file) => file);
	}

	addFile(priority: number, file: GscFile) {
		this.files[priority] = file;
	}

	removeFile(priority: number) {
		delete this.files[priority];
	}
}
