import * as vscode from "vscode";

type SettingUpdater<T> = (
	config: vscode.WorkspaceConfiguration,
	section: string,
) => (T | undefined) | Promise<T | undefined>;
type SettingSubscriber<T> = (value: T) => void;

const configName = "GSC";

export class Setting<T> {
	public readonly section: string;
	private defaultValue: T;
	private updater: SettingUpdater<T>;

	private _value: T;
	private subscriptions: Set<SettingSubscriber<T>>;

	constructor(section: string, defaultValue: T, updater: SettingUpdater<T>) {
		this.section = section;
		this.defaultValue = defaultValue;
		this.updater = updater;

		this._value = defaultValue;
		this.subscriptions = new Set();

		this.update();
	}

	get value() {
		return this._value;
	}

	async update() {
		const config = vscode.workspace.getConfiguration(configName);
		this._value = (await this.updater(config, this.section)) ?? this.defaultValue;
		for (const callback of this.subscriptions) callback(this.value);
	}

	subscribe(callback: SettingSubscriber<T>) {
		this.subscriptions.add(callback);
	}

	unsubscribe(callback: SettingSubscriber<T>) {
		this.subscriptions.delete(callback);
	}
}

export type Settings = ReturnType<typeof createSettings>;

export const createSettings = (context: vscode.ExtensionContext, engines: string[]) => {
	const configEngineNames = Object.fromEntries(
		engines.map((engine) => [engine, engine.toUpperCase()]),
	);

	const settings: Setting<any>[] = [];

	const createSetting = <T>(section: string, defaultValue: T, updater?: SettingUpdater<T>) => {
		const defaultUpdater: SettingUpdater<T> = (config, section) => config.get(section);
		const setting = new Setting<T>(section, defaultValue, updater ?? defaultUpdater);
		settings.push(setting);
		return setting;
	};

	const createGlobalSettings = () => ({
		intelliSense: {
			enable: {
				keywords: createSetting<boolean>("intelliSense.enable.keywords", true),
				callablesGame: createSetting<"off" | "non-deprecated" | "all">(
					"intelliSense.enable.callablesGame",
					"non-deprecated",
				),
				callablesScript: createSetting<boolean>("intelliSense.enable.callablesScript", true),
			},
			conciseMode: createSetting<boolean>("intelliSense.conciseMode", false),
			foldersSorting: createSetting<"top" | "bottom" | "inline">(
				"intelliSense.foldersSorting",
				"inline",
			),
		},
		colors: {
			enable: createSetting<"off" | "quotients" | "all">("colors.enable", "quotients"),
		},
	});

	const createEngineSettings = (engine: string) => ({
		featuresets: createSetting<{ [featureset: string]: boolean }>(
			`featureSets.${configEngineNames[engine]}`,
			{},
		),
		rootDirs: createSetting<vscode.Uri[]>(
			`rootDirectories.${configEngineNames[engine]}`,
			[],
			async (config, section) => {
				const paths: string[] = config.get(section, []);
				const uris = await Promise.all(
					paths.map(async (path) => {
						try {
							const uri = vscode.Uri.file(path);
							await vscode.workspace.fs.stat(uri);
							return uri;
						} catch {
							vscode.window.showWarningMessage(
								`Invalid ${engine.toUpperCase()} GSC root directory: "${path}" \
								Review your extension settings.`,
							);
						}
					}),
				);
				return uris.filter((uri): uri is vscode.Uri => uri !== undefined);
			},
		),
	});

	context.subscriptions.push(
		vscode.workspace.onDidChangeConfiguration((event) => {
			if (!event.affectsConfiguration(configName)) return;
			for (const setting of settings) {
				if (!event.affectsConfiguration(`${configName}.${setting.section}`)) continue;
				setting.update();
			}
		}),
	);

	return {
		...createGlobalSettings(),
		engines: Object.fromEntries(engines.map((engine) => [engine, createEngineSettings(engine)])),
	};
};
