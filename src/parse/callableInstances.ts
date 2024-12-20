import { Range, type TextDocument } from "vscode";
import { getNextSubstring } from "../util";

import type { Ignored } from "../models/Ignored";
import type { CallableInstanceRaw } from "../models/Instance";
import {
	SegmentBuilder,
	SegmentBuilderLinear,
	type SegmentMap,
	type SegmentTree,
} from "../models/Segment";

export const parseCallableInstances = (
	document: TextDocument,
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
			const ident = { name, range: new Range(identStart, identEnd) };

			const range = new Range(
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

			const paramsBuilder = new SegmentBuilder<{ contentRange?: Range }>();
			const addParam = (startIndex: number, endIndex: number) => {
				const getContentRange = () => {
					const paramText = text.slice(startIndex, endIndex);
					const match = paramText.match(/^\s*(.*?)\s*$/ds);
					if (!match) return undefined;
					const [trimmedStartOffset, trimmedEndOffset] = match.indices![1];
					if (trimmedStartOffset === trimmedEndOffset) return undefined;
					return new Range(
						document.positionAt(bodyOffset + startIndex + trimmedStartOffset),
						document.positionAt(bodyOffset + startIndex + trimmedEndOffset),
					);
				};
				const range = new Range(
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
					range: new Range(
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
