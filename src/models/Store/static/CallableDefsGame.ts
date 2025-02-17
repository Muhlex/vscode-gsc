import type { FeaturesetsScope } from "../../Scope";
import type { CallableDefGame, CallableDefsGameRaw } from "../../Callable";

export class CallableDefsGame {
	private readonly store: Map<string, CallableDefGame[]>;

	constructor() {
		this.store = new Map();
	}

	addDefs(callableDefsRaw: CallableDefsGameRaw) {
		for (const name in callableDefsRaw) {
			const variants = callableDefsRaw[name];
			let variantsStore = this.store.get(name);
			if (!variantsStore) {
				variantsStore = [];
				this.store.set(name, variantsStore);
			}
			for (const variant of variants) {
				const scopes = new Map<string, Set<string>>();
				for (const scopeRaw of variant.scopes) {
					const lookupEngine = scopes.get(scopeRaw.engine);
					if (!lookupEngine) {
						scopes.set(scopeRaw.engine, new Set(scopeRaw.featuresets));
						continue;
					}
					for (const featureset of scopeRaw.featuresets) lookupEngine.add(featureset);
				}

				const def: CallableDefGame = {
					...variant,
					ident: { name },
					origin: "game",
					scopes,
				};
				variantsStore.push(def);
			}
		}
	}

	createScoped(scope: FeaturesetsScope): ReadonlyMap<string, CallableDefGame> {
		const result = new Map<string, CallableDefGame>();
		for (const variants of this.store.values()) {
			for (const variant of variants) {
				const matchingEngineScope = variant.scopes.get(scope.engine);
				if (!matchingEngineScope) continue;
				const isMatch = scope.featuresets.some((featureset) => matchingEngineScope.has(featureset));
				if (!isMatch) continue;
				result.set(variant.ident.name, variant);
			}
		}
		return result;
	}
}
