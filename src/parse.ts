import * as vscode from "vscode";
import { type Fragment, FragmentType, hasFragmentAtPos, getFragmentsAtPos } from "./models/Fragment";
import type { CallableDefScript } from "./models/Def";
import type { CallableInstanceRaw } from "./models/Instance";
import type { GscFile } from "./stores/GscStore/GscFile";

export const parseIgnoredFragments = (
	document: vscode.TextDocument,
	range?: vscode.Range,
): Fragment[] => {
	const regExp =
		/(?<block>\/\*.*?(?:\*\/|$))|(?<line>\/\/.*?(?=$|[\r\n]))|(?<string>"[^"\\]*(?:\\.[^"\\]*)*(?:"|$))/gs;
	const result: Fragment[] = [];

	for (const match of document.getText(range).matchAll(regExp)) {
		const text = match[0];
		const { block, line, string } = match.groups!;
		const startPos = document.positionAt(match.index);
		const endPos = document.positionAt(match.index + text.length);
		const range = new vscode.Range(startPos, endPos);

		if (block) result.push({ text, range, type: FragmentType.CommentBlock });
		else if (line) result.push({ text, range, type: FragmentType.CommentLine });
		else if (string) result.push({ text, range, type: FragmentType.String });
	}

	return result;
};

export const parseGlobalFragments = (
	document: vscode.TextDocument,
	nonIgnoredFragments: readonly Fragment[],
): Fragment[] => {
	const eofPos = document.lineAt(document.lineCount - 1).range.end;

	const result: Fragment[] = [];
	let level = 0;
	let offset = 0;
	for (const { text, range } of nonIgnoredFragments) {
		let i = 0;
		while (true) {
			const iOpen = text.indexOf("{", i);
			const iClose = text.indexOf("}", i);
			if (iOpen !== -1 && (iOpen < iClose || iClose === -1)) {
				level++;
				i = iOpen + 1;
				if (level === 1) {
					const fragmentRange = new vscode.Range(
						document.positionAt(offset),
						document.positionAt(document.offsetAt(range.start) + iOpen),
					);
					result.push({ range: fragmentRange, text: document.getText(fragmentRange) });
				}
				continue;
			}
			if (iClose !== -1 && (iClose < iOpen || iOpen === -1)) {
				level = Math.max(0, level - 1);
				i = iClose + 1;
				if (level === 0) {
					offset = document.offsetAt(range.start) + i;
				}
				continue;
			}

			break;
		}
	}
	if (level === 0) {
		const range = new vscode.Range(document.positionAt(offset), eofPos);
		result.push({ range, text: document.getText(range) });
	}
	return result;
};

export const parseCallableDefs = (
	document: vscode.TextDocument,
	globalFragments: readonly Fragment[],
	ignoredFragments: readonly Fragment[],
	file: GscFile,
): Map<string, CallableDefScript> => {
	// No global flag as there is at most one definition per global fragment:
	const regExp = /\b([A-Za-z_][A-Za-z0-9_]*)\b\s*\(([^)]*?)\)\s*$/d;
	const result = new Map<string, CallableDefScript>();

	for (let i = 0; i < globalFragments.length; i++) {
		const { range, text } = globalFragments[i];
		const fragmentOffset = document.offsetAt(range.start);
		const match = text.match(regExp);
		if (match === null) continue;

		const offset = fragmentOffset + match.indices![1][0];
		const position = document.positionAt(offset);
		if (hasFragmentAtPos(ignoredFragments, position)) continue;

		const entry: CallableDefScript = {
			origin: "script",
			ident: {
				name: match[1],
				range: new vscode.Range(position, document.positionAt(offset + match[1].length)),
			},
			params: (() => {
				const text = match[2];
				const offset = fragmentOffset + match.indices![2][0];
				const regExp = /\b([A-Za-z_][A-Za-z0-9_]*)\b\s*(?:,|$)/g;
				const matches = [...text.matchAll(regExp)];
				if (matches.length === 0) return [];

				return matches.map(({ index, 1: name }) => ({
					name,
					range: new vscode.Range(
						document.positionAt(offset + index),
						document.positionAt(offset + index + name.length),
					),
				}));
			})(),
			body: {
				range: new vscode.Range(
					range.end,
					globalFragments[i + 1]?.range.start || document.lineAt(document.lineCount - 1).range.end,
				),
			},
			file,
		};

		result.set(entry.ident.name.toLowerCase(), entry);
	}

	return result;
};

export const parseCallableInstances = (
	document: vscode.TextDocument,
	bodyFragments: readonly Fragment[],
	ignoredFragments: readonly Fragment[],
) => {
	const regExp =
		/(?:\b(?<path>[A-Za-z0-9_\\]+)\s*::\s*)?(?:\b(?<call>[A-Za-z_][A-Za-z0-9_]*)\b\s*\(|(?<=::\s*)\b(?<reference>[A-Za-z_][A-Za-z0-9_]*)\b)/dg;
	const result: CallableInstanceRaw[] = [];

	for (const bodyFragment of bodyFragments) {
		const text = document.getText(bodyFragment.range);
		const bodyOffset = document.offsetAt(bodyFragment.range.start);

		for (const match of text.matchAll(regExp)) {
			const { path, call, reference } = match.groups!;
			const kind = call ? "call" : "reference";
			const name = call || reference;

			const [identStartOffset, identEndOffset] = match.indices!.groups![kind];
			const identStart = document.positionAt(bodyOffset + identStartOffset);
			if (ignoredFragments && hasFragmentAtPos(ignoredFragments, identStart)) continue;

			const identEnd = document.positionAt(bodyOffset + identEndOffset);
			const callable: CallableInstanceRaw = {
				kind,
				ident: { name, range: new vscode.Range(identStart, identEnd) },
				path: path || undefined,
				range: new vscode.Range(
					document.positionAt(bodyOffset + match.indices![0][0]),
					document.positionAt(bodyOffset + match.indices![0][1]),
				),
			};

			if (kind === "call") {
				const startIndex = match.indices![0][1];
				let level = 1; // bracket nesting level
				const paramIndices = [startIndex];
				let closingIndex = text.length;

				let i = startIndex;
				parseParams: while (true) {
					const chars = level === 1 ? ["(", ")", ";", ","] : ["(", ")", ";"];
					const next = chars
						.map((char) => ({ char, index: text.indexOf(char, i) }))
						.filter(({ index }) => index !== -1)
						.sort((a, b) => a.index - b.index)
						.at(0);
					if (!next) break;

					const nextPosition = document.positionAt(bodyOffset + next.index);
					const ignoredFragment = getFragmentsAtPos(ignoredFragments, nextPosition)[0];
					if (ignoredFragment) {
						i = document.offsetAt(ignoredFragment.range.end) - bodyOffset;
						continue;
					}

					i = next.index + 1;
					switch (next.char) {
						case ",":
							paramIndices.push(i);
							break;
						case "(":
							level++;
							break;
						case ")":
							level--;
							if (level === 0) {
								closingIndex = next.index;
								break parseParams;
							}
							break;
						case ";":
							closingIndex = next.index;
							break parseParams;
					}
				}

				const params: CallableInstanceRaw["params"] = [];
				const addParam = (startIndex: number, endIndex: number) => {
					const getTrimmedRange = () => {
						const paramText = text.slice(startIndex, endIndex);
						const match = paramText.match(/^\s*(.*?)\s*$/ds);
						if (!match) return undefined;
						const [trimmedStartOffset, trimmedEndOffset] = match.indices![1];
						if (trimmedStartOffset === trimmedEndOffset) return undefined;
						return new vscode.Range(
							document.positionAt(bodyOffset + startIndex + trimmedStartOffset),
							document.positionAt(bodyOffset + startIndex + trimmedEndOffset),
						);
					};
					const range = new vscode.Range(
						document.positionAt(bodyOffset + startIndex),
						document.positionAt(bodyOffset + endIndex),
					);
					params.push({ range, trimmedRange: getTrimmedRange() });
				};

				for (let i = 0; i < paramIndices.length - 1; i++) {
					addParam(paramIndices[i], paramIndices[i + 1] - 1);
				}
				addParam(paramIndices[paramIndices.length - 1], closingIndex);

				callable.params = params;
				callable.range = callable.range.with(
					undefined,
					document.positionAt(bodyOffset + closingIndex + 1),
				);
			}

			result.push(callable);
		}
	}

	return result;
};

export const parseIncludes = (
	document: vscode.TextDocument,
	globalFragments: readonly Fragment[],
	ignoredFragments: readonly Fragment[] = [],
) => {
	const regExp = /#include\s*(\b[A-Za-z0-9_\\]+)/g;
	const text = document.getText(globalFragments[0]?.range);
	const paths = new Set<string>();

	for (const match of text.matchAll(regExp)) {
		const position = document.positionAt(match.index);
		if (hasFragmentAtPos(ignoredFragments, position)) continue;
		paths.add(match[1]);
	}

	return [...paths];
};
