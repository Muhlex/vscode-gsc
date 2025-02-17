import { SetMap } from "../../Structures/SetMap";
import type { Script } from "./Script";

/**
 * Dependencies are handled externally to allow for lookups via Script path. This is required for
 * when new Scripts are created that are previously unavailable dependencies of existing Scripts.
 **/

export class DependencyTracker {
	private readonly dependenciesByDependent: SetMap<Script, string>;
	private readonly dependentsByDependency: SetMap<string, Script>;

	constructor() {
		this.dependenciesByDependent = new SetMap();
		this.dependentsByDependency = new SetMap();
	}

	getDependencies(dependent: Script) {
		return this.dependenciesByDependent.get(dependent);
	}

	getDependents(scriptPath: string) {
		return this.dependentsByDependency.get(scriptPath);
	}

	add(dependent: Script, dependency: string) {
		this.dependenciesByDependent.add(dependent, dependency);
		this.dependentsByDependency.add(dependency, dependent);
	}

	remove(dependent: Script, dependency: string) {
		this.dependenciesByDependent.delete(dependent, dependency);
		this.dependentsByDependency.delete(dependency, dependent);
	}

	clear(dependent: Script) {
		this.dependenciesByDependent.clear(dependent);
		const dependencies = this.getDependencies(dependent);
		if (!dependencies) return;
		for (const dependencyPath of dependencies) this.remove(dependent, dependencyPath);
	}
}
