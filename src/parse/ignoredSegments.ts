import { Range, type TextDocument } from "vscode";

import type { Ignored } from "../models/Ignored";
import { SegmentBuilder, type SegmentMap } from "../models/Segment";

export const parseIgnoredSegments = (
	document: TextDocument,
	range?: Range,
): SegmentMap<Ignored> => {
	const regExp =
		/(?<block>\/\*.*?(?:\*\/|$))|(?<line>\/\/.*?(?=$|[\r\n]))|(?<string>"[^"\\]*(?:\\.[^"\\]*)*(?:"|$))/gs;
	const builder = new SegmentBuilder<Ignored>();

	for (const match of document.getText(range).matchAll(regExp)) {
		const text = match[0];
		const { block, line, string } = match.groups!;
		const startPos = document.positionAt(match.index);
		const endPos = document.positionAt(match.index + text.length);
		const range = new Range(startPos, endPos);

		if (block) builder.set(range, { kind: "comment-block" });
		else if (line) builder.set(range, { kind: "comment-line" });
		else if (string) builder.set(range, { kind: "string" });
	}

	return builder.toMap();
};
