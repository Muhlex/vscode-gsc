import * as vscode from "vscode";
import { readDirectories, readJSON } from "./util";

import type { Engine } from "./models/Engine";
import { Providers } from "./providers";
import { createSettings } from "./settings";
import { Stores } from "./stores";

export async function activate(context: vscode.ExtensionContext) {
	const dataUri = vscode.Uri.joinPath(context.extensionUri, "data");
	const engineIds = await readDirectories(dataUri);
	const engines: Engine[] = await Promise.all(
		engineIds.map(async (id) => await readJSON(vscode.Uri.joinPath(dataUri, id, "meta.json"))),
	);

	const settings = createSettings(context, engines);
	for (const engine of engines) {
		const stores = new Stores(context, engine, settings);
		stores.init();
		const providers = new Providers(context, engine, settings, stores);
		providers.register();
	}
}
