const baseEntry = {
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
	moduleTypes: ["commonjs", "esm"],
}

export default {
	rootDir: "pkgtest",
	entries: [
		{
			...baseEntry,
			packageManagers: ["npm", "pnpm"],
		},
		{
			...baseEntry,
			packageManagers: ["yarn-v1"],
			packageJson: {
				resolutions: {
					"@hanseltime/pkgtest": 'file:/home/justin.hanselman/test-yarn'
				},
			},
		},
		{
			...baseEntry,
			packageManagers: ["yarn-berry"],
			packageJson: {
				resolutions: {
					"@hanseltime/pkgtest": 'portal:/home/justin.hanselman/test-yarn'
				},
			},
		}
	],
};
