export class SetMap<K, V> {
	private readonly sets: Map<K, Set<V>>;

	constructor() {
		this.sets = new Map();
	}

	get(key: K): ReadonlySet<V> | undefined {
		return this.sets.get(key);
	}

	add(key: K, value: V) {
		let set = this.sets.get(key);
		if (!set) {
			set = new Set();
			this.sets.set(key, set);
		}
		set.add(value);
	}

	delete(key: K, value: V) {
		const set = this.sets.get(key);
		if (!set) return;
		set.delete(value);
		if (set.size === 0) this.sets.delete(key);
	}

	clear(key: K) {
		this.sets.delete(key);
	}
}
