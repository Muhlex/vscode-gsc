import * as vscode from "vscode";
import { readDirectories, readJSON } from "./util";

import type { Engine } from "./models/Engine";

import { createSettings } from "./settings";
import { Providers } from "./providers";
import { Stores } from "./models/Store";

export async function activate(context: vscode.ExtensionContext) {
	const dataUri = vscode.Uri.joinPath(context.extensionUri, "data");
	const engineIds = await readDirectories(dataUri);
	const engines: Engine[] = await Promise.all(
		engineIds.map(async (id) => await readJSON(vscode.Uri.joinPath(dataUri, id, "engine.json"))),
	);

	const settings = createSettings(engines);
	context.subscriptions.push(settings);

	const stores = new Stores(engines, settings.tree, dataUri);
	context.subscriptions.push(stores);
	await stores.init();

	for (const engine of engines) {
		const providers = new Providers(engine, settings.tree, stores);
		providers.register();

		context.subscriptions.push(providers);
	}
}
