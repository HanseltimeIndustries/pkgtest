import { applyFiltersToEntries, FilterOptions } from "./applyFiltersToEntries";
import { StandardizedTestConfig, StandardizedTestConfigEntry } from "./config";
import { Logger } from "./Logger";
import { TestGroupOverview } from "./reporters";
import { ModuleTypes, PkgManager, RunWith, TestType } from "./types";

const testEntryAllTypes: StandardizedTestConfigEntry = {
	alias: "alias1",
	packageManagers: [
		{
			packageManager: PkgManager.YarnV1,
			alias: "pkg1",
			options: {},
		},
		{
			packageManager: PkgManager.YarnBerry,
			alias: "pkg2",
			options: {},
		},
	],
	moduleTypes: [ModuleTypes.Commonjs, ModuleTypes.ESM],
	binTests: {},
	fileTests: {
		testMatch: "mytest",
		runWith: [RunWith.TsNode, RunWith.Tsx, RunWith.Node],
		transforms: {
			typescript: {},
		},
	},
};
const testFileTestOnly = {
	...testEntryAllTypes,
	alias: "onlyfiletests",
	binTests: undefined,
};
const testBinTestOnly = {
	...testEntryAllTypes,
	alias: "onlybintests",
	fileTests: undefined,
};
// all + fileTestsOnly (2) * 2 pkg managers * 2 modTypes * 3 runWith = 24
const totalFileTests = 24
// all + binTestsOnly (2) * 2 pkg managers * 2 modTypes = 8
const totalBinTests = 8

const testLogger: Logger = {
	log: jest.fn(),
	logDebug: jest.fn(),
	error: jest.fn(),
	context: "testcontext",
	debug: false,
};

beforeEach(() => {
	jest.resetAllMocks();
});

it.each([[undefined], [{}]])("returns same with %s filter", (f) => {
	expect(
		applyFiltersToEntries(
			[
				testEntryAllTypes,
				{
					...testEntryAllTypes,
					binTests: undefined,
				},
			],
			{
				logger: testLogger,
				binTestSuitesOverview: new TestGroupOverview(),
				fileTestSuitesOverview: new TestGroupOverview(),
			},
			f,
		),
	).toEqual([
		testEntryAllTypes,
		{
			...testEntryAllTypes,
			binTests: undefined,
		},
	]);
});

it.each(
	[
		[
			{
				testTypes: [TestType.File],
			},
			[testEntryAllTypes, testFileTestOnly, testBinTestOnly],
			[
				{
					...testEntryAllTypes,
					binTests: undefined,
				},
				testFileTestOnly,
			],
			// 4 for bin script in all and 4 for bin only,
			[0, 8],
		],
		[
			{
				testTypes: [TestType.Bin],
			},
			[testEntryAllTypes, testFileTestOnly, testBinTestOnly],
			[
				{
					...testEntryAllTypes,
					fileTests: undefined,
				},
				testBinTestOnly,
			],
			// 4 * 3 runWith * 2 for all entry and file only
			[24, 0],
		],
		[
			{
				moduleTypes: [ModuleTypes.Commonjs],
			},
			[testEntryAllTypes, testFileTestOnly, testBinTestOnly],
			[
				{
					...testEntryAllTypes,
					moduleTypes: [ModuleTypes.Commonjs],
				},
				{
					...testFileTestOnly,
					moduleTypes: [ModuleTypes.Commonjs],
				},
				{
					...testBinTestOnly,
					moduleTypes: [ModuleTypes.Commonjs],
				},
			],
			// 2 pkg * 3 runWith * 2 for all entry and file only = 12
			// 2 pkg * 2 for entry and bin = 4
			[12, 4],
		],
		[
			{
				moduleTypes: [ModuleTypes.ESM],
			},
			[testEntryAllTypes, testFileTestOnly, testBinTestOnly],
			[
				{
					...testEntryAllTypes,
					moduleTypes: [ModuleTypes.ESM],
				},
				{
					...testFileTestOnly,
					moduleTypes: [ModuleTypes.ESM],
				},
				{
					...testBinTestOnly,
					moduleTypes: [ModuleTypes.ESM],
				},
			],
			// 2 pkg * 3 runWith * 2 for all entry and file only = 12
			// 2 pkg * 2 for entry and bin = 4
			[12, 4],
		],
		[
			{
				packageManagers: [PkgManager.YarnBerry],
			},
			[testEntryAllTypes, testFileTestOnly, testBinTestOnly],
			[
				{
					...testEntryAllTypes,
					packageManagers: testEntryAllTypes.packageManagers.filter((pm) => {
						return pm.packageManager === PkgManager.YarnBerry;
					}),
				},
				{
					...testFileTestOnly,
					packageManagers: testFileTestOnly.packageManagers.filter((pm) => {
						return pm.packageManager === PkgManager.YarnBerry;
					}),
				},
				{
					...testBinTestOnly,
					packageManagers: testBinTestOnly.packageManagers.filter((pm) => {
						return pm.packageManager === PkgManager.YarnBerry;
					}),
				},
			],
			// 1 pkg * 2 mod * 3 runWith * 2 for all entry and file only = 12
			// 1 pkg * 2 mod * 2 for entry and bin = 4
			[12, 4],
		],
		[
			{
				pkgManagerAlias: ["pkg1"],
			},
			[testEntryAllTypes, testFileTestOnly, testBinTestOnly],
			[
				{
					...testEntryAllTypes,
					packageManagers: testEntryAllTypes.packageManagers.filter((pm) => {
						return pm.alias === "pkg1";
					}),
				},
				{
					...testFileTestOnly,
					packageManagers: testFileTestOnly.packageManagers.filter((pm) => {
						return pm.alias === "pkg1";
					}),
				},
				{
					...testBinTestOnly,
					packageManagers: testBinTestOnly.packageManagers.filter((pm) => {
						return pm.alias === "pkg1";
					}),
				},
			],
			// 1 pkg * 2 mod * 3 runWith * 2 for all entry and file only = 12
			// 1 pkg * 2 mod * 2 for entry and bin = 4
			[12, 4],
		],
		[
			{
				runWith: [RunWith.TsNode, RunWith.Tsx],
			},
			[testEntryAllTypes, testFileTestOnly, testBinTestOnly],
			[
				{
					...testEntryAllTypes,
					fileTests: {
						...testEntryAllTypes.fileTests,
						runWith: [RunWith.TsNode, RunWith.Tsx],
					},
				},
				{
					...testFileTestOnly,
					fileTests: {
						...testFileTestOnly.fileTests,
						runWith: [RunWith.TsNode, RunWith.Tsx],
					},
				},
				testBinTestOnly,
			],
			// 2 pkg * 2 mod * 1 runWith * 2 for all entry and file only = 8
			// No bin tests affected
			[8, 0],
		],
		[
			{
				testTypes: [TestType.File],
				moduleTypes: [ModuleTypes.Commonjs],
				packageManagers: [PkgManager.YarnV1],
				runWith: [RunWith.TsNode, RunWith.Tsx],
			},
			[testEntryAllTypes, testFileTestOnly, testBinTestOnly],
			[
				{
					...testEntryAllTypes,
					fileTests: {
						...testEntryAllTypes.fileTests,
						runWith: [RunWith.TsNode, RunWith.Tsx],
					},
					moduleTypes: [ModuleTypes.Commonjs],
					packageManagers: testEntryAllTypes.packageManagers.filter((pm) => {
						return pm.packageManager === PkgManager.YarnV1;
					}),
					binTests: undefined,
				},
				{
					...testFileTestOnly,
					fileTests: {
						...testFileTestOnly.fileTests,
						runWith: [RunWith.TsNode, RunWith.Tsx],
					},
					moduleTypes: [ModuleTypes.Commonjs],
					packageManagers: testFileTestOnly.packageManagers.filter((pm) => {
						return pm.packageManager === PkgManager.YarnV1;
					}),
				},
			],
			// total = 2 pkg * 3 runWith * 2 mod * 2 pkgs for file = 24
			// Only select 1 pkg * 1 mod and 2 runWith = 4 => leads to 20 skipped
			// 2 pk * 2 mod * 2 entries with both
			[20, 8],
		],
	].map((e) => {
		// Serialize the filter for test clarity
		return [JSON.stringify(e[0]), ...e] as unknown as [
			string,
			FilterOptions,
			StandardizedTestConfigEntry[],
			StandardizedTestConfig[],
			[number, number],
		];
	}),
)(
	"filters tests for %s",
	(_fStr, f, entries, exp, [fileTestsSkipped, binTestsSkipped]) => {
		const binTestSuitesOverview = new TestGroupOverview();
		const fileTestSuitesOverview = new TestGroupOverview();
		expect(
			applyFiltersToEntries(
				entries,
				{
					logger: testLogger,
					binTestSuitesOverview,
					fileTestSuitesOverview,
				},
				f,
			),
		).toEqual(exp);
		fileTestSuitesOverview.finalize();
		binTestSuitesOverview.finalize();
		// We only increment totals and skips in this method
		expect(fileTestSuitesOverview.skipped).toBe(fileTestsSkipped);
		expect(binTestSuitesOverview.skipped).toBe(binTestsSkipped);
		expect(fileTestSuitesOverview.total).toBe(totalFileTests);
		expect(binTestSuitesOverview.total).toBe(totalBinTests);
	},
);
