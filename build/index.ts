import { parseArgs } from "node:util";
import { copy, getJSON, removeDir, writeJSON } from "./io";

import type { Engine } from "../src/models/Engine";
import type { EngineScope } from "../src/models/Scope";

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
const urls: { engines: string; keywords: string; callables: string } = index.urls;

const enginesDocs: {
	id: string;
	displayName: string;
	gameTitle: string;
	featuresets: { id: string; displayName: string; description: string }[];
}[] = await getJSON(urls.engines);
const enginesDocsById = new Map(enginesDocs.map((engine) => [engine.id, engine]));

const engines: Engine[] = args.engine.map((id) => {
	const docs = enginesDocsById.get(id);
	if (!docs) throw new Error(`Engine '${id}' is not documented in ${urls.engines}.`);

	return {
		id,
		languageId: `gsc-${id}`,
		displayName: docs.displayName,
		gameTitle: docs.gameTitle,
		featuresets: docs.featuresets.map(({ id, displayName, description }) => ({
			id,
			displayName,
			description,
			enabledByDefault: ["common", "mp"].includes(id),
		})),
	};
});

const keywords = await getJSON(urls.keywords);
const keywordsByEngineId = (() => {
	const result = new Map<string, string[]>();
	for (const name in keywords) {
		const scopes: EngineScope[] = keywords[name].scopes;
		for (const scope of scopes) {
			let engineKeywords = result.get(scope.engine);
			if (!engineKeywords) {
				engineKeywords = [];
				result.set(scope.engine, engineKeywords);
			}
			engineKeywords.push(name);
		}
	}
	return result;
})();

const callables = await getJSON(urls.callables);

const writePromises: Promise<void>[] = [];
const projectDir = new URL("../", import.meta.url);
const outDir = new URL(`${compilerOptions.outDir}/`, projectDir);
const outDataDir = new URL("data/", outDir);

if (await removeDir(outDir)) console.log("Removed out directory.");
writePromises.push(copy(new URL("README.md", projectDir), new URL("README.md", outDir)));
writePromises.push(copy(new URL("CHANGELOG.md", projectDir), new URL("CHANGELOG.md", outDir)));
writePromises.push(copy(new URL("LICENSE", projectDir), new URL("LICENSE", outDir)));
writePromises.push(copy(new URL("static/", projectDir), new URL("static/", outDir)));

writePromises.push(writeJSON(new URL("keywords.json", outDataDir), keywords));
writePromises.push(writeJSON(new URL("callables.json", outDataDir), callables));

for (const engine of engines) {
	const outEngineDir = new URL(`${engine.id}/`, outDataDir);

	writePromises.push(writeJSON(new URL("engine.json", outEngineDir), engine));
	const engineKeywords = keywordsByEngineId.get(engine.id) ?? [];
	const grammar = createGrammar(engine, engineKeywords);
	writePromises.push(writeJSON(new URL("grammar.json", outEngineDir), grammar));
	const snippets = createSnippets(engineKeywords);
	writePromises.push(writeJSON(new URL("snippets.json", outEngineDir), snippets));
}

const contributes = createContributes(engines);
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
