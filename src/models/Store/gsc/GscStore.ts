import * as vscode from "vscode";
import { SetMap } from "../../Structures/SetMap";

import type { Engine } from "../../Engine";
import type { ExtensionSettings } from "../../../settings";

import { GscFile } from "./GscFile";
import type { Script } from "./Script";
import { ScriptFilesystem } from "./ScriptFilesystem";

export class GscStore {
	private readonly languageIds: ReadonlySet<string>;
	private readonly settings: ExtensionSettings;

	private readonly files: Map<vscode.Uri["path"], GscFile>;
	private readonly filesystems: Map<string, ScriptFilesystem>;
	readonly scriptsByFile: SetMap<GscFile, Script>;

	private readonly disposables: vscode.Disposable[] = [];

	constructor(engines: Engine[], settings: ExtensionSettings) {
		this.languageIds = new Set(engines.map((engine) => engine.languageId));
		this.settings = settings;

		this.files = new Map();
		this.filesystems = new Map();
		this.scriptsByFile = new SetMap();
	}

	init() {
		for (const languageId of this.languageIds) {
			const engineSettings = this.settings.engines[languageId];
			const disposable = engineSettings.rootUris.subscribe(() => this.filesystems.clear());
			this.disposables.push(disposable);
		}

		// Changes in-editor:
		this.disposables.push(
			vscode.workspace.onDidChangeTextDocument(({ document }) => {
				if (!this.languageIds.has(document.languageId)) return;

				const file = this.getFile(document);
				if (!file) return;
				if (!document.isDirty && this.scriptsByFile.get(file)) return; // filesystem will handle it
				file.onChanged();
			}),
		);

		// Delete untracked files on close:
		this.disposables.push(
			vscode.workspace.onDidCloseTextDocument(({ uri }) => {
				const file = this.getFile(uri);
				if (!file || this.scriptsByFile.get(file)) return;
				this.removeFile(uri);
			}),
		);
	}

	getFile(resource: vscode.Uri | vscode.TextDocument) {
		const uri = resource instanceof vscode.Uri ? resource : resource.uri;
		return this.files.get(uri.path);
	}

	ensureFile(resource: vscode.Uri | vscode.TextDocument) {
		const uri = resource instanceof vscode.Uri ? resource : resource.uri;
		return this.files.get(uri.path) ?? this.createFile(uri);
	}

	private createFile(uri: vscode.Uri): GscFile {
		const file = new GscFile(uri);
		this.files.set(uri.path, file);
		return file;
	}

	removeFile(uri: vscode.Uri) {
		return this.files.delete(uri.path);
	}

	async getFilesystem(scope: vscode.ConfigurationScope & { languageId: string }) {
		const key = await this.getFilesystemKey(scope);
		let filesystem = this.filesystems.get(key);
		if (!filesystem) {
			const { languageId } = scope;
			const engineSettings = this.settings.engines[languageId];
			const rootUris = await engineSettings.rootUris.get(scope);
			filesystem = new ScriptFilesystem(languageId, rootUris, this);
			this.filesystems.set(key, filesystem);
			this.disposables.push(filesystem);
		}
		return filesystem;
	}

	private async getFilesystemKey(scope: vscode.ConfigurationScope & { languageId: string }) {
		const { languageId } = scope;
		const engineSettings = this.settings.engines[languageId];
		const rootUris = await engineSettings.rootUris.get(scope);

		return JSON.stringify([languageId, rootUris.map((dir) => dir.toString(true))]);
	}

	dispose() {
		for (const disposable of this.disposables) disposable.dispose();
	}
}
