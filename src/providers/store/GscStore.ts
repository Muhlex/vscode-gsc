import { File } from "./FileStore";

export class RelativeGsc {
	public path: string;
	private files: File[] = [];

	constructor(options: { path: string }) {
		this.path = options.path;
	}

	get file() {
		return this.files.at(-1);
	}

	setFile(file: File, rootIndex: number) {
		this.files[rootIndex] = file;
	}
}

export class GscStore {
	private gscs = new Map<string, RelativeGsc>();

	create(gscPath: string) {
		const gsc = new RelativeGsc({ path: gscPath });
		this.gscs.set(gsc.path, gsc);
		return gsc;
	}

	getByPath(gscPath: string) {
		return this.gscs.get(gscPath);
	}
}
