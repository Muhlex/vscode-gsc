export type Engine = {
	id: string;
	languageId: string;
	displayName: string;
	gameTitle: string;
	featuresets: {
		id: string;
		description: string;
		enabledByDefault: boolean;
	}[];
};
