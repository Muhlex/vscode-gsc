import * as fs from "fs/promises";
import * as path from "path";

export const writeFile = async (filepath: string, content: string | Buffer) => {
	await fs.mkdir(path.dirname(filepath), { recursive: true });
	await fs.writeFile(filepath, content);
};

export const getFilesRecursive = async (dir: string): Promise<string[]> => {
	const dirents = await fs.readdir(dir, { withFileTypes: true });
	const files = await Promise.all(dirents.map((dirent) => {
		const res = path.resolve(dir, dirent.name);
		return dirent.isDirectory() ? getFilesRecursive(res) : res;
	}));
	return files.flat();
};
