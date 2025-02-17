import { Range, type TextDocument } from "vscode";

import type { TextSegment } from "../models/SegmentTypes";
import { SegmentBuilder, type SegmentMap } from "../models/Segment";

export const parseTextSegments = (document: TextDocument): SegmentMap<TextSegment> => {
	const regExp =
		/(?<block>\/\*.*?(?:\*\/|$))|(?<line>\/\/.*?(?=$|[\r\n]))|(?<string>"[^"\\]*(?:\\.[^"\\]*)*(?:"|$))/gs;
	const builder = new SegmentBuilder<TextSegment>();

	for (const match of document.getText().matchAll(regExp)) {
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
