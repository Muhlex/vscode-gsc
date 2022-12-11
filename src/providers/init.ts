import * as vscode from "vscode";
import getProviders from "./providers";

let initID = 0;
const disposables: vscode.Disposable[] = [];

export default async () => {
	initID++;
	const thisInitID = initID;
	disposables.forEach(d => d.dispose());

	const providers = await getProviders();

	if (initID !== thisInitID) return;

	for (const engine in providers) {
		const languageID = ("gsc-" + engine);
		disposables.push(vscode.languages.registerCompletionItemProvider(
			languageID,
			providers[engine].completionItemProvider,
			"\\"
		));
		disposables.push(vscode.languages.registerHoverProvider(
			languageID,
			providers[engine].hoverProvider
		));
		disposables.push(vscode.languages.registerSignatureHelpProvider(
			languageID,
			providers[engine].signatureHelpProvider,
			"(", ","
		));
		/**
		 * When registering both a whole document and a range SemanticTokensProvider, the former
		 * takes precedence after initial load. However it is slower. As long as we don't need the
		 * full document for our semantics, don't even provide the slower (full document) version.
		 * Official TS support currently does the same.
		 **/
		disposables.push(vscode.languages.registerDocumentRangeSemanticTokensProvider(
			languageID,
			providers[engine].rangeSemanticTokensProvider,
			providers[engine].semanticTokensLegend
		));
		disposables.push(vscode.languages.registerDefinitionProvider(
			languageID,
			providers[engine].definitionProvider
		));
		disposables.push(vscode.languages.registerInlayHintsProvider(
			languageID,
			providers[engine].inlayHintsProvider
		));
		if (vscode.workspace.getConfiguration("GSC.colors").get("enable")) {
			disposables.push(vscode.languages.registerColorProvider(
				languageID,
				providers[engine].colorProvider
			));
		}
	}
};
