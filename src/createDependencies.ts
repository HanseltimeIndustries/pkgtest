import { getLocalPackagePath } from "./pkgManager";
import { tryGetDependency } from "./tryGetDependency";
import { TypescriptOptions, RunWith, PkgManager } from "./types";

export interface CreateDependenciesOptions {
	typescript?: TypescriptOptions;
	runBy?: RunWith[];
	pkgManager: PkgManager;
	/**
	 * If you explicitly want to include other dependencies, you can add them here,
	 *
	 * IMPORTANT!  This overrides any derived types
	 */
	additionalDependencies?: {
		[pkg: string]: string;
	};
}

/**
 * Creates a set of dependencies for the target test project that given the package
 * json of the project we want to test, it's relative url to the target package.json we
 * are building dependencies for and test options.
 *
 * @param packageJson
 * @param packageRelativePath
 * @param options
 * @returns
 */
export function createDependencies(
	/**
	 * The packageJson of the package we're tesing installs for (used for lookup of peerDependencies
	 * and fallback versioning)
	 */
	packageJson: {
		name: string;
		dependencies?: {
			[pkg: string]: string;
		};
		devDependencies?: {
			[pkg: string]: string;
		};
		peerDependencies?: {
			[pkg: string]: string;
		};
	},
	/**
	 * The relative path from the current directory that we're building dependencies for to the package
	 * under test
	 */
	packageRelativePath: string,
	options: CreateDependenciesOptions,
) {
	const { name, peerDependencies } = packageJson;

	const { typescript, runBy, pkgManager, additionalDependencies } = options;

	// Specific templates have their own dependencies
	const specificDeps: {
		[pkg: string]: string | undefined;
	} = typescript
		? {
				typescript:
					typescript?.version ?? tryGetDependency("typescript", packageJson),
				"@types/node":
					typescript?.nodeTypes?.version ??
					tryGetDependency("@types/node", packageJson),
			}
		: {};
	// Make sure we have minimum dependency requirements
	runBy?.forEach((rBy) => {
		if (rBy === RunWith.Tsx || rBy === RunWith.TsNode) {
			if (!typescript) {
				throw new Error(
					`Supply a typescript object (even if empty) for running by ${rBy}`,
				);
			}
			if (!specificDeps.typescript) {
				throw new Error(
					`Cannot run by ${rBy} without a typescript version supplied or discoverable in package.json!`,
				);
			}
			if (!specificDeps["@types/node"]) {
				throw new Error(
					`Cannot run by ${rBy} without a @types/node version supplied or discoverable in package.json!`,
				);
			}
		}
	});

	runBy?.forEach((rBy) => {
		switch (rBy) {
			case RunWith.Node:
				break;
			case RunWith.TsNode:
				specificDeps["ts-node"] =
					typescript?.tsNode?.version ??
					tryGetDependency("ts-node", packageJson);
				if (!specificDeps["ts-node"]) {
					throw new Error(
						`Cannot run by ts-node without a ts-node version supplied or discoverable in package.json!`,
					);
				}
				break;
			case RunWith.Tsx:
				specificDeps["tsx"] =
					typescript?.tsx?.version ?? tryGetDependency("tsx", packageJson);
				if (!specificDeps["tsx"]) {
					throw new Error(
						`Cannot run by tsx without a tsx version supplied or discoverable in package.json!`,
					);
				}
				break;
			default:
				throw new Error("Unimplemented runBy dependencies for: " + runBy);
		}
	});

	let localPath = getLocalPackagePath(pkgManager, packageRelativePath);

	return {
		[name]: localPath,
		...peerDependencies,
		...specificDeps,
		...additionalDependencies,
	};
}
