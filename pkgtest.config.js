const { join } = require("path");

const nodeLinkedYarnBerry = {
	alias: "yarn node linked",
	packageManager: "yarn-berry",
	options: {
		yarnrc: {
			nodeLinker: "node-modules",
		},
	},
};

const packageManagers = [
	// "npm",
	// "pnpm",
	"yarn-v1",
	// "yarn-berry",
	// nodeLinkedYarnBerry,
];

const simpleFileTests = {
	fileTests: {
		testMatch: "**/*.ts",
		runWith: ["node", "tsx", "ts-node"],
		transforms: {
			typescript: {
				tsNode: {
					version: "^10.9.2",
				},
			}, // Use the defaults, but we do want typescript transformation
		},
	},
	packageManagers,
	moduleTypes: ["commonjs", "esm"],
	timeout: 3000, // ts-node on yarn-berry takes about 2s (kinda pretty high compared to all the others)
};

const cjsBinTests = {
	additionalFiles: [[join("fixtures", "fakepkgtest-cjs"), "./"]],
	binTests: {
		pkgtest: [
			{
				// Run an actual simple pkgtest via the cli
				args: "",
			},
		],
	},
	packageManagers,
	moduleTypes: ["commonjs"],
	timeout: 100000, // Make it about 2 minutes since we're literally running another pkgtest
};

const esmBinTests = {
	additionalFiles: [[join("fixtures", "fakepkgtest-esm"), "./"]],
	binTests: {
		pkgtest: [
			{
				// Run an actual simple pkgtest via the cli
				args: "",
			},
		],
	},
	packageManagers,
	moduleTypes: ["esm"],
	timeout: 100000, // Make it about 2 minutes since we're literally running another pkgtest
};

module.exports = {
	rootDir: "pkgtest",
	locks: true,
	matchIgnore: ["fixtures/**"],
	entries: [simpleFileTests, cjsBinTests, esmBinTests],
};
