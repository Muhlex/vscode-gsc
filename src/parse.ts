import * as vscode from "vscode";
import { escapeRegExp, getNextSubstring } from "./util";

import type { CallableDefScript } from "./models/Def";
import type { Ignored } from "./models/Ignored";
import type { CallableInstanceRaw } from "./models/Instance";
import {
	SegmentBuilder,
	SegmentBuilderLinear,
	type SegmentMap,
	type SegmentTree,
} from "./models/Segment";
import type { GscFile } from "./stores/GscStore/GscFile";

export const parseIgnoredSegments = (
	document: vscode.TextDocument,
	range?: vscode.Range,
): SegmentMap<Ignored> => {
	const regExp =
		/(?<block>\/\*.*?(?:\*\/|$))|(?<line>\/\/.*?(?=$|[\r\n]))|(?<string>"[^"\\]*(?:\\.[^"\\]*)*(?:"|$))/gs;
	const builder = new SegmentBuilder<Ignored>();

	for (const match of document.getText(range).matchAll(regExp)) {
		const text = match[0];
		const { block, line, string } = match.groups!;
		const startPos = document.positionAt(match.index);
		const endPos = document.positionAt(match.index + text.length);
		const range = new vscode.Range(startPos, endPos);

		if (block) builder.set(range, { kind: "comment-block" });
		else if (line) builder.set(range, { kind: "comment-line" });
		else if (string) builder.set(range, { kind: "string" });
	}

	return builder.toMap();
};

export const parseGlobalSegments = (
	document: vscode.TextDocument,
	ignoredSegments: SegmentMap<Ignored>,
): SegmentMap => {
	const eofPos = document.lineAt(document.lineCount - 1).range.end;

	const builder = new SegmentBuilder();
	let level = 0;
	let offset = 0;
	for (const range of ignoredSegments.inverted(document)) {
		const text = document.getText(range);
		let i = 0;
		while (true) {
			const iOpen = text.indexOf("{", i);
			const iClose = text.indexOf("}", i);
			if (iOpen !== -1 && (iOpen < iClose || iClose === -1)) {
				level++;
				i = iOpen + 1;
				if (level === 1) {
					builder.set(
						new vscode.Range(
							document.positionAt(offset),
							document.positionAt(document.offsetAt(range.start) + iOpen),
						),
					);
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
		builder.set(new vscode.Range(document.positionAt(offset), eofPos));
	}
	return builder.toMap();
};

export const parseCallableDefs = (
	document: vscode.TextDocument,
	globalSegments: SegmentMap,
	ignoredSegments: SegmentMap<Ignored>,
	file: GscFile,
): SegmentMap<CallableDefScript> => {
	// No global flag as there is at most one definition per global segment:
	const regExp = /\b([A-Za-z_][\w]*)\b\s*\(([^)]*?)\)\s*$/d;
	const builder = new SegmentBuilder<CallableDefScript>();

	for (let i = 0; i < globalSegments.length; i++) {
		const { range: globalRange } = globalSegments.getByIndex(i)!;
		const segmentOffset = document.offsetAt(globalRange.start);
		const text = document.getText(globalRange);
		const match = text.match(regExp);
		if (match === null) continue;

		const offset = segmentOffset + match.indices![1][0];
		const position = document.positionAt(offset);
		if (ignoredSegments.hasAt(position)) continue;

		const name = match[1];
		const ident = {
			name,
			range: new vscode.Range(position, document.positionAt(offset + name.length)),
		};

		const params = (() => {
			const text = match[2];
			const offset = segmentOffset + match.indices![2][0];
			const regExp = /\b([A-Za-z_][\w]*)\b\s*(?:,|$)/g;
			const matches = [...text.matchAll(regExp)];
			if (matches.length === 0) return [];

			return matches.map(({ index, 1: name }) => ({
				name,
				range: new vscode.Range(
					document.positionAt(offset + index),
					document.positionAt(offset + index + name.length),
				),
			}));
		})();

		const body = (() => {
			const range = new vscode.Range(
				globalRange.end,
				globalSegments.getByIndex(i + 1)?.range.start ??
					document.lineAt(document.lineCount - 1).range.end,
			);
			const offset = document.offsetAt(range.start);
			const text = document.getText(range);
			const paramsBuilder = new SegmentBuilder<{ index: number }>();

			for (const [index, param] of params.entries()) {
				const regExp = new RegExp(String.raw`\b(?<!\.)${escapeRegExp(param.name)}(?!\s*\()\b`, "g");
				const matches = text.matchAll(regExp);
				for (const match of matches) {
					const start = document.positionAt(offset + match.index);
					if (ignoredSegments.hasAt(start)) continue;
					const end = document.positionAt(offset + match.index + match[0].length);
					paramsBuilder.set(new vscode.Range(start, end), { index });
				}
			}

			return {
				range,
				variables: {
					params: paramsBuilder.toMap(),
				},
			};
		})();

		const entry: CallableDefScript = {
			origin: "script",
			ident,
			params,
			body,
			file,
		};

		builder.set(new vscode.Range(ident.range.start, body.range.end), entry);
	}

	return builder.toMap();
};

export const parseCallableInstances = (
	document: vscode.TextDocument,
	globalSegments: SegmentMap,
	ignoredSegments: SegmentMap<Ignored>,
): SegmentTree<CallableInstanceRaw> => {
	const regExp =
		/(?:\b(?<path>[\w\\]+)\s*::\s*)?(?:\b(?<call>[A-Za-z_][\w]*)\b\s*\(|(?<=::\s*)\b(?<reference>[A-Za-z_][\w]*)\b)/dg;
	const builder = new SegmentBuilderLinear<CallableInstanceRaw>();

	for (const range of globalSegments.inverted(document)) {
		const bodyOffset = document.offsetAt(range.start);
		const text = document.getText(range);

		for (const match of text.matchAll(regExp)) {
			const { path, call, reference } = match.groups!;
			const kind = call ? "call" : "reference";
			const name = call || reference;

			const [identStartOffset, identEndOffset] = match.indices!.groups![kind];
			const identStart = document.positionAt(bodyOffset + identStartOffset);
			if (ignoredSegments.hasAt(identStart)) continue;
			const identEnd = document.positionAt(bodyOffset + identEndOffset);
			const ident = { name, range: new vscode.Range(identStart, identEnd) };

			const range = new vscode.Range(
				document.positionAt(bodyOffset + match.indices![0][0]),
				document.positionAt(bodyOffset + match.indices![0][1]),
			);

			if (kind === "reference") {
				builder.push(range, {
					kind,
					ident,
					path: path || undefined,
				});
				continue;
			}

			const startIndex = match.indices![0][1];
			let level = 1; // bracket nesting level
			const paramIndices = [startIndex];
			let closingIndex = text.length;

			let i = startIndex;
			parseParams: while (true) {
				const chars = level === 1 ? ["(", ")", ";", ","] : ["(", ")", ";"];
				const next = getNextSubstring(text, chars, i);
				if (!next) break;

				const nextPosition = document.positionAt(bodyOffset + next.index);
				const ignoredSegmentAtPos = ignoredSegments.getAt(nextPosition);
				if (ignoredSegmentAtPos) {
					i = document.offsetAt(ignoredSegmentAtPos.range.end) - bodyOffset;
					continue;
				}

				i = next.index + 1;
				switch (next.substring) {
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

			const paramsBuilder = new SegmentBuilder<{ contentRange?: vscode.Range }>();
			const addParam = (startIndex: number, endIndex: number) => {
				const getContentRange = () => {
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
				paramsBuilder.set(range, { contentRange: getContentRange() });
			};

			for (let i = 0; i < paramIndices.length - 1; i++) {
				addParam(paramIndices[i], paramIndices[i + 1] - 1);
			}
			addParam(paramIndices[paramIndices.length - 1], closingIndex);

			builder.push(range.with(undefined, document.positionAt(bodyOffset + closingIndex + 1)), {
				kind,
				ident,
				path: path || undefined,
				paramList: {
					range: new vscode.Range(
						document.positionAt(bodyOffset + startIndex - 1),
						document.positionAt(bodyOffset + closingIndex),
					),
				},
				params: paramsBuilder.toMap(),
			});
		}
	}

	return builder.toTree();
};

export const parseIncludes = (
	document: vscode.TextDocument,
	globalSegments: SegmentMap,
	ignoredSegments: SegmentMap<Ignored>,
) => {
	const regExp = /#include\s*(\b[\w\\]+)/g;
	const text = document.getText(globalSegments.getByIndex(0)?.range);
	const paths = new Set<string>();

	for (const match of text.matchAll(regExp)) {
		const position = document.positionAt(match.index);
		if (ignoredSegments.hasAt(position)) continue;
		paths.add(match[1]);
	}

	return [...paths];
};
