import * as vscode from "vscode";

import { CallableDef, CallableDefCustom } from "../../types/Defs";
import { CallableInstance } from "../../types/Instances";
import { ParsedBlock } from "../parse";
import { RelativeGsc } from "./GscStore";

type DefinedCallableInstance = CallableInstance & { def: CallableDef }

export type FileCache = {
	ignoredBlocks: ParsedBlock[],
	topLevelBlocks: ParsedBlock[],
	callableDefs: Map<string, CallableDefCustom>,
	callableInstances: CallableInstance[],
	definedCallableInstances: DefinedCallableInstance[]
};

export class File {
	public uri: vscode.Uri;
	public relativeGsc?: RelativeGsc;
	public cache: Partial<FileCache> = {};

	constructor(uri: vscode.Uri, options?: { relativeGsc?: RelativeGsc, cache?: Partial<FileCache> }) {
		this.uri = uri;
		Object.assign(this, options);
	}

	updateCache(partialCache: Partial<FileCache>) {
		Object.assign(this.cache, partialCache);
	}

	invalidateCache() {
		this.cache = {};
	}
}

export class FileStore {
	private files = new Map<string, File>();

	create(uri: vscode.Uri, options?: ConstructorParameters<typeof File>[1]) {
		const file = new File(uri, options);
		this.files.set(uri.toString(true), file);
		return file;
	}

	getByUri(uri: vscode.Uri) {
		return this.files.get(uri.toString(true));
	}

	deleteByUri(uri: vscode.Uri) {
		return this.files.delete(uri.toString(true));
	}
}
