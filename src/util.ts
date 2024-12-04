import * as vscode from "vscode";

export function wait(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function readJSON(uri: vscode.Uri) {
	const data = await vscode.workspace.fs.readFile(uri);
	return JSON.parse(data.toString());
}

export async function readDirectories(uri: vscode.Uri) {
	const dirEntries = await vscode.workspace.fs.readDirectory(uri);
	return dirEntries.filter(([, type]) => type === vscode.FileType.Directory).map(([name]) => name);
}

export function escapeRegExp(string: string) {
	return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function removeFileExtension(filename: string) {
	const extensionDotIndex = filename.lastIndexOf(".");
	if (extensionDotIndex === -1) return filename;
	return filename.slice(0, extensionDotIndex);
}

export function getNextSubstring(
	input: string,
	substrings: string[],
	position?: number,
	backwards = false,
) {
	const indexOf = (backwards ? input.lastIndexOf : input.indexOf).bind(input);
	return substrings
		.map((substring) => ({ substring, index: indexOf(substring, position) }))
		.filter(({ index }) => index !== -1)
		.sort((a, b) => a.index - b.index)
		.at(backwards ? -1 : 0);
}
