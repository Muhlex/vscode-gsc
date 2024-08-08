import * as vscode from "vscode";
import type { VariableDef, CallableDef } from "../models/Def";

export const getTypesString = (types?: string[]) => (types?.length ? types.join("/") : "");
export const getVariableString = (v: VariableDef) => v.name || getTypesString(v.types) || "unknown";

export const createDocumentation = (
	def: CallableDef,
	languageId: string,
	features?: { concise?: boolean; example?: boolean },
) => {
	const concise = features?.concise ?? false;
	const showExample = features?.example ?? true;

	const getVariableDoc = (v: VariableDef | undefined, kind: string) => {
		if (!v) return "";

		const types = getTypesString(v.types);
		return `${concise ? `${kind} ` : `*${kind}* `}${
			v.name ? `\`${v.name}\`${types ? " " : ""}` : ""
		}${types ? `*${types}*` : ""}${v.description ? ` — ${v.description.join("\n")}` : ""}`;
	};

	const isGame = def.origin === "game";
	const receiver = getVariableDoc(def.receiver, concise ? "📥️️" : "@receiver");
	const params =
		def.params
			?.map((p) => getVariableDoc(p, concise ? (p.optional ? "✳️️" : "✴️️") : "@param"))
			.join("\n\n") || "";
	const returns = getVariableDoc(def.return, concise ? "↩️️" : "@return");

	const variables = `\
${receiver ? `${receiver}\n\n` : ""}\
${params ? `${params}\n\n` : ""}\
${returns}`;

	const example =
		def.example && showExample
			? `\
${concise ? "" : "*Example:*\n"}
\`\`\`${languageId}
${def.example.join("\n")}
\`\`\``
			: "";

	return new vscode.MarkdownString(`\
${isGame && def.deprecated ? "**👎️ Deprecated**\n\n" : ""}\
${isGame && def.devOnly ? "**🛠️️ Development only**\n\n" : ""}\
${def.description?.join("\n\n") || ""}\
${variables ? `\n***\n${variables}` : ""}\
${example ? `\n***\n${example}` : ""}`);
};
