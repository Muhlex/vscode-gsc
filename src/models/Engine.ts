import type { Featureset } from "./Featureset";

export type Engine = {
	id: string;
	languageId: string;
	displayName: string;
	gameTitle: string;
	featuresets: Featureset[];
};

export const languageIdToEngineId = (languageId: string) => {
	const prefix = "gsc-";
	if (!languageId.startsWith(prefix)) throw new Error(`Invalid language ID: ${languageId}`);
	return languageId.slice(prefix.length);
};
