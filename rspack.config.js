/**
 * Configuration for bundling our binary scripts - we do this so that binary scripts
 * are not reliant on external npm dependencies and subject to version mismatch
 */
const { defineConfig } = require("@rspack/cli");
const { basename, join } = require("path");
const { readFileSync, existsSync } = require("fs");
const { convert } = require("tsconfig-to-swcconfig");

// TODO: set this value if you are placing all of your scripts in a folder within the root
const binSourceRoot = join("src", "bin");

// Iterate all package.json bin commands and construct them as expected
const pkgJson = JSON.parse(
	readFileSync(join(__dirname, "package.json")).toString(),
);

const outpath = join("dist", "bin");

const configOptions = {
	entry: {},
	output: {
		path: join(process.cwd(), outpath),
	},
	module: {
		rules: [
			{
				test: /\.ts$/,
				exclude: [/node_modules/],
				loader: "builtin:swc-loader",
				options: convert(join(__dirname, "tsconfig.json"), process.cwd()),
				type: "javascript/auto",
			},
		],
	},
};

if (!pkgJson.bin || Object.keys(pkgJson.bin).length === 0) {
	console.warn(
		`No bin files located in package.json so no bin bundling is performed!`,
	);
} else {
	// Apply entries
	Object.keys(pkgJson.bin).forEach((cmd) => {
		const compiledPath = pkgJson.bin[cmd];
		const base = basename(compiledPath);
		const bundleName = base.substring(0, base.lastIndexOf("."));
		if (
			!compiledPath.startsWith(`./${outpath}`) &&
			!compiledPath.startsWith(outpath)
		) {
			throw new Error(
				`package.json bin entry does not reference output dir (${outpath}): "${cmd}: ${compiledPath}"`,
			);
		}
		// replace dist with src and .js with .ts
		const srcPath = join(
			__dirname,
			compiledPath
				.replace(outpath + "/", binSourceRoot + "/")
				.replace(/\.js$/, ".ts"),
		);
		if (!existsSync(srcPath)) {
			throw new Error(
				`Unresolvable package.json bin entry: "${cmd}: ${compiledPath}".  Looking at ${srcPath}`,
			);
		}
		configOptions.entry[bundleName] = srcPath;
	});
}

module.exports = defineConfig({
	...configOptions,
	context: join(__dirname, "src"),
	externalsPresets: {
		node: true,
	},
	resolve: {
		extensions: [".ts", ".js"],
	},
	node: {
		// Preserve nodejs values
		__dirname: false,
		__filename: false,
	},
});
