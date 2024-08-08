import type * as vscode from "vscode";
import type { Settings } from "../settings";

import { StaticStore } from "./StaticStore";
import { GscStore } from "./GscStore";

export const createStores = (
	context: vscode.ExtensionContext,
	settings: Settings,
	engine: string,
	languageId: string,
) => {
	const staticStore = new StaticStore(context, settings, engine);
	return {
		static: staticStore,
		gsc: new GscStore(context, settings, engine, languageId, staticStore),
	};
};

export type Stores = ReturnType<typeof createStores>;
