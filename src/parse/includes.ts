import * as vscode from "vscode";

import type { TextDocument } from "vscode";
import type { TextSegment } from "../models/SegmentTypes";
import type { Include } from "../models/Include";
import { SegmentBuilder, type SegmentMap } from "../models/Segment";

export const parseIncludes = (
	document: TextDocument,
	globalSegments: SegmentMap,
	textSegments: SegmentMap<TextSegment>,
): { byRange: SegmentMap<Include>; paths: string[] } => {
	const regExp = /#include\s*(\b[\w\\]+)/dg;
	const text = document.getText(globalSegments.getByIndex(0)?.range);
	const builder = new SegmentBuilder<Include>();
	const paths = new Set<string>();

	for (const match of text.matchAll(regExp)) {
		const [startOffset, endOffset] = match.indices![0];
		const startPosition = document.positionAt(startOffset);
		if (textSegments.hasAt(startPosition)) continue;

		const endPosition = document.positionAt(endOffset);
		const range = new vscode.Range(startPosition, endPosition);

		const pathText = match[1];
		const [pathStartOffset, pathEndOffset] = match.indices![1];
		const pathRange = new vscode.Range(
			document.positionAt(pathStartOffset),
			document.positionAt(pathEndOffset),
		);
		builder.set(range, { path: { text: pathText, range: pathRange } });
		paths.add(pathText);
	}

	return { byRange: builder.toMap(), paths: [...paths] };
};
