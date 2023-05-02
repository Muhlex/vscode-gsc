import * as vscode from "vscode";
import createProviders from "./create";

let initID = 0;
const disposables: vscode.Disposable[] = [];

export default async () => {
	initID++;
	const thisInitID = initID;
	disposables.forEach(d => d.dispose());

	const providers = await createProviders();
	const languageIDsToEngines = new Map<string, string>();

	if (initID !== thisInitID) return;

	for (const engine in providers) {
		const languageID = `gsc-${engine}`;
		languageIDsToEngines.set(languageID, engine);

		const {
			completionItemProvider,
			hoverProvider,
			signatureHelpProvider,
			rangeSemanticTokensProvider,
			semanticTokensLegend,
			definitionProvider,
			inlayHintsProvider,
			colorProvider,
			store
		} = providers[engine];

		disposables.push(store); // Always dispose stores which are created per engine!

		disposables.push(vscode.languages.registerCompletionItemProvider(
			languageID,
			completionItemProvider,
			"\\"
		));
		disposables.push(vscode.languages.registerHoverProvider(
			languageID,
			hoverProvider
		));
		disposables.push(vscode.languages.registerSignatureHelpProvider(
			languageID,
			signatureHelpProvider,
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
			rangeSemanticTokensProvider,
			semanticTokensLegend
		));
		disposables.push(vscode.languages.registerDefinitionProvider(
			languageID,
			definitionProvider
		));
		disposables.push(vscode.languages.registerInlayHintsProvider(
			languageID,
			inlayHintsProvider
		));
		if (vscode.workspace.getConfiguration("GSC.colors").get("enable")) {
			disposables.push(vscode.languages.registerColorProvider(
				languageID,
				colorProvider
			));
		}
	}

	disposables.push(vscode.workspace.onDidChangeTextDocument(event => {
		const engine = languageIDsToEngines.get(event.document.languageId);
		if (!engine) return;
		providers[engine].store.onDidChangeGscDocument(event);
	}));
};
