export function tryGetDependency(
	dep: string,
	packageJson: {
		dependencies?: {
			[k: string]: string;
		};
		devDependencies?: {
			[k: string]: string;
		};
		peerDependencies?: {
			[k: string]: string;
		};
	},
) {
	return (
		packageJson.peerDependencies?.[dep] ??
		packageJson.dependencies?.[dep] ??
		packageJson.devDependencies?.[dep]
	);
}
