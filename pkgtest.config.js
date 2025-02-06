module.exports = {
	entries: [
		{
			testMatch: "pkgtest/**/*.ts",
			runWith: ["node", "tsx"],
			packageManagers: ["yarn-v1", "yarn-v4", "npm"],
			moduleTypes: ["commonjs", "esm"],
			transforms: {
				typescript: {}, // Use the defaults, but we do want typescript transformation
			},
		},
	],
};
