import * as vscode from "vscode";

import { Cache } from "../../Cache/Cache";

import type { SegmentMap, SegmentTree } from "../../Segment";
import type { TextSegment } from "../../SegmentTypes";
import type { CallableDefScript, CallableInstance } from "../../Callable";

import { parseTextSegments } from "../../../parse/textSegments";
import { parseGlobalSegments } from "../../../parse/globalSegments";
import { parseIncludes } from "../../../parse/includes";
import { parseCallableDefs } from "../../../parse/callableDefs";
import { parseCallableInstances } from "../../../parse/callableInstances";

export class GscFile {
	private readonly uri: vscode.Uri;
	private readonly cache: Cache<{
		textSegments: SegmentMap<TextSegment>;
		globalSegments: SegmentMap;
		includedPaths: readonly string[];
		callableDefs: Readonly<{
			byRange: SegmentMap<CallableDefScript>;
			byName: ReadonlyMap<string, CallableDefScript>;
		}>;
		callableInstances: SegmentTree<CallableInstance>;
	}>;

	constructor(uri: vscode.Uri) {
		this.uri = uri;
		this.cache = new Cache();
	}

	async getDocument() {
		return vscode.workspace.openTextDocument(this.uri);
	}

	getTextSegments() {
		return this.cache.getAsync("textSegments", async (token: vscode.CancellationToken) => {
			const doc = await this.getDocument();
			if (token.isCancellationRequested) return;
			return parseTextSegments(doc);
		});
	}

	getGlobalSegments() {
		return this.cache.getAsync("globalSegments", async (token: vscode.CancellationToken) => {
			const doc = await this.getDocument();
			if (token.isCancellationRequested) return;
			const textSegments = await this.getTextSegments();
			return parseGlobalSegments(doc, textSegments);
		});
	}

	getIncludedPaths() {
		return this.cache.getAsync("includedPaths", async (token: vscode.CancellationToken) => {
			const doc = await this.getDocument();
			if (token.isCancellationRequested) return;
			return parseIncludes(doc, await this.getGlobalSegments(), await this.getTextSegments());
		});
	}

	getCallableDefs() {
		return this.cache.getAsync("callableDefs", async (token: vscode.CancellationToken) => {
			const doc = await this.getDocument();
			if (token.isCancellationRequested) return;
			const defs = parseCallableDefs(
				doc,
				await this.getGlobalSegments(),
				await this.getTextSegments(),
			);

			const byName = new Map<string, CallableDefScript>();
			for (const { value: def } of defs) {
				byName.set(def.ident.name.toLowerCase(), def);
			}

			return {
				byRange: defs,
				byName,
			};
		});
	}

	getCallableInstances() {
		return this.cache.getAsync("callableInstances", async (token: vscode.CancellationToken) => {
			const doc = await this.getDocument();
			if (token.isCancellationRequested) return;

			return parseCallableInstances(
				doc,
				await this.getGlobalSegments(),
				await this.getTextSegments(),
			);
		});
	}

	onChanged() {
		this.cache.clear();
	}
}
