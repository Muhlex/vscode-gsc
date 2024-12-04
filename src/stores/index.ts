import type * as vscode from "vscode";

import type { Settings } from "../settings";
import type { Engine } from "../models/Engine";

import { StaticStore } from "./StaticStore";
import { GscStore } from "./GscStore";

export class Stores {
	readonly static: StaticStore;
	readonly gsc: GscStore;

	constructor(context: vscode.ExtensionContext, engine: Engine, settings: Settings) {
		this.static = new StaticStore(context, engine, settings);
		this.gsc = new GscStore(context, engine, settings, this.static);
	}

	async init() {
		await Promise.all([this.static.init()/* TODO: , this.gsc.init() */]);
	}
}
