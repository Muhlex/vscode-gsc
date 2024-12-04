export class AsyncCache<T extends object> {
	private data: Partial<T> = {};
	private promises: {
		[K in keyof T]?: Promise<T[K]>;
	} = {};

	async get<K extends keyof T>(
		key: K,
		getFunc: () => Promise<NonNullable<T[K]>>,
	): Promise<NonNullable<T[K]>> {
		// TODO: Make sure this logic holds up when cache is cleared while a promise is pending:
		const cachedPromise = this.promises[key];
		if (cachedPromise) return await cachedPromise;

		const promise = getFunc();
		this.promises[key] = promise;
		const data = await promise;
		this.data[key] = data;
		return data;
	}

	getCached<K extends keyof T>(key: K): T[K] | undefined {
		return this.data[key];
	}

	clear(key?: keyof T) {
		if (key) {
			delete this.data[key];
			delete this.promises[key];
		} else {
			this.data = {};
			this.promises = {};
		}
	}
}
