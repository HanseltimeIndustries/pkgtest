import { createDependencies } from "./createDependencies";
import { PkgManager, RunBy, TypescriptOptions } from "./types";

const testPackageUnderTestJson = {
	name: "@test/pkg",
	devDependencies: {
		typescript: "^5.9.0",
		tsx: "^9.9.9",
		"@types/node": "^20.0.0",
	},
	// make one dependency a regular dependency
	dependencies: {
		"ts-node": "4.0.0",
	},
	peerDependencies: {
		tsx: "^9.9.1",
	},
};
const testRelativePath = "../someFolder/my-pkg";
const testExplicitVersion: TypescriptOptions = {
	version: "5.9.1",
	tsx: {
		version: "10.0.0",
	},
	tsNode: {
		version: "5.0.0",
	},
	nodeTypes: {
		version: "^24.0.0",
	},
};

function expectedPrefix(pkgManager: PkgManager) {
	if (pkgManager === PkgManager.YarnBerry) {
		return "portal:";
	}
	return "file:";
}

describe.each(Object.values(PkgManager).map((pkgManager) => [pkgManager]))(
	"Create Dependencies for %s",
	(pkgManager) => {
		const expPrefix = expectedPrefix(pkgManager);

		it(`creates correct dependencies for ${RunBy.Node}`, () => {
			expect(
				createDependencies(testPackageUnderTestJson, testRelativePath, {
					runBy: [RunBy.Node],
					pkgManager,
				}),
			).toEqual({
				...testPackageUnderTestJson.peerDependencies,
				[testPackageUnderTestJson.name]: `${expPrefix}${testRelativePath}`,
			});
		});
		// Default package.json tests
		it(`creates correct dependencies for ${RunBy.TsNode} - only package.json deps`, () => {
			expect(
				createDependencies(testPackageUnderTestJson, testRelativePath, {
					runBy: [RunBy.TsNode],
					pkgManager,
					typescript: {},
				}),
			).toEqual({
				...testPackageUnderTestJson.peerDependencies,
				typescript: testPackageUnderTestJson.devDependencies.typescript,
				"@types/node": testPackageUnderTestJson.devDependencies["@types/node"],
				"ts-node": testPackageUnderTestJson.dependencies["ts-node"],
				[testPackageUnderTestJson.name]: `${expPrefix}${testRelativePath}`,
			});
		});
		it(`creates correct dependencies for ${RunBy.Tsx} - only package.json deps`, () => {
			expect(
				createDependencies(testPackageUnderTestJson, testRelativePath, {
					runBy: [RunBy.Tsx],
					pkgManager,
					typescript: {},
				}),
			).toEqual({
				// tsx is a "peer dependency"
				...testPackageUnderTestJson.peerDependencies,
				typescript: testPackageUnderTestJson.devDependencies.typescript,
				"@types/node": testPackageUnderTestJson.devDependencies["@types/node"],
				[testPackageUnderTestJson.name]: `${expPrefix}${testRelativePath}`,
			});
		});
		// All explicit override tests
		it(`creates correct dependencies for ${RunBy.TsNode} - with explicit values`, () => {
			expect(
				createDependencies(testPackageUnderTestJson, testRelativePath, {
					runBy: [RunBy.TsNode],
					pkgManager,
					typescript: testExplicitVersion,
				}),
			).toEqual({
				...testPackageUnderTestJson.peerDependencies,
				typescript: testExplicitVersion.version,
				"@types/node": testExplicitVersion.nodeTypes?.version,
				"ts-node": testExplicitVersion.tsNode?.version,
				[testPackageUnderTestJson.name]: `${expPrefix}${testRelativePath}`,
			});
		});
		it(`creates correct dependencies for ${RunBy.Tsx} - with explicit values`, () => {
			expect(
				createDependencies(testPackageUnderTestJson, testRelativePath, {
					runBy: [RunBy.Tsx],
					pkgManager,
					typescript: testExplicitVersion,
				}),
			).toEqual({
				typescript: testExplicitVersion.version,
				"@types/node": testExplicitVersion.nodeTypes?.version,
				tsx: testExplicitVersion.tsx?.version,
				[testPackageUnderTestJson.name]: `${expPrefix}${testRelativePath}`,
			});
		});
		// mixed explicit override tests
		it(`creates correct dependencies for ${RunBy.TsNode} - with some explict values`, () => {
			expect(
				createDependencies(testPackageUnderTestJson, testRelativePath, {
					runBy: [RunBy.Tsx],
					pkgManager,
					typescript: {
						...testExplicitVersion,
						nodeTypes: undefined,
					},
				}),
			).toEqual({
				...testPackageUnderTestJson.peerDependencies,
				typescript: testExplicitVersion.version,
				"@types/node": testPackageUnderTestJson.devDependencies["@types/node"],
				tsx: testExplicitVersion.tsx?.version,
				[testPackageUnderTestJson.name]: `${expPrefix}${testRelativePath}`,
			});
		});
		it(`creates correct dependencies for ${RunBy.Tsx} - with some explict values`, () => {
			expect(
				createDependencies(testPackageUnderTestJson, testRelativePath, {
					runBy: [RunBy.Tsx],
					pkgManager,
					typescript: {
						...testExplicitVersion,
						nodeTypes: undefined,
					},
				}),
			).toEqual({
				typescript: testExplicitVersion.version,
				"@types/node": testPackageUnderTestJson.devDependencies["@types/node"],
				tsx: testExplicitVersion.tsx?.version,
				[testPackageUnderTestJson.name]: `${expPrefix}${testRelativePath}`,
			});
		});
		// Typescript common requirement errors
		const requiresTypescript = [RunBy.TsNode, RunBy.Tsx];
		const missingTypescriptDep = {
			...testPackageUnderTestJson,
			devDependencies: {
				...testPackageUnderTestJson.devDependencies,
				typescript: undefined,
			},
		};
		const missingTsNodeDep = {
			...testPackageUnderTestJson,
			devDependencies: {
				...testPackageUnderTestJson.devDependencies,
				"@types/node": undefined,
			},
		};
		for (const tsRequireRunBy of requiresTypescript) {
			it(`throws an error if no typescript object is provided for ${tsRequireRunBy}`, () => {
				expect(() =>
					createDependencies(testPackageUnderTestJson, testRelativePath, {
						runBy: [tsRequireRunBy],
						pkgManager,
					}),
				).toThrow(
					`Supply a typescript object (even if empty) for running by ${tsRequireRunBy}`,
				);
			});
			it(`throws an error if no typescript version is not discoverable for ${tsRequireRunBy}`, () => {
				expect(() =>
					createDependencies(missingTypescriptDep as any, testRelativePath, {
						runBy: [tsRequireRunBy],
						pkgManager,
						typescript: {},
					}),
				).toThrow(
					`Cannot run by ${tsRequireRunBy} without a typescript version supplied or discoverable in package.json!`,
				);
			});
			it(`throws an error if no @types/node version is not discoverable for ${tsRequireRunBy}`, () => {
				expect(() =>
					createDependencies(missingTsNodeDep as any, testRelativePath, {
						runBy: [tsRequireRunBy],
						pkgManager,
						typescript: {},
					}),
				).toThrow(
					`Cannot run by ${tsRequireRunBy} without a @types/node version supplied or discoverable in package.json!`,
				);
			});
		}
		// Required version resolution errors per runner
		it(`throw an error if no discoverable ${RunBy.TsNode} version for running with ${RunBy.TsNode}`, () => {
			const missingTsxDep = {
				...testPackageUnderTestJson,
				dependencies: {
					...testPackageUnderTestJson.dependencies,
					"ts-node": undefined,
				},
			};
			expect(() =>
				createDependencies(missingTsxDep as any, testRelativePath, {
					runBy: [RunBy.TsNode],
					pkgManager,
					typescript: {
						...testExplicitVersion,
						tsNode: undefined,
					},
				}),
			).toThrow(
				`Cannot run by ts-node without a ts-node version supplied or discoverable in package.json!`,
			);
		});
		it(`throw an error if no discoverable ${RunBy.Tsx} version for running with ${RunBy.Tsx}`, () => {
			const missingTsxDep = {
				...testPackageUnderTestJson,
				devDependencies: {
					...testPackageUnderTestJson.devDependencies,
					tsx: undefined,
				},
				peerDependencies: {
					...testPackageUnderTestJson.peerDependencies,
					tsx: undefined,
				},
			};
			expect(() =>
				createDependencies(missingTsxDep as any, testRelativePath, {
					runBy: [RunBy.Tsx],
					pkgManager,
					typescript: {
						...testExplicitVersion,
						tsx: undefined,
					},
				}),
			).toThrow(
				`Cannot run by tsx without a tsx version supplied or discoverable in package.json!`,
			);
		});
		it("Creates dependencies for full set of RunBy - no explicit version overrides", () => {
			expect(
				createDependencies(testPackageUnderTestJson, testRelativePath, {
					runBy: Object.values(RunBy),
					pkgManager,
					typescript: {},
				}),
			).toEqual({
				// Tsx is resolved first via peerDeps so we're good
				...testPackageUnderTestJson.peerDependencies,
				typescript: testPackageUnderTestJson.devDependencies.typescript,
				"@types/node": testPackageUnderTestJson.devDependencies["@types/node"],
				"ts-node": testPackageUnderTestJson.dependencies["ts-node"],
				[testPackageUnderTestJson.name]: `${expPrefix}${testRelativePath}`,
			});
		});
		it("Creates dependencies for full set of RunBy - with version overrides", () => {
			expect(
				createDependencies(testPackageUnderTestJson, testRelativePath, {
					runBy: Object.values(RunBy),
					pkgManager,
					typescript: testExplicitVersion,
				}),
			).toEqual({
				// Tsx is resolved first via peerDeps so we're good
				...testPackageUnderTestJson.peerDependencies,
				typescript: testExplicitVersion.version,
				"@types/node": testExplicitVersion.nodeTypes?.version,
				"ts-node": testExplicitVersion.tsNode?.version,
				tsx: testExplicitVersion.tsx?.version,
				[testPackageUnderTestJson.name]: `${expPrefix}${testRelativePath}`,
			});
		});
		it("Creates dependencies with additional Overrides taking preference", () => {
			expect(
				createDependencies(testPackageUnderTestJson, testRelativePath, {
					runBy: Object.values(RunBy),
					pkgManager,
					typescript: testExplicitVersion,
					additionalDependencies: {
						someNewDep: "5.0.0",
						tsx: "override",
					},
				}),
			).toEqual({
				// Tsx is resolved first via peerDeps so we're good
				...testPackageUnderTestJson.peerDependencies,
				typescript: testExplicitVersion.version,
				"@types/node": testExplicitVersion.nodeTypes?.version,
				"ts-node": testExplicitVersion.tsNode?.version,
				tsx: "override",
				[testPackageUnderTestJson.name]: `${expPrefix}${testRelativePath}`,
				someNewDep: "5.0.0",
			});
		});
	},
);
