import * as vscode from "vscode";
import * as path from "path";

export const uriToGscPath = (uri: vscode.Uri, rootFolders: { root: string, uri: vscode.Uri }[]) => {
	const matchingRoot = rootFolders.find(r => uri.toString().startsWith(r.uri.toString()));
	if (!matchingRoot) return undefined;
	const split = uri.path.slice(matchingRoot.uri.path.length + 1).split("/");
	split[split.length - 1] = path.parse(split[split.length - 1]).name; // remove file extension
	return [matchingRoot.root, ...split].join("\\");
};
