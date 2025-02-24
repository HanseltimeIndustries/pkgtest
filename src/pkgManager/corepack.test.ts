import { execSync } from "child_process";
import { ensureMinimumCorepack, MIN_COREPACK } from "./corepack";
import { LIBRARY_NAME } from "../config";

jest.mock("child_process");

const mockExecSync = jest.mocked(execSync);

beforeEach(() => {
	jest.resetAllMocks();
});

it(`throws an error if the version is not ${MIN_COREPACK}`, () => {
	mockExecSync.mockReturnValue("0.29.0");

	expect(() =>
		ensureMinimumCorepack({
			cwd: "someTestPkg",
		}),
	).toThrow(
		`${LIBRARY_NAME} requires corepack version on the shell of: ${MIN_COREPACK}!  Found 0.29.0.  Please upgrade it via 'npm install -g corepack@${MIN_COREPACK}`,
	);

	expect(mockExecSync).toHaveBeenCalledWith("corepack --version", {
		cwd: "someTestPkg",
		env: process.env,
	});
});

it(`accepts minimum version ${MIN_COREPACK}`, () => {
	mockExecSync.mockReturnValue("0.31.0");

	ensureMinimumCorepack({
		cwd: process.cwd(),
	});
});

it(`accepts greater version ${MIN_COREPACK}`, () => {
	mockExecSync.mockReturnValue("0.32.1");

	ensureMinimumCorepack({
		cwd: process.cwd(),
	});
});
