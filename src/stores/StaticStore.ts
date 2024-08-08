import * as vscode from "vscode";

import type { Settings } from "../settings";
import type { CallableDefsEngine, CallableDefGame } from "../models/Def";

export class StaticStore {
	keywords: readonly string[];
	callables: ReadonlyMap<string, CallableDefGame>;

	constructor(context: vscode.ExtensionContext, settings: Settings, engine: string) {
		this.keywords = [];
		this.callables = new Map();

		const defsUri = vscode.Uri.joinPath(context.extensionUri, "out", "defs", engine);

		this.initKeywords(defsUri);

		const featuresetsSetting = settings.engines[engine].featuresets;
		let cancellationTokenSource = new vscode.CancellationTokenSource();
		this.initCallables(defsUri, featuresetsSetting.value, cancellationTokenSource.token);

		const onFeaturesetsChange = (featuresets: { [featureset: string]: boolean }) => {
			cancellationTokenSource.cancel();
			cancellationTokenSource.dispose();
			cancellationTokenSource = new vscode.CancellationTokenSource();
			this.initCallables(defsUri, featuresets, cancellationTokenSource.token);
		};
		featuresetsSetting.subscribe(onFeaturesetsChange);

		context.subscriptions.push(
			new vscode.Disposable(() => {
				featuresetsSetting.unsubscribe(onFeaturesetsChange);
				cancellationTokenSource.dispose();
			}),
		);
	}

	private async initKeywords(defsUri: vscode.Uri) {
		const uri = vscode.Uri.joinPath(defsUri, "keyword.json");
		const data = await vscode.workspace.fs.readFile(uri);
		this.keywords = JSON.parse(data.toString());
	}

	private async initCallables(
		defsUri: vscode.Uri,
		featuresets: { [featureset: string]: boolean },
		token: vscode.CancellationToken,
	) {
		const uri = vscode.Uri.joinPath(defsUri, "callable.json");
		const data = await vscode.workspace.fs.readFile(uri);
		if (token.isCancellationRequested) return;
		const callableDefsEngine: CallableDefsEngine = JSON.parse(data.toString());

		const callableDefsEngineEnabled: CallableDefsEngine = {};

		for (const featureset in featuresets) {
			const enabled = featuresets[featureset];
			if (!enabled) continue;
			callableDefsEngineEnabled[featureset] = callableDefsEngine[featureset];
		}

		const callableDefs: Map<string, CallableDefGame> = new Map();

		for (const featureset in callableDefsEngineEnabled) {
			const callableDefsFeatureset = callableDefsEngineEnabled[featureset];
			for (const module in callableDefsFeatureset) {
				const callableDefsModule = callableDefsFeatureset[module];
				for (const ident in callableDefsModule) {
					const callableDef = callableDefsModule[ident];
					callableDef.origin = "game";

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
