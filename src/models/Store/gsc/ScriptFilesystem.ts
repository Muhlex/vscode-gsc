import * as vscode from "vscode";

import type { GscStore } from "./GscStore";
import type { GscFile } from "./GscFile";
import { Script } from "./Script";
import { ScriptDir } from "./ScriptDir";
import { DependencyTracker } from "./DependencyTracker";

import { LayeredValueMap } from "../../Structures/LayeredValueMap";
import { removeFileExtension } from "../../../util";

export class ScriptFilesystem {
	readonly languageId: string;
	private readonly uris: vscode.Uri[];
	readonly gscStore: GscStore;

	readonly dependencies: DependencyTracker;
	private readonly scriptRoot: ScriptDir;
	private readonly scriptsByFile: LayeredValueMap<GscFile, Script>;
	private readonly filesByScript: LayeredValueMap<Script, GscFile>;
	private readonly disposables: vscode.Disposable[];

	constructor(languageId: string, uris: vscode.Uri[], gscStore: GscStore) {
		this.languageId = languageId;
		this.uris = uris;
		this.gscStore = gscStore;

		this.dependencies = new DependencyTracker();
		this.scriptRoot = new ScriptDir("");
		this.scriptsByFile = new LayeredValueMap();
		this.filesByScript = new LayeredValueMap();
		this.disposables = [];
	}

	async init() {
		const promises: Thenable<void>[] = [];

		for (const [priority, rootUri] of this.uris.entries()) {
			const pattern = new vscode.RelativePattern(rootUri, "**/*.{gsc,csc}");

			promises.push(
				vscode.workspace.findFiles(pattern).then((uris) => {
					for (const uri of uris) this.onCreateFile(uri, rootUri, priority);
				}),
			);

			const watcher = vscode.workspace.createFileSystemWatcher(pattern);
			this.disposables.push(watcher);
			this.disposables.push(
				watcher.onDidCreate((uri) => this.onCreateFile(uri, rootUri, priority)),
			);
			this.disposables.push(
				watcher.onDidChange((uri) => {
					const file = this.gscStore.ensureFile(uri);
					file.onChanged();
					const script = this.scriptsByFile.get(file);
					script?.onChanged();
				}),
			);
			this.disposables.push(
				watcher.onDidDelete((uri) => this.onDeleteFile(uri, rootUri, priority)),
			);
		}

		await Promise.all(promises);
	}

	getScriptDirByPath(path: string | string[]) {
		if (path.length === 0) return this.scriptRoot;
		const parsedPath = ScriptFilesystem.parseScriptPath(path);

		let currentDir = this.scriptRoot;
		for (const folder of parsedPath) {
			const childDir = currentDir.children.get(folder);
			if (!childDir) return undefined;
			currentDir = childDir;
		}
		return currentDir;
	}

	getScriptByPath(path: string | string[]) {
		const folders = ScriptFilesystem.parseScriptPath(path);
		const filename = folders.pop();
		if (!filename) return undefined;

		const scriptDir = this.getScriptDirByPath(folders);
		if (!scriptDir) return undefined;

		return scriptDir.scripts.get(filename);
	}

	getScriptByFile(file: GscFile) {
		return this.scriptsByFile.get(file);
	}

	getScriptByResource(resource: vscode.Uri | vscode.TextDocument) {
		const uri = resource instanceof vscode.Uri ? resource : resource.uri;
		const file = this.gscStore.getFile(uri);
		if (!file) return undefined;
		return this.scriptsByFile.get(file);
	}

	getFileByScript(script: Script) {
		return this.filesByScript.get(script);
	}

	private onCreateFile(uri: vscode.Uri, rootUri: vscode.Uri, priority: number) {
		const folders = ScriptFilesystem.parseUri(uri, rootUri);
		const filename = folders.pop();
		if (!filename) throw new Error(`Invalid script file path: "${uri.path}"`);

		let currentDir = this.scriptRoot;
		for (const folder of folders) {
			let childDir = currentDir.children.get(folder);
			if (!childDir) {
				childDir = new ScriptDir(folder, currentDir);
				currentDir.children.set(folder, childDir);
			}
			currentDir = childDir;
		}

		let script = currentDir.scripts.get(filename);
		if (!script) {
			script = new Script(filename, currentDir, this);
			currentDir.scripts.set(filename, script);
			script.onCreated();
		}

		const file = this.gscStore.ensureFile(uri);
		this.scriptsByFile.set(file, priority, script);
		this.filesByScript.set(script, priority, file);
		this.gscStore.onFileAssignScript(file, script);
	}

	private onDeleteFile(uri: vscode.Uri, rootUri: vscode.Uri, priority: number) {
		const file = this.gscStore.getFile(uri);
		this.gscStore.removeFile(uri);

		if (file) this.scriptsByFile.delete(file, priority);

		const parsedPath = ScriptFilesystem.parseUri(uri, rootUri);
		const script = this.getScriptByPath(parsedPath);
		if (!script) throw new Error(`File is not represented by a script: "${uri.path}".`);

		this.filesByScript.delete(script, priority);
		if (file) this.gscStore.onFileUnassignScript(file, script);

		if (this.filesByScript.get(script)) return; // there is still a file representing this script

		let dir = script.dir;
		dir.scripts.delete(script.name);
		while (dir.parent) {
			if (dir.children.size + dir.scripts.size > 0) break;
			dir.parent.children.delete(dir.name);
			dir = dir.parent;
		}
	}

	dispose() {
		for (const disposable of this.disposables) disposable.dispose();
	}

	static parseScriptPath(path: string | string[]) {
		return typeof path === "string" ? path.split("\\") : path;
	}

	static parseUri(uri: vscode.Uri, rootUri: vscode.Uri) {
		const segments = uri.path.slice(rootUri.path.length + 1).split("/");
		const fileWithExt = segments.pop();
		if (fileWithExt) {
			const filename = removeFileExtension(fileWithExt);
			segments.push(filename);
		}
		return segments;
	}
}
