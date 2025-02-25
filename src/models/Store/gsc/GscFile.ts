import * as vscode from "vscode";

import { Cache } from "../../Cache/Cache";

import type { SegmentMap, SegmentTree } from "../../Segment";
import type { TextSegment } from "../../SegmentTypes";
import type { Include } from "../../Include";
import type { CallableDefScript, CallableUsage } from "../../Callable";

import { parseTextSegments } from "../../../parse/textSegments";
import { parseGlobalSegments } from "../../../parse/globalSegments";
import { parseIncludes } from "../../../parse/includes";
import { parseCallableDefs } from "../../../parse/callableDefs";
import { parseCallableUsages } from "../../../parse/callableUsages";

export class GscFile {
	readonly uri: vscode.Uri;
	private readonly cache: Cache<{
		textSegments: SegmentMap<TextSegment>;
		globalSegments: SegmentMap;
		includes: Readonly<{
			byRange: SegmentMap<Include>;
			paths: string[];
		}>;
		callableDefs: Readonly<{
			byRange: SegmentMap<CallableDefScript>;
			byName: ReadonlyMap<string, CallableDefScript>;
		}>;
		callableUsages: SegmentTree<CallableUsage>;
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

	getIncludes() {
		return this.cache.getAsync("includes", async (token: vscode.CancellationToken) => {
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
				this,
			);

			const byName = new Map<string, CallableDefScript>();
			for (const { value: def } of defs) {
				byName.set(def.name.text.toLowerCase(), def);
			}

			return { byRange: defs, byName };
		});
	}

	getCallableUsages() {
		return this.cache.getAsync("callableUsages", async (token: vscode.CancellationToken) => {
			const doc = await this.getDocument();
			if (token.isCancellationRequested) return;

			return parseCallableUsages(doc, await this.getGlobalSegments(), await this.getTextSegments());
		});
	}

	onChanged() {
		this.cache.clear();
	}
}
