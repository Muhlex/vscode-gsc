import type { Engine } from "../models/Engine";

export default (enginesMeta: Engine[]) => {
	return {
		languages: enginesMeta.map((meta) => {
			const icon = `./static/icons/language/${meta.id}.svg`;
			return {
				id: meta.languageId,
				aliases: [`Game Script (${meta.displayName})`, `GSC (${meta.displayName})`],
				extensions: [".gsc", ".csc"],
				configuration: "./static/language-configuration.json",
				icon: { light: icon, dark: icon },
			};
		}),
		grammars: enginesMeta.map((meta) => ({
			language: meta.languageId,
			scopeName: `source.gsc.${meta.id}`,
			path: `./data/${meta.id}/grammar.json`,
		})),
		snippets: enginesMeta.map((meta) => ({
			language: meta.languageId,
			path: `./data/${meta.id}/snippets.json`,
		})),
		configuration: {
			title: "GSC (Call of Duty)",
			properties: {
				"GSC.intelliSense.enable.keywords": {
					markdownDescription: "Auto complete keywords (if, for, switch, ...) with IntelliSense.",
					scope: "language-overridable",
					type: "boolean",
					default: true,
				},
				"GSC.intelliSense.enable.callablesGame": {
					markdownDescription:
						"Auto complete inbuilt (engine) functions and methods with IntelliSense.",
					scope: "language-overridable",
					type: "string",
					default: "non-deprecated",
					enum: ["off", "non-deprecated", "all"],
					enumDescriptions: [
						"Don't auto complete inbuilt functions and methods.",
						"Only auto complete inbuilt functions and methods not marked as deprecated (these are often non-functioning).",
						"Auto complete all inbuilt functions and methods.",
					],
				},
				"GSC.intelliSense.enable.callablesScript": {
					markdownDescription:
						"Auto complete script-defined functions and methods with IntelliSense.",
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
						"Determine how to sort folders when auto completing file paths with IntelliSense.",
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
					enginesMeta.map((meta) => [
						`GSC.featureSets.${meta.displayName}`,
						{
							markdownDescription: `Define sets of engine features to be used (by IntelliSense and semantic highlighting) for **${meta.gameTitle}**.`,
							scope: "resource",
							type: "object",
							properties: Object.fromEntries(
								meta.featuresets.map((featureset) => [
									featureset.id,
									{
										type: "boolean",
										description: featureset.description,
									},
								]),
							),
							additionalProperties: false,
							default: Object.fromEntries(
								meta.featuresets.map((featureset) => [featureset.id, featureset.enabledByDefault]),
							),
						},
					]),
				),
				...Object.fromEntries(
					enginesMeta.map((meta) => [
						`GSC.rootDirectories.${meta.displayName}`,
						{
							markdownDescription: `Root directory paths where stock or custom GSC files are found for **${meta.gameTitle}**. When a file exists in multiple paths, later paths takes precedence.\n\nE. g. \`C:\\games\\${meta.id}\\raw\``,
							scope: "machine-overridable",
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
			enginesMeta.map((meta) => [
				`[${meta.languageId}]`,
				{
					"files.encoding": "windows1252",
				},
			]),
		),
	};
};
