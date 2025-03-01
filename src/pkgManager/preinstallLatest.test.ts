import { writeFile } from "fs/promises";
import { sanitizeEnv } from "./sanitizeEnv";
import { ILogFilesScanner, Logger } from "../logging";
import { preinstallLatest } from "./preinstallLatest";
import { PkgManager } from "../types";
import { join } from "path";
import { controlledExec } from "../controlledExec";

jest.mock("fs/promises");
jest.mock("../controlledExec");

const mockWriteFile = jest.mocked(writeFile);
const mockControlledExec = jest.mocked(controlledExec);

const mockLogFilesScanner: ILogFilesScanner = {
	scanOnly: jest.fn(),
	collectLogFiles: jest.fn(),
	createNested: jest.fn(),
};

beforeEach(() => {
	jest.resetAllMocks();
});

it("performs the correct commands", async () => {
	mockControlledExec.mockResolvedValue("someVersion");
	const logger = new Logger({
		context: "something",
		debug: false,
	});
	await preinstallLatest(
		"someTempDir",
		PkgManager.YarnBerry,
		logger,
		mockLogFilesScanner,
	);

	expect(mockControlledExec).toHaveBeenCalledWith(
		`corepack yarn@latest --version`,
		{
			cwd: "someTempDir",
			env: sanitizeEnv(join("someTempDir", "package.json")),
		},
		logger,
		mockLogFilesScanner,
		{
			onlyReturnStdOut: true,
		},
	);
	expect(mockWriteFile).toHaveBeenCalledWith(
		join("someTempDir", "package.json"),
		JSON.stringify(
			{
				name: "dummy-preinstall",
			},
			undefined,
			4,
		),
	);
});
