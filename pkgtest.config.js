module.exports = {
	entries: [
		{
			testMatch: "pkgtest/**/*.ts",
			runWith: ["node", "tsx"],
			packageManagers: ["yarn-v1", "yarn-berry", "npm", "pnpm"],
			moduleTypes: ["commonjs", "esm"],
			transforms: {
				typescript: {}, // Use the defaults, but we do want typescript transformation
			},
		},
	],
};
