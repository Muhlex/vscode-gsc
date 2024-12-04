import * as vscode from "vscode";
import type { Engine } from "./models/Engine";

import { readDirectories, readJSON } from "./util";
import { createSettings } from "./settings";
import { Stores } from "./stores";
import { Providers } from "./providers";

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
