import * as vscode from "vscode";
import { readJSON } from "../../../util";

import { languageIdToEngineId, type Engine } from "../../Engine";
import type { ExtensionSettings } from "../../../settings";

import type { CallableDefGame } from "../../Callable";
import { CallableDefsGameRepo } from "./CallableDefsGameRepo";
import { KeywordsRepo } from "./KeywordsRepo";

export class StaticStore {
	private readonly engines: Engine[];
	private readonly settings: ExtensionSettings;
	private readonly dataPath: vscode.Uri;

	private readonly keywords: KeywordsRepo;
	private readonly keywordsByScope: Map<string, string[]>;
	private readonly callableDefsGame: CallableDefsGameRepo;
	private readonly callableDefsGameByScope: Map<string, ReadonlyMap<string, CallableDefGame>>;

	private readonly disposables: vscode.Disposable[] = [];

	constructor(engines: Engine[], settings: ExtensionSettings, dataPath: vscode.Uri) {
		this.engines = engines;
		this.settings = settings;
		this.dataPath = dataPath;

		this.keywords = new KeywordsRepo();
		this.keywordsByScope = new Map();
		this.callableDefsGame = new CallableDefsGameRepo();
		this.callableDefsGameByScope = new Map();
	}

	async init() {
		const keywordsPath = vscode.Uri.joinPath(this.dataPath, "keywords.json");
		this.keywords.addRaw(await readJSON(keywordsPath));

		const callableDefsPath = vscode.Uri.joinPath(this.dataPath, "callables.json");
		this.callableDefsGame.addRaw(await readJSON(callableDefsPath));

		for (const { languageId } of this.engines) {
			const engineSettings = this.settings.engines[languageId];
			const disposable = engineSettings.featuresets.subscribe(() =>
				this.callableDefsGameByScope.clear(),
			);
			this.disposables.push(disposable);
		}
	}

	getKeywords(scope: vscode.ConfigurationScope & { languageId: string }) {
		const key = this.getEngineScopeKey(scope);
		let keywords = this.keywordsByScope.get(key);
		if (!keywords) {
			const { languageId } = scope;
			keywords = this.keywords.createScoped({ engine: languageIdToEngineId(languageId) });
			this.keywordsByScope.set(key, keywords);
		}
		return keywords;
	}

	getCallableDefs(scope: vscode.ConfigurationScope & { languageId: string }) {
		const key = this.getFeaturesetsScopeKey(scope);
		let callables = this.callableDefsGameByScope.get(key);
		if (!callables) {
			const { languageId } = scope;
			const engineSettings = this.settings.engines[languageId];
			const featuresetFlags = engineSettings.featuresets.get(scope);
			const featuresetList = Object.keys(featuresetFlags).filter((key) => featuresetFlags[key]);
			callables = this.callableDefsGame.createScoped({
				engine: languageIdToEngineId(languageId),
				featuresets: featuresetList,
			});
			this.callableDefsGameByScope.set(key, callables);
		}
		return callables;
	}

	private getEngineScopeKey(scope: vscode.ConfigurationScope & { languageId: string }) {
		return scope.languageId;
	}

	private getFeaturesetsScopeKey(scope: vscode.ConfigurationScope & { languageId: string }) {
		const { languageId } = scope;
		const engineSettings = this.settings.engines[languageId];
		const featuresets = engineSettings.featuresets.get(scope);

		return JSON.stringify([languageId, Object.values(featuresets)]);
	}

	dispose() {
		for (const disposable of this.disposables) disposable.dispose();
	}
}
