import * as vscode from "vscode";

import { Setting, type SettingUpdater } from "./Setting";

export type SettingsSchema = { [key: string]: SettingsSchema | SettingUpdater<any> };
type SettingsTree = { [key: string]: SettingsTree | Setting<any> };
type SettingsSchemaToSettingsTree<T> = {
	[K in keyof T]: T[K] extends (input: any) => infer R
		? Setting<R>
		: SettingsSchemaToSettingsTree<T[K]>;
};

export class Settings<T extends SettingsSchema> {
	readonly tree: SettingsSchemaToSettingsTree<T>;
	private readonly list: Setting<unknown>[];

	private disposables: vscode.Disposable[] = [];

	constructor(baseSection: string, schema: (raw: typeof Setting.rawValueUpdater) => T) {
		this.list = [];
		const createSettingsTree = (schema: SettingsSchema, sectionPrefix = "") => {
			const tree: SettingsTree = {};
			for (const key in schema) {
				const path = sectionPrefix ? `${sectionPrefix}.${key}` : key;
				const value = schema[key];
				if (typeof value === "function") {
					const setting = new Setting(baseSection, path, value);
					tree[key] = setting;
					this.list.push(setting);
				} else {
					tree[key] = createSettingsTree(value, path);
				}
			}
			return tree;
		};
		this.tree = createSettingsTree(
			schema(Setting.rawValueUpdater),
		) as SettingsSchemaToSettingsTree<T>;

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
