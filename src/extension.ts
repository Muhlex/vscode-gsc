import * as vscode from "vscode";
import initProviders from "./providers/init";

export async function activate(context: vscode.ExtensionContext) {
	initProviders();

	vscode.workspace.onDidChangeConfiguration(event => {
		const reinitProviders = event.affectsConfiguration("GSC.intelliSense")
			|| event.affectsConfiguration("GSC.featureSets")
			|| event.affectsConfiguration("GSC.colors.enable")
			|| event.affectsConfiguration("GSC.rootFolders");
		if (reinitProviders) initProviders();
	});
}

// export function deactivate() {} // TODO: do we have to dispose of the providers manually?
