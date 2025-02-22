import { writeFile } from "fs/promises";
import { sanitizeEnv } from "./sanitizeEnv";
import { Logger } from "../Logger";
import { preinstallLatest } from "./preinstallLatest";
import { PkgManager } from "../types";
import { exec, ExecException } from "child_process";
import { join } from "path";

jest.mock("fs/promises");
jest.mock("child_process");

const mockWriteFile = jest.mocked(writeFile);
const mockExec = jest.mocked(exec);

beforeEach(() => {
	jest.resetAllMocks();
});

it("performs the correct commands", async () => {
	mockExec.mockImplementation(
		(
			_cmd: string,
			_options: any,
			cb:
				| ((
						e: ExecException | null,
						stdout: string | Buffer,
						stderr: string | Buffer,
				  ) => void)
				| undefined,
		) => {
			cb?.(null, "someVersion", "");
			return undefined as any;
		},
	);

	await preinstallLatest(
		"someTempDir",
		PkgManager.YarnBerry,
		new Logger({
			context: "something",
			debug: false,
		}),
	);

	expect(mockExec).toHaveBeenCalledWith(
		`corepack yarn@latest --version`,
		{
			cwd: "someTempDir",
			env: sanitizeEnv(join("someTempDir", "package.json")),
		},
		expect.anything(),
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
