import type { TextDocument } from "vscode";
import type { TextSegment } from "../models/SegmentTypes";
import type { SegmentMap } from "../models/Segment";

export const parseIncludes = (
	document: TextDocument,
	globalSegments: SegmentMap,
	textSegments: SegmentMap<TextSegment>,
) => {
	const regExp = /#include\s*(\b[\w\\]+)/g;
	const text = document.getText(globalSegments.getByIndex(0)?.range);
	const paths = new Set<string>();

	for (const match of text.matchAll(regExp)) {
		const position = document.positionAt(match.index);
		if (textSegments.hasAt(position)) continue;
		paths.add(match[1]);
	}

	return [...paths];
};
