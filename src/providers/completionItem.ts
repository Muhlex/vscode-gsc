import * as vscode from "vscode";

import type { Stores } from "../stores";
import type { Settings } from "../settings";
import type { CallableDef } from "../models/Def";

import { getVariableString, createDocumentation } from "./shared";
import { hasFragmentAtPos } from "../models/Fragment";
import { removeFileExtension } from "../util";

export const createCompletionItemProvider = (
	stores: Stores,
	settings: Settings,
): vscode.CompletionItemProvider => ({
	async provideCompletionItems(document, position, token, context) {
		const file = stores.gsc.getFile(document);
		if (context.triggerCharacter) {
			const ignoredFragments = await file.getIgnoredFragments();
			if (token.isCancellationRequested) return;
			if (hasFragmentAtPos(ignoredFragments, position)) return;
		}

		const getItems = async () => {
			const intelliSense = settings.intelliSense;
			const items: vscode.CompletionItem[] = [];

			const linePreCursorText = document.lineAt(position).text.slice(0, position.character);
			const partialScriptPath = linePreCursorText.match(/[A-Za-z0-9_]+\\[A-Za-z0-9_\\]*$/)?.[0];
			const parentScriptPath = partialScriptPath
				? partialScriptPath.slice(0, partialScriptPath.lastIndexOf("\\"))
				: "";

			const scriptDir = stores.gsc.getScriptDir(parentScriptPath);
			if (scriptDir) {
				const foldersToTop = intelliSense.foldersSorting.value === "top";
				for (const [foldername] of scriptDir.children) {
					items.push(createFolderCompletionItem(foldername, foldersToTop));
				}
				const filesToTop = intelliSense.foldersSorting.value === "bottom";
				for (const [, script] of scriptDir.scripts) {
					const file = script.getFile();
					if (!file) continue;
					items.push(createFileCompletionItem(file.filename, filesToTop));
				}
			}

			if (partialScriptPath) return items;

			if (intelliSense.enable.keywords.value) {
				for (const keyword of stores.static.keywords) {
					items.push(createKeywordCompletionItem(keyword));
				}
			}

			const enableCallablesGame = intelliSense.enable.callablesGame.value;
			if (enableCallablesGame !== "off") {
				for (const [, def] of stores.static.callables) {
					if (def.deprecated && enableCallablesGame === "non-deprecated") continue;
					const documentation = createDocumentation(def, document.languageId, {
						concise: intelliSense.conciseMode.value,
					});
					items.push(createCallableCompletionItem(def, false, documentation));
				}
			}

			if (intelliSense.enable.callablesScript.value) {
				const defs = await file.getCallableDefsScope();
				if (token.isCancellationRequested) return items;
				for (const [, def] of defs) {
					items.push(createCallableCompletionItem(def, def.file === file));
				}
			}

			return items;
		};

		return { isIncomplete: false, items: await getItems() };
	},
});

const createKeywordCompletionItem = (keyword: string): vscode.CompletionItem => {
	return {
		label: keyword,
		kind: vscode.CompletionItemKind.Keyword,
	};
};

const createCallableCompletionItem = (
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

const createFolderCompletionItem = (
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

const createFileCompletionItem = (filename: string, sortToTop = false): vscode.CompletionItem => {
	return {
		label: filename,
		sortText: sortToTop ? `\u0000${filename}` : undefined,
		insertText: `${removeFileExtension(filename)}::`, // TODO: Remove :: when it's an include
		filterText: `\\${filename}`,
		kind: vscode.CompletionItemKind.File,
	};
};
