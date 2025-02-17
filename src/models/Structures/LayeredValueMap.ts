import { LayeredValue } from "./LayeredValue";

export class LayeredValueMap<K, V> {
	private readonly layeredValues: Map<K, LayeredValue<V>>;

	constructor() {
		this.layeredValues = new Map();
	}

	get(key: K) {
		const layeredValue = this.layeredValues.get(key);
		return layeredValue?.top;
	}

	set(key: K, layerIndex: number, value: V) {
		const layeredValue = this.layeredValues.get(key);
		if (!layeredValue) this.layeredValues.set(key, new LayeredValue({ [layerIndex]: value }));
		else layeredValue.set(layerIndex, value);
	}

	delete(key: K, layerIndex: number) {
		const layeredValue = this.layeredValues.get(key);
		if (!layeredValue) return;
		layeredValue.delete(layerIndex);
		if (layeredValue.top === undefined) this.layeredValues.delete(key);
	}
}
