import * as vscode from "vscode";
import * as path from "node:path";

import type { StaticData } from "../static";
import { GscScriptDir } from "./GscScriptDir";
import { GscScript } from "./GscScript";
import { GscFile } from "./GscFile";
import { languageIDToEngine } from "../../util";

export class GscStore {
	private disposables: vscode.Disposable[];
	private scripts: GscScriptDir;
	private files: Map<vscode.Uri["path"], GscFile>;
	staticData: StaticData;

	constructor(options: { engine: string; staticData: StaticData }) {
		this.disposables = [];
		this.scripts = new GscScriptDir("");
		this.files = new Map();
		this.staticData = options.staticData;

		// Track configured directories:
		for (const [priority, rootUri] of this.staticData.config.rootUris.entries()) {
			const pattern = new vscode.RelativePattern(rootUri, "**/*.{gsc,csc}");

			vscode.workspace.findFiles(pattern).then((uris) => {
				for (const uri of uris) this.addFile(uri, rootUri, priority);
			});

			const watcher = vscode.workspace.createFileSystemWatcher(pattern);
			this.disposables.push(watcher);
			watcher.onDidCreate((uri) => this.addFile(uri, rootUri, priority));
			watcher.onDidChange((uri) => this.getFile(uri)?.clearCache());
			watcher.onDidDelete((uri) => this.removeFile(uri, priority));
		}

		// Track changes to open files:
		this.disposables.push(
			vscode.workspace.onDidChangeTextDocument(({ document }) => {
				const engine = languageIDToEngine(document.languageId);
				if (!engine) return;

				if (!document.isDirty) return; // Disk events will handle it...
				this.getFile(document).clearCache();
			}),
		);

		// Forget files that are not part of tracked directories on close:
		this.disposables.push(
			vscode.workspace.onDidCloseTextDocument((document) => {
				const file = this.getFile(document.uri);
				if (!file || file.script) return;

				this.removeFile(document.uri);
			}),
		);
	}

	getScriptDir(path: string | string[]) {
		if (path.length === 0) return this.scripts;
		const folders = typeof path === "string" ? path.split("\\") : path;

		let currentDir = this.scripts;
		for (const folder of folders) {
			const childDir = currentDir.children.get(folder);
			if (!childDir) return undefined;
			currentDir = childDir;
		}
		return currentDir;
	}

	getScript(path: string | string[]) {
		const { folders, filename } = GscStore.scriptPathToScriptPathSegments(path);
		if (!filename) return undefined;

		const scriptDir = this.getScriptDir(folders);
		if (!scriptDir) return undefined;

		return scriptDir.scripts.get(filename);
	}

	getFile(document: vscode.TextDocument): GscFile;
	getFile(uri: vscode.Uri): GscFile | undefined;
	getFile(identifier: vscode.Uri | vscode.TextDocument) {
		if (identifier instanceof vscode.Uri) {
			const uri = identifier;
			return this.files.get(uri.path);
		}

		const document = identifier;
		let file = this.files.get(document.uri.path);

		if (!file) {
			file = new GscFile(this, document.uri);
			this.files.set(document.uri.path, file);
		}
		return file;
	}

	private addFile(uri: vscode.Uri, rootUri: vscode.Uri, priority: number) {
		const { folders, filename } = GscStore.uriToScriptPathSegments(uri, rootUri);
		if (!filename) throw new Error(`Cannot add file "${uri.path}" due to invalid script path.`);

		let currentDir = this.scripts;
		for (const folder of folders) {
			let childDir = currentDir.children.get(folder);
			if (!childDir) {
				childDir = new GscScriptDir(folder, currentDir);
				currentDir.children.set(folder, childDir);
			}
			currentDir = childDir;
		}

		let script = currentDir.scripts.get(filename);
		if (!script) {
			script = new GscScript(filename, currentDir);
			currentDir.scripts.set(filename, script);
		}

		const file = new GscFile(this, uri, script);
		script.addFile(priority, file);
		this.files.set(uri.path, file);
	}

	private removeFile(uri: vscode.Uri, priority?: number) {
		const file = this.getFile(uri);
		if (!file) throw new Error(`Cannot remove unknown file "${uri.path}".`);

		this.files.delete(uri.path);
		const script = file.script;
		if (!script || priority === undefined) return;

		script.removeFile(priority);

		if (script.fileCount > 0) return;
		script.dir.scripts.delete(script.name);

		let dir = script.dir;
		while (dir.parent) {
			if (dir.children.size + dir.scripts.size > 0) break;
			dir.parent.children.delete(dir.name);
			dir = dir.parent;
		}
	}

	dispose() {
		for (const disposable of this.disposables) disposable.dispose();
	}

	static scriptPathToScriptPathSegments(path: string | string[]) {
		const folders = typeof path === "string" ? path.split("\\") : path;
		const filename = folders.pop();
		return { folders, filename };
	}

	static uriToScriptPathSegments(uri: vscode.Uri, rootUri: vscode.Uri) {
		const folders = uri.path.slice(rootUri.path.length + 1).split("/");
		const fileWithExt = folders.pop();
		const filename = fileWithExt && path.parse(fileWithExt).name;
		return { folders, filename };
	}
}
