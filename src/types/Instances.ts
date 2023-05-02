import { Range } from "vscode";

export enum CallableInstanceType { Reference, Call }
export type CallableInstance = {
	type: CallableInstanceType
	ident: { name: string, range: Range }
	params?: { range: Range }[]
}
