import { tmpdir } from "os";
import { resolve } from "path";
import { getTempDir } from "./getTempDir";

jest.mock("os");

const mockTmpdir = jest.mocked(tmpdir);

const testTempDir = "some/tempdir";

beforeEach(() => {
	jest.resetAllMocks();
	mockTmpdir.mockReturnValue(testTempDir);
	process.env.PKG_TEST_TEMP_DIR = "";
});

it("overrides with absolute PKG_TEST_TEMP_DIR", () => {
	const full = resolve(process.cwd(), "someDir");
	process.env.PKG_TEST_TEMP_DIR = full;

	expect(getTempDir()).toEqual(full);
});

it("overrides with relative PKG_TEST_TEMP_DIR", () => {
	const full = resolve(process.cwd(), "someDir2");
	process.env.PKG_TEST_TEMP_DIR = "someDir2";

	expect(getTempDir()).toEqual(full);
});

it("falls back to os tmpdir", () => {
	expect(getTempDir()).toEqual(testTempDir);
});
