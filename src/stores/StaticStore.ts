import * as vscode from "vscode";

import type { Settings } from "../settings";
import type { Engine } from "../models/Engine";
import type { CallableDefsEngine, CallableDefGame } from "../models/Def";

import { readJSON } from "../util";

export class StaticStore {
	private context: vscode.ExtensionContext;
	private engine: Engine;
	private settings: Settings;

	keywords: readonly string[];
	callables: ReadonlyMap<string, CallableDefGame>;

	constructor(context: vscode.ExtensionContext, engine: Engine, settings: Settings) {
		this.context = context;
		this.engine = engine;
		this.settings = settings;

		this.keywords = [];
		this.callables = new Map();
	}

	public init() {
		const { context, engine, settings } = this;
		const engineDataUri = vscode.Uri.joinPath(context.extensionUri, "data", engine.id);
		const promises = [];

		promises.push(this.initKeywords(engineDataUri));

		const featuresetsSetting = settings.engines[engine.id].featuresets;
		let cancellationTokenSource = new vscode.CancellationTokenSource();
		promises.push(
			this.initCallables(engineDataUri, featuresetsSetting.value, cancellationTokenSource.token),
		);

		const onFeaturesetsChange = (featuresets: { [featureset: string]: boolean }) => {
			cancellationTokenSource.cancel();
			cancellationTokenSource.dispose();
			cancellationTokenSource = new vscode.CancellationTokenSource();
			this.initCallables(engineDataUri, featuresets, cancellationTokenSource.token);
		};
		featuresetsSetting.subscribe(onFeaturesetsChange);

		context.subscriptions.push(
			new vscode.Disposable(() => {
				featuresetsSetting.unsubscribe(onFeaturesetsChange);
				cancellationTokenSource.dispose();
			}),
		);

		return Promise.all(promises);
	}

	private async initKeywords(engineDataUri: vscode.Uri) {
		const uri = vscode.Uri.joinPath(engineDataUri, "keyword.json");
		this.keywords = await readJSON(uri);
	}

	private async initCallables(
		engineDataUri: vscode.Uri,
		featuresets: { [featureset: string]: boolean },
		token: vscode.CancellationToken,
	) {
		const uri = vscode.Uri.joinPath(engineDataUri, "callable.json");
		const callableDefsEngine: CallableDefsEngine = await readJSON(uri);
		if (token.isCancellationRequested) return;

		const callableDefs: Map<string, CallableDefGame> = new Map();
		for (const [featureset, enabled] of Object.entries(featuresets)) {
			if (!enabled) continue;
			const callableDefsFeatureset = callableDefsEngine[featureset];
			for (const module in callableDefsFeatureset) {
				const callableDefsModule = callableDefsFeatureset[module];
				for (const ident in callableDefsModule) {
					const callableDef = callableDefsModule[ident];
					callableDef.origin = "game";
					callableDef.ident = { name: ident };
					callableDef.module = module;
					callableDef.featureset = featureset;

					const identLc = ident.toLowerCase();
					const existingDef = callableDefs.get(identLc);
					if (existingDef && (existingDef.priority ?? 0) >= (callableDef.priority ?? 0)) continue;
					callableDefs.set(identLc, callableDef);
				}
			}
		}

		this.callables = callableDefs;
	}
}
