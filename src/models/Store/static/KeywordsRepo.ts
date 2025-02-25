import type { EngineScope } from "../../Scope";

type KeywordsRaw = { [name: string]: { scopes: EngineScope[] } };

export class KeywordsRepo {
	private readonly engineIdsByName: Map<string, Set<string>>;

	constructor() {
		this.engineIdsByName = new Map();
	}

	addRaw(keywordsRaw: KeywordsRaw) {
		for (const name in keywordsRaw) {
			const scopes = keywordsRaw[name].scopes;
			let storedScopes = this.engineIdsByName.get(name);
			if (!storedScopes) {
				storedScopes = new Set();
				this.engineIdsByName.set(name, storedScopes);
			}
			for (const scope of scopes) storedScopes.add(scope.engine);
		}
	}

	createScoped(scope: EngineScope): string[] {
		const result: string[] = [];
		for (const [name, engineIds] of this.engineIdsByName) {
			if (engineIds.has(scope.engine)) result.push(name);
		}
		return result;
	}
}
