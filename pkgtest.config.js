module.exports = {
	matchRootDir: "pkgtest",
	entries: [
		{
			binTests: {},
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
			packageManagers: [
				"npm",
				"pnpm",
				"yarn-v1",
				"yarn-berry",
				{
					alias: "yarn node linked",
					packageManager: "yarn-berry",
					options: {
						yarnrc: {
							nodeLinker: "node-modules",
						},
					},
				},
			],
			moduleTypes: ["commonjs", "esm"],
		},
	],
};
