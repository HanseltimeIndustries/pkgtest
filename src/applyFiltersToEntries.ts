import { StandardizedTestConfigEntry } from "./config";
import {
	BinTestRunnerDescribe,
	FileTestRunnerDescribe,
	ScriptTestRunnerDescribe,
	skipSuiteDescribe,
	TestGroupOverview,
} from "./reporters";
import {
	ModuleTypes,
	OnWindowsProblemsAction,
	PkgManager,
	RunWith,
	TestConfigEntry,
	TestType,
} from "./types";
import { Logger } from "./logging";
import { isWindowsProblem } from "./isWindowsProblem";
import type { ChalkInstance } from "chalk" with { "resolution-mode": "import" };

export interface ContextOptions {
	logger: Logger;
	fileTestSuitesOverview: TestGroupOverview;
	binTestSuitesOverview: TestGroupOverview;
	scriptTestSuitesOverview: TestGroupOverview;
	// This is because chalk is an esm module that needs explicit async importing
	chalk: ChalkInstance
}

export interface EntryFilterOptions {
	moduleTypes?: ModuleTypes[];
	noModuleTypes?: ModuleTypes[];
	packageManagers?: PkgManager[];
	noPackageManagers?: PkgManager[];
	runWith?: RunWith[];
	noRunWith?: RunWith[];
	pkgManagerAlias?: string[];
	noPkgManagerAlias?: string[];
	testTypes?: TestType[];
	noTestTypes?: TestType[];
	onWindowsProblems?: OnWindowsProblemsAction;
}

/**
 * This will filter out or edit some test config entries based on any filters by returning edited config entries
 * @param config
 */
export function applyFiltersToEntries(
	entries: StandardizedTestConfigEntry[],
	context: ContextOptions,
	filters?: EntryFilterOptions,
): StandardizedTestConfigEntry[] {
	const {
		logger,
		fileTestSuitesOverview,
		binTestSuitesOverview,
		scriptTestSuitesOverview,
		chalk,
	} = context;
	// No need to do any filtering if there's no options
	if (!filters || Object.keys(filters).length === 0) {
		// Add additional to the total
		entries.forEach((ent) => {
			addFilteredEntryToTotal(
				ent,
				fileTestSuitesOverview,
				binTestSuitesOverview,
				scriptTestSuitesOverview,
			);
		});
		return entries;
	}

	function getFromNoType(values: string[], filters?: string[]) {
		return filters ? values.filter((v) => !filters.includes(v)) : values;
	}

	// For enum types, we don't support no and only types at the same tim

	// Coerce filters with "noTypes" - filters types take precedence
	let modTypes = getFromNoType(
		filters.moduleTypes ?? Object.values(ModuleTypes),
		filters.noModuleTypes,
	);
	let testTypes = getFromNoType(
		filters.testTypes ?? Object.values(TestType),
		filters.noTestTypes,
	);
	let packageManagers = getFromNoType(
		filters.packageManagers ?? Object.values(PkgManager),
		filters.noPackageManagers,
	);
	let runWith = getFromNoType(
		filters.runWith ?? Object.values(RunWith),
		filters.noRunWith,
	);

	const skipFileTests = testTypes && !testTypes.includes(TestType.File);
	const skipBinTests = testTypes && !testTypes.includes(TestType.Bin);
	const skipScriptTests = testTypes && !testTypes.includes(TestType.Script);
	return (
		entries
			.map((testConfigEntry) => {
				let filteredFileTests = testConfigEntry.fileTests;
				let filteredBinTests = testConfigEntry.binTests;
				let filteredScriptTests = testConfigEntry.scriptTests;
				let filteredModTypes = testConfigEntry.moduleTypes;
				let filteredPkgManagers = testConfigEntry.packageManagers;
				if (skipBinTests) {
					if (filteredBinTests) {
						filteredModTypes.forEach((modType) => {
							filteredPkgManagers.forEach(
								({ packageManager: pkgManager, alias: pkgManagerAlias }) => {
									binTestsSkip(
										logger,
										{ modType, pkgManager, pkgManagerAlias },
										testConfigEntry,
										binTestSuitesOverview,
										chalk,
									);
								},
							);
						});
						filteredBinTests = undefined;
					}
				}
				if (skipFileTests) {
					if (filteredFileTests) {
						filteredModTypes.forEach((modType) => {
							filteredPkgManagers.forEach(
								({ packageManager: pkgManager, alias: pkgManagerAlias }) => {
									fileTestsSkip(
										logger,
										{ modType, pkgManager, pkgManagerAlias },
										testConfigEntry,
										fileTestSuitesOverview,
										chalk,
									);
								},
							);
						});
						filteredFileTests = undefined;
					}
				}
				if (skipScriptTests) {
					if (filteredScriptTests) {
						filteredModTypes.forEach((modType) => {
							filteredPkgManagers.forEach(
								({ packageManager: pkgManager, alias: pkgManagerAlias }) => {
									scriptTestsSkip(
										logger,
										{ modType, pkgManager, pkgManagerAlias },
										testConfigEntry,
										scriptTestSuitesOverview,
										chalk,
									);
								},
							);
						});
						filteredScriptTests = undefined;
					}
				}

				const filteredTestTypeConfigEntry = {
					...testConfigEntry,
					fileTests: filteredFileTests,
					binTests: filteredBinTests,
					scriptTests: filteredScriptTests,
				};

				// reassign
				filteredModTypes = testConfigEntry.moduleTypes.filter((modType) => {
					if (modTypes && !modTypes.includes(modType)) {
						// Do some UI Logging for each package manager variant that we lose as a result of cutting the module type
						filteredPkgManagers.forEach(
							({ packageManager: pkgManager, alias: pkgManagerAlias }) => {
								testEntryProjectLevelSkip(
									logger,
									{
										modType,
										pkgManager,
										pkgManagerAlias,
									},
									filteredTestTypeConfigEntry,
									fileTestSuitesOverview,
									binTestSuitesOverview,
									scriptTestSuitesOverview,
									chalk,
								);
							},
						);

						return false;
					}
					return true;
				});

				// reassign pkg managers to reduced set
				filteredPkgManagers = testConfigEntry.packageManagers.filter(
					(_pkgManager) => {
						const { packageManager: pkgManager, alias: pkgManagerAlias } =
							_pkgManager;

						if (packageManagers && !packageManagers.includes(pkgManager)) {
							filteredModTypes.forEach((modType) => {
								testEntryProjectLevelSkip(
									logger,
									{
										modType,
										pkgManager,
										pkgManagerAlias,
									},
									filteredTestTypeConfigEntry,
									fileTestSuitesOverview,
									binTestSuitesOverview,
									scriptTestSuitesOverview,
									chalk,
								);
							});
							return false;
						}
						if (
							filters.pkgManagerAlias &&
							!filters.pkgManagerAlias.includes(pkgManagerAlias)
						) {
							filteredModTypes.forEach((modType) => {
								testEntryProjectLevelSkip(
									logger,
									{
										modType,
										pkgManager,
										pkgManagerAlias,
									},
									filteredTestTypeConfigEntry,
									fileTestSuitesOverview,
									binTestSuitesOverview,
									scriptTestSuitesOverview,
									chalk,
								);
							});
							return false;
						}
						// Apply No Type
						if (
							filters.noPkgManagerAlias &&
							filters.noPkgManagerAlias.includes(pkgManagerAlias)
						) {
							filteredModTypes.forEach((modType) => {
								testEntryProjectLevelSkip(
									logger,
									{
										modType,
										pkgManager,
										pkgManagerAlias,
									},
									filteredTestTypeConfigEntry,
									fileTestSuitesOverview,
									binTestSuitesOverview,
									scriptTestSuitesOverview,
									chalk,
								);
							});
							return false;
						}
						// Apply Windows exclusion last
						if (filters.onWindowsProblems) {
							if (isWindowsProblem(_pkgManager)) {
								if (
									filters.onWindowsProblems === OnWindowsProblemsAction.Error
								) {
									throw new Error(
										`${pkgManager} ${pkgManagerAlias} is problematic on windows!  Make sure it is not configured for process.platform === 'win32'`,
									);
								}
								logger.log(
									chalk.yellow(
										`Skipping ${pkgManager} (${pkgManagerAlias}) Due to Problematic Windows Setup`,
									),
								);
								filteredModTypes.forEach((modType) => {
									testEntryProjectLevelSkip(
										logger,
										{
											modType,
											pkgManager,
											pkgManagerAlias,
										},
										filteredTestTypeConfigEntry,
										fileTestSuitesOverview,
										binTestSuitesOverview,
										scriptTestSuitesOverview,
										chalk,
									);
								});
								return false;
							}
						}
						return true;
					},
				);

				// If there are still fileTests, do additional filtering
				if (filteredTestTypeConfigEntry.fileTests) {
					filteredFileTests = {
						...filteredTestTypeConfigEntry.fileTests,
						runWith: filteredTestTypeConfigEntry.fileTests.runWith.filter(
							(rw) => {
								if (runWith && !runWith.includes(rw)) {
									filteredModTypes.forEach((modType) => {
										filteredPkgManagers.forEach(
											({
												packageManager: pkgManager,
												alias: pkgManagerAlias,
											}) => {
												fileTestSuitesOverview.addSkippedToTotal(
													skipFileSuitesNotice(logger, {
														runWith: [rw],
														modType,
														pkgManager,
														pkgManagerAlias,
													},
												chalk),
												);
											},
										);
									});
									return false;
								}
								return true;
							},
						),
					};
				}

				const filteredEntry = {
					...testConfigEntry,
					fileTests: filteredFileTests,
					binTests: filteredBinTests,
					scriptTests: filteredScriptTests,
					packageManagers: filteredPkgManagers,
					moduleTypes: filteredModTypes,
				};
				addFilteredEntryToTotal(
					filteredEntry,
					fileTestSuitesOverview,
					binTestSuitesOverview,
					scriptTestSuitesOverview,
				);
				return filteredEntry;
			})
			// In the event that we filtered both file and binTests, don't even pass it back
			.filter(
				(fEntry) => fEntry.fileTests || fEntry.binTests || fEntry.scriptTests,
			)
	);
}

function skipFileSuitesNotice(
	logger: Logger,
	opts: {
		runWith: RunWith[];
		modType: ModuleTypes;
		pkgManager: PkgManager;
		pkgManagerAlias: string;
	},
	chalk: ChalkInstance,
): number {
	const { runWith, ...rest } = opts;
	runWith.forEach((runBy) => {
		logger.log(
			skipSuiteDescribe({
				...rest,
				runBy,
			} as FileTestRunnerDescribe, chalk),
		);
	});
	return runWith.length;
}

function binTestsSkip(
	logger: Logger,
	context: {
		modType: ModuleTypes;
		pkgManager: PkgManager;
		pkgManagerAlias: string;
	},
	config: TestConfigEntry,
	binTestsSuiteOverview: TestGroupOverview,
	chalk: ChalkInstance,
) {
	binTestsSuiteOverview.addSkippedToTotal(1);
	logger.log(
		skipSuiteDescribe({
			...context,
			binTestConfig: config.binTests!,
		} as BinTestRunnerDescribe, chalk),
	);
}

function fileTestsSkip(
	logger: Logger,
	context: {
		modType: ModuleTypes;
		pkgManager: PkgManager;
		pkgManagerAlias: string;
	},
	config: TestConfigEntry,
	fileTestsSuiteOverview: TestGroupOverview,
	chalk: ChalkInstance,
) {
	fileTestsSuiteOverview.addSkippedToTotal(
		skipFileSuitesNotice(logger, {
			runWith: config.fileTests!.runWith,
			...context,
		}, chalk),
	);
}

function scriptTestsSkip(
	logger: Logger,
	context: {
		modType: ModuleTypes;
		pkgManager: PkgManager;
		pkgManagerAlias: string;
	},
	config: TestConfigEntry,
	scriptTestsSuiteOverview: TestGroupOverview,
	chalk: ChalkInstance,
) {
	scriptTestsSuiteOverview.addSkippedToTotal(1);
	logger.log(
		skipSuiteDescribe({
			...context,
			scriptTests: config.scriptTests!,
		} as ScriptTestRunnerDescribe, chalk),
	);
}

/**
 * Used to indicate that we're skipping all tests related to a single project that would be created
 */
function testEntryProjectLevelSkip(
	logger: Logger,
	context: {
		modType: ModuleTypes;
		pkgManager: PkgManager;
		pkgManagerAlias: string;
	},
	config: TestConfigEntry,
	fileTestsSuiteOverview: TestGroupOverview,
	binTestsSuiteOverview: TestGroupOverview,
	scriptTestsOverview: TestGroupOverview,
	chalk: ChalkInstance,
) {
	if (config.fileTests) {
		fileTestsSkip(logger, context, config, fileTestsSuiteOverview, chalk);
	}
	if (config.binTests) {
		binTestsSkip(logger, context, config, binTestsSuiteOverview, chalk);
	}
	if (config.scriptTests) {
		scriptTestsSkip(logger, context, config, scriptTestsOverview, chalk);
	}
}

function addFilteredEntryToTotal(
	ent: StandardizedTestConfigEntry,
	fileTestSuitesOverview: TestGroupOverview,
	binTestSuitesOverview: TestGroupOverview,
	scriptTestSuitesOverview: TestGroupOverview,
) {
	if (ent.fileTests) {
		fileTestSuitesOverview.addToTotal(
			ent.moduleTypes.length *
				ent.packageManagers.length *
				ent.fileTests.runWith.length,
		);
	}
	if (ent.binTests) {
		binTestSuitesOverview.addToTotal(
			ent.moduleTypes.length * ent.packageManagers.length,
		);
	}
	if (ent.scriptTests) {
		scriptTestSuitesOverview.addToTotal(
			ent.moduleTypes.length * ent.packageManagers.length,
		);
	}
}
