import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

export async function removeDir(path: string | URL) {
	try {
		await rm(path, { recursive: true });
		return true;
	} catch (error) {
		if (error.code === "ENOENT") return false;
		throw error;
	}
}

export async function createDir(path: string | URL) {
	try {
		await mkdir(path, { recursive: true });
		return true;
	} catch (error) {
		if (error.code === "EEXIST") return false;
		throw error;
	}
}

export async function copy(source: string | URL, destination: string | URL) {
	await cp(source, destination, { recursive: true });
}

export async function getJSON(input: string | URL) {
	const url = typeof input === "string" ? new URL(input) : input;
	if (url.protocol === "file:") {
		const text = await readFile(url, { encoding: "utf-8" });
		return JSON.parse(text);
	}
	const response = await fetch(url);
	return response.json();
}

export async function writeJSON(path: string | URL, data: any) {
	const pathString = typeof path === "string" ? path : fileURLToPath(path);
	await createDir(dirname(pathString));
	await writeFile(path, JSON.stringify(data));
}
