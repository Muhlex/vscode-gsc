import * as vscode from "vscode";
import * as path from "node:path";

import { loadStaticData } from "./static";
import { GscStore } from "./GscStore";
import { getIsPosInsideParsedBlocks } from "./parse";
import { escapeRegExp, isCall, isReference } from "../util";
import {
	createCallableCompletionItem,
	createDocumentation,
	createFileCompletionItem,
	createFolderCompletionItem,
	createHover,
	createKeywordCompletionItem,
	createSignatures,
} from "./items";

const createEngineProviders = async (engine: string, defsUri: vscode.Uri) => {
	const staticData = await loadStaticData(engine, defsUri);
	const store = new GscStore({ engine, staticData });
	const getDef = async (ident: string, document: vscode.TextDocument) => {
		const identLc = ident.toLowerCase();
		return (
			staticData.defs.callable.get(identLc) ??
			(await store.getFile(document).getCallableDefsInScope()).get(identLc)
		);
	};

	const completionItemProvider: vscode.CompletionItemProvider = {
		async provideCompletionItems(document, position, token, context) {
			const file = store.getFile(document);
			if (context.triggerCharacter) {
				const ignoredBlocks = await file.getIgnoredBlocks();
				if (getIsPosInsideParsedBlocks(ignoredBlocks, position)) return;
			}

			const getItems = async () => {
				const items: vscode.CompletionItem[] = [];

				const linePreCursorText = document.lineAt(position).text.slice(0, position.character);
				const partialScriptPath = linePreCursorText.match(/[A-Za-z0-9_]+\\[A-Za-z0-9_\\]*$/)?.[0];
				const parentScriptPath = partialScriptPath
					? partialScriptPath.slice(0, partialScriptPath.lastIndexOf("\\"))
					: "";

				const scriptDir = store.getScriptDir(parentScriptPath);
				if (scriptDir) {
					const foldersToTop = staticData.config.foldersSorting === "top";
					for (const [foldername] of scriptDir.children) {
						items.push(createFolderCompletionItem(foldername, foldersToTop));
					}
					const filesToTop = staticData.config.foldersSorting === "bottom";
					for (const [filename] of scriptDir.scripts) {
						items.push(createFileCompletionItem(filename, filesToTop));
					}
				}

				if (partialScriptPath) return items;

				for (const def of staticData.defs.keyword) {
					items.push(createKeywordCompletionItem(def));
				}

				for (const [, def] of staticData.defs.callable) {
					items.push(
						createCallableCompletionItem(
							def,
							false,
							createDocumentation(def, engine, staticData.config.conciseMode),
						),
					);
				}
				for (const [, def] of await file.getCallableDefsInScope()) {
					items.push(createCallableCompletionItem(def, def.file === file));
				}

				return items;
			};

			return { isIncomplete: false, items: await getItems() };
		},
	};

	const hoverProvider: vscode.HoverProvider = {
		async provideHover(document, position, token) {
			if (getIsPosInsideParsedBlocks(await store.getFile(document).getIgnoredBlocks(), position))
				return;

			const wordRange = document.getWordRangeAtPosition(position, /[A-Za-z_][A-Za-z0-9_]*/);
			if (!wordRange) return;
			if (!isCall(wordRange, document) && !isReference(wordRange, document)) return;

			const word = document.getText(wordRange);
			const def = await getDef(word, document);
			if (!def) return;

			return createHover(createDocumentation(def, engine, staticData.config.conciseMode));
		},
	};

	const _NL = "\n".charCodeAt(0);
	const _TAB = "\t".charCodeAt(0);
	const _WSB = " ".charCodeAt(0);
	const _lBracket = "[".charCodeAt(0);
	const _rBracket = "]".charCodeAt(0);
	const _lCurly = "{".charCodeAt(0);
	const _rCurly = "}".charCodeAt(0);
	const _lParent = "(".charCodeAt(0);
	const _rParent = ")".charCodeAt(0);
	const _comma = ",".charCodeAt(0);
	const _quote = "'".charCodeAt(0);
	const _dQuote = '"'.charCodeAt(0);
	const _underscore = "_".charCodeAt(0);
	const _a = "a".charCodeAt(0);
	const _z = "z".charCodeAt(0);
	const _A = "A".charCodeAt(0);
	const _Z = "Z".charCodeAt(0);
	const _0 = "0".charCodeAt(0);
	const _9 = "9".charCodeAt(0);

	const signatureHelpProvider: vscode.SignatureHelpProvider = {
		async provideSignatureHelp(document, position, token, context) {
			// Adapted from php-language-features extension ((c) Microsoft Corporation):
			// https://github.com/microsoft/vscode/blob/dbae720630e5996cc4d05c14649480a19b077d78/extensions/php-language-features/src/features/signatureHelpProvider.ts
			class BackwardIterator {
				private lineNumber: number;
				private offset: number;
				private line: string;
				private model: vscode.TextDocument;

				constructor(model: vscode.TextDocument, offset: number, lineNumber: number) {
					this.lineNumber = lineNumber;
					this.offset = offset;
					this.line = model.lineAt(this.lineNumber).text;
					this.model = model;
				}

				hasNext(): boolean {
					return this.lineNumber >= 0;
				}

				next(): number {
					if (this.offset < 0) {
						if (this.lineNumber > 0) {
							this.lineNumber--;
							this.line = this.model.lineAt(this.lineNumber).text;
							this.offset = this.line.length - 1;
							return _NL;
						}
						this.lineNumber = -1;
						return 0;
					}
					const ch = this.line.charCodeAt(this.offset);
					this.offset--;
					return ch;
				}
			}

			const readArguments = (iterator: BackwardIterator): number => {
				let parentNesting = 0;
				let bracketNesting = 0;
				let curlyNesting = 0;
				let paramCount = 0;
				while (iterator.hasNext()) {
					const ch = iterator.next();
					switch (ch) {
						case _lParent:
							parentNesting--;
							if (parentNesting < 0) {
								return paramCount;
							}
							break;
						case _rParent:
							parentNesting++;
							break;
						case _lCurly:
							curlyNesting--;
							break;
						case _rCurly:
							curlyNesting++;
							break;
						case _lBracket:
							bracketNesting--;
							break;
						case _rBracket:
							bracketNesting++;
							break;
						case _dQuote:
						case _quote:
							while (iterator.hasNext() && ch !== iterator.next()) {
								// find the closing quote or double quote
							}
							break;
						case _comma:
							if (!parentNesting && !bracketNesting && !curlyNesting) {
								paramCount++;
							}
							break;
					}
				}
				return -1;
			};

			const readIdent = (iterator: BackwardIterator): string => {
				const isIdentPart = (ch: number): boolean => {
					return (
						ch === _underscore || // _
						(ch >= _a && ch <= _z) || // a-z
						(ch >= _A && ch <= _Z) || // A-Z
						(ch >= _0 && ch <= _9) // 0-9
					);
				};

				let identStarted = false;
				let ident = "";
				while (iterator.hasNext()) {
					const ch = iterator.next();
					if (!identStarted && (ch === _WSB || ch === _TAB || ch === _NL)) continue;

					if (isIdentPart(ch)) {
						identStarted = true;
						ident = String.fromCharCode(ch) + ident;
					} else if (identStarted) {
						return ident;
					}
				}
				return ident;
			};

			const iterator = new BackwardIterator(document, position.character - 1, position.line);

			const activeParam = readArguments(iterator);
			if (activeParam < 0) return;

			const ident = readIdent(iterator);
			if (!ident) return;

			const def = await getDef(ident, document);
			if (!def) return;

			const signatures = createSignatures(def);

			return {
				activeSignature: 0,
				activeParameter: Math.min(activeParam, signatures[0].parameters.length - 1),
				signatures,
			};
		},
	};

	const semanticTokensLegend = (() => {
		const types = ["function", "method", "parameter"];
		const modifiers = ["definition", "defaultLibrary", "deprecated"];
		return new vscode.SemanticTokensLegend(types, modifiers);
	})();

	const provideSemanticTokens = async (document: vscode.TextDocument, range?: vscode.Range) => {
		const builder = new vscode.SemanticTokensBuilder();
		const file = store.getFile(document);
		const ignoredBlocks = await file.getIgnoredBlocks();

		const provideFromGame = () => {
			const text = document.getText(range);
			const callOrRef = /::\s*\b([A-Za-z_][A-Za-z0-9_]*)\b|\b([A-Za-z_][A-Za-z0-9_]*)\b\s*\(/dg;

			// Typescript doesn't yet know about .indices in RegExpMatchArray
			for (const match of text.matchAll(callOrRef) as IterableIterator<
				RegExpMatchArray & { indices: Array<[number, number]> }
			>) {
				const ident = match[1] || match[2];
				const def = staticData.defs.callable.get(ident.toLowerCase());
				if (!def) continue;

				const offset = range ? document.offsetAt(range.start) : 0;
				const index = (match.indices[1] || match.indices[2])[0];
				const startPos = document.positionAt(index + offset);

				if (getIsPosInsideParsedBlocks(ignoredBlocks, startPos)) continue;

				const type = def.receiver ? 1 : 0;
				const modifiers = def.deprecated ? 0b110 : 0b010;
				builder.push(startPos.line, startPos.character, ident.length, type, modifiers);
			}
		};

		const provideFromScript = async () => {
			for (const [, { ident, params, body }] of await file.getCallableDefs()) {
				if (range && range.end.compareTo(ident.range.start) < 0) break;
				builder.push(
					ident.range.start.line,
					ident.range.start.character,
					ident.name.length,
					0,
					0b1,
				);

				for (const param of params) {
					builder.push(
						param.range.start.line,
						param.range.start.character,
						param.name.length,
						2,
						0b1,
					);

					// Only respect the requested range for the function body as otherwise the checks
					// would be more expensive than just providing the semantic tokens out of range:
					if (range && !range.intersection(body.range)) continue;

					const extBody = {
						...body,
						text: document.getText(body.range),
						offset: document.offsetAt(body.range.start),
					};

					// Params in body
					// TODO: Parse these centrally to allow refactoring?
					const regexp = new RegExp(
						String.raw`\b(?<!\.)${escapeRegExp(param.name)}(?!\s*\()\b`,
						"g",
					);
					const matches = extBody.text.matchAll(regexp) as IterableIterator<
						RegExpMatchArray & { index: number }
					>;
					for (const match of matches) {
						const startPos = document.positionAt(extBody.offset + match.index);
						if (getIsPosInsideParsedBlocks(ignoredBlocks, startPos)) continue;
						builder.push(startPos.line, startPos.character, param.name.length, 2);
					}
				}
			}
		};

		provideFromGame();
		await provideFromScript();

		return builder.build();
	};

	const semanticTokensProvider: vscode.DocumentSemanticTokensProvider = {
		async provideDocumentSemanticTokens(document, token) {
			return await provideSemanticTokens(document);
		},
	};

	const rangeSemanticTokensProvider: vscode.DocumentRangeSemanticTokensProvider = {
		async provideDocumentRangeSemanticTokens(document, range, token) {
			return await provideSemanticTokens(document, range);
		},
	};

	const definitionProvider: vscode.DefinitionProvider = {
		async provideDefinition(document, position, token) {
			const file = store.getFile(document);
			if (getIsPosInsideParsedBlocks(await file.getIgnoredBlocks(), position)) return;

			const wordRange = document.getWordRangeAtPosition(position, /[A-Za-z_][A-Za-z0-9_]*/);
			if (!wordRange) return;
			if (!isCall(wordRange, document) && !isReference(wordRange, document)) return;

			const defs = await file.getCallableDefsInScope();
			const ident = document.getText(wordRange);
			const def = defs.get(ident.toLowerCase());
			if (!def) return;
			if (wordRange.isEqual(def.ident.range)) return;

			return new vscode.Location(def.file.uri, def.ident.range);
		},
	};

	const inlayHintsProvider: vscode.InlayHintsProvider = {
		async provideInlayHints(document, range, token) {
			const result: vscode.InlayHint[] = [];

			for (const instance of await store.getFile(document).getCallableInstancesDefined()) {
				const def = instance.def;
				if (!def || !def.params) continue;
				if (!instance.params || instance.params.length < 1) continue;
				if (range.start.isAfter(instance.params[instance.params.length - 1].range.start)) continue;
				if (range.end.isBefore(instance.params[0].range.start)) break;

				for (const [i, param] of instance.params.entries()) {
					if (!def.params[i]) break;
					result.push({
						position: param.range.start,
						label: `${def.params[i].name}:`,
						kind: vscode.InlayHintKind.Parameter,
						paddingRight: true,
					});
				}
			}

			return result;
		},
	};

	const colorProvider: vscode.DocumentColorProvider = {
		provideColorPresentations(color, context, token) {
			const toBase = (value: number, base = 255) => `${Math.round(value * base)}/${base}`;
			const labels = [
				`(${color.red.toFixed(2)}, ${color.green.toFixed(2)}, ${color.blue.toFixed(2)})`,
				`(${toBase(color.red)}, ${toBase(color.green)}, ${toBase(color.blue)})`,
			];
			return labels.map((label) => ({
				label,
				textEdit: vscode.TextEdit.replace(context.range, label),
			}));
		},
		async provideDocumentColors(document, token) {
			const ignoredBlocks = await store.getFile(document).getIgnoredBlocks();
			const colorsWithBase =
				/\(\s*(?<r>\d*\.?\d+)\s*(?:\/\s*(?<rb>\d+))?\s*,\s*(?<g>\d*\.?\d+)\s*(?:\/\s*(?<gb>\d+))?\s*,\s*(?<b>\d*\.?\d+)\s*(?:\/\s*(?<bb>\d+))?\s*\)/dg;
			const result: vscode.ColorInformation[] = [];

			// Typescript doesn't yet know about .indices in RegExpMatchArray
			for (const match of document.getText().matchAll(colorsWithBase) as IterableIterator<
				RegExpMatchArray & { indices: Array<[number, number]> }
			>) {
				const getComponent = (value: string, base?: string) =>
					Number(value) / (base ? Number(base) : 1);

				const { r, rb, g, gb, b, bb } = match.groups as { [key: string]: string };
				const components: [number, number, number] = [
					getComponent(r, rb),
					getComponent(g, gb),
					getComponent(b, bb),
				];
				if (components.some((c) => c < 0 || c > 1)) continue;

				const color = new vscode.Color(...components, 1);

				const startIndex = match.indices[0][0];
				const endIndex = match.indices[0][1];
				const startPos = document.positionAt(startIndex);
				if (getIsPosInsideParsedBlocks(ignoredBlocks, startPos)) continue;

				const range = new vscode.Range(startPos, document.positionAt(endIndex));

				result.push({ color, range });
			}
			return result;
		},
	};

	return {
		completionItemProvider,
		hoverProvider,
		signatureHelpProvider,
		semanticTokensProvider,
		rangeSemanticTokensProvider,
		semanticTokensLegend,
		definitionProvider,
		inlayHintsProvider,
		colorProvider,
		store,
	};
};

export default async () => {
	const defsUri = vscode.Uri.file(path.join(__dirname, "../defs"));
	const engines = (await vscode.workspace.fs.readDirectory(defsUri))
		.filter(([, fileType]) => fileType === vscode.FileType.Directory)
		.map(([name]) => name);
	const providersPerEngine = engines.map(
		async (engine): Promise<[string, Awaited<ReturnType<typeof createEngineProviders>>]> => {
			return [engine, await createEngineProviders(engine, defsUri)];
		},
	);
	return Object.fromEntries(await Promise.all(providersPerEngine));
};
