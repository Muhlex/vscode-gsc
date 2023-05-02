import * as vscode from "vscode";
import * as path from "path";

import { CallableDef } from "../types/Defs";

export const createKeywordCompletionItem = (keyword: string): vscode.CompletionItem => {
	return {
		label: keyword,
		kind: vscode.CompletionItemKind.Keyword
	};
};

export const createCallableCompletionItem = (
	def: CallableDef,
	documentation?: vscode.MarkdownString
): vscode.CompletionItem => {
	const getUsage = () => {
		return (def.receiver ? ("<" + (def.receiver.name || def.receiver.type) + "> ") : "")
			+ def.ident.name + "("
			+ (def.params?.map(p => `${p.optional ? "[" : "<"}${p.name}${p.optional ? "]" : ">"}`).join(", ") || "")
			+ ")";
	};

	const isEngine = Boolean(def.module && def.featureset);
	return {
		label: {
			label: def.ident.name,
			description: isEngine ? `${def.module} (${def.featureset})` : def.path || "(local)"
		},
		detail: getUsage(),
		documentation: documentation || def.description?.join("\n"),
		kind: def.receiver ? vscode.CompletionItemKind.Method : vscode.CompletionItemKind.Function,
		commitCharacters: [/* "(" */] // annoying when completion items are shown all the time
	};
};

export const createFolderCompletionItem = (foldername: string, sortToTop = false): vscode.CompletionItem => {
	return {
		label: foldername + "\\",
		sortText: sortToTop ? " " + foldername : undefined,
		command: { command: "editor.action.triggerSuggest", title: "Retrigger Suggest" },
		kind: vscode.CompletionItemKind.Folder
	};
};

export const createFileCompletionItem = (filename: string, sortToTop = false): vscode.CompletionItem => {
	return {
		label: filename,
		sortText: sortToTop ? "\u0000" + filename : undefined,
		insertText: path.parse(filename).name + "::",
		filterText: "\\" + filename,
		kind: vscode.CompletionItemKind.File
	};
};

export const createHover = (markdown: vscode.MarkdownString): vscode.Hover => {
	return new vscode.Hover(markdown);
};

export const createSignatures = (def: CallableDef): vscode.SignatureInformation[] => {
	if (!def.params) return [];
	const parameters = def.params.map(p => ({
		label: `${p.optional ? "[" : "<"}${p.name}${p.optional ? "]" : ">"}`,
		documentation: new vscode.MarkdownString(p.description?.join("\n") || "")
	}));
	return [{
		label: def.ident.name + "(" + parameters.map(({ label }) => label).join(", ") + ")",
		parameters
	}];
};
