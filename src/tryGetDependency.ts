export function tryGetDependency(
	dep: string,
	packageJson: {
		dependencies?: {
			[k: string]: string;
		};
		devDependencies?: {
			[k: string]: string;
		};
	},
) {
	return packageJson.dependencies?.[dep] ?? packageJson.devDependencies?.[dep];
}
