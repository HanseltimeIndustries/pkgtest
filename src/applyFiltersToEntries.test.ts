import {
	applyFiltersToEntries,
	EntryFilterOptions,
} from "./applyFiltersToEntries";
import { StandardizedTestConfig, StandardizedTestConfigEntry } from "./config";
import { Logger } from "./logging";
import { TestGroupOverview } from "./reporters";
import { isWindowsProblem } from "./isWindowsProblem";
import {
	ModuleTypes,
	OnWindowsProblemsAction,
	PkgManager,
	RunWith,
	TestType,
} from "./types";

jest.mock("./isWindowsProblem");
const mockIsWindowsProblem = jest.mocked(isWindowsProblem);

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
	scriptTests: [
		{
			name: "script1",
			script: "something",
		},
		{
			name: "script2",
			script: "somethingelse",
		},
	],
};
const testFileTestOnly = {
	...testEntryAllTypes,
	alias: "onlyfiletests",
	binTests: undefined,
	scriptTests: undefined,
};
const testBinTestOnly = {
	...testEntryAllTypes,
	alias: "onlybintests",
	fileTests: undefined,
	scriptTests: undefined,
};
const scriptTestOnly = {
	...testEntryAllTypes,
	alias: "onlyscripttests",
	binTests: undefined,
	fileTests: undefined,
};
// all + fileTestsOnly (2) * 2 pkg managers * 2 modTypes * 3 runWith = 24
const totalFileTestSuites = 24;
// all + binTestsOnly (2) * 2 pkg managers * 2 modTypes = 8
const totalBinTestSuites = 8;
// all + scriptTestsOnly (2) * 2 pkg managers * 2 modTypes = 8
const totalScriptTestSuites = 8;

const testLogger: Logger = {
	log: jest.fn(),
	logDebug: jest.fn(),
	error: jest.fn(),
	context: "testcontext",
	debug: false,
};

beforeEach(() => {
	jest.resetAllMocks();
	// Set it up so that yarnv1 is skipped
	mockIsWindowsProblem.mockImplementation(({ packageManager }) => {
		if (packageManager === PkgManager.YarnV1) {
			return true;
		}
		return false;
	});
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
				scriptTestSuitesOverview: new TestGroupOverview(),
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
			[testEntryAllTypes, testFileTestOnly, testBinTestOnly, scriptTestOnly],
			[
				{
					...testEntryAllTypes,
					binTests: undefined,
					scriptTests: undefined,
				},
				testFileTestOnly,
			],
			// 4 for bin script in all and 4 for bin only,
			[0, totalBinTestSuites, totalScriptTestSuites],
		],
		[
			{
				testTypes: [TestType.Bin],
			},
			[testEntryAllTypes, testFileTestOnly, testBinTestOnly, scriptTestOnly],
			[
				{
					...testEntryAllTypes,
					fileTests: undefined,
					scriptTests: undefined,
				},
				testBinTestOnly,
			],
			// 4 * 3 runWith * 2 for all entry and file only
			[totalFileTestSuites, 0, totalScriptTestSuites],
		],
		[
			{
				testTypes: [TestType.Script],
			},
			[testEntryAllTypes, testFileTestOnly, testBinTestOnly, scriptTestOnly],
			[
				{
					...testEntryAllTypes,
					fileTests: undefined,
					binTests: undefined,
				},
				scriptTestOnly,
			],
			// 4 * 3 runWith * 2 for all entry and file only
			[totalFileTestSuites, totalBinTestSuites, 0],
		],
		[
			{
				moduleTypes: [ModuleTypes.Commonjs],
			},
			[testEntryAllTypes, testFileTestOnly, testBinTestOnly, scriptTestOnly],
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
				{
					...scriptTestOnly,
					moduleTypes: [ModuleTypes.Commonjs],
				},
			],
			// 2 pkg * 3 runWith * 2 for all entry and file only = 12
			// 2 pkg * 2 for entry and bin = 4
			[12, 4, 4],
		],
		[
			{
				moduleTypes: [ModuleTypes.ESM],
			},
			[testEntryAllTypes, testFileTestOnly, testBinTestOnly, scriptTestOnly],
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
				{
					...scriptTestOnly,
					moduleTypes: [ModuleTypes.ESM],
				},
			],
			// 2 pkg * 3 runWith * 2 for all entry and file only = 12
			// 2 pkg * 2 for entry and bin = 4
			[12, 4, 4],
		],
		[
			{
				packageManagers: [PkgManager.YarnBerry],
			},
			[testEntryAllTypes, testFileTestOnly, testBinTestOnly, scriptTestOnly],
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
				{
					...scriptTestOnly,
					packageManagers: scriptTestOnly.packageManagers.filter((pm) => {
						return pm.packageManager === PkgManager.YarnBerry;
					}),
				},
			],
			// 1 pkg * 2 mod * 3 runWith * 2 for all entry and file only = 12
			// 1 pkg * 2 mod * 2 for entry and bin = 4
			[12, 4, 4],
		],
		[
			{
				pkgManagerAlias: ["pkg1"],
			},
			[testEntryAllTypes, testFileTestOnly, testBinTestOnly, scriptTestOnly],
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
				{
					...scriptTestOnly,
					packageManagers: scriptTestOnly.packageManagers.filter((pm) => {
						return pm.alias === "pkg1";
					}),
				},
			],
			// 1 pkg * 2 mod * 3 runWith * 2 for all entry and file only = 12
			// 1 pkg * 2 mod * 2 for entry and bin = 4
			[12, 4, 4],
		],
		[
			{
				runWith: [RunWith.TsNode, RunWith.Tsx],
			},
			[testEntryAllTypes, testFileTestOnly, testBinTestOnly, scriptTestOnly],
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
				scriptTestOnly,
			],
			// 2 pkg * 2 mod * 1 runWith * 2 for all entry and file only = 8
			// No bin tests affected
			[8, 0, 0],
		],
		[
			{
				testTypes: [TestType.File],
				moduleTypes: [ModuleTypes.Commonjs],
				packageManagers: [PkgManager.YarnV1],
				runWith: [RunWith.TsNode, RunWith.Tsx],
			},
			[testEntryAllTypes, testFileTestOnly, testBinTestOnly, scriptTestOnly],
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
					scriptTests: undefined,
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
			[20, 8, 8],
		],
		[
			{
				noTestTypes: [TestType.File],
				noModuleTypes: [ModuleTypes.Commonjs],
				noPackageManagers: [PkgManager.YarnV1],
				noRunWith: [RunWith.TsNode, RunWith.Tsx],
			},
			[testEntryAllTypes, testFileTestOnly, testBinTestOnly, scriptTestOnly],
			[
				{
					...testEntryAllTypes,
					moduleTypes: [ModuleTypes.ESM],
					packageManagers: testEntryAllTypes.packageManagers.filter((pm) => {
						return pm.packageManager !== PkgManager.YarnV1;
					}),
					fileTests: undefined,
				},
				{
					...testBinTestOnly,
					moduleTypes: [ModuleTypes.ESM],
					packageManagers: testFileTestOnly.packageManagers.filter((pm) => {
						return pm.packageManager !== PkgManager.YarnV1;
					}),
				},
				{
					...scriptTestOnly,
					moduleTypes: [ModuleTypes.ESM],
					packageManagers: scriptTestOnly.packageManagers.filter((pm) => {
						return pm.packageManager !== PkgManager.YarnV1;
					}),
				},
			],
			// All file tests
			// all commonjs skipped and none with yarn-v1 (2) = 4 + 2
			[totalFileTestSuites, 6, 6],
		],
		[
			{
				noTestTypes: [TestType.Bin],
				noModuleTypes: [ModuleTypes.Commonjs],
				noPackageManagers: [PkgManager.YarnV1],
				noRunWith: [RunWith.TsNode, RunWith.Tsx],
			},
			[testEntryAllTypes, testFileTestOnly, testBinTestOnly, scriptTestOnly],
			[
				{
					...testEntryAllTypes,
					moduleTypes: [ModuleTypes.ESM],
					packageManagers: testEntryAllTypes.packageManagers.filter((pm) => {
						return pm.packageManager !== PkgManager.YarnV1;
					}),
					fileTests: {
						...testFileTestOnly.fileTests,
						runWith: [RunWith.Node],
					},
					binTests: undefined,
				},
				{
					...testFileTestOnly,
					moduleTypes: [ModuleTypes.ESM],
					packageManagers: testFileTestOnly.packageManagers.filter((pm) => {
						return pm.packageManager !== PkgManager.YarnV1;
					}),
					fileTests: {
						...testFileTestOnly.fileTests,
						runWith: [RunWith.Node],
					},
				},
				{
					...scriptTestOnly,
					moduleTypes: [ModuleTypes.ESM],
					packageManagers: scriptTestOnly.packageManagers.filter((pm) => {
						return pm.packageManager !== PkgManager.YarnV1;
					}),
				},
			],
			// All bin tests
			// There's only 1 test (yarn-berry + 1 runWith) * 2 entries => 24 - 2 = 22
			[22, 8, 6],
		],
		// Windows skip
		[
			{
				noTestTypes: [TestType.Bin],
				noModuleTypes: [ModuleTypes.Commonjs],
				// This will skip yarnv1 due to the mock
				onWindowsProblems: OnWindowsProblemsAction.Skip,
				noRunWith: [RunWith.TsNode, RunWith.Tsx],
			},
			[testEntryAllTypes, testFileTestOnly, testBinTestOnly, scriptTestOnly],
			[
				{
					...testEntryAllTypes,
					moduleTypes: [ModuleTypes.ESM],
					packageManagers: testEntryAllTypes.packageManagers.filter((pm) => {
						return pm.packageManager !== PkgManager.YarnV1;
					}),
					fileTests: {
						...testFileTestOnly.fileTests,
						runWith: [RunWith.Node],
					},
					binTests: undefined,
				},
				{
					...testFileTestOnly,
					moduleTypes: [ModuleTypes.ESM],
					packageManagers: testFileTestOnly.packageManagers.filter((pm) => {
						return pm.packageManager !== PkgManager.YarnV1;
					}),
					fileTests: {
						...testFileTestOnly.fileTests,
						runWith: [RunWith.Node],
					},
				},
				{
					...scriptTestOnly,
					moduleTypes: [ModuleTypes.ESM],
					packageManagers: scriptTestOnly.packageManagers.filter((pm) => {
						return pm.packageManager !== PkgManager.YarnV1;
					}),
				},
			],
			// All bin tests
			// There's only 1 test (yarn-berry + 1 runWith) * 2 entries => 24 - 2 = 22
			[22, 8, 6],
		],
	].map((e) => {
		// Serialize the filter for test clarity
		return [JSON.stringify(e[0]), ...e] as unknown as [
			string,
			EntryFilterOptions,
			StandardizedTestConfigEntry[],
			StandardizedTestConfig[],
			[number, number, number],
		];
	}),
)(
	"filters tests for %s",
	(
		_fStr,
		f,
		entries,
		exp,
		[fileTestsSkipped, binTestsSkipped, scriptTestsSkipped],
	) => {
		const binTestSuitesOverview = new TestGroupOverview();
		const fileTestSuitesOverview = new TestGroupOverview();
		const scriptTestSuitesOverview = new TestGroupOverview();
		expect(
			applyFiltersToEntries(
				entries,
				{
					logger: testLogger,
					binTestSuitesOverview,
					fileTestSuitesOverview,
					scriptTestSuitesOverview,
				},
				f,
			),
		).toEqual(exp);
		fileTestSuitesOverview.finalize();
		binTestSuitesOverview.finalize();
		scriptTestSuitesOverview.finalize();
		// We only increment totals and skips in this method
		expect(fileTestSuitesOverview.skipped).toBe(fileTestsSkipped);
		expect(binTestSuitesOverview.skipped).toBe(binTestsSkipped);
		expect(fileTestSuitesOverview.total).toBe(totalFileTestSuites);
		expect(binTestSuitesOverview.total).toBe(totalBinTestSuites);
		expect(scriptTestSuitesOverview.skipped).toBe(scriptTestsSkipped);
		expect(scriptTestSuitesOverview.total).toBe(totalScriptTestSuites);
	},
);

it("throws an error if windows problems detected", () => {
	const binTestSuitesOverview = new TestGroupOverview();
	const fileTestSuitesOverview = new TestGroupOverview();
	const scriptTestSuitesOverview = new TestGroupOverview();
	expect(() =>
		applyFiltersToEntries(
			[testEntryAllTypes],
			{
				logger: testLogger,
				binTestSuitesOverview,
				fileTestSuitesOverview,
				scriptTestSuitesOverview,
			},
			{
				onWindowsProblems: OnWindowsProblemsAction.Error,
			},
		),
	).toThrow(
		"is problematic on windows!  Make sure it is not configured for process.platform === 'win32'",
	);
});
