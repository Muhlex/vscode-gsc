import * as vscode from "vscode";

import type { Settings } from "../settings";
import type { StaticStore } from "../stores/StaticStore";
import type { GscStore } from "../stores/GscStore";

import { createCompletionItemProvider } from "./completionItem";
import { createSignatureHelpProvider } from "./signatureHelp";
import { createRangeSemanticTokensProvider, semanticTokensLegend } from "./semanticTokens";
import { createHoverProvider } from "./hover";
import { createDefinitionProvider } from "./definition";
import { createInlayHintsProvider } from "./inlayHints";
import { createColorProvider } from "./color";

export class Providers {
	private readonly context: vscode.ExtensionContext;
	private readonly languageID: string;
	private providers;

	constructor(
		context: vscode.ExtensionContext,
		settings: Settings,
		languageID: string,
		stores: { static: StaticStore; gsc: GscStore },
	) {
		this.context = context;
		this.languageID = languageID;
		this.providers = {
			completionItem: createCompletionItemProvider(stores, settings),
			signatureHelp: createSignatureHelpProvider(stores),
			semanticTokens: createRangeSemanticTokensProvider(stores),
			hover: createHoverProvider(stores, settings),
			definition: createDefinitionProvider(stores),
			inlayHints: createInlayHintsProvider(stores),
			color: createColorProvider(stores, settings),
		};
	}

	register() {
		const l = vscode.languages;
		const p = this.providers;
		const langId = this.languageID;
		const disposables = [
			l.registerCompletionItemProvider(langId, p.completionItem, "\\"),
			l.registerSignatureHelpProvider(langId, p.signatureHelp, "(", ","),
			/**
			 * When registering both a whole document and a range SemanticTokensProvider, the former
			 * takes precedence after initial load. However it is slower. As long as we don't need the
			 * full document for our semantics, don't even provide the slower (full document) version.
			 * Official TS support currently does the same.
			 **/
			l.registerDocumentRangeSemanticTokensProvider(langId, p.semanticTokens, semanticTokensLegend),
			l.registerHoverProvider(langId, p.hover),
			l.registerDefinitionProvider(langId, p.definition),
			l.registerInlayHintsProvider(langId, p.inlayHints),
			l.registerColorProvider(langId, p.color),
		];
		this.context.subscriptions.push(...disposables);
	}
}
