import type * as vscode from "vscode";
import { createSettings } from "./settings";
import { createStores } from "./stores";
import { Providers } from "./providers";

export async function activate(context: vscode.ExtensionContext) {
	const contributes = context.extension.packageJSON.contributes;
	const languageIds = (contributes.languages as { id: string }[]).map(({ id }) => id);
	const engines = languageIds.map((id) => id.replace("gsc-", ""));

	const settings = createSettings(context, engines);
	for (const [i, engine] of engines.entries()) {
		const languageId = languageIds[i];
		const stores = createStores(context, settings, engine, languageId);
		const providers = new Providers(context, settings, languageId, stores);
		providers.register();
	}
}

// TODO: Update typescript and remove some casts in providers (done?)
