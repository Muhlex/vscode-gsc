import * as vscode from "vscode";
import { readJSON } from "../../../util";

import { languageIdToEngineId, type Engine } from "../../Engine";
import type { ExtensionSettings } from "../../../settings";

import type { CallableDefGame } from "../../Callable";
import { CallableDefsGame } from "./CallableDefsGame";

export class StaticStore {
	private readonly engines: Engine[];
	private readonly settings: ExtensionSettings;
	private readonly dataPath: vscode.Uri;

	private callableDefsGame: CallableDefsGame;
	private readonly callableDefsByScope: Map<string, ReadonlyMap<string, CallableDefGame>>;

	private readonly disposables: vscode.Disposable[] = [];

	constructor(engines: Engine[], settings: ExtensionSettings, dataPath: vscode.Uri) {
		this.engines = engines;
		this.settings = settings;
		this.dataPath = dataPath;

		this.callableDefsGame = new CallableDefsGame();
		this.callableDefsByScope = new Map();
	}

	async init() {
		const callableDefsPath = vscode.Uri.joinPath(this.dataPath, "callables.json");
		this.callableDefsGame.addDefs(await readJSON(callableDefsPath));

		for (const { languageId } of this.engines) {
			const engineSettings = this.settings.engines[languageId];
			const disposable = engineSettings.featuresets.subscribe(() =>
				this.callableDefsByScope.clear(),
			);
			this.disposables.push(disposable);
		}
	}

	getCallableDefs(scope: vscode.ConfigurationScope & { languageId: string }) {
		const key = this.getCallableDefsKey(scope);
		let callables = this.callableDefsByScope.get(key);
		if (!callables) {
			const { languageId } = scope;
			const engineSettings = this.settings.engines[languageId];
			const featuresetFlags = engineSettings.featuresets.get(scope);
			const featuresetList = Object.keys(featuresetFlags).filter((key) => featuresetFlags[key]);
			callables = this.callableDefsGame.createScoped({
				engine: languageIdToEngineId(languageId),
				featuresets: featuresetList,
			});
			this.callableDefsByScope.set(key, callables);
		}
		return callables;
	}

	private getCallableDefsKey(scope: vscode.ConfigurationScope & { languageId: string }) {
		const { languageId } = scope;
		const engineSettings = this.settings.engines[languageId];
		const featuresets = engineSettings.featuresets.get(scope);

		return JSON.stringify([languageId, Object.values(featuresets)]);
	}

	dispose() {
		for (const disposable of this.disposables) disposable.dispose();
	}
}
