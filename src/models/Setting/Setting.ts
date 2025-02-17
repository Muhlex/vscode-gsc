import * as vscode from "vscode";

export type SettingUpdater<T> = (value: any) => T;
export type SettingSubscriber = () => void;

export class Setting<T> {
	private readonly baseSection: string;
	private readonly section: string;
	private readonly updater: SettingUpdater<T>;

	private readonly cache: Map<string, T>;
	private readonly subscribers: Set<SettingSubscriber>;

	constructor(baseSection: string, section: string, updater?: SettingUpdater<T>) {
		this.baseSection = baseSection;
		this.section = section;
		this.updater = updater ?? Setting.rawValueUpdater;

		this.cache = new Map();
		this.subscribers = new Set();
	}

	get path() {
		return `${this.baseSection}.${this.section}`;
	}

	onDidChangeConfiguration(event: vscode.ConfigurationChangeEvent) {
		if (!event.affectsConfiguration(this.path)) return;
		this.cache.clear();
		for (const callback of this.subscribers) callback();
	}

	subscribe(callback: SettingSubscriber) {
		this.subscribers.add(callback);
		return new vscode.Disposable(() => this.subscribers.delete(callback));
	}

	get(scope: vscode.ConfigurationScope) {
		const config = vscode.workspace.getConfiguration(this.baseSection, scope);
		const scopeKey = this.getScopeKey(config, scope);
		const cached = this.cache.get(scopeKey);
		if (cached !== undefined) return cached;

		const value = this.updater(config.get(this.section));
		this.cache.set(scopeKey, value);
		return value;
	}

	private getScopeKey(config: vscode.WorkspaceConfiguration, scope: vscode.ConfigurationScope) {
		const inspect = config.inspect(this.section);
		if (!inspect) throw new Error(`Invalid configuration leaf: ${this.path}`);

		const languageId = (() => {
			if (!("languageId" in scope)) return undefined;
			const isLanguageScoped =
				inspect.globalLanguageValue !== undefined ||
				inspect.workspaceLanguageValue !== undefined ||
				inspect.workspaceFolderLanguageValue !== undefined;
			if (!isLanguageScoped) return undefined;
			return scope.languageId;
		})();
		const workspaceFolder = (() => {
			if (!("uri" in scope) || !scope.uri) return undefined;
			const isWorkspaceFolderScoped =
				inspect.workspaceFolderValue !== undefined ||
				inspect.workspaceFolderLanguageValue !== undefined;
			if (!isWorkspaceFolderScoped) return undefined;
			return vscode.workspace.getWorkspaceFolder(scope.uri)!;
		})();

		return JSON.stringify([languageId ?? "", workspaceFolder?.uri.toString(true) ?? ""]);
	}

	static rawValueUpdater<T>(value: any) {
		return value as T;
	}
}
