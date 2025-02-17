// TODO: del

import * as vscode from "vscode";
import { AsyncCache } from "./AsyncCache";

export class AsyncDocumentCache<T extends object> extends AsyncCache<T> {
	private uri: vscode.Uri;

	constructor(uri: vscode.Uri) {
		super();
		this.uri = uri;
	}

	async getWithDocument<K extends keyof T>(
		key: K,
		getFunc: (document: vscode.TextDocument) => Promise<NonNullable<T[K]>>,
	): Promise<NonNullable<T[K]>> {
		return this.get(key, async () => {
			const document = await vscode.workspace.openTextDocument(this.uri);
			return getFunc(document);
		});
	}
}
