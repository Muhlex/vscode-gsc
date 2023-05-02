import * as vscode from "vscode";

export function wait(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

export function escapeRegExp(string: string) {
	return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function isCall(range: vscode.Range, document: vscode.TextDocument) {
	const PAREN = "(";
	const start = range.end;
	const end = range.end.translate(0, PAREN.length);
	const text = document.getText(new vscode.Range(start, end));
	return text === PAREN;
}

export function isReference(range: vscode.Range, document: vscode.TextDocument) {
	const REF = "::";
	if (range.start.character < REF.length) return false;
	const start = range.start.translate(0, -REF.length);
	const end = range.start;
	const text = document.getText(new vscode.Range(start, end));
	return text === REF;
}

const languageIDsToEngines = new Map<string, string>();
export function clearLanguageIDs() {
	languageIDsToEngines.clear();
}
export function registerLanguageID(id: string, engine: string) {
	languageIDsToEngines.set(id, engine);
}
export function languageIDToEngine(id: string) {
	return languageIDsToEngines.get(id);
}
