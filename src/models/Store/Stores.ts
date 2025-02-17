import type * as vscode from "vscode";

import { StaticStore } from "./static/StaticStore";
import { GscStore } from "./gsc/GscStore";

import type { ExtensionSettings } from "../../settings";
import type { Engine } from "../Engine";

export class Stores {
	readonly static: StaticStore;
	readonly gsc: GscStore;

	constructor(engines: Engine[], settings: ExtensionSettings, dataPath: vscode.Uri) {
		this.static = new StaticStore(engines, settings, dataPath);
		this.gsc = new GscStore(engines, settings);
	}

	async init() {
		await Promise.all([this.static.init(), this.gsc.init()]);
	}

	dispose() {
		this.static.dispose();
		this.gsc.dispose();
	}
}
