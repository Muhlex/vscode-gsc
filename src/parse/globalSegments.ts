import { Range, type TextDocument } from "vscode";

import type { TextSegment } from "../models/SegmentTypes";
import { SegmentBuilder, type SegmentMap } from "../models/Segment";

export const parseGlobalSegments = (
	document: TextDocument,
	textSegments: SegmentMap<TextSegment>,
): SegmentMap => {
	const eofPos = document.lineAt(document.lineCount - 1).range.end;

	const builder = new SegmentBuilder();
	let level = 0;
	let offset = 0;
	for (const range of textSegments.inverted(document)) {
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
						new Range(
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
		builder.set(new Range(document.positionAt(offset), eofPos));
	}
	return builder.toMap();
};
