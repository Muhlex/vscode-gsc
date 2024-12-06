import type { TextDocument } from "vscode";
import type { Ignored } from "../models/Ignored";
import type { SegmentMap } from "../models/Segment";

export const parseIncludes = (
	document: TextDocument,
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
