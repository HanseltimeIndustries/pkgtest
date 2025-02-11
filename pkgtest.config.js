module.exports = {
	matchRootDir: "pkgtest",
	entries: [
		{
			testMatch: "**/*.ts",
			runWith: ["node", "tsx", "ts-node"],
			packageManagers: ["yarn-v1", "yarn-berry", "npm", "pnpm"],
			// packageManagers: [
			// 	"npm",
			// 	"yarn-berry",
			// 	{
			// 		alias: "yarn node linked",
			// 		packageManager: "yarn-berry",
			// 		options: {
			// 			yarnrc: {
			// 				nodeLinker: "node-modules",
			// 			},
			// 		},
			// 	},
			// ],
			moduleTypes: ["commonjs", "esm"],
			transforms: {
				typescript: {
					tsNode: {
						version: "^10.9.2",
					},
				}, // Use the defaults, but we do want typescript transformation
			},
		},
	],
};
