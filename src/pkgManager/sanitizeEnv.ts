export function sanitizeEnv(pathToPackageJson: string) {
	return {
		...process.env,
		// Since yarn plug'n'play pollutes node options with its loader
		NODE_OPTIONS: "",
		npm_package_json: pathToPackageJson,
	};
}
