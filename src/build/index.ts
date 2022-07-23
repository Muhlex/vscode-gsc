import { join as joinPath } from 'path';
import * as fs from 'fs/promises';

import grammar from './templates/grammar';
import writeFile from './write-file';
import * as tsconfig from '../../tsconfig.json';

const OUT_DIR = 'out/';
const VARIANT_IDS = ['iw3', 'iw4'];
console.log(tsconfig);

(async () => {
	try {
		await fs.access(OUT_DIR);
		console.log('Clearing directory:', OUT_DIR);
		await fs.rm(OUT_DIR, { recursive: true });
	} catch (error) { }

	VARIANT_IDS.forEach(id => {
		// Grammars
		// console.log(grammar(id).repository.preprocessor.patterns[0].match);
		writeFile(
			joinPath(OUT_DIR, 'grammars', `gsc-${id}.tmLanguage.json`),
			JSON.stringify(grammar(id))
		);
	});
})();
