import { Range, type TextDocument } from "vscode";
import { escapeRegExp } from "../util";

import type { CallableDefScript } from "../models/Callable";
import type { TextSegment } from "../models/SegmentTypes";
import { SegmentBuilder, type SegmentMap } from "../models/Segment";

type DocComment = {
	description?: string[];
	example?: string[];
	receiver?: { name: string };
	paramRenames?: string[];
	params?: Map<string, { description: string[]; optional: boolean }>;
};

const parseDocComment = (text: string): DocComment | undefined => {
	const match = text.match(/\/\/\/\s*ScriptDocBegin\b(.*)\/\/\/\s*ScriptDocEnd\b/s);
	if (!match) return undefined;

	const result: DocComment = {};

	const matches = match[1].matchAll(/"(.*?):(.*)"/g);
	for (const match of matches) {
		const key = match[1].toLowerCase().trim();
		const value = match[2].trim();
		if (!value) continue;

		switch (key) {
			case "summary":
				result.description = [value];
				break;
			case "example":
				result.example = [value];
				break;
			case "callon":
				result.receiver = { name: value };
				break;
			case "name": {
				// 'Name' field is basically a function signature that may be used to rename parameters.
				// Thus parse it's parameter names and use them for docs.
				const paramsMatch = value.match(/\((.*?)\)/);
				if (!paramsMatch) continue;
				const paramsText = paramsMatch[1];
				result.paramRenames = paramsText.split(",").map((paramText) => {
					const match = paramText.match(/<\s*(.*)\s*>/);
					if (!match) return paramText.trim();
					return match[1];
				});
				break;
			}
			case "mandatoryarg":
			case "optionalarg": {
				const match = value.match(/<(.*?)>\s*:(.*)$/);
				if (!match) continue;
				const name = match[1].trim();
				const description = [match[2].trim()];
				const optional = key === "optionalarg";

				if (!result.params) result.params = new Map();
				result.params.set(name, { description, optional });
				break;
			}
		}
	}
	return result;
};

export const parseCallableDefs = (
	document: TextDocument,
	globalSegments: SegmentMap,
	textSegments: SegmentMap<TextSegment>,
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
		if (textSegments.hasAt(position)) continue;

		const name = match[1];
		const ident = {
			name,
			range: new Range(position, document.positionAt(offset + name.length)),
		};

		const params = (() => {
			const text = match[2];
			const offset = segmentOffset + match.indices![2][0];
			const regExp = /\b([A-Za-z_][\w]*)\b\s*(?:,|$)/g;
			const matches = [...text.matchAll(regExp)];
			if (matches.length === 0) return [];

			return matches.map(({ index, 1: name }) => ({
				name,
				range: new Range(
					document.positionAt(offset + index),
					document.positionAt(offset + index + name.length),
				),
			}));
		})();

		const body = (() => {
			const range = new Range(
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
					if (textSegments.hasAt(start)) continue;
					const end = document.positionAt(offset + match.index + match[0].length);
					paramsBuilder.set(new Range(start, end), { index });
				}
			}

			return {
				range,
				variables: {
					params: paramsBuilder.toMap(),
				},
			};
		})();

		const comment = textSegments
			.getIn(globalRange)
			.findLast(({ value }) => value.kind === "comment-block");
		const doc = comment ? parseDocComment(document.getText(comment.range)) : undefined;

		const entry: CallableDefScript = {
			origin: "script",
			ident,
			params: params.map((param, i) => {
				const name = doc?.paramRenames?.[i] ?? param.name;
				return {
					...doc?.params?.get(name),
					...param,
					name,
				};
			}),
			description: doc?.description,
			example: doc?.example,
			receiver: doc?.receiver,
			body,
		};

		builder.set(new Range(ident.range.start, body.range.end), entry);
	}

	return builder.toMap();
};
