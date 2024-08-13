export function wait(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

export function escapeRegExp(string: string) {
	return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function removeFileExtension(filename: string) {
	const extensionDotIndex = filename.lastIndexOf(".");
	if (extensionDotIndex === -1) return filename;
	return filename.slice(0, extensionDotIndex);
}
