import * as vscode from "vscode";

import type { Stores } from "../stores";
import type { CallableDef } from "../types/Defs";

import { getDef, getVariableString } from "./shared";

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
// const _quote = "'".charCodeAt(0);
// const _dQuote = '"'.charCodeAt(0);
const _underscore = "_".charCodeAt(0);
const _a = "a".charCodeAt(0);
const _z = "z".charCodeAt(0);
const _A = "A".charCodeAt(0);
const _Z = "Z".charCodeAt(0);
const _0 = "0".charCodeAt(0);
const _9 = "9".charCodeAt(0);

export const createSignatureHelpProvider = (stores: Stores): vscode.SignatureHelpProvider => ({
	async provideSignatureHelp(document, position, token, _context) {
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
					// TODO: Why did PHP exclude strings here? Leaving it out for now.

					// case _dQuote:
					// case _quote:
					// 	while (iterator.hasNext() && ch !== iterator.next()) {
					// 		// find the closing quote or double quote
					// 	}
					// 	break;
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

		const def = await getDef(ident, document, stores);
		if (token.isCancellationRequested) return;
		if (!def) return;

		const signatures = createSignatures(def);

		return {
			activeSignature: 0,
			activeParameter: Math.min(activeParam, signatures[0].parameters.length - 1),
			signatures,
		};
	},
});

const createSignatures = (def: CallableDef): vscode.SignatureInformation[] => {
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
