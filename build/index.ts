import { parseArgs } from "node:util";
import { copyDir, getJSON, removeDir, writeJSON } from "./io";

import type { Engine } from "../src/models/Engine";

import createContributes from "../src/templates/contributes";
import createGrammar from "../src/templates/grammar";
import createSnippets from "../src/templates/snippets";

import packageJson from "../package.json";
import { compilerOptions } from "../tsconfig.json";

const args = parseArgs({
	options: {
		api: {
			type: "string",
		},
		engine: {
			type: "string",
			default: [],
			multiple: true,
		},
	},
	args: process.argv.slice(2),
}).values;
if (!args.api) throw new Error("Missing required --api argument.");

const apiUrl = new URL(args.api);

const index = await getJSON(new URL("./index.json", apiUrl));
const enginesData = await Promise.all(
	args.engine.map(async (id) => {
		if (!index.engines[id]) throw new Error(`Engine '${id}' is not documented in ${apiUrl}.`);
		const { meta, keyword: keywordUrl, callable: callableUrl } = index.engines[id];

		const keywords: string[] = await getJSON(keywordUrl);

		const callablesJSON = await getJSON(callableUrl);
		const pickKeys = <T extends object>(object: T, keys: (keyof T)[], depth = 0) => {
			if (depth === keys.length) return object;
			const key = keys[depth];
			return Object.fromEntries(
				Object.entries(object).map(([k, v]) => [k, pickKeys(v[key], keys, depth + 1)]),
			);
		};
		const callables = pickKeys(callablesJSON.featuresets, ["modules", "callables"]);

		const engine: Engine = {
			id,
			languageId: `gsc-${id}`,
			displayName: meta.displayName,
			gameTitle: meta.gameTitle,
			featuresets: Object.entries(callablesJSON.featuresets)
				.map(([id, data]) => {
					const { meta } = data as any;
					return {
						id,
						description: meta.description,
						enabledByDefault: ["common", "mp"].includes(id),
					};
				})
				.sort((a, b) => {
					const order = ["common", "sp", "mp"];
					const aIndex = order.indexOf(a.id);
					const bIndex = order.indexOf(b.id);
					if (aIndex === -1 && bIndex === -1) return a < b ? -1 : 1;
					if (aIndex === -1) return 1;
					if (bIndex === -1) return -1;
					return aIndex - bIndex;
				}),
		};

		return { engine, keywords, callables };
	}),
);

const projectDir = new URL("../", import.meta.url);
const outDir = new URL(`${compilerOptions.outDir}/`, projectDir);
const outDataDir = new URL("data/", outDir);
const staticDir = new URL("static/", projectDir);
const writePromises: Promise<void>[] = [];

if (await removeDir(outDir)) console.log("Removed out directory.");
writePromises.push(copyDir(staticDir, new URL("static/", outDir)));

for (const { engine, keywords, callables } of enginesData) {
	const outEngineDir = new URL(`${engine.id}/`, outDataDir);

	writePromises.push(writeJSON(new URL("meta.json", outEngineDir), engine));
	writePromises.push(writeJSON(new URL("keyword.json", outEngineDir), keywords));
	writePromises.push(writeJSON(new URL("callable.json", outEngineDir), callables));
	const grammar = createGrammar(engine, keywords);
	writePromises.push(writeJSON(new URL("grammar.json", outEngineDir), grammar));
	const snippets = createSnippets(keywords);
	writePromises.push(writeJSON(new URL("snippets.json", outEngineDir), snippets));
}

const contributes = createContributes(enginesData.map((data) => data.engine));
writePromises.push(
	writeJSON(new URL("package.json", outDir), {
		...packageJson,
		type: "commonjs",
		main: "./",
		contributes,
	}),
);

await Promise.all(writePromises);
console.log("Build successful.");
