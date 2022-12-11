import * as vscode from "vscode";

export enum ParsedBlockType { BlockComment, LineComment, String }
export interface ParsedBlock {
	text: string,
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

export const parseFunctionDefs = (document: vscode.TextDocument, topLevelBlocks: ParsedBlock[], ignoredBlocks?: ParsedBlock[]) => {
	// No global flag as there is at most one function per top-level-block:
	const regexp = /\b([A-Za-z_][A-Za-z0-9_]*)\b\s*\(([^)]*?)\)\s*{/sd;
	const result = new Map<string, {
		ident: { name: string, range: vscode.Range }
		params: { name: string, range: vscode.Range }[]
		body: { range: vscode.Range }
	}>();

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
			params: parseParams(document, match[2], blockOffset + match.indices[2][0], true),
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

export enum CallableInstanceType { Reference, Call }

export const parseCallableInstances = (document: vscode.TextDocument, topLevelBlocks: ParsedBlock[], ignoredBlocks?: ParsedBlock[]) => {
	const text = document.getText();
	const regexp = /::\s*\b([A-Za-z_][A-Za-z0-9_]*)\b|\b([A-Za-z_][A-Za-z0-9_]*)\b\s*\(([^)]*?)\)/gd;
	const result: {
		type: CallableInstanceType
		ident: { name: string, range: vscode.Range }
		params?: { name: string, range: vscode.Range }[]
	}[] = [];

	for (const match of text.matchAll(regexp) as IterableIterator<RegExpMatchArray & { indices: Array<[number, number]> }>) {
		const type = match[1] ? CallableInstanceType.Reference : CallableInstanceType.Call;
		const ident = match[1] || match[2];
		const offset = match[1] ? match.indices[1][0] : match.indices[2][0];
		const position = document.positionAt(offset);
		if (getIsPosInsideParsedBlocks(topLevelBlocks, position)) continue;
		if (ignoredBlocks && getIsPosInsideParsedBlocks(ignoredBlocks, position)) continue;

		const callable: typeof result[number] = {
			ident: {
				name: ident,
				range: (() => {
					return new vscode.Range(
						position,
						document.positionAt(offset + ident.length)
					);
				})()
			},
			type
		};

		if (type === CallableInstanceType.Call) {
			// TODO: match nested callables instead of assuming there can't be another callable inside
			// the params parentheses:
			callable.params = parseParams(document, match[3], match.indices[3][0]);
		}

		result.push(callable);
	}

	return result;
};

const parseParams = (document: vscode.TextDocument, text: string, offset = 0, isDef = false) => {
	const regexp = isDef
		? /\b([A-Za-z_][A-Za-z0-9_]*)\b\s*(?:,|$)/gd
		: /\s*(\S+?)\s*(?:,|$)/gd;
	const matches = [...text.matchAll(regexp) as IterableIterator<RegExpMatchArray & { indices: [number, number][] }>];
	if (matches.length === 0) return [];

	return matches.map(({ 1: name, indices: [, [index]] }) => ({
		name,
		range: new vscode.Range(
			document.positionAt(offset + index),
			document.positionAt(offset + index + name.length)
		)
	}));
};
