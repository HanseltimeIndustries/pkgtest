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
};

export default {
	rootDir: "pkgtest",
	// Since we use locks in the upper context, we are just gonna skip that because it's painful to do lock updates
	locks: false,
	entries: [
		{
			...baseEntry,
			packageManagers: ["npm", "pnpm"],
		},
		// {
		// 	...baseEntry,
		// 	packageManagers: [
		// 		{
		// 			alias: "nolockv1",
		// 			packageManager: "yarn-v1",
		// 			options: {
		// 				installCliArgs: "--no-lockfile",
		// 			},
		// 		},
		// 	],
		// 	packageJson: {
		// 		resolutions: {
		// 			"@hanseltime/pkgtest": "file:/home/justin.hanselman/test-yarn",
		// 		},
		// 	},
		// },
		// {
		// 	...baseEntry,
		// 	packageManagers: [
		// 		{
		// 			alias: "nolockberry",
		// 			packageManager: "yarn-berry",
		// 			options: {
		// 				installCliArgs: "--no-immutable",
		// 			},
		// 		},
		// 	],
		// 	packageJson: {
		// 		resolutions: {
		// 			"@hanseltime/pkgtest": "portal:/home/justin.hanselman/test-yarn",
		// 		},
		// 	},
		// },
	],
};
