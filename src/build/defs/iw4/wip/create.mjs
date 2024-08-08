import fs from "node:fs";

const spFile = fs.readFileSync("./sp-dump.txt", "utf-8");
const mpFile = fs.readFileSync("./mp-dump.txt", "utf-8");

const common = new Map();
const sp = new Map();
const mp = new Map();

for (const name of spFile.split("\n")) {
	sp.set(name, { name });
}

for (const line of mpFile.split("\n")) {
	const [name, devOnly] = line.split(" ");
	const value = { name, devOnly: !!Number.parseInt(devOnly, 10) };
	if (sp.has(name)) {
		sp.delete(name);
		common.set(name, value);
	} else {
		mp.set(name, value);
	}
}

common.delete("");
sp.delete("");
mp.delete("");

const saveFiles = (map, path) => {
	for (const value of map.values()) {
		let object = {};
		if ("devOnly" in value) {
			object = { devOnly: value.devOnly };
		}
		const json = `${JSON.stringify(object, undefined, "\t")}\n`;
		console.log(path);
		fs.writeFile(`${path}/${value.name}.json`, json, () => {});
	}
};

saveFiles(sp, "./sp/_");
saveFiles(mp, "./mp/_");
saveFiles(common, "./common/_");
