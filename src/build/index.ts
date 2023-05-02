import * as fs from "fs/promises";
import * as path from "path";

import getGrammar from "./templates/grammar";
import getSnippets from "./templates/snippets";
import { writeFile, getFilesRecursive } from "./files";
import * as tsconfig from "../../tsconfig.json";

import { KeywordDefsHierarchy, CallableDefsHierarchy, CallableDef } from "../types/Defs";

const OUT_DIR = tsconfig.compilerOptions.outDir;

(async () => {
	const ENGINES = (await fs.readdir(path.join(__dirname, "defs"), { withFileTypes: true }))
		.filter(dirent => dirent.isDirectory())
		.map(dirent => dirent.name);

	try {
		await fs.access(OUT_DIR);
		console.log("Clearing directory:", OUT_DIR);
		await fs.rm(OUT_DIR, { recursive: true });
	} catch (error) { /* noop, out dir was empty */ }

	const getKeywordDefs = async (): Promise<KeywordDefsHierarchy> => {
		const keywordDefs: KeywordDefsHierarchy = {};
		await Promise.all(ENGINES.map(async engine => {
			const keywordsPath = path.join(__dirname, "defs", engine, "keyword.json");
			try {
				const keywords = JSON.parse((await fs.readFile(keywordsPath)).toString());
				keywordDefs[engine] = keywords;
			} catch (error) {
				throw new Error(`JSON.parse error in '${keywordsPath}':\n${error}`);
			}
		}));

		return keywordDefs;
	};

	const buildKeywordDefs = async (defs: KeywordDefsHierarchy) => {
		ENGINES.forEach(engine => {
			writeFile(
				path.join(OUT_DIR, "defs", engine, "keyword.json"),
				JSON.stringify(defs[engine] || [])
			);
		});
	};

	const buildCallableDefs = async () => {
		const files = (await Promise.all(
			ENGINES.map(async engine => {
				const callablesPath = path.join(__dirname, "defs", engine, "callable");
				return await getFilesRecursive(callablesPath);
			})
		)).flat();
		const defs: CallableDefsHierarchy = {};

		await Promise.all(files.map(async filepath => {
			const { dir, name } = path.parse(filepath);
			const segments = dir.split(path.sep);
			const module = segments[segments.length - 1];
			const featureset = segments[segments.length - 2];
			const engine = segments[segments.length - 4];

			try {
				const def: CallableDef = JSON.parse((await fs.readFile(filepath)).toString());
				def.ident = { name };
				def.module = module;
				def.featureset = featureset;
				def.engine = engine;
				if (!defs[engine]) defs[engine] = {};
				if (!defs[engine][featureset]) defs[engine][featureset] = {};
				if (!defs[engine][featureset][module]) defs[engine][featureset][module] = {};
				defs[engine][featureset][module][name] = def;
			} catch (error) {
				throw new Error(`JSON.parse error in '${filepath}':\n${error}`);
			}
		}));

		ENGINES.forEach(engine => {
			writeFile(
				path.join(OUT_DIR, "defs", engine, "callable.json"),
				JSON.stringify(defs[engine] || {})
			);
		});
	};

	const buildGrammars = (keywordDefs: KeywordDefsHierarchy) => {
		return Promise.all(ENGINES.map(engine => writeFile(
			path.join(OUT_DIR, "grammars", `gsc-${engine}.json`),
			JSON.stringify(getGrammar(engine, keywordDefs[engine]))
		)));
	};

	const buildSnippets = (keywordDefs: KeywordDefsHierarchy) => {
		return Promise.all(ENGINES.map(engine => writeFile(
			path.join(OUT_DIR, "snippets", `gsc-${engine}.json`),
			JSON.stringify(getSnippets(engine, keywordDefs[engine]))
		)));
	};

	try {
		const keywordDefs = await getKeywordDefs();
		buildKeywordDefs(keywordDefs);
		buildCallableDefs();
		buildGrammars(keywordDefs);
		buildSnippets(keywordDefs);
	} catch (error) {
		console.error(error);
	}
})();
