import * as vscode from "vscode";

import type { Settings } from "../settings";
import type { Engine } from "../models/Engine";
import type { Stores } from "../stores";

import { createCompletionItemProvider } from "./completionItem";
import { createSignatureHelpProvider } from "./signatureHelp";
import { createRangeSemanticTokensProvider, semanticTokensLegend } from "./semanticTokens";
import { createHoverProvider } from "./hover";
import { createDefinitionProvider } from "./definition";
import { createInlayHintsProvider } from "./inlayHints";
import { createColorProvider } from "./color";

export class Providers {
	private readonly context: vscode.ExtensionContext;
	private readonly languageId: string;
	private providers;

	constructor(
		context: vscode.ExtensionContext,
		engine: Engine,
		settings: Settings,
		stores: Stores,
	) {
		this.context = context;
		this.languageId = engine.languageId;
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
		const lId = this.languageId;
		const p = this.providers;
		const disposables = [
			l.registerCompletionItemProvider(lId, p.completionItem, "\\", ":"),
			l.registerSignatureHelpProvider(lId, p.signatureHelp, "(", ","),
			/**
			 * When registering both a whole document and a range SemanticTokensProvider, the former
			 * takes precedence after initial load. However it is slower. As long as we don't need the
			 * full document for our semantics, don't even provide the slower (full document) version.
			 * Official TS support currently does the same.
			 **/
			l.registerDocumentRangeSemanticTokensProvider(lId, p.semanticTokens, semanticTokensLegend),
			l.registerHoverProvider(lId, p.hover),
			l.registerDefinitionProvider(lId, p.definition),
			l.registerInlayHintsProvider(lId, p.inlayHints),
			l.registerColorProvider(lId, p.color),
		];
		this.context.subscriptions.push(...disposables);
	}
}
