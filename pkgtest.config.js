const { join } = require("path");

// Create a pkgtest.config.js file so we can test our binary and solve yarn local resolution in dependencies
const createConfigFile = (_config, { moduleType, projectDir }) => {
	const exportPart =
		moduleType === "commonjs" ? "module.exports = " : "export default ";
	const pkgtestPath = projectDir;

	const content = `const baseEntry = {
	fileTests: {
		testMatch: "**/*.ts",
		runWith: ["node", "tsx", "ts-node"],
		transforms: {
			typescript: {
				version: "^5.0.0",
				tsNode: {
					version: "^10.9.2",
				},
				tsx: {
					version: "^4.19.2",
				},
				nodeTypes: {
					version: "^20.0.0",
				},
			}, // Use the defaults, but we do want typescript transformation
		},
	},
	// Add the peerDeps of pkgtest
	additionalDependencies: {
		"get-tsconfig": "^4.10.0",
		"type-fest": "^4.35.0"
	},
	moduleTypes: ["commonjs", "esm"],
	timeout: 9000, // Accounts for some slow downs on CI
};

${exportPart}{
	rootDir: "pkgtest",
	// Since we use locks in the upper context, we are just gonna skip that because it's painful to do lock updates
	locks: false,
	entries: [
		{
			...baseEntry,
			packageManagers: ["npm", "pnpm"],
		},
		{
			...baseEntry,
			packageManagers: [
				{
					alias: "nolockv1",
					packageManager: "yarn-v1",
				},
			],
			packageJson: {
				resolutions: {
					"@hanseltime/pkgtest": "file:${pkgtestPath}",
				},
			},
		},
		{
			...baseEntry,
			packageManagers: [
				{
					alias: "nolockberry",
					packageManager: "yarn-berry",
				},
			],
			packageJson: {
				resolutions: {
					"@hanseltime/pkgtest": "portal:${pkgtestPath}",
				},
			},
		},
	],
};`;

	return [content, "pkgtest.config.js"];
};

const nodeLinkedYarnBerry = {
	alias: "yarn node linked",
	packageManager: "yarn-berry",
	options: {
		yarnrc: {
			nodeLinker: "node-modules",
		},
	},
};

let packageManagers = [
	"npm",
	"pnpm",
	"yarn-v1",
	"yarn-berry",
	nodeLinkedYarnBerry,
];
// To allow for --install only caching, we'll handle an environmet variable with installOnly and propagate it
let addArgs = "";
if (process.env.NESTED_YARN_V1_INSTALL == "true") {
	addArgs = " --installOnly --pkgManager yarn-v1";
	// Filter down to just one packageManager since we just want to make sure yarn cache doesn't break
	// on the real run
	packageManagers = ["yarn-berry"];
}
// If we supply the noYarnv1CacheClean flag, we propagate it
if (process.argv.includes("--noYarnv1CacheClean")) {
	addArgs += " --noYarnv1CacheClean";
}

const nonNestedTests = {
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
	// Prove that we run script tests with a dummy script
	scriptTests: [
		{
			name: "hello",
			script: "node -e 'console.log(\"hello\")'",
		},
	],
	packageManagers,
	moduleTypes: ["commonjs", "esm"],
	timeout: 3000, // ts-node on yarn-berry takes about 2s (kinda pretty high compared to all the others)
};

const cjsBinTests = {
	additionalFiles: [
		[join("fixtures", "fakepkgtest-cjs"), "./"],
		createConfigFile,
	],
	binTests: {
		pkgtest: [
			{
				// Run an actual simple pkgtest via the cli
				args: addArgs,
			},
		],
	},
	packageManagers,
	moduleTypes: ["commonjs"],
	timeout: 140000, // Make it about 2 minutes since we're literally running another pkgtest
};

const esmBinTests = {
	additionalFiles: [
		[join("fixtures", "fakepkgtest-esm"), "./"],
		createConfigFile,
	],
	binTests: {
		pkgtest: [
			{
				// Run an actual simple pkgtest via the cli
				args: addArgs,
			},
		],
	},
	packageManagers,
	moduleTypes: ["esm"],
	timeout: 140000, // Make it about 2 minutes since we're literally running another pkgtest
};

module.exports = {
	rootDir: "pkgtest",
	locks: false,
	matchIgnore: ["fixtures/**"],
	entries: [nonNestedTests, cjsBinTests, esmBinTests],
};
