import * as vscode from "vscode";

export class HTTPError extends Error {
	public readonly status: number;
	constructor(response: Response) {
		super(`${response.status}: ${response.statusText}`);
		this.name = "HTTPError";
		this.status = response.status;
	}
}

export class API {
	private url: URL;

	constructor(url: URL) {
		this.url = url;
	}

	private async get<T>(path: string | URL): Promise<T> {
		const response = await fetch(new URL(path, this.url));
		if (!response.ok) {
			vscode.window.showErrorMessage(`Failed to fetch "${path}": ${response.statusText}`);
			throw new HTTPError(response);
		}
		return (await response.json()) as T;
	}

	async getVersion() {
		const json = await this.get<{ version: string }>("");
		return json.version;
	}
}
