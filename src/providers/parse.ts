import * as vscode from "vscode";
import { CallableInstance, CallableInstanceType } from "../types/Instances";
import { CallableDefCustom } from "../types/Defs";

export enum ParsedBlockType { BlockComment, LineComment, String }
export type ParsedBlock = {
	text: string
	range: vscode.Range
	type?: ParsedBlockType
}

export const getIsPosInsideParsedBlocks = (sortedBlocks: ParsedBlock[], pos: vscode.Position) => {
	for (let i = sortedBlocks.length - 1; i >= 0; i--) {
		const block = sortedBlocks[i];
		if (block.range.start.compareTo(pos) > 0) continue;
		if (block.range.end.compareTo(pos) <= 0) return false;
		return true;
	}
	return false;
};

export const parseIgnoredBlocks = (document: vscode.TextDocument, range?: vscode.Range) => {
	const regexp = /(?<block>\/\*.*?(?:\*\/|$))|(?<line>\/\/.*?(?=$|[\r\n]))|(?<string>"[^"\\]*(?:\\.[^"\\]*)*(?:"|$))/gs;
	const result: ParsedBlock[] = [];

	for (const match of document.getText(range).matchAll(regexp)) {
		const [text, block, line, string] = match;
		const startPos = document.positionAt(match.index as number);
		const endPos = document.positionAt(match.index as number + text.length);
		const range = new vscode.Range(startPos, endPos);

		if (block) result.push({ text, range, type: ParsedBlockType.BlockComment });
		else if (line) result.push({ text, range, type: ParsedBlockType.LineComment });
		else if (string) result.push({ text, range, type: ParsedBlockType.String });
	}

	return result;
};

export const parseTopLevelBlocks = (document: vscode.TextDocument, ignoredBlocks?: ParsedBlock[]) => {
	const eofPos = document.lineAt(document.lineCount - 1).range.end;
	const includedBlocks = [...(ignoredBlocks || []), { range: new vscode.Range(eofPos, eofPos) }]
		.map((block, i, array) => {
			const start = i === 0 ? new vscode.Position(0, 0) : array[i - 1].range.end;
			const end = block.range.start;
			const range = new vscode.Range(start, end);
			return { range, text: document.getText(range) };
		});

	const topLevelBlocks: ParsedBlock[] = [];
	let level = 0;
	let offset = 0;
	for (const { text, range } of includedBlocks) {
		for (let i = 0;;) {
			const iOpen = text.indexOf("{", i);
			const iClose = text.indexOf("}", i);
			if (iOpen !== -1 && (iOpen < iClose || iClose === -1)) {
				level++;
				i = iOpen + 1;
				if (level === 1) {
					const r = new vscode.Range(
						document.positionAt(offset),
						document.positionAt(document.offsetAt(range.start) + i)
					);
					topLevelBlocks.push({ range: r, text: document.getText(r) });
				}
				continue;
			}
			if (iClose !== -1 && (iClose < iOpen || iOpen === -1)) {
				level = Math.max(0, level - 1);
				i = iClose + 1;
				if (level === 0) {
					offset = document.offsetAt(range.start) + iClose;
				}
				continue;
			}

			break;
		}
	}
	if (level === 0) {
		const range = new vscode.Range(document.positionAt(offset), eofPos);
		topLevelBlocks.push({ range, text: document.getText(range) });
	}
	return topLevelBlocks;
};

export const parseCallableDefs = (document: vscode.TextDocument, topLevelBlocks: ParsedBlock[], ignoredBlocks?: ParsedBlock[]) => {
	// No global flag as there is at most one function per top-level-block:
	const regexp = /\b([A-Za-z_][A-Za-z0-9_]*)\b\s*\(([^)]*?)\)\s*{/sd;
	const result = new Map<string, CallableDefCustom>();

	for (let i = 0; i < topLevelBlocks.length; i++) {
		const { range, text } = topLevelBlocks[i];
		const blockOffset = document.offsetAt(range.start);
		const match = text.match(regexp) as RegExpMatchArray & { indices: [number, number][] };
		if (match === null) continue;

		const offset = blockOffset + match.indices[1][0];
		const position = document.positionAt(offset);
		if (ignoredBlocks && getIsPosInsideParsedBlocks(ignoredBlocks, position)) continue;

		const entry = {
			ident: {
				name: match[1],
				range: new vscode.Range(
					position,
					document.positionAt(offset + match[1].length)
				),
			},
			params: (() => {
				const text = match[2];
				const offset = blockOffset + match.indices[2][0];
				const regexp = /\b([A-Za-z_][A-Za-z0-9_]*)\b\s*(?:,|$)/g;
				const matches = [...text.matchAll(regexp) as IterableIterator<RegExpMatchArray & { index: number }>];
				if (matches.length === 0) return [];

				return matches.map(({ 1: name, index }) => ({
					name,
					range: new vscode.Range(
						document.positionAt(offset + index),
						document.positionAt(offset + index + name.length)
					)
				}));
			})(),
			body: {
				range: new vscode.Range(
					range.end,
					topLevelBlocks[i + 1]?.range.start || document.lineAt(document.lineCount - 1).range.end
				)
			}
		};

		result.set(entry.ident.name.toLowerCase(), entry);
	}

	return result;
};

export const parseCallableInstances = (document: vscode.TextDocument, topLevelBlocks: ParsedBlock[], ignoredBlocks?: ParsedBlock[]) => {
	const regexp = /::\s*\b([A-Za-z_][A-Za-z0-9_]*)\b|\b([A-Za-z_][A-Za-z0-9_]*)\b\s*\(/gd;
	const result: CallableInstance[] = [];
	const text = document.getText();

	for (const match of text.matchAll(regexp) as IterableIterator<RegExpMatchArray & { indices: Array<[number, number]> }>) {
		const type = match[1] ? CallableInstanceType.Reference : CallableInstanceType.Call;
		const name = match[1] || match[2];
		const offset = match[1] ? match.indices[1][0] : match.indices[2][0];
		const position = document.positionAt(offset);
		if (getIsPosInsideParsedBlocks(topLevelBlocks, position)) continue;
		if (ignoredBlocks && getIsPosInsideParsedBlocks(ignoredBlocks, position)) continue;

		const callable: typeof result[number] = {
			ident: {
				name,
				range: new vscode.Range(position, document.positionAt(offset + name.length)),
			},
			type
		};

		// parse params
		if (type === CallableInstanceType.Call) {
			const openingIndex = offset + name.length;
			let closingIndex: number | undefined = undefined;
			let level = 0;
			const commaIndices = [];

			for (let i = openingIndex;;) {
				const chars = ["(", ")"];
				if (level === 1) chars.push(","); // only on the braces concerning this function call
				const next = chars
					.map(char => ({ char, index: text.indexOf(char, i) }))
					.filter(({ index }) => index !== -1)
					.sort((a, b) => a.index - b.index)
					.at(0);
				if (!next) break;

				if (next.char === "(") {
					level++;
				} else if (next.char === ")") {
					level--;
					if (level === 0) {
						closingIndex = next.index;
						break;
					}
				} else if (next.char === ",") {
					commaIndices.push(next.index);
				}

				i = next.index + 1;
			}

			const endIndices = [...commaIndices, closingIndex || text.length - 1];

			const params = [];
			for (const [i, endIndex] of endIndices.entries()) {
				const startIndex = i === 0 ? (openingIndex + 1) : (endIndices[i - 1] + 1);
				const paramText = text.slice(startIndex, endIndex);
				const match = paramText.match(/^\s*(.*?)\s*$/d) as (RegExpMatchArray & { indices: Array<[number, number]> }) | null;
				if (!match || match.indices[1][0] === match.indices[1][1]) continue; // no param

				const startOffset = match.indices[1][0];
				const endOffset = match.indices[0][1] - match.indices[1][1];
				const range = new vscode.Range(
					document.positionAt(startIndex + startOffset),
					document.positionAt(endIndex - endOffset)
				);
				params.push({ range });
			}
			callable.params = params;
		}

		result.push(callable);
	}

	return result;
};
