export class LayeredValue <V> {
	private _top: V | undefined;
	private all: V[];

	constructor(layers: { [key: number]: V }) {
		this.all = [];
		for (const key in layers) this.all[key] = layers[key];
		this.updateTop();
	}

	get top() {
		return this._top;
	}

	set(layer: number, value: V) {
		this.all[layer] = value;
		this.updateTop();
	}

	delete(layer: number) {
		delete this.all[layer];
		this.updateTop();
	}

	private updateTop() {
		this._top = this.all.findLast((value) => value !== undefined);
	}
}
