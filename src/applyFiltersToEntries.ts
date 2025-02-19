import { StandardizedTestConfigEntry } from "./config";
import { skipSuiteDescribe, TestGroupOverview } from "./reporters";
import {
	ModuleTypes,
	PkgManager,
	RunWith,
	TestConfigEntry,
	TestType,
} from "./types";
import { Logger } from "./Logger";

export interface ContextOptions {
	logger: Logger;
	fileTestSuitesOverview: TestGroupOverview;
	binTestSuitesOverview: TestGroupOverview;
}

export interface FilterOptions {
	moduleTypes?: ModuleTypes[];
	packageManagers?: PkgManager[];
	runWith?: RunWith[];
	pkgManagerAlias?: string[];
	testTypes?: TestType[];
	/**
	 * A glob filter of file names to run (relative to the cwd root)
	 */
	fileTestNames?: string[];
	/**
	 * A string match/regex filter to only run bins that match
	 */
	binTestNames?: string[];
}

/**
 * This will filter out or edit some test config entries based on any filters by returning edited config entries
 * @param config
 */
export function applyFiltersToEntries(
	entries: StandardizedTestConfigEntry[],
	context: ContextOptions,
	filters?: FilterOptions,
): StandardizedTestConfigEntry[] {
	const { logger, fileTestSuitesOverview, binTestSuitesOverview } = context;
	// No need to do any filtering if there's no options
	if (!filters || Object.keys(filters).length === 0) {
		// Add additional to the total
		entries.forEach((ent) => {
			addFilteredEntryToTotal(
				ent,
				fileTestSuitesOverview,
				binTestSuitesOverview,
			);
		});
		return entries;
	}

	const skipFileTests =
		filters?.testTypes && !filters.testTypes.includes(TestType.File);
	const skipBinTests =
		filters?.testTypes && !filters.testTypes.includes(TestType.Bin);
	return (
		entries
			.map((testConfigEntry) => {
				let filteredFileTests = testConfigEntry.fileTests;
				let filteredBinTests = testConfigEntry.binTests;
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

				const filteredTestTypeConfigEntry = {
					...testConfigEntry,
					fileTests: filteredFileTests,
					binTests: filteredBinTests,
				};

				// reassign
				filteredModTypes = testConfigEntry.moduleTypes.filter((modType) => {
					if (filters.moduleTypes && !filters.moduleTypes.includes(modType)) {
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

						if (
							filters.packageManagers &&
							!filters.packageManagers.includes(pkgManager)
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
								if (filters.runWith && !filters.runWith.includes(rw)) {
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
					packageManagers: filteredPkgManagers,
					moduleTypes: filteredModTypes,
				};
				addFilteredEntryToTotal(
					filteredEntry,
					fileTestSuitesOverview,
					binTestSuitesOverview,
				);
				return filteredEntry;
			})
			// In the event that we filtered both file and binTests, don't even pass it back
			.filter((fEntry) => fEntry.fileTests || fEntry.binTests)
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
			}),
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
		}),
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
) {
	if (config.fileTests) {
		fileTestsSkip(logger, context, config, fileTestsSuiteOverview);
	}
	if (config.binTests) {
		binTestsSkip(logger, context, config, binTestsSuiteOverview);
	}
}

function addFilteredEntryToTotal(
	ent: StandardizedTestConfigEntry,
	fileTestSuitesOverview: TestGroupOverview,
	binTestSuitesOverview: TestGroupOverview,
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
}
