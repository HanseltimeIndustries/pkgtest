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
	PkgManager,
	RunWith,
	TestConfigEntry,
	TestType,
} from "./types";
import { Logger } from "./logging";

export interface ContextOptions {
	logger: Logger;
	fileTestSuitesOverview: TestGroupOverview;
	binTestSuitesOverview: TestGroupOverview;
	scriptTestSuitesOverview: TestGroupOverview;
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
								);
							});
							return false;
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
													}),
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
): number {
	const { runWith, ...rest } = opts;
	runWith.forEach((runBy) => {
		logger.log(
			skipSuiteDescribe({
				...rest,
				runBy,
			} as FileTestRunnerDescribe),
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
) {
	binTestsSuiteOverview.addSkippedToTotal(1);
	logger.log(
		skipSuiteDescribe({
			...context,
			binTestConfig: config.binTests!,
		} as BinTestRunnerDescribe),
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
) {
	fileTestsSuiteOverview.addSkippedToTotal(
		skipFileSuitesNotice(logger, {
			runWith: config.fileTests!.runWith,
			...context,
		}),
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
) {
	scriptTestsSuiteOverview.addSkippedToTotal(1);
	logger.log(
		skipSuiteDescribe({
			...context,
			scriptTests: config.scriptTests!,
		} as ScriptTestRunnerDescribe),
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
) {
	if (config.fileTests) {
		fileTestsSkip(logger, context, config, fileTestsSuiteOverview);
	}
	if (config.binTests) {
		binTestsSkip(logger, context, config, binTestsSuiteOverview);
	}
	if (config.scriptTests) {
		scriptTestsSkip(logger, context, config, scriptTestsOverview);
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
