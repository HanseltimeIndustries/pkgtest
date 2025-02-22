import { mkdtemp, rm } from "fs/promises";
import { LIBRARY_NAME } from "../config";
import { ModuleTypes, PkgManager } from "../types";
import { preinstallLatest } from "./preinstallLatest";
import { join } from "path";
import { Logger } from "../Logger";
import { resolveLatestVersions } from "./resolveLatestVersions";

jest.mock("./preinstallLatest");
jest.mock("fs/promises");

const mockPreinstallLatest = jest.mocked(preinstallLatest);
const mockMkdtemp = jest.mocked(mkdtemp);
const mockRm = jest.mocked(rm);

const latestBerry = "4.8.5";
const latestYarn1 = "1.1.2";
const latestNpm = "11.0.0";
const latestPnpm = "9.2.2";

const testTempDir = "someTempDir";

beforeEach(() => {
	jest.resetAllMocks();
});

it("applies resolution for missing versions with once and only once lookup", async () => {
	mockPreinstallLatest.mockImplementation(
		async (_tmpDir: string, pkgManager, _logger) => {
			switch (pkgManager) {
				case PkgManager.YarnBerry:
					return latestBerry;
				case PkgManager.YarnV1:
					return latestYarn1;
				case PkgManager.Npm:
					return latestNpm;
				case PkgManager.Pnpm:
					return latestPnpm;
			}
			return "should not be here";
		},
	);
	mockMkdtemp.mockResolvedValue(testTempDir);
	mockRm.mockResolvedValue();

	const logger = new Logger({
		context: "huh",
		debug: false,
	});

	expect(
		await resolveLatestVersions(
			"someDir",
			[
				{
					alias: "entry1",
					moduleTypes: [ModuleTypes.Commonjs],
					packageManagers: [
						{
							packageManager: PkgManager.YarnBerry,
							alias: "a1",
						},
						{
							packageManager: PkgManager.Npm,
							alias: "a2",
							version: "1.2.3",
						},
					],
				},
				{
					alias: "entry2",
					moduleTypes: [ModuleTypes.Commonjs],
					packageManagers: [
						{
							packageManager: PkgManager.YarnBerry,
							alias: "b1",
						},
						{
							packageManager: PkgManager.Npm,
							alias: "b2",
							version: "1.2.32",
						},
					],
				},
				{
					alias: "entry2",
					moduleTypes: [ModuleTypes.Commonjs],
					packageManagers: [
						{
							packageManager: PkgManager.Pnpm,
							alias: "c1",
						},
						{
							packageManager: PkgManager.YarnV1,
							alias: "c2",
						},
					],
				},
			],
			logger,
		),
	).toEqual([
		{
			alias: "entry1",
			moduleTypes: [ModuleTypes.Commonjs],
			packageManagers: [
				{
					packageManager: PkgManager.YarnBerry,
					alias: "a1",
					version: latestBerry,
				},
				{
					packageManager: PkgManager.Npm,
					alias: "a2",
					version: "1.2.3",
				},
			],
		},
		{
			alias: "entry2",
			moduleTypes: [ModuleTypes.Commonjs],
			packageManagers: [
				{
					packageManager: PkgManager.YarnBerry,
					alias: "b1",
					version: latestBerry,
				},
				{
					packageManager: PkgManager.Npm,
					alias: "b2",
					version: "1.2.32",
				},
			],
		},
		{
			alias: "entry2",
			moduleTypes: [ModuleTypes.Commonjs],
			packageManagers: [
				{
					packageManager: PkgManager.Pnpm,
					alias: "c1",
					version: latestPnpm,
				},
				{
					packageManager: PkgManager.YarnV1,
					alias: "c2",
					version: latestYarn1,
				},
			],
		},
	]);

	expect(mockPreinstallLatest).toHaveBeenCalledTimes(3);
	expect(mockPreinstallLatest).toHaveBeenCalledWith(
		testTempDir,
		PkgManager.Pnpm,
		logger,
	);
	expect(mockPreinstallLatest).toHaveBeenCalledWith(
		testTempDir,
		PkgManager.YarnV1,
		logger,
	);
	expect(mockPreinstallLatest).toHaveBeenCalledWith(
		testTempDir,
		PkgManager.YarnBerry,
		logger,
	);
	expect(mockMkdtemp).toHaveBeenCalledTimes(3);
	expect(mockMkdtemp).toHaveBeenCalledWith(join("someDir", `${LIBRARY_NAME}-`));
	expect(mockRm).toHaveBeenCalledTimes(3);
	expect(mockRm).toHaveBeenCalledWith(testTempDir, {
		force: true,
		recursive: true,
	});
});
