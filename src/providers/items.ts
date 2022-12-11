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
			+ def.ident + "("
			+ (def.params?.map(p => `${p.optional ? "[" : "<"}${p.name}${p.optional ? "]" : ">"}`).join(", ") || "")
			+ ")";
	};

	return {
		label: { label: def.ident, description: def.path || `${def.module} (${def.featureset})` },
		detail: getUsage(),
		documentation: documentation || def.description?.join("\n"),
		kind: def.receiver ? vscode.CompletionItemKind.Method : vscode.CompletionItemKind.Function,
		commitCharacters: ["("]
	};
};

export const createFolderCompletionItem = (foldername: string, sortToTop = false): vscode.CompletionItem => {
	return {
		label: foldername + "\\",
		sortText: sortToTop ? "0" + foldername : undefined,
		command: { command: "editor.action.triggerSuggest", title: "Retrigger Suggest" },
		kind: vscode.CompletionItemKind.Folder
	};
};

export const createFileCompletionItem = (filename: string, sortToTop = false): vscode.CompletionItem => {
	return {
		label: filename,
		sortText: sortToTop ? "0" + filename : undefined,
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
		label: def.ident + "(" + parameters.map(({ label }) => label).join(", ") + ")",
		parameters
	}];
};
