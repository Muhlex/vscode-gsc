import * as vscode from "vscode";
import initProviders from "./providers/init";

export async function activate(context: vscode.ExtensionContext) {
	initProviders();

	vscode.workspace.onDidChangeConfiguration(event => {
		const reinitProviders = [
			"GSC.intelliSense",
			"GSC.featureSets",
			"GSC.colors.enable",
			"GSC.rootFolders"
		].some(section => event.affectsConfiguration(section));
		if (reinitProviders) initProviders();
	});
}

// export function deactivate() {} // TODO: do we have to dispose of the providers manually?
