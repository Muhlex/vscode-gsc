import * as vscode from "vscode";

import type { ExtensionSettings } from "../settings";
import type { Stores, ScriptDir } from "../models/Store";
import type { CallableDef, CallableDefScript } from "../models/Callable";

import { removeFileExtension } from "../util";
import { createDocumentation, createUsage } from "./shared";

export const createCompletionItemProvider = (
	stores: Stores,
	settings: ExtensionSettings,
): vscode.CompletionItemProvider => ({
	async provideCompletionItems(document, position, token, context) {
		const file = stores.gsc.ensureFile(document);
		if (context.triggerCharacter) {
			if (context.triggerCharacter === ":") {
				// only trigger on double colon
				if (position.character < 2) return;
				const withPrev = document.getText(new vscode.Range(position.translate(0, -2), position));
				if (withPrev !== "::") return;
			}
		}

		const textSegments = await file.getTextSegments();
		if (token.isCancellationRequested) return;
		if (textSegments.hasAt(position)) return;

		const getItems = async () => {
			const intelliSense = settings.intelliSense;
			const enableKeywords = settings.intelliSense.enable.keywords.get(document);
			const enableCallablesGame = settings.intelliSense.enable.callablesGame.get(document);
			const enableCallablesScript = settings.intelliSense.enable.callablesScript.get(document);
			const conciseMode = settings.intelliSense.conciseMode.get(document);
			const items: vscode.CompletionItem[] = [];

			const createKeywords = () => {
				if (!enableKeywords) return;
				for (const keyword of stores.static.getKeywords(document)) {
					items.push(createKeywordCompletionItem(keyword));
				}
			};

			const createCallablesGame = () => {
				if (enableCallablesGame === "off") return;
				for (const [, def] of stores.static.getCallableDefs(document)) {
					if (def.deprecated && enableCallablesGame === "non-deprecated") continue;
					items.push(
						createCallableCompletionItem(def, document.languageId, { concise: conciseMode }),
					);
				}
			};

			const createCallablesScript = (defs: Iterable<CallableDefScript>) => {
				if (!enableCallablesScript) return;
				for (const def of defs) {
					items.push(
						createCallableCompletionItem(def, document.languageId, {
							concise: conciseMode,
							local: def.file === file,
						}),
					);
				}
			};

			const createCallablesScope = async () => {
				const defsScope = await file.getCallableDefsScope();
				if (token.isCancellationRequested) return;
				createCallablesGame();
				createCallablesScript(defsScope.values());
			};

			const createGscScripts = (scriptDir: GscScriptDir, isDirective = false) => {
				const foldersToTop = intelliSense.foldersSorting.value === "top";
				const filesToTop = intelliSense.foldersSorting.value === "bottom";
				for (const [foldername] of scriptDir.children) {
					items.push(createFolderCompletionItem(foldername, foldersToTop));
				}
				for (const [, script] of scriptDir.scripts) {
					const file = script.getFile();
					if (!file) continue;
					items.push(createFileCompletionItem(file.filename, filesToTop, !isDirective));
				}
			};

			const createWhitespaceLinesReader = (startLineIndex: number) => {
				let line = document.lineAt(startLineIndex);
				let text = line.text;
				return (offset: number) => {
					text = text.slice(0, offset);
					if (!/^\s*$/.test(text)) return text;
					while (line.lineNumber > 0) {
						line = document.lineAt(line.lineNumber - 1);
						text = `${line.text}\n${text}`;
						if (!line.isEmptyOrWhitespace) break;
					}
					return text;
				};
			};

			const readLines = createWhitespaceLinesReader(position.line);
			const preCursorText = readLines(position.character);

			// scope resolution (::)
			const scopeResSeparatorMatch = preCursorText.match(/::\s*([A-Za-z_][\w]*)?$/);
			if (scopeResSeparatorMatch) {
				const preSeparatorText = readLines(scopeResSeparatorMatch.index!);
				const scriptPath = preSeparatorText.match(/([\w\\]*\w)\s*$/)?.[1] ?? "";
				if (!scriptPath) {
					await createCallablesScope();
					return items;
				}
				const file = stores.gsc.getScript(scriptPath)?.getFile();
				if (!file) return items;
				const defs = await file.getCallableDefs();
				if (token.isCancellationRequested) return items;
				createCallablesScript(defs.byName.values());
				return items;
			}

			// scope script paths
			const partialScriptMatch = preCursorText.match(/\w[\w\\]*$/);
			const partialScriptPath = partialScriptMatch?.[0] ?? "";
			const lastSlashIndex = partialScriptPath.lastIndexOf("\\");
			const parentScriptPath =
				lastSlashIndex !== -1 ? partialScriptPath.slice(0, lastSlashIndex) : "";

			const scriptDir = stores.gsc.getScriptDir(parentScriptPath);
			if (!scriptDir) return items;
			const preScriptPathText = partialScriptMatch
				? readLines(partialScriptMatch.index!)
				: preCursorText;
			const isDirective = /#[a-z_]+\s+/.test(preScriptPathText);
			createGscScripts(scriptDir, isDirective);
			if (scriptDir.parent || isDirective) return items;

			createKeywords();
			await createCallablesScope();
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
	languageId: string,
	options: {
		local?: boolean;
		concise?: boolean;
	},
): vscode.CompletionItem => {
	const isGame = def.origin === "game";
	return {
		label: {
			label: def.name.text,
			description: options.local
				? undefined
				: isGame
					? `${def.module} (${def.featureset})`
					: def.file.script?.path,
		},
		detail: createUsage(def),
		documentation: createDocumentation(def, languageId, { concise: options.concise }),
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

const createFileCompletionItem = (
	filename: string,
	sortToTop = false,
	addSeparator = true,
): vscode.CompletionItem => {
	return {
		label: filename,
		sortText: sortToTop ? `\u0000${filename}` : undefined,
		insertText: `${removeFileExtension(filename)}${addSeparator ? "::" : ""}`,
		command: addSeparator
			? { command: "editor.action.triggerSuggest", title: "Retrigger Suggest" }
			: undefined,
		filterText: `\\${filename}`,
		kind: vscode.CompletionItemKind.File,
	};
};
