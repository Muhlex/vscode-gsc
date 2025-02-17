import * as vscode from "vscode";

import { Settings } from "./models/Setting";
import type { Engine } from "./models/Engine";

export const createSettings = (engines: Engine[]) => {
	return new Settings("GSC", (createSetting) => {
		const globalSettings = {
			intelliSense: {
				enable: {
					keywords: createSetting<boolean>("intelliSense.enable.keywords"),
					callablesGame: createSetting<"off" | "non-deprecated" | "all">(
						"intelliSense.enable.callablesGame",
					),
					callablesScript: createSetting<boolean>("intelliSense.enable.callablesScript"),
				},
				conciseMode: createSetting<boolean>("intelliSense.conciseMode"),
				foldersSorting: createSetting<"top" | "bottom" | "inline">("intelliSense.foldersSorting"),
			},
			colors: {
				enable: createSetting<"off" | "quotients" | "all">("colors.enable"),
			},
		};

		const createEngineSettings = (engine: Engine) => ({
			featuresets: createSetting<{ [featureset: string]: boolean }>(
				`featureSets.${engine.displayName}`,
			),
			rootUris: createSetting<Promise<vscode.Uri[]>>(
				`rootDirectories.${engine.displayName}`,
				async (paths: string[]) => {
					const uris = await Promise.all(
						paths.map(async (path) => {
							try {
								const uri = vscode.Uri.file(path);
								await vscode.workspace.fs.stat(uri);
								// TODO: Check if it's a folder
								return uri;
							} catch {
								vscode.window.showWarningMessage(
									`Invalid ${engine.displayName} GSC root directory: "${path}" \
									Review your extension settings.`,
								);
							}
						}),
					);
					return uris.filter((uri): uri is vscode.Uri => uri !== undefined);
				},
			),
		});

		return {
			...globalSettings,
			engines: Object.fromEntries(engines.map((e) => [e.languageId, createEngineSettings(e)])),
		};
	});
};

export type ExtensionSettings = ReturnType<typeof createSettings>["tree"];
