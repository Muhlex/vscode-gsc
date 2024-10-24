import * as vscode from "vscode";
import { hasRangeAtPos, getRangesAtPos } from "../ranges.js";

export enum FragmentType {
	CommentBlock = 0,
	CommentLine = 1,
	String = 2,
}

export type Fragment = {
	text: string; // TODO: Do we really store the text? Could be gotten from range.
	range: vscode.Range;
	type?: FragmentType;
};

export const hasFragmentAtPos = (sortedFragments: readonly Fragment[], pos: vscode.Position) => {
	return hasRangeAtPos(sortedFragments, pos, (fragment) => fragment.range);
};

export const getFragmentsAtPos = (sortedFragments: readonly Fragment[], pos: vscode.Position) => {
	return getRangesAtPos(sortedFragments, pos, (fragment) => fragment.range);
};

export const invertFragments = (
	document: vscode.TextDocument,
	fragments: readonly Fragment[],
): Fragment[] => {
	const bofPos = new vscode.Position(0, 0);
	const eofPos = document.lineAt(document.lineCount - 1).range.end;

	if (fragments.length < 1) {
		return [{ text: document.getText(), range: new vscode.Range(bofPos, eofPos) }];
	}

	const result: Fragment[] = [];
	const firstFragment = fragments[0];
	const lastFragment = fragments[fragments.length - 1];

	if (!firstFragment.range.start.isEqual(bofPos)) {
		const range = new vscode.Range(bofPos, firstFragment.range.start);
		result.push({ text: document.getText(range), range });
	}
	for (let i = 0; i < fragments.length - 1; i++) {
		const fragment = fragments[i];
		const start = fragment.range.end;
		const end = fragments[i + 1]?.range.start ?? eofPos;
		const range = new vscode.Range(start, end);
		result.push({ text: document.getText(range), range });
	}
	if (!lastFragment.range.end.isEqual(eofPos)) {
		const range = new vscode.Range(lastFragment.range.end, eofPos);
		result.push({ text: document.getText(range), range });
	}

	return result;
};
