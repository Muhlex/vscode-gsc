import fs from 'fs/promises';
import { dirname } from 'path';

export default async (filepath: string, content: string) => {
	try {
		await fs.mkdir(dirname(filepath), { recursive: true });
		await fs.writeFile(filepath, content);
	} catch (error) {
		console.error(error);
	}
}
