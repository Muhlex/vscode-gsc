import * as vscode from "vscode";

import { Setting, type SettingUpdater } from "./Setting";

type SettingFactory = <T>(path: string, updater?: SettingUpdater<T>) => Setting<T>;
type SettingsTreeFactory<T> = (createSetting: SettingFactory) => T;

export class Settings<T extends Record<string, any>> {
	readonly tree: T;
	private readonly list: Setting<unknown>[];

	private disposables: vscode.Disposable[] = [];

	constructor(baseSection: string, createTree: SettingsTreeFactory<T>) {
		this.list = [];
		const createSetting: SettingFactory = (path, updater) => {
			const setting = new Setting(baseSection, path, updater);
			this.list.push(setting);
			return setting;
		};

		this.tree = createTree(createSetting);

		this.disposables.push(
			vscode.workspace.onDidChangeConfiguration((event) => {
				for (const setting of this.list) setting.onDidChangeConfiguration(event);
			}),
		);
	}

	dispose() {
		for (const disposable of this.disposables) disposable.dispose();
	}
}
