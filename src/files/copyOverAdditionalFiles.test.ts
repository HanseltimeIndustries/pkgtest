import { statSync } from "fs";
import { cp } from "fs/promises";
import { copyOverAdditionalFiles } from "./copyOverAdditionalFiles";
import { join, resolve } from "path";

jest.mock("fs");
jest.mock("fs/promises");

const mockCp = jest.mocked(cp);
const mockStatSync = jest.mocked(statSync);

beforeEach(() => {
	jest.resetAllMocks();
});

it("applies the correct copy overs", async () => {
	mockStatSync.mockImplementation((file) => {
		if (file === "dir1" || file === "dir2") {
			return {
				isDirectory() {
					return true;
				},
			} as any;
		}
		return {
			isDirectory() {
				return false;
			},
		} as any;
	});
	await copyOverAdditionalFiles(
		[
			{
				files: ["f1.txt", "f2.txt", "dir1"],
				toDir: "something",
			},
			{
				files: ["f3.txt", "dir2"],
				toDir: join("something", "else"),
			},
		],
		"testProjectDir",
	);

	expect(mockCp).toHaveBeenCalledWith(
		"f1.txt",
		resolve("testProjectDir", "something"),
	);
	expect(mockCp).toHaveBeenCalledWith(
		"f2.txt",
		resolve("testProjectDir", "something"),
	);
	expect(mockCp).toHaveBeenCalledWith(
		"dir1",
		resolve("testProjectDir", "something"),
		{
			recursive: true,
		},
	);
	expect(mockCp).toHaveBeenCalledWith(
		"f3.txt",
		resolve("testProjectDir", "something", "else"),
	);
	expect(mockCp).toHaveBeenCalledWith(
		"dir2",
		resolve("testProjectDir", "something", "else"),
		{
			recursive: true,
		},
	);
});

it("throws an error if the toDir path is absolute", async () => {
	mockStatSync.mockImplementation((file) => {
		if (file === "dir1" || file === "dir2") {
			return {
				isDirectory() {
					return true;
				},
			} as any;
		}
		return {
			isDirectory() {
				return false;
			},
		} as any;
	});
	await expect(
		copyOverAdditionalFiles(
			[
				{
					files: ["f1.txt", "f2.txt", "dir1"],
					toDir: "/something",
				},
				{
					files: ["f3.txt", "dir2"],
					toDir: join("something", "else"),
				},
			],
			"testProjectDir",
		),
	).rejects.toThrow(
		`Supplied a non-relative path for copying additional files: /something`,
	);
});
