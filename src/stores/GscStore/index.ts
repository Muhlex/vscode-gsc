import * as vscode from "vscode";
import * as path from "node:path";

import type { Settings } from "../../settings";
import type { StaticStore } from "../StaticStore";
import { GscScriptDir } from "./GscScriptDir";
import { GscScript } from "./GscScript";
import { GscFile } from "./GscFile";

export class GscStore {
	readonly staticStore: StaticStore;
	private scripts: GscScriptDir;
	private files: Map<vscode.Uri["path"], GscFile>;

	constructor(
		context: vscode.ExtensionContext,
		settings: Settings,
		engine: string,
		languageId: string,
		staticStore: StaticStore,
	) {
		this.staticStore = staticStore;
		this.scripts = new GscScriptDir("");
		this.files = new Map();

		// Track changes when editing files:
		context.subscriptions.push(
			vscode.workspace.onDidChangeTextDocument(({ document }) => {
				if (document.languageId !== languageId) return;

				const file = this.getFile(document);
				if (!document.isDirty && file.script) {
					return; // File system watcher for root directories will handle it...
				}
				file.clearCache();
			}),
		);

		// Forget files that are not part of configured directories on close:
		context.subscriptions.push(
			vscode.workspace.onDidCloseTextDocument((document) => {
				const file = this.getFile(document.uri);
				if (!file || file.script) return;

				this.removeFile(document.uri);
			}),
		);

		// Track disk changes for configured directories:
		let fileSystemWatchers: vscode.FileSystemWatcher[] = [];
		const disposeFileSystemWatchers = () => {
			for (const watcher of fileSystemWatchers) watcher.dispose();
			fileSystemWatchers = [];
		};

		const initRootDirectories = (rootUris: vscode.Uri[]) => {
			disposeFileSystemWatchers();
			this.files.clear();

			for (const [priority, rootUri] of rootUris.entries()) {
				const pattern = new vscode.RelativePattern(rootUri, "**/*.{gsc,csc}");

				vscode.workspace.findFiles(pattern).then((uris) => {
					for (const uri of uris) this.createFileScript(uri, rootUri, priority);
				});

				const watcher = vscode.workspace.createFileSystemWatcher(pattern);
				fileSystemWatchers.push(watcher);
				watcher.onDidCreate((uri) => this.createFileScript(uri, rootUri, priority));
				watcher.onDidChange((uri) => this.getFile(uri)?.clearCache());
				watcher.onDidDelete((uri) => this.removeFile(uri));
			}
		};

		const rootDirectoriesSetting = settings.engines[engine].rootDirs;
		initRootDirectories(rootDirectoriesSetting.value);
		rootDirectoriesSetting.subscribe(initRootDirectories);

		context.subscriptions.push(
			new vscode.Disposable(() => {
				rootDirectoriesSetting.unsubscribe(initRootDirectories);
				disposeFileSystemWatchers();
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

	private createFile(uri: vscode.Uri) {
		const file = new GscFile(this, uri);
		this.files.set(uri.path, file);
		return file;
	}

	private createFileScript(uri: vscode.Uri, rootUri: vscode.Uri, priority: number) {
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

		const file = this.createFile(uri);
		file.script = script;
		script.addFile(file, priority);
	}

	private removeFile(uri: vscode.Uri) {
		const file = this.getFile(uri);
		if (!file) throw new Error(`Cannot remove unknown file "${uri.path}".`);

		this.files.delete(uri.path);
		const script = file.script;
		if (!script) return;

		script.removeFile(file);

		if (script.fileCount > 0) return;
		script.dir.scripts.delete(script.name);

		let dir = script.dir;
		while (dir.parent) {
			if (dir.children.size + dir.scripts.size > 0) break;
			dir.parent.children.delete(dir.name);
			dir = dir.parent;
		}
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
