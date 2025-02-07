module.exports = {
	entries: [
		{
			testMatch: "pkgtest/**/*.ts",
			runWith: ["node", "tsx", "ts-node"],
			packageManagers: ["yarn-v1", "yarn-berry", "npm", "pnpm"],
			moduleTypes: ["commonjs", "esm"],
			transforms: {
				typescript: {
					tsNode: {
						version: "^10.9.2",
					}
				}, // Use the defaults, but we do want typescript transformation
			},
		},
	],
};
