import * as vscode from "vscode";
import type { VariableDef, CallableDef } from "../types/Defs";
import type { Stores } from "../stores";

export const getTypesString = (types?: string[]) => (types?.length ? types.join("/") : "");
export const getVariableString = (v: VariableDef) => v.name || getTypesString(v.types) || "unknown";

// TODO: Replace this with something that works with inline includes (pass a Range probably):
// TODO: Maybe attach it to the Stores instead?
export const getDef = async (ident: string, document: vscode.TextDocument, stores: Stores) => {
	const identLc = ident.toLowerCase();
	return (
		stores.static.callables.get(identLc) ??
		(await stores.gsc.getFile(document).getCallableDefsInScope()).get(identLc)
	);
};

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

export const isCall = (range: vscode.Range, document: vscode.TextDocument) => {
	const PAREN = "(";
	const start = range.end;
	const end = range.end.translate(0, PAREN.length);
	const text = document.getText(new vscode.Range(start, end));
	return text === PAREN;
};

export const isReference = (range: vscode.Range, document: vscode.TextDocument) => {
	const REF = "::";
	if (range.start.character < REF.length) return false;
	const start = range.start.translate(0, -REF.length);
	const end = range.start;
	const text = document.getText(new vscode.Range(start, end));
	return text === REF;
};
