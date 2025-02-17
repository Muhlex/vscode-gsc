import type { Engine } from "./Engine";
import type { Featureset } from "./Featureset";

export type EngineScope = { engine: Engine["id"] };
export type FeaturesetsScope = EngineScope & { featuresets: Featureset["id"][] };

export type ScopesLookup = ReadonlyMap<Engine["id"], ReadonlySet<Featureset["id"]>>;
