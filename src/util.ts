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

export function getNextSubstring( // TODO use this wherever
	input: string,
	substrings: string[],
	position?: number,
	backwards = false,
) {
	const indexOf = (backwards ? input.lastIndexOf : input.indexOf).bind(input);
	return substrings
		.map((substring) => ({ substring, index: indexOf(substring, position) }))
		.filter(({ index }) => index !== -1)
		.sort((a, b) => a.index - b.index)
		.at(backwards ? -1 : 0);
}
