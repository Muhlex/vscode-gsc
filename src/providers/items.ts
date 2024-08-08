import * as vscode from "vscode";
import * as path from "node:path";

import type { CallableDef, VariableDef } from "../types/Defs";

const getTypesString = (types?: string[]) => (types?.length ? types.join("/") : "");
const getVariableString = (v: VariableDef) => v.name || getTypesString(v.types) || "unknown";

export const createKeywordCompletionItem = (keyword: string): vscode.CompletionItem => {
	return {
		label: keyword,
		kind: vscode.CompletionItemKind.Keyword,
	};
};

export const createCallableCompletionItem = (
	def: CallableDef,
	isLocal = false,
	documentation?: vscode.MarkdownString,
): vscode.CompletionItem => {
	const getUsage = () => {
		return `${def.receiver ? `<${getVariableString(def.receiver)}> ` : ""}${def.ident.name}(${
			def.params
				?.map((p) => `${p.optional ? "[" : "<"}${getVariableString(p)}${p.optional ? "]" : ">"}`)
				.join(", ") || ""
		})`;
	};

	const isGame = def.origin === "game";
	return {
		label: {
			label: def.ident.name,
			description: isLocal
				? undefined
				: isGame
					? `${def.module} (${def.featureset})`
					: def.file.script?.path,
		},
		detail: getUsage(),
		documentation: documentation || def.description?.join("\n"),
		kind: def.receiver ? vscode.CompletionItemKind.Method : vscode.CompletionItemKind.Function,
		commitCharacters: [
			/* "(" */
		], // annoying because completion items are shown all the time
	};
};

export const createFolderCompletionItem = (
	foldername: string,
	sortToTop = false,
): vscode.CompletionItem => {
	return {
		label: `${foldername}\\`,
		sortText: sortToTop ? ` ${foldername}` : undefined,
		command: { command: "editor.action.triggerSuggest", title: "Retrigger Suggest" },
		kind: vscode.CompletionItemKind.Folder,
	};
};

export const createFileCompletionItem = (
	filename: string,
	sortToTop = false,
): vscode.CompletionItem => {
	return {
		label: filename,
		sortText: sortToTop ? `\u0000${filename}` : undefined,
		insertText: `${path.parse(filename).name}::`, // TODO: Remove :: when it's an include
		filterText: `\\${filename}`,
		kind: vscode.CompletionItemKind.File,
	};
};

export const createHover = (markdown: vscode.MarkdownString): vscode.Hover => {
	return new vscode.Hover(markdown);
};

export const createSignatures = (def: CallableDef): vscode.SignatureInformation[] => {
	if (!def.params) return [];
	const parameters = def.params.map((p) => ({
		label: `${p.optional ? "[" : "<"}${getVariableString(p)}${p.optional ? "]" : ">"}`,
		documentation: new vscode.MarkdownString(p.description?.join("\n") || ""),
	}));
	return [
		{
			label: `${def.ident.name}(${parameters.map(({ label }) => label).join(", ")})`,
			parameters,
		},
	];
};

export const createDocumentation = (def: CallableDef, engine: string, concise: boolean) => {
	const getVariableDoc = (v: VariableDef | undefined, kind: string) => {
		if (!v) return "";

		const types = getTypesString(v.types);
		return `${concise ? `${kind} ` : `*${kind}* `}${
			v.name ? `\`${v.name}\`${types ? " " : ""}` : ""
		}${types ? `*${types}*` : ""}${v.description ? ` — ${v.description.join("\n")}` : ""}`;
	};

	const isGame = def.origin === "game";
	const receiver = getVariableDoc(def.receiver, concise ? "📥️️" : "@receiver");
	const params =
		def.params
			?.map((p) => getVariableDoc(p, concise ? (p.optional ? "✳️️" : "✴️️") : "@param"))
			.join("\n\n") || "";
	const returns = getVariableDoc(def.return, concise ? "↩️️" : "@return");

	const variables = `\
${receiver ? `${receiver}\n\n` : ""}\
${params ? `${params}\n\n` : ""}\
${returns}`;

	const example = !def.example
		? ""
		: `\
${concise ? "" : "*Example:*\n"}
\`\`\`gsc-${engine}
${def.example.join("\n")}
\`\`\``;

	return new vscode.MarkdownString(`\
${isGame && def.deprecated ? "**👎️ Deprecated**\n\n" : ""}\
${isGame && def.devOnly ? "**🛠️️ Development only**\n\n" : ""}\
${def.description?.join("\n\n") || ""}\
${variables ? `\n***\n${variables}` : ""}\
${example ? `\n***\n${example}` : ""}`);
};
