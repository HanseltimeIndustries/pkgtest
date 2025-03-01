/**
 * Bundling of our binary scripts
 */
const { join } = require("path");
const { readFileSync, writeFileSync, existsSync } = require("fs");

// Iterate all package.json bin commands and construct them as expected
const pkgJson = JSON.parse(
	readFileSync(join(__dirname, "package.json")).toString(),
);

if (!pkgJson.bin) {
	console.warn(
		`No bin files located in package.json so no bin bundling is performed!`,
	);
} else {
	// Add hashbangs
	function addHashBang(cmd, compiledPath) {
		if (process.platform === "win32") {
			compiledPath = compiledPath.replaceAll("/", "\\");
		}
		if (!existsSync(compiledPath)) {
			console.error(
				`Unable to find compiled bin script for ${cmd} as ${compiledPath}`,
			);
			process.exit(3);
		}
		const compiledBin = readFileSync(compiledPath).toString();
		const hashbang = "#!/usr/bin/env node\n";
		if (!compiledBin.startsWith(hashbang)) {
			writeFileSync(compiledPath, hashbang + compiledBin);
			console.log("Added hashbang to " + compiledPath);
		}
	}
	if (typeof pkgJson.bin === "string") {
		const splitIdx = pkgJson.name.indexOf("/");
		addHashBang(
			pkgJson.name.slice(splitIdx >= 0 ? splitIdx + 1 : 0),
			pkgJson.bin,
		);
	} else {
		Object.keys(pkgJson.bin).forEach((cmd) => {
			addHashBang(cmd, pkgJson.bin[cmd]);
		});
	}
}
