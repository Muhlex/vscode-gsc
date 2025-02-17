import type { Engine } from "../models/Engine";

export default (engines: Engine[]) => {
	return {
		languages: engines.map((engine) => {
			const icon = `./static/icons/language/${engine.id}.svg`;
			return {
				id: engine.languageId,
				aliases: [`Game Script (${engine.displayName})`, `GSC (${engine.displayName})`],
				extensions: [".gsc", ".csc"],
				configuration: "./static/language-configuration.json",
				icon: { light: icon, dark: icon },
			};
		}),
		grammars: engines.map((engine) => ({
			language: engine.languageId,
			scopeName: `source.gsc.${engine.id}`,
			path: `./data/${engine.id}/grammar.json`,
		})),
		snippets: engines.map((engine) => ({
			language: engine.languageId,
			path: `./data/${engine.id}/snippets.json`,
		})),
		configuration: {
			title: "GSC (Call of Duty)",
			properties: {
				"GSC.intelliSense.enable.keywords": {
					markdownDescription: "Suggest keywords (if, for, switch, ...) with IntelliSense.",
					scope: "language-overridable",
					type: "boolean",
					default: true,
				},
				"GSC.intelliSense.enable.callablesGame": {
					markdownDescription: "Suggest inbuilt (engine) functions and methods with IntelliSense.",
					scope: "language-overridable",
					type: "string",
					default: "non-deprecated",
					enum: ["off", "non-deprecated", "all"],
					enumDescriptions: [
						"Don't suggest inbuilt functions and methods.",
						"Only suggest inbuilt functions and methods not marked as deprecated (these are often non-functioning).",
						"Suggest all inbuilt functions and methods.",
					],
				},
				"GSC.intelliSense.enable.callablesScript": {
					markdownDescription: "Suggest script-defined functions and methods with IntelliSense.",
					scope: "language-overridable",
					type: "boolean",
					default: true,
				},
				"GSC.intelliSense.conciseMode": {
					markdownDescription:
						"Make documentation entries more concise (e. g. replacing tags such as *@param* or *@return* with concise emoji versions ✴️✳️ or ↩️).",
					scope: "language-overridable",
					type: "boolean",
					default: false,
				},
				"GSC.intelliSense.foldersSorting": {
					markdownDescription:
						"Configure how to sort folders when suggesting file paths with IntelliSense.",
					scope: "language-overridable",
					type: "string",
					default: "inline",
					enum: ["top", "bottom", "inline"],
					enumItemLabels: ["Folders before files", "Folders after files", "Alphabetical sorting"],
					enumDescriptions: [
						"Sort folders to the beginning of the list.",
						"Sort folders to the end of the list (files first).",
						"Always sort alphabetically (mix files and folders)",
					],
				},
				"GSC.colors.enable": {
					markdownDescription: "Display color picker on vector literals with components 0 ≤ x ≤ 1.",
					scope: "language-overridable",
					type: "string",
					default: "quotients",
					enum: ["off", "quotients", "all"],
					enumDescriptions: [
						"Don't show color picker.",
						"Only show color picker when all components are quotients (e.g. 🟩 (0/255, 255/255, 20/255)).",
						"Always show color picker on applicable vectors. (This can identify vectors as colors which are not intended as such.)",
					],
				},
				...Object.fromEntries(
					engines.map((engine) => [
						`GSC.featureSets.${engine.displayName}`,
						{
							markdownDescription: `Define sets of engine features to be used (by IntelliSense and semantic highlighting) for **${engine.gameTitle}**.`,
							scope: "resource",
							type: "object",
							properties: Object.fromEntries(
								engine.featuresets.map((featureset) => [
									featureset.id,
									{
										type: "boolean",
										description: featureset.description,
									},
								]),
							),
							additionalProperties: false,
							default: Object.fromEntries(
								engine.featuresets.map((featureset) => [featureset.id, featureset.enabledByDefault]),
							),
						},
					]),
				),
				...Object.fromEntries(
					engines.map((engine) => [
						`GSC.rootDirectories.${engine.displayName}`,
						{
							markdownDescription: `Root directory paths where stock or custom GSC files are found for **${engine.gameTitle}**. When a file exists in multiple paths, later paths takes precedence.\n\nE. g. \`C:\\games\\${engine.id}\\raw\``,
							scope: "window",
							type: "array",
							uniqueItems: true,
							items: {
								type: "string",
								format: "uri",
							},
							default: [],
						},
					]),
				),
			},
		},
		configurationDefaults: Object.fromEntries(
			engines.map((engine) => [`[${engine.languageId}]`, { "files.encoding": "windows1252" }]),
		),
	};
};
